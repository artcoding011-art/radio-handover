'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  ARCHIVE_MAX_FILE_BYTES,
  ArchiveAttachment,
  ArchivePost,
  GITHUB_MAX_FILE_BYTES,
  SUPABASE_ARCHIVE_BUCKET,
} from '@/lib/archiveTypes'
import { normalizeVisualHtml, sourceToEditableHtml } from '@/lib/archiveHtml'
import ArchiveStorageBar, { ClientStorageUsage } from './ArchiveStorageBar'
import HtmlFormatToolbar from './HtmlFormatToolbar'

interface ArchiveEditorProps {
  initialPost?: ArchivePost | null
  defaultAuthor: string
  storageUsage?: ClientStorageUsage | null
  onStorageChanged?: () => void
  onCancel: () => void
  onSaved: (savedPost: ArchivePost) => void
}

function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (!url || !key) {
    throw new Error('대용량 파일 저장소(Supabase) 환경변수가 설정되지 않았습니다.')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function generateDraftPostId(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = Math.random().toString(16).slice(2, 8)
  return `${y}${m}${d}-${rand}`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size <= 3.5 * 1024 * 1024) {
    return file
  }

  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const maxDim = 1920
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(file)
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file)
            return
          }
          const newName = file.name.replace(/\.[^.]+$/, '.jpg')
          resolve(new File([blob], newName, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        0.85
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(file)
    }
    img.src = objectUrl
  })
}

export default function ArchiveEditor({
  initialPost,
  defaultAuthor,
  storageUsage = null,
  onStorageChanged,
  onCancel,
  onSaved,
}: ArchiveEditorProps) {
  const isEdit = Boolean(initialPost)
  const postId = useMemo(() => initialPost?.id || generateDraftPostId(), [initialPost])

  const [title, setTitle] = useState(initialPost?.title || '')
  const [author, setAuthor] = useState(initialPost?.author || defaultAuthor)
  const [isNotice, setIsNotice] = useState(initialPost?.isNotice || false)
  const [content, setContent] = useState(initialPost?.content || '')
  const [attachments, setAttachments] = useState<ArchiveAttachment[]>(initialPost?.attachments || [])
  const [images, setImages] = useState<ArchiveAttachment[]>(initialPost?.images || [])

  // 옵시디언 스타일 2-모드: 기본값은 서식이 적용된 상태로 쓰는 '작성(visual)' 모드
  const [editorMode, setEditorMode] = useState<'visual' | 'source'>('visual')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadingStatusText, setUploadingStatusText] = useState<string | null>(null)
  const [largeFileNotice, setLargeFileNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isDraggingEditor, setIsDraggingEditor] = useState(false)
  const [isDraggingFileBox, setIsDraggingFileBox] = useState(false)

  const sessionGithubPathsRef = useRef<string[]>([])
  const sessionSupabasePathsRef = useRef<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const visualEditorRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 비주얼 모드에서 실제 편집이 발생했는지 여부 (단순 열람 후 원본 보기 시 기존 마크다운 보존)
  const visualDirtyRef = useRef(false)
  // 비주얼 모드 실행 취소(Ctrl+Z) / 다시 실행(Ctrl+Y) 히스토리
  const visualHistoryRef = useRef<string[]>([''])
  const visualHistoryIdxRef = useRef<number>(0)
  const visualLastTypingRef = useRef<number>(0)
  const visualLastGroupedRef = useRef<boolean>(false)

  // 원본 보기 모드 실행 취소(Ctrl+Z) / 다시 실행(Ctrl+Y) 히스토리
  const sourceHistoryRef = useRef<Array<{ value: string; start: number; end: number }>>([
    { value: initialPost?.content || '', start: 0, end: 0 },
  ])
  const sourceHistoryIdxRef = useRef<number>(0)
  const sourceLastTypingRef = useRef<number>(0)
  const sourceLastGroupedRef = useRef<boolean>(false)

  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const syncHistoryFlags = (mode: 'visual' | 'source' = editorMode) => {
    if (mode === 'visual') {
      setCanUndo(visualHistoryIdxRef.current > 0)
      setCanRedo(visualHistoryIdxRef.current < visualHistoryRef.current.length - 1)
    } else {
      setCanUndo(sourceHistoryIdxRef.current > 0)
      setCanRedo(sourceHistoryIdxRef.current < sourceHistoryRef.current.length - 1)
    }
  }

  // 비주얼 모드 진입(초기 마운트 및 원본보기 -> 작성 전환) 시 HTML 렌더링 주입
  useEffect(() => {
    if (editorMode !== 'visual') {
      syncHistoryFlags('source')
      return
    }
    const el = visualEditorRef.current
    if (!el) return

    const html = sourceToEditableHtml(content)
    el.innerHTML = html
    visualDirtyRef.current = false
    visualHistoryRef.current = [html]
    visualHistoryIdxRef.current = 0
    visualLastGroupedRef.current = false
    syncHistoryFlags('visual')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorMode])

  // ── 비주얼(작성) 모드 히스토리 & 동기화 ──
  const recordVisualSnapshot = (immediate = false) => {
    const el = visualEditorRef.current
    if (!el) return
    const rawHtml = el.innerHTML
    const stack = visualHistoryRef.current
    const idx = visualHistoryIdxRef.current
    const current = stack[idx]

    visualDirtyRef.current = true
    const normalized = normalizeVisualHtml(rawHtml)
    setContent(normalized)

    if (current === rawHtml) return

    const now = Date.now()
    if (idx < stack.length - 1) {
      stack.splice(idx + 1)
    }

    const lengthDiff = Math.abs(rawHtml.length - (current?.length ?? 0))
    const isSmallTyping =
      !immediate &&
      visualLastGroupedRef.current &&
      now - visualLastTypingRef.current < 450 &&
      lengthDiff <= 4

    if (isSmallTyping && visualHistoryIdxRef.current > 0) {
      stack[visualHistoryIdxRef.current] = rawHtml
    } else {
      stack.push(rawHtml)
      if (stack.length > 100) stack.shift()
      visualHistoryIdxRef.current = stack.length - 1
    }

    visualLastTypingRef.current = now
    visualLastGroupedRef.current = !immediate
    syncHistoryFlags('visual')
  }

  const placeCaretAtEnd = (el: HTMLElement) => {
    try {
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    } catch {
      // 무시
    }
  }

  const handleVisualUndo = () => {
    if (visualHistoryIdxRef.current <= 0) return
    visualHistoryIdxRef.current -= 1
    const html = visualHistoryRef.current[visualHistoryIdxRef.current]
    const el = visualEditorRef.current
    if (el) {
      el.innerHTML = html
      el.focus()
      placeCaretAtEnd(el)
    }
    visualLastGroupedRef.current = false
    visualDirtyRef.current = true
    setContent(normalizeVisualHtml(html))
    syncHistoryFlags('visual')
  }

  const handleVisualRedo = () => {
    if (visualHistoryIdxRef.current >= visualHistoryRef.current.length - 1) return
    visualHistoryIdxRef.current += 1
    const html = visualHistoryRef.current[visualHistoryIdxRef.current]
    const el = visualEditorRef.current
    if (el) {
      el.innerHTML = html
      el.focus()
      placeCaretAtEnd(el)
    }
    visualLastGroupedRef.current = false
    visualDirtyRef.current = true
    setContent(normalizeVisualHtml(html))
    syncHistoryFlags('visual')
  }

  // ── 원본 보기(source) 모드 히스토리 ──
  const updateSourceWithHistory = (
    nextValue: string,
    nextStart?: number,
    nextEnd?: number,
    immediate = false
  ) => {
    const stack = sourceHistoryRef.current
    const idx = sourceHistoryIdxRef.current
    const current = stack[idx]

    if (current && current.value === nextValue) {
      setContent(nextValue)
      return
    }

    const start = nextStart ?? nextValue.length
    const end = nextEnd ?? start
    const now = Date.now()
    const lengthDiff = Math.abs(nextValue.length - (current?.value.length ?? 0))

    if (idx < stack.length - 1) {
      stack.splice(idx + 1)
    }

    const isSmallTyping =
      !immediate &&
      sourceLastGroupedRef.current &&
      now - sourceLastTypingRef.current < 450 &&
      lengthDiff <= 2 &&
      !nextValue.endsWith('\n')

    if (isSmallTyping && sourceHistoryIdxRef.current > 0) {
      stack[sourceHistoryIdxRef.current] = { value: nextValue, start, end }
    } else {
      stack.push({ value: nextValue, start, end })
      if (stack.length > 100) stack.shift()
      sourceHistoryIdxRef.current = stack.length - 1
    }

    sourceLastTypingRef.current = now
    sourceLastGroupedRef.current = !immediate
    setContent(nextValue)
    syncHistoryFlags('source')
  }

  const handleSourceUndo = () => {
    if (sourceHistoryIdxRef.current <= 0) return
    sourceHistoryIdxRef.current -= 1
    const snap = sourceHistoryRef.current[sourceHistoryIdxRef.current]
    sourceLastGroupedRef.current = false
    setContent(snap.value)
    syncHistoryFlags('source')
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      const posStart = Math.min(snap.start, snap.value.length)
      const posEnd = Math.min(snap.end, snap.value.length)
      el.setSelectionRange(posStart, posEnd)
    })
  }

  const handleSourceRedo = () => {
    if (sourceHistoryIdxRef.current >= sourceHistoryRef.current.length - 1) return
    sourceHistoryIdxRef.current += 1
    const snap = sourceHistoryRef.current[sourceHistoryIdxRef.current]
    sourceLastGroupedRef.current = false
    setContent(snap.value)
    syncHistoryFlags('source')
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      const posStart = Math.min(snap.start, snap.value.length)
      const posEnd = Math.min(snap.end, snap.value.length)
      el.setSelectionRange(posStart, posEnd)
    })
  }

  const handleUndo = () => {
    if (editorMode === 'visual') handleVisualUndo()
    else handleSourceUndo()
  }

  const handleRedo = () => {
    if (editorMode === 'visual') handleVisualRedo()
    else handleSourceRedo()
  }

  // ── 모드 전환 (작성 <-> 원본 보기) ──
  const handleSwitchMode = (targetMode: 'visual' | 'source') => {
    if (targetMode === editorMode) return

    if (targetMode === 'source') {
      let nextSource = content
      if (visualDirtyRef.current && visualEditorRef.current) {
        nextSource = normalizeVisualHtml(visualEditorRef.current.innerHTML)
        setContent(nextSource)
      }
      sourceHistoryRef.current = [{ value: nextSource, start: 0, end: 0 }]
      sourceHistoryIdxRef.current = 0
      sourceLastGroupedRef.current = false
      setEditorMode('source')
    } else {
      setEditorMode('visual')
    }
  }

  const insertImageIntoEditor = (uploadedImages: Array<{ alt: string; url: string }>) => {
    if (editorMode === 'visual') {
      const el = visualEditorRef.current
      if (!el) return
      el.focus()
      const sel = window.getSelection()
      const isInside =
        sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)
      if (!isInside) {
        placeCaretAtEnd(el)
      }
      const htmlSnippet = uploadedImages
        .map(
          ({ alt, url }) =>
            `<p><img src="${url}" alt="${alt.replace(/"/g, '&quot;')}" /></p>`
        )
        .join('')
      document.execCommand('insertHTML', false, `${htmlSnippet}<p><br /></p>`)
      recordVisualSnapshot(true)
      return
    }

    // source 모드
    const snippets = uploadedImages.map(({ alt, url }) => `![${alt}](${url})`).join('\n')
    const el = textareaRef.current
    if (!el) {
      const next = content ? `${content}\n${snippets}` : snippets
      updateSourceWithHistory(next, next.length, next.length, true)
      return
    }
    const start = el.selectionStart ?? content.length
    const end = el.selectionEnd ?? content.length
    const inserted = `\n${snippets}\n`
    const next = content.slice(0, start) + inserted + content.slice(end)
    const nextPos = start + inserted.length
    updateSourceWithHistory(next, nextPos, nextPos, true)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(nextPos, nextPos)
    })
  }

  const handleUploadInlineImages = async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith('image/') && !f.type.includes('svg'))
    if (imageFiles.length === 0) return

    setErrorMsg(null)
    setUploadingImage(true)
    try {
      const uploadedForInsert: Array<{ alt: string; url: string }> = []
      const newImages: ArchiveAttachment[] = []

      for (const rawFile of imageFiles) {
        const processed = await compressImageIfNeeded(rawFile)
        if (processed.size > GITHUB_MAX_FILE_BYTES) {
          throw new Error(
            `본문 이미지(${processed.name})가 압축 후에도 4MB를 초과합니다. 하단 첨부파일 영역에 대용량 파일로 올려주세요.`
          )
        }

        const formData = new FormData()
        formData.append('file', processed)
        formData.append('postId', postId)
        formData.append('kind', 'image')

        const res = await fetch('/api/archive/upload', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.message || '이미지 업로드에 실패했습니다.')
        }

        sessionGithubPathsRef.current.push(data.attachment.path)
        newImages.push(data.attachment)
        const safeAlt = (processed.name || 'image').replace(/[\[\]]/g, '')
        uploadedForInsert.push({ alt: safeAlt, url: data.url })
      }

      setImages((prev) => [...prev, ...newImages])
      insertImageIntoEditor(uploadedForInsert)
    } catch (err: any) {
      setErrorMsg(err?.message || '이미지 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploadingImage(false)
    }
  }

  const uploadLargeFileToSupabase = async (file: File): Promise<ArchiveAttachment> => {
    const supabase = getBrowserSupabase()
    const extMatch = file.name.match(/\.([a-zA-Z0-9]{1,10})$/)
    const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : ''
    const fileId = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
    const storagePath = `posts/${postId}/files/file_${fileId}${ext}`

    const { error } = await supabase.storage
      .from(SUPABASE_ARCHIVE_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (error) {
      if (
        error.message?.toLowerCase().includes('bucket') ||
        error.message?.toLowerCase().includes('not found')
      ) {
        throw new Error(
          `대용량 파일 저장소(${SUPABASE_ARCHIVE_BUCKET})가 아직 준비되지 않았습니다. Supabase에 '${SUPABASE_ARCHIVE_BUCKET}' 버킷을 생성해주세요.`
        )
      }
      throw new Error(`대용량 파일 업로드 실패 (${file.name}): ${error.message}`)
    }

    sessionSupabasePathsRef.current.push(storagePath)

    return {
      id: fileId,
      name: file.name,
      path: storagePath,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      isImage: false,
      uploadedAt: new Date().toISOString(),
      storage: 'supabase',
    }
  }

  const handleUploadAttachments = async (files: File[]) => {
    if (files.length === 0) return

    setErrorMsg(null)
    setLargeFileNotice(null)
    setUploadingFile(true)
    try {
      const uploaded: ArchiveAttachment[] = []
      const uploadedLargeNames: string[] = []

      for (const file of files) {
        if (file.size > ARCHIVE_MAX_FILE_BYTES) {
          throw new Error(
            `첨부파일(${file.name}, ${formatFileSize(file.size)})이 최대 용량 50MB를 초과합니다.`
          )
        }

        const isLargeFile = file.size > GITHUB_MAX_FILE_BYTES

        if (isLargeFile) {
          if (storageUsage?.available && file.size > storageUsage.remainingBytes) {
            throw new Error(
              `대용량 저장소 잔여 용량이 부족합니다. (필요: ${formatFileSize(
                file.size
              )}, 잔여: ${formatFileSize(storageUsage.remainingBytes)})`
            )
          }
          setUploadingStatusText(
            `대용량 파일 업로드 중... (${file.name}, ${formatFileSize(file.size)})`
          )
          const largeAttachment = await uploadLargeFileToSupabase(file)
          uploaded.push(largeAttachment)
          uploadedLargeNames.push(`${file.name} (${formatFileSize(file.size)})`)
        } else {
          setUploadingStatusText(`파일 업로드 중... (${file.name})`)
          const formData = new FormData()
          formData.append('file', file)
          formData.append('postId', postId)
          formData.append('kind', 'file')

          const res = await fetch('/api/archive/upload', {
            method: 'POST',
            body: formData,
          })
          const data = await res.json()
          if (!res.ok) {
            throw new Error(data.message || '첨부파일 업로드에 실패했습니다.')
          }

          sessionGithubPathsRef.current.push(data.attachment.path)
          uploaded.push({ ...data.attachment, storage: 'github' })
        }
      }

      setAttachments((prev) => [...prev, ...uploaded])

      if (uploadedLargeNames.length > 0) {
        setLargeFileNotice(
          `대용량 파일로 분류되어 업로드되었습니다: ${uploadedLargeNames.join(', ')}`
        )
        onStorageChanged?.()
      }
    } catch (err: any) {
      setErrorMsg(err?.message || '파일 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploadingFile(false)
      setUploadingStatusText(null)
    }
  }

  const handleRemoveAttachment = (attachment: ArchiveAttachment) => {
    setAttachments((prev) => prev.filter((item) => item.id !== attachment.id))
  }

  // ── 비주얼 모드 키보드 단축키 (Ctrl+Z, Ctrl+Y, Ctrl+B/I/U) ──
  const handleVisualKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return
    const key = e.key.toLowerCase()

    if (key === 'z' && !e.shiftKey) {
      e.preventDefault()
      handleVisualUndo()
      return
    }
    if ((key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey)) {
      e.preventDefault()
      handleVisualRedo()
      return
    }
    if (!e.shiftKey && ['b', 'i', 'u'].includes(key)) {
      e.preventDefault()
      const cmdMap: Record<string, string> = { b: 'bold', i: 'italic', u: 'underline' }
      try {
        document.execCommand('styleWithCSS', false, 'true')
      } catch {}
      document.execCommand(cmdMap[key], false)
      recordVisualSnapshot(true)
    }
  }

  // ── 원본 보기 모드 키보드 단축키 ──
  const handleSourceKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return
    const key = e.key.toLowerCase()

    if (key === 'z' && !e.shiftKey) {
      e.preventDefault()
      handleSourceUndo()
      return
    }
    if ((key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey)) {
      e.preventDefault()
      handleSourceRedo()
      return
    }

    if (e.shiftKey) return
    const tagMap: Record<string, { tag: string; placeholder: string }> = {
      b: { tag: 'strong', placeholder: '굵은 텍스트' },
      i: { tag: 'em', placeholder: '기울임 텍스트' },
      u: { tag: 'u', placeholder: '밑줄 텍스트' },
    }
    const target = tagMap[key]
    if (!target) return

    e.preventDefault()
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart ?? content.length
    const end = el.selectionEnd ?? content.length
    const selected = content.slice(start, end)
    const openTag = `<${target.tag}>`
    const closeTag = `</${target.tag}>`

    let nextContent = ''
    let nextSelStart = start
    let nextSelEnd = end

    if (selected.startsWith(openTag) && selected.endsWith(closeTag)) {
      const unwrapped = selected.slice(openTag.length, selected.length - closeTag.length)
      nextContent = content.slice(0, start) + unwrapped + content.slice(end)
      nextSelStart = start
      nextSelEnd = start + unwrapped.length
    } else if (
      start >= openTag.length &&
      content.slice(start - openTag.length, start) === openTag &&
      content.slice(end, end + closeTag.length) === closeTag
    ) {
      nextContent =
        content.slice(0, start - openTag.length) +
        selected +
        content.slice(end + closeTag.length)
      nextSelStart = start - openTag.length
      nextSelEnd = nextSelStart + selected.length
    } else {
      const inner = selected || target.placeholder
      nextContent = content.slice(0, start) + openTag + inner + closeTag + content.slice(end)
      nextSelStart = start + openTag.length
      nextSelEnd = nextSelStart + inner.length
    }

    updateSourceWithHistory(nextContent, nextSelStart, nextSelEnd, true)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(nextSelStart, nextSelEnd)
    })
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || [])
    const pastedImages = items
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((f): f is File => Boolean(f))

    if (pastedImages.length > 0) {
      e.preventDefault()
      await handleUploadInlineImages(pastedImages)
    }
  }

  const handleEditorDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingEditor(false)
    const dropped = Array.from(e.dataTransfer?.files || [])
    if (dropped.length === 0) return

    const imgs = dropped.filter((f) => f.type.startsWith('image/') && !f.type.includes('svg'))
    const others = dropped.filter((f) => !f.type.startsWith('image/') || f.type.includes('svg'))

    if (imgs.length > 0) {
      await handleUploadInlineImages(imgs)
    }
    if (others.length > 0) {
      await handleUploadAttachments(others)
    }
  }

  const handleCancelClick = async () => {
    if (
      sessionGithubPathsRef.current.length > 0 ||
      sessionSupabasePathsRef.current.length > 0
    ) {
      const githubPaths = [...sessionGithubPathsRef.current]
      const supabasePaths = [...sessionSupabasePathsRef.current]
      sessionGithubPathsRef.current = []
      sessionSupabasePathsRef.current = []
      fetch('/api/archive/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: githubPaths, supabasePaths }),
      }).catch(() => {})
    }
    onCancel()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setErrorMsg('제목을 입력해주세요.')
      return
    }
    if (uploadingImage || uploadingFile) {
      setErrorMsg('파일 업로드가 완료된 후 저장해주세요.')
      return
    }

    const finalContent =
      editorMode === 'visual' && visualDirtyRef.current && visualEditorRef.current
        ? normalizeVisualHtml(visualEditorRef.current.innerHTML)
        : content

    setErrorMsg(null)
    setSaving(true)
    try {
      const usedImages = images.filter((img) => finalContent.includes(img.path))

      const url = isEdit ? `/api/archive/${encodeURIComponent(postId)}` : '/api/archive'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: postId,
          title: title.trim(),
          author: author.trim() || defaultAuthor,
          isNotice,
          content: finalContent,
          attachments,
          images: usedImages,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || '저장에 실패했습니다.')
      }

      sessionGithubPathsRef.current = []
      sessionSupabasePathsRef.current = []
      onSaved(data.post)
    } catch (err: any) {
      setErrorMsg(err?.message || '게시글 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* 상단 바 */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-5 bg-blue-900 rounded-full" />
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? '게시글 수정' : '자료실 글쓰기'}
          </h2>
          <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
            Markdown · HTML 지원
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancelClick}
            disabled={saving}
            className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving || uploadingImage || uploadingFile}
            className="px-5 py-2 text-sm font-bold text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && (
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {saving ? '저장 중...' : isEdit ? '수정 완료' : '등록하기'}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {errorMsg && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {errorMsg}
          </div>
        )}

        {/* 제목 / 글쓴이 / 공지 고정 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-7">
            <label className="block text-xs font-bold text-gray-500 mb-1">제목 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="게시글 제목을 입력하세요"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
              required
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-gray-500 mb-1">글쓴이</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="작성자 이름"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
            />
          </div>

          <div className="md:col-span-2 flex items-end pt-4 md:pt-5">
            <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2.5 rounded-xl border border-gray-200 hover:bg-blue-50/50 transition w-full justify-center">
              <input
                type="checkbox"
                checked={isNotice}
                onChange={(e) => setIsNotice(e.target.checked)}
                className="w-4 h-4 accent-blue-900 rounded"
              />
              <span className="text-sm font-bold text-blue-900">공지 고정</span>
            </label>
          </div>
        </div>

        {/* 에디터 박스: 옵시디언 스타일 2-모드 (작성 <-> 원본 보기) */}
        <div className="border border-gray-200 rounded-2xl">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 rounded-t-2xl flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-white border border-gray-200 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => handleSwitchMode('visual')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-md transition ${
                  editorMode === 'visual'
                    ? 'bg-blue-900 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                작성
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode('source')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-md transition ${
                  editorMode === 'source'
                    ? 'bg-blue-900 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                원본 보기
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 hidden sm:inline">
                {editorMode === 'visual'
                  ? '글자를 드래그해 서식 적용 · 이미지 붙여넣기(Ctrl+V) 지원'
                  : 'HTML / Markdown 원본 코드 직접 편집 모드'}
              </span>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  e.target.value = ''
                  if (files.length > 0) handleUploadInlineImages(files)
                }}
              />
              <button
                type="button"
                disabled={uploadingImage}
                onClick={() => imageInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {uploadingImage ? '이미지 업로드 중...' : '본문 이미지 삽입'}
              </button>
            </div>
          </div>

          {/* HTML 서식 아이콘 툴바 (작성 & 원본 보기 양쪽 모드 완벽 지원) */}
          <HtmlFormatToolbar
            mode={editorMode}
            textareaRef={textareaRef}
            visualEditorRef={visualEditorRef}
            content={content}
            onSourceChange={(next, selStart, selEnd) =>
              updateSourceWithHistory(next, selStart, selEnd, true)
            }
            onVisualSync={() => recordVisualSnapshot(true)}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
          />

          {/* 본문 편집 영역 */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDraggingEditor(true)
            }}
            onDragLeave={() => setIsDraggingEditor(false)}
            onDrop={handleEditorDrop}
            className={`relative rounded-b-2xl overflow-hidden transition ${
              isDraggingEditor ? 'bg-blue-50/70 ring-2 ring-inset ring-blue-500' : 'bg-white'
            }`}
          >
            {editorMode === 'visual' ? (
              <div
                ref={visualEditorRef}
                contentEditable
                suppressContentEditableWarning
                data-placeholder={`여기에 내용을 작성하세요.\n\n• 글자를 드래그한 뒤 상단 아이콘(B, I, U, 색상, 크기, 정렬 등)으로 바로 서식을 적용할 수 있습니다.\n• 단축키: Ctrl+Z (실행취소), Ctrl+Y (다시실행), Ctrl+B (굵게), Ctrl+I (기울임), Ctrl+U (밑줄)\n• 이미지는 Ctrl+V로 붙여넣거나 끌어다 놓으면 본문에 바로 표시됩니다.\n• 코드를 직접 보고 수정하려면 상단 '원본 보기'를 클릭하세요.`}
                onInput={() => recordVisualSnapshot(false)}
                onKeyDown={handleVisualKeyDown}
                onPaste={handlePaste}
                className="archive-visual-editor w-full min-h-[420px] max-h-[650px] overflow-y-auto p-6"
              />
            ) : (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) =>
                  updateSourceWithHistory(
                    e.target.value,
                    e.target.selectionStart,
                    e.target.selectionEnd,
                    false
                  )
                }
                onKeyDown={handleSourceKeyDown}
                onPaste={handlePaste}
                rows={18}
                placeholder={`HTML 또는 마크다운(Markdown) 원본 코드를 직접 편집할 수 있습니다.\n'작성' 탭을 누르면 코드가 적용된 화면으로 바로 전환됩니다.`}
                className="w-full min-h-[420px] max-h-[650px] p-5 text-sm font-mono leading-relaxed text-gray-800 focus:outline-none resize-y bg-gray-50/40"
              />
            )}

            {isDraggingEditor && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-blue-900/10">
                <div className="bg-white px-4 py-2 rounded-xl shadow-md border border-blue-200 text-blue-900 text-sm font-bold">
                  여기에 놓으면 이미지(본문) / 파일(첨부)이 업로드됩니다
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 일반 & 대용량 첨부파일 영역 */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDraggingFileBox(true)
          }}
          onDragLeave={() => setIsDraggingFileBox(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDraggingFileBox(false)
            const files = Array.from(e.dataTransfer?.files || [])
            if (files.length > 0) handleUploadAttachments(files)
          }}
          className={`rounded-2xl border-2 border-dashed p-4 transition ${
            isDraggingFileBox
              ? 'border-blue-600 bg-blue-50/70'
              : 'border-gray-200 bg-gray-50/50'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <svg className="w-4 h-4 text-blue-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="text-sm font-bold text-gray-800">
                첨부파일 ({attachments.length})
              </span>
              <span className="text-xs text-gray-500">
                파일당 최대 <strong className="text-blue-900">50MB</strong> (4MB 초과는{' '}
                <span className="text-amber-700 font-bold">대용량 파일</span>로 자동 저장)
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                e.target.value = ''
                if (files.length > 0) handleUploadAttachments(files)
              }}
            />
            <button
              type="button"
              disabled={uploadingFile}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition disabled:opacity-50"
            >
              {uploadingFile ? '업로드 중...' : '+ 파일 첨부'}
            </button>
          </div>

          <ArchiveStorageBar usage={storageUsage} />

          {uploadingStatusText && (
            <div className="mb-3 px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-blue-900/25 border-t-blue-900 rounded-full animate-spin flex-shrink-0" />
              <span>{uploadingStatusText}</span>
            </div>
          )}

          {largeFileNotice && (
            <div className="mb-3 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-between gap-2">
              <span>📦 {largeFileNotice}</span>
              <button
                type="button"
                onClick={() => setLargeFileNotice(null)}
                className="text-amber-600 hover:text-amber-900 px-1"
              >
                ✕
              </button>
            </div>
          )}

          {attachments.length === 0 ? (
            <p className="text-xs text-gray-400 py-2 text-center">
              첨부된 파일이 없습니다. 파일을 끌어다 놓거나 &apos;+ 파일 첨부&apos; 버튼을 눌러 추가하세요.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {attachments.map((file) => {
                const isLarge = file.storage === 'supabase' || file.size > GITHUB_MAX_FILE_BYTES
                return (
                  <li
                    key={file.id}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-100 uppercase flex-shrink-0">
                        {file.name.split('.').pop()?.slice(0, 6) || 'FILE'}
                      </span>
                      {isLarge && (
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 flex-shrink-0">
                          대용량 파일
                        </span>
                      )}
                      <span className="truncate font-medium text-gray-800">{file.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        ({formatFileSize(file.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(file)}
                      className="ml-3 text-xs font-bold text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition flex-shrink-0"
                    >
                      삭제
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </form>
  )
}
