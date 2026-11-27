import crypto from 'crypto'
import { ArchiveAttachment, ArchiveIndex, ArchivePost, ArchivePostSummary } from './archiveTypes'
import { deleteSupabaseArchiveFiles } from './supabaseArchive'

const GITHUB_API_BASE = 'https://api.github.com'

interface GitHubConfig {
  token: string
  owner: string
  repo: string
  branch: string
}

function getGitHubConfig(): GitHubConfig {
  const token = process.env.GITHUB_TOKEN?.trim()
  const owner = process.env.GITHUB_OWNER?.trim()
  const repo = process.env.GITHUB_REPO?.trim()
  const branch = process.env.GITHUB_ARCHIVE_BRANCH?.trim() || 'archive-data'

  if (!token || !owner || !repo) {
    throw new Error(
      'GitHub 자료실 환경변수가 설정되지 않았습니다. (.env.local의 GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO 확인)'
    )
  }

  return { token, owner, repo, branch }
}

function encodeGitHubPath(filePath: string): string {
  return filePath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

export function validateArchiveFilePath(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false
  if (!filePath.startsWith('posts/')) return false
  if (filePath.includes('..') || filePath.includes('\\') || filePath.includes('\0')) return false
  return /^[a-zA-Z0-9/_\-.]+$/.test(filePath)
}

export function validatePostId(postId: string): boolean {
  return /^[a-zA-Z0-9_-]{6,64}$/.test(postId)
}

async function githubRequest(
  endpoint: string,
  options: RequestInit = {},
  extraHeaders: Record<string, string> = {}
): Promise<Response> {
  const { token } = getGitHubConfig()
  return fetch(`${GITHUB_API_BASE}${endpoint}`, {
    ...options,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...extraHeaders,
      ...(options.headers as Record<string, string> | undefined),
    },
  })
}

interface ArchiveServerCache {
  branchInitialized: boolean
  indexCache: { data: ArchiveIndex; fetchedAt: number } | null
  postCache: Map<string, { data: ArchivePost; fetchedAt: number }>
  inflightPosts: Map<string, Promise<ArchivePost | null>>
}

const globalForArchive = globalThis as unknown as { __radioArchiveCache?: ArchiveServerCache }
const serverCache: ArchiveServerCache =
  globalForArchive.__radioArchiveCache ??
  (globalForArchive.__radioArchiveCache = {
    branchInitialized: false,
    indexCache: null,
    postCache: new Map(),
    inflightPosts: new Map(),
  })

/**
 * archive-data 전용 orphan 브랜치가 없으면 자동으로 생성하고 초기 index.json을 커밋합니다.
 */
export async function ensureArchiveBranch(): Promise<void> {
  if (serverCache.branchInitialized) return

  const { owner, repo, branch } = getGitHubConfig()
  const refRes = await githubRequest(
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`
  )

  if (refRes.ok) {
    serverCache.branchInitialized = true
    return
  }

  if (refRes.status !== 404) {
    const errText = await refRes.text()
    throw new Error(`GitHub 브랜치 확인 실패 (${refRes.status}): ${errText}`)
  }

  // 1) 초기 index.json 블롭 생성
  const initialIndex: ArchiveIndex = { lastNo: 0, posts: [] }
  const blobRes = await githubRequest(`/repos/${owner}/${repo}/git/blobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: JSON.stringify(initialIndex, null, 2),
      encoding: 'utf-8',
    }),
  })
  if (!blobRes.ok) {
    throw new Error(`초기 블롭 생성 실패: ${await blobRes.text()}`)
  }
  const blobData = await blobRes.json()

  // 2) 독립(orphan) 루트 트리 생성
  const treeRes = await githubRequest(`/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tree: [
        {
          path: 'index.json',
          mode: '100644',
          type: 'blob',
          sha: blobData.sha,
        },
      ],
    }),
  })
  if (!treeRes.ok) {
    throw new Error(`초기 트리 생성 실패: ${await treeRes.text()}`)
  }
  const treeData = await treeRes.json()

  // 3) 부모 커밋이 없는 orphan 커밋 생성
  const commitRes = await githubRequest(`/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'chore(archive): initialize archive-data branch',
      tree: treeData.sha,
      parents: [],
    }),
  })
  if (!commitRes.ok) {
    throw new Error(`초기 커밋 생성 실패: ${await commitRes.text()}`)
  }
  const commitData = await commitRes.json()

  // 4) 브랜치 ref 생성
  const createRefRes = await githubRequest(`/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha: commitData.sha,
    }),
  })

  // 동시에 생성되어 422가 나더라도 이미 존재하므로 통과
  if (!createRefRes.ok && createRefRes.status !== 422) {
    throw new Error(`브랜치 생성 실패: ${await createRefRes.text()}`)
  }

  serverCache.branchInitialized = true
}

interface ContentFileResult {
  content: string
  sha: string
}

async function getTextFile(filePath: string): Promise<ContentFileResult | null> {
  await ensureArchiveBranch()
  const { owner, repo, branch } = getGitHubConfig()
  const encodedPath = encodeGitHubPath(filePath)
  const res = await githubRequest(
    `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`
  )

  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`GitHub 파일 조회 실패 (${filePath}, ${res.status}): ${await res.text()}`)
  }

  const data = await res.json()
  if (data.content) {
    const decoded = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
    return { content: decoded, sha: data.sha }
  }

  // 1MB 초과 텍스트 파일 폴백 (Git Blob API)
  const blobRes = await githubRequest(`/repos/${owner}/${repo}/git/blobs/${data.sha}`)
  if (!blobRes.ok) {
    throw new Error(`GitHub Blob 조회 실패 (${filePath}): ${await blobRes.text()}`)
  }
  const blobData = await blobRes.json()
  const decoded = Buffer.from(blobData.content.replace(/\n/g, ''), 'base64').toString('utf-8')
  return { content: decoded, sha: data.sha }
}

async function putFile(
  filePath: string,
  contentBuffer: Buffer,
  message: string,
  knownSha?: string
): Promise<{ sha: string }> {
  await ensureArchiveBranch()
  const { owner, repo, branch } = getGitHubConfig()
  const encodedPath = encodeGitHubPath(filePath)

  let sha = knownSha
  if (sha === undefined) {
    const existingRes = await githubRequest(
      `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`
    )
    if (existingRes.ok) {
      const existingData = await existingRes.json()
      sha = existingData.sha
    }
  }

  const body: Record<string, string> = {
    message,
    content: contentBuffer.toString('base64'),
    branch,
  }
  if (sha) {
    body.sha = sha
  }

  const res = await githubRequest(`/repos/${owner}/${repo}/contents/${encodedPath}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    const error = new Error(`GitHub 파일 저장 실패 (${filePath}, ${res.status}): ${text}`) as Error & {
      status?: number
    }
    error.status = res.status
    throw error
  }

  const result = await res.json()
  return { sha: result.content?.sha || '' }
}

export async function deleteArchiveFile(filePath: string, message?: string): Promise<void> {
  await ensureArchiveBranch()
  const { owner, repo, branch } = getGitHubConfig()
  const encodedPath = encodeGitHubPath(filePath)

  const existingRes = await githubRequest(
    `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`
  )
  if (existingRes.status === 404) return
  if (!existingRes.ok) {
    throw new Error(`삭제 대상 조회 실패 (${filePath}): ${await existingRes.text()}`)
  }
  const existing = await existingRes.json()
  if (Array.isArray(existing)) return

  const res = await githubRequest(`/repos/${owner}/${repo}/contents/${encodedPath}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message || `chore(archive): delete ${filePath}`,
      sha: existing.sha,
      branch,
    }),
  })

  if (!res.ok && res.status !== 404) {
    throw new Error(`GitHub 파일 삭제 실패 (${filePath}): ${await res.text()}`)
  }
}

const INDEX_CACHE_TTL_MS = 60_000 // 60초
const POST_CACHE_TTL_MS = 300_000 // 5분 (작성/수정/삭제 시 즉시 갱신)

export async function getArchiveIndex(forceRefresh = false): Promise<ArchiveIndex> {
  if (
    !forceRefresh &&
    serverCache.indexCache &&
    Date.now() - serverCache.indexCache.fetchedAt < INDEX_CACHE_TTL_MS
  ) {
    return serverCache.indexCache.data
  }

  const file = await getTextFile('index.json')
  if (!file) {
    const empty: ArchiveIndex = { lastNo: 0, posts: [] }
    serverCache.indexCache = { data: empty, fetchedAt: Date.now() }
    return empty
  }
  try {
    const parsed = JSON.parse(file.content) as ArchiveIndex
    const normalized: ArchiveIndex = {
      lastNo: typeof parsed.lastNo === 'number' ? parsed.lastNo : 0,
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
    }
    serverCache.indexCache = { data: normalized, fetchedAt: Date.now() }
    return normalized
  } catch {
    return { lastNo: 0, posts: [] }
  }
}

async function updateArchiveIndex<T>(
  updater: (index: ArchiveIndex) => { nextIndex: ArchiveIndex; result: T },
  commitMessage: string
): Promise<T> {
  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const file = await getTextFile('index.json')
    const currentIndex: ArchiveIndex = file
      ? JSON.parse(file.content)
      : { lastNo: 0, posts: [] }

    const { nextIndex, result } = updater(currentIndex)
    const buffer = Buffer.from(JSON.stringify(nextIndex, null, 2), 'utf-8')

    try {
      await putFile('index.json', buffer, commitMessage, file?.sha)
      serverCache.indexCache = { data: nextIndex, fetchedAt: Date.now() }
      return result
    } catch (err: any) {
      if (err?.status === 409 && attempt < maxAttempts) {
        continue
      }
      throw err
    }
  }

  throw new Error('인덱스 업데이트 중 충돌이 발생했습니다. 잠시 후 다시 시도해주세요.')
}

export function sortArchivePosts(posts: ArchivePostSummary[]): ArchivePostSummary[] {
  return [...posts].sort((a, b) => {
    if (a.isNotice !== b.isNotice) return a.isNotice ? -1 : 1
    return b.no - a.no
  })
}

export async function getArchivePost(
  id: string,
  forceRefresh = false
): Promise<ArchivePost | null> {
  if (!validatePostId(id)) return null

  const cached = serverCache.postCache.get(id)
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < POST_CACHE_TTL_MS) {
    return cached.data
  }

  // 같은 글에 대한 동시 요청 합치기 (호버 + 클릭 중복 호출 방지)
  if (!forceRefresh) {
    const inflight = serverCache.inflightPosts.get(id)
    if (inflight) return inflight
  }

  const fetchPromise = (async (): Promise<ArchivePost | null> => {
    const [metaFile, mdFile] = await Promise.all([
      getTextFile(`posts/${id}/meta.json`),
      getTextFile(`posts/${id}/post.md`),
    ])

    if (!metaFile) {
      serverCache.postCache.delete(id)
      return null
    }

    const meta = JSON.parse(metaFile.content) as Omit<ArchivePost, 'content'>
    const post: ArchivePost = {
      ...meta,
      attachments: Array.isArray(meta.attachments) ? meta.attachments : [],
      images: Array.isArray(meta.images) ? meta.images : [],
      content: mdFile?.content ?? '',
    }
    serverCache.postCache.set(id, { data: post, fetchedAt: Date.now() })
    return post
  })().finally(() => {
    serverCache.inflightPosts.delete(id)
  })

  serverCache.inflightPosts.set(id, fetchPromise)
  return fetchPromise
}

export interface CreatePostInput {
  id?: string
  title: string
  author: string
  isNotice: boolean
  content: string
  attachments: ArchiveAttachment[]
  images: ArchiveAttachment[]
}

export async function createArchivePost(input: CreatePostInput): Promise<ArchivePost> {
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = crypto.randomBytes(3).toString('hex')
  const postId = input.id && validatePostId(input.id) ? input.id : `${datePart}-${randomPart}`
  const timestamp = now.toISOString()

  const summaryWithoutNo = {
    id: postId,
    title: input.title.trim(),
    author: input.author.trim() || '관리자',
    isNotice: Boolean(input.isNotice),
    createdAt: timestamp,
    updatedAt: timestamp,
    attachmentCount: input.attachments.length,
    hasImage:
      input.images.length > 0 ||
      /!\[[^\]]*\]\([^)]+\)|<img\s[^>]*src=/i.test(input.content),
    hasLargeFile: input.attachments.some((a) => a.storage === 'supabase'),
    attachmentNames: input.attachments.map((a) => a.name),
  }

  // index.json에서 번호 채번 후 등록
  const assignedSummary = await updateArchiveIndex(
    (index) => {
      const nextNo = (index.lastNo || 0) + 1
      const summary: ArchivePostSummary = { ...summaryWithoutNo, no: nextNo }
      const filtered = index.posts.filter((p) => p.id !== postId)
      return {
        nextIndex: {
          lastNo: nextNo,
          posts: sortArchivePosts([summary, ...filtered]),
        },
        result: summary,
      }
    },
    `feat(archive): create post #${postId} - ${summaryWithoutNo.title}`
  )

  const fullPost: ArchivePost = {
    ...assignedSummary,
    content: input.content,
    attachments: input.attachments,
    images: input.images,
  }

  const { content, ...metaOnly } = fullPost
  await putFile(
    `posts/${postId}/post.md`,
    Buffer.from(content, 'utf-8'),
    `feat(archive): save content for ${postId}`
  )
  await putFile(
    `posts/${postId}/meta.json`,
    Buffer.from(JSON.stringify(metaOnly, null, 2), 'utf-8'),
    `feat(archive): save metadata for ${postId}`
  )

  serverCache.postCache.set(postId, { data: fullPost, fetchedAt: Date.now() })
  return fullPost
}

export interface UpdatePostInput {
  title: string
  author: string
  isNotice: boolean
  content: string
  attachments: ArchiveAttachment[]
  images: ArchiveAttachment[]
}

export async function updateArchivePost(
  id: string,
  input: UpdatePostInput
): Promise<ArchivePost | null> {
  if (!validatePostId(id)) return null
  const existing = await getArchivePost(id)
  if (!existing) return null

  const updatedAt = new Date().toISOString()

  // 제거된 첨부파일 정리
  const nextPaths = new Set([
    ...input.attachments.map((a) => a.path),
    ...input.images.map((i) => i.path),
  ])
  const removedFiles = [...existing.attachments, ...existing.images].filter(
    (item) =>
      !nextPaths.has(item.path) &&
      !input.content.includes(item.path) &&
      validateArchiveFilePath(item.path)
  )

  const removedGithubFiles = removedFiles.filter((f) => f.storage !== 'supabase')
  const removedSupabasePaths = removedFiles
    .filter((f) => f.storage === 'supabase')
    .map((f) => f.path)

  for (const removed of removedGithubFiles) {
    try {
      await deleteArchiveFile(removed.path, `chore(archive): remove unused file ${removed.name}`)
    } catch (err) {
      console.warn('첨부파일 정리 중 경고:', err)
    }
  }
  if (removedSupabasePaths.length > 0) {
    await deleteSupabaseArchiveFiles(removedSupabasePaths)
  }

  const updatedSummary: ArchivePostSummary = {
    id: existing.id,
    no: existing.no,
    title: input.title.trim(),
    author: input.author.trim() || existing.author,
    isNotice: Boolean(input.isNotice),
    createdAt: existing.createdAt,
    updatedAt,
    attachmentCount: input.attachments.length,
    hasImage:
      input.images.length > 0 ||
      /!\[[^\]]*\]\([^)]+\)|<img\s[^>]*src=/i.test(input.content),
    hasLargeFile: input.attachments.some((a) => a.storage === 'supabase'),
    attachmentNames: input.attachments.map((a) => a.name),
  }

  const fullPost: ArchivePost = {
    ...updatedSummary,
    content: input.content,
    attachments: input.attachments,
    images: input.images,
  }

  const { content, ...metaOnly } = fullPost
  await putFile(
    `posts/${id}/post.md`,
    Buffer.from(content, 'utf-8'),
    `fix(archive): update content for #${existing.no}`
  )
  await putFile(
    `posts/${id}/meta.json`,
    Buffer.from(JSON.stringify(metaOnly, null, 2), 'utf-8'),
    `fix(archive): update metadata for #${existing.no}`
  )

  await updateArchiveIndex(
    (index) => {
      const updatedPosts = index.posts.map((p) => (p.id === id ? updatedSummary : p))
      const existsInIndex = index.posts.some((p) => p.id === id)
      return {
        nextIndex: {
          ...index,
          posts: sortArchivePosts(existsInIndex ? updatedPosts : [updatedSummary, ...updatedPosts]),
        },
        result: updatedSummary,
      }
    },
    `fix(archive): update index for #${existing.no}`
  )

  serverCache.postCache.set(id, { data: fullPost, fetchedAt: Date.now() })
  return fullPost
}

export async function deleteArchivePost(id: string): Promise<boolean> {
  if (!validatePostId(id)) return false
  await ensureArchiveBranch()
  const { owner, repo, branch } = getGitHubConfig()

  // 0) Supabase Storage에 저장된 대용량 파일 경로 먼저 확보
  let supabasePaths: string[] = []
  try {
    const existing = await getArchivePost(id)
    if (existing) {
      supabasePaths = [...existing.attachments, ...existing.images]
        .filter((f) => f.storage === 'supabase' && validateArchiveFilePath(f.path))
        .map((f) => f.path)
    }
  } catch (err) {
    console.warn('삭제 전 메타 조회 경고:', err)
  }

  // 1) index.json에서 먼저 제거
  await updateArchiveIndex(
    (index) => ({
      nextIndex: {
        ...index,
        posts: index.posts.filter((p) => p.id !== id),
      },
      result: true,
    }),
    `chore(archive): remove post ${id} from index`
  )

  // 2) Supabase Storage 대용량 파일 삭제 (무료 1GB 용량 즉시 반환)
  if (supabasePaths.length > 0) {
    await deleteSupabaseArchiveFiles(supabasePaths)
  }

  // 2) posts/{id}/files 디렉토리 내 모든 파일 삭제
  const filesDirRes = await githubRequest(
    `/repos/${owner}/${repo}/contents/${encodeGitHubPath(`posts/${id}/files`)}?ref=${encodeURIComponent(branch)}`
  )
  if (filesDirRes.ok) {
    const entries = await filesDirRes.json()
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        if (entry.type === 'file' && entry.path) {
          await deleteArchiveFile(entry.path, `chore(archive): delete file for post ${id}`)
        }
      }
    }
  }

  // 3) post.md, meta.json 삭제
  await deleteArchiveFile(`posts/${id}/post.md`, `chore(archive): delete post.md for ${id}`)
  await deleteArchiveFile(`posts/${id}/meta.json`, `chore(archive): delete meta.json for ${id}`)
  serverCache.postCache.delete(id)

  return true
}

export async function uploadArchiveFile(params: {
  postId: string
  originalName: string
  buffer: Buffer
  mimeType: string
  isImage: boolean
}): Promise<ArchiveAttachment> {
  const { postId, originalName, buffer, mimeType, isImage } = params
  if (!validatePostId(postId)) {
    throw new Error('유효하지 않은 게시글 ID입니다.')
  }

  const extMatch = originalName.match(/\.([a-zA-Z0-9]{1,10})$/)
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : isImage ? '.png' : ''
  const fileId = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
  const safeFileName = `${isImage ? 'img' : 'file'}_${fileId}${ext}`
  const filePath = `posts/${postId}/files/${safeFileName}`

  await putFile(
    filePath,
    buffer,
    `feat(archive): upload ${isImage ? 'image' : 'file'} ${originalName}`
  )

  return {
    id: fileId,
    name: originalName,
    path: filePath,
    size: buffer.length,
    mimeType: mimeType || 'application/octet-stream',
    isImage,
    uploadedAt: new Date().toISOString(),
    storage: 'github',
  }
}

export async function downloadArchiveFile(
  filePath: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!validateArchiveFilePath(filePath)) return null
  await ensureArchiveBranch()

  const { owner, repo, branch } = getGitHubConfig()
  const encodedPath = encodeGitHubPath(filePath)

  // Raw 바이너리 직접 조회 (최대 100MB 지원)
  const rawRes = await githubRequest(
    `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
    {},
    { Accept: 'application/vnd.github.raw+json' }
  )

  if (rawRes.status === 404) return null

  if (rawRes.ok) {
    const arrayBuffer = await rawRes.arrayBuffer()
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: rawRes.headers.get('content-type') || 'application/octet-stream',
    }
  }

  // 폴백: 메타데이터에서 sha 조회 후 Git Blob Raw 다운로드
  const metaRes = await githubRequest(
    `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`
  )
  if (!metaRes.ok) return null
  const meta = await metaRes.json()
  if (!meta.sha) return null

  const blobRes = await githubRequest(
    `/repos/${owner}/${repo}/git/blobs/${meta.sha}`,
    {},
    { Accept: 'application/vnd.github.raw' }
  )
  if (!blobRes.ok) return null

  const arrayBuffer = await blobRes.arrayBuffer()
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: 'application/octet-stream',
  }
}
