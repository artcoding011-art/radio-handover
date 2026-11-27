'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { ArchivePost, ArchivePostSummary } from '@/lib/archiveTypes'
import ArchiveDetail from './ArchiveDetail'
import ArchiveEditor from './ArchiveEditor'
import ArchiveStorageBar, { ClientStorageUsage } from './ArchiveStorageBar'

interface ArchiveTabProps {
  userId: string
  isReadonly?: boolean
  isActive?: boolean
}

const PAGE_SIZE = 15
const POSTS_STORAGE_KEY = 'radio_archive_posts_v1'
const POST_STORAGE_PREFIX = 'radio_archive_post_v1_'

function readSessionPosts(): ArchivePostSummary[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(POSTS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeSessionPosts(posts: ArchivePostSummary[]) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(posts))
  } catch {
    // sessionStorage 용량 초과 시 무시
  }
}

function readSessionPost(id: string): ArchivePost | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(`${POST_STORAGE_PREFIX}${id}`)
    if (!raw) return null
    return JSON.parse(raw) as ArchivePost
  } catch {
    return null
  }
}

function writeSessionPost(post: ArchivePost) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(`${POST_STORAGE_PREFIX}${post.id}`, JSON.stringify(post))
  } catch {
    // 무시
  }
}

function removeSessionPost(id: string) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(`${POST_STORAGE_PREFIX}${id}`)
  } catch {
    // 무시
  }
}

function clearSessionPostsCache() {
  if (typeof window === 'undefined') return
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i)
      if (k && k.startsWith(POST_STORAGE_PREFIX)) {
        keysToRemove.push(k)
      }
    }
    keysToRemove.forEach((k) => window.sessionStorage.removeItem(k))
  } catch {
    // 무시
  }
}

function formatListDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatFullDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function sortSummaries(list: ArchivePostSummary[]): ArchivePostSummary[] {
  return [...list].sort((a, b) => {
    if (a.isNotice !== b.isNotice) return a.isNotice ? -1 : 1
    return b.no - a.no
  })
}

export default function ArchiveTab({
  userId,
  isReadonly = false,
  isActive = true,
}: ArchiveTabProps) {
  const [view, setView] = useState<'list' | 'detail' | 'write' | 'edit'>('list')
  const [posts, setPosts] = useState<ArchivePostSummary[]>([])
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [refreshingList, setRefreshingList] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const [selectedPost, setSelectedPost] = useState<ArchivePost | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [storageUsage, setStorageUsage] = useState<ClientStorageUsage | null>(null)

  // 메모리 + 진행 중 Promise 중복 제거 캐시
  const postCacheRef = useRef<Map<string, ArchivePost>>(new Map())
  const inflightPromiseRef = useRef<Map<string, Promise<ArchivePost | null>>>(new Map())
  const didInitialFetchRef = useRef(false)

  // 마운트 직후 sessionStorage에서 즉시 복원 (F5 새로고침 시 0초 표시)
  useEffect(() => {
    const cachedList = readSessionPosts()
    if (cachedList) {
      setPosts(cachedList)
      setHasLoadedOnce(true)
    }
  }, [])

  const getCachedPost = useCallback((id: string): ArchivePost | null => {
    const mem = postCacheRef.current.get(id)
    if (mem) return mem
    const stored = readSessionPost(id)
    if (stored) {
      postCacheRef.current.set(id, stored)
      return stored
    }
    return null
  }, [])

  const setCachedPost = useCallback((post: ArchivePost) => {
    postCacheRef.current.set(post.id, post)
    writeSessionPost(post)
  }, [])

  const fetchStorageUsage = useCallback(async () => {
    try {
      const res = await fetch(`/api/archive/storage-usage?_t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!res.ok) return
      const data = await res.json()
      setStorageUsage(data)
    } catch {
      // 용량 조회 실패 시 목록 표시를 막지 않음
    }
  }, [])

  /**
   * 단건 게시글 조회 (진행 중 요청이 있으면 Promise 재사용하여 중복 요청 완전 방지)
   */
  const fetchPostDetail = useCallback(
    (id: string, forceRefresh = false): Promise<ArchivePost | null> => {
      if (!forceRefresh) {
        const inflight = inflightPromiseRef.current.get(id)
        if (inflight) return inflight
      }

      const qs = forceRefresh ? `refresh=1&_t=${Date.now()}` : ''
      const url = qs
        ? `/api/archive/${encodeURIComponent(id)}?${qs}`
        : `/api/archive/${encodeURIComponent(id)}`

      const promise = fetch(url, { cache: 'no-store' })
        .then(async (res) => {
          const data = await res.json()
          if (!res.ok) {
            throw new Error(data.message || '게시글을 불러오지 못했습니다.')
          }
          if (data?.post) {
            setCachedPost(data.post)
            return data.post as ArchivePost
          }
          return null
        })
        .finally(() => {
          inflightPromiseRef.current.delete(id)
        })

      inflightPromiseRef.current.set(id, promise)
      return promise
    },
    [setCachedPost]
  )

  const fetchPosts = useCallback(
    async (options?: { forceRefresh?: boolean; silent?: boolean }) => {
      const forceRefresh = Boolean(options?.forceRefresh)
      const silent = Boolean(options?.silent)

      if (!silent) {
        setRefreshingList(true)
      }
      setListError(null)

      try {
        const qs = forceRefresh ? `refresh=1&_t=${Date.now()}` : `_t=${Date.now()}`
        const res = await fetch(`/api/archive?${qs}`, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.message || '자료실 목록을 불러오지 못했습니다.')
        }
        const nextPosts: ArchivePostSummary[] = Array.isArray(data.posts) ? data.posts : []
        setPosts(nextPosts)
        setHasLoadedOnce(true)
        writeSessionPosts(nextPosts)

        if (forceRefresh) {
          postCacheRef.current.clear()
          clearSessionPostsCache()
        } else {
          for (const summary of nextPosts) {
            const cached = getCachedPost(summary.id)
            if (cached && cached.updatedAt !== summary.updatedAt) {
              postCacheRef.current.delete(summary.id)
              removeSessionPost(summary.id)
            }
          }
        }
      } catch (err: any) {
        setListError(err?.message || '자료실 목록을 불러오는 중 오류가 발생했습니다.')
        setHasLoadedOnce(true)
      } finally {
        if (!silent) {
          setRefreshingList(false)
        }
      }
    },
    [getCachedPost]
  )

  // 자료실 탭 활성화 시 즉시 동기화, 비활성화 상태에서는 홈 초기 API 경쟁을 피해 2초 뒤 백그라운드 1회 로드
  useEffect(() => {
    if (isActive) {
      const hadCache = Boolean(readSessionPosts())
      if (!didInitialFetchRef.current) {
        didInitialFetchRef.current = true
        fetchPosts({ silent: hadCache })
        fetchStorageUsage()
      }
      return
    }

    if (didInitialFetchRef.current) return
    const timer = setTimeout(() => {
      if (!didInitialFetchRef.current) {
        didInitialFetchRef.current = true
        fetchPosts({ silent: true })
        fetchStorageUsage()
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [isActive, fetchPosts, fetchStorageUsage])

  // 자료실 목록 표시 중 아직 캐시되지 않은 상위 3개 글을 순차(1개씩) 백그라운드 프리로드
  useEffect(() => {
    if (!isActive || view !== 'list' || posts.length === 0) return
    let cancelled = false

    const timer = setTimeout(async () => {
      const targets = posts.slice(0, 3)
      for (const summary of targets) {
        if (cancelled) break
        const cached = getCachedPost(summary.id)
        if (cached && cached.updatedAt === summary.updatedAt) continue
        try {
          await fetchPostDetail(summary.id)
        } catch {
          // 프리패치 실패는 무시
        }
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isActive, view, posts, getCachedPost, fetchPostDetail])

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return posts
    return posts.filter((post) => {
      const titleMatch = post.title.toLowerCase().includes(q)
      const authorMatch = post.author.toLowerCase().includes(q)
      const fileMatch = (post.attachmentNames || []).some((name) =>
        name.toLowerCase().includes(q)
      )
      return titleMatch || authorMatch || fileMatch
    })
  }, [posts, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedPosts = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filteredPosts.slice(start, start + PAGE_SIZE)
  }, [filteredPosts, safePage])

  // Hover Prefetch: 중복 요청 없이 백그라운드로 미리 받아둠
  const prefetchPost = useCallback(
    (summary: ArchivePostSummary) => {
      const cached = getCachedPost(summary.id)
      if (cached && cached.updatedAt === summary.updatedAt) return
      fetchPostDetail(summary.id).catch(() => {})
    },
    [getCachedPost, fetchPostDetail]
  )

  const handleOpenPost = async (summary: ArchivePostSummary) => {
    setListError(null)
    const cached = getCachedPost(summary.id)

    // 캐시에 최신 버전이 있으면 로딩 없이 즉시 열기 (0초!)
    if (cached && cached.updatedAt === summary.updatedAt) {
      setSelectedPost(cached)
      setView('detail')
      return
    }

    // 캐시에 구버전이라도 있으면 먼저 즉시 보여주고 뒤에서 조용히 최신화
    if (cached) {
      setSelectedPost(cached)
      setView('detail')
      fetchPostDetail(summary.id, true)
        .then((fresh) => {
          if (fresh) {
            setSelectedPost((prev) => (prev?.id === summary.id ? fresh : prev))
          }
        })
        .catch(() => {})
      return
    }

    // 진행 중이던 프리패치 Promise가 있으면 그대로 이어받고, 없을 때만 새 요청
    setLoadingDetail(true)
    try {
      const post = await fetchPostDetail(summary.id)
      if (!post) {
        throw new Error('게시글을 찾을 수 없습니다.')
      }
      setSelectedPost(post)
      setView('detail')
    } catch (err: any) {
      setListError(err?.message || '게시글 조회 중 오류가 발생했습니다.')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchQuery('')
    setCurrentPage(1)
  }

  const handleSavedPost = async (savedPost: ArchivePost) => {
    setCachedPost(savedPost)
    setSelectedPost(savedPost)
    setPosts((prev) => {
      const { content: _c, attachments: _a, images: _i, ...summary } = savedPost
      const exists = prev.some((p) => p.id === savedPost.id)
      const next = sortSummaries(
        exists ? prev.map((p) => (p.id === savedPost.id ? summary : p)) : [summary, ...prev]
      )
      writeSessionPosts(next)
      return next
    })
    setView('detail')
    fetchStorageUsage()
  }

  const handleDeletedPost = async () => {
    const deletedId = selectedPost?.id
    if (deletedId) {
      postCacheRef.current.delete(deletedId)
      removeSessionPost(deletedId)
      setPosts((prev) => {
        const next = prev.filter((p) => p.id !== deletedId)
        writeSessionPosts(next)
        return next
      })
    }
    setSelectedPost(null)
    setView('list')
    fetchStorageUsage()
  }

  const showInitialSkeleton = !hasLoadedOnce && refreshingList && posts.length === 0

  return (
    <div className="max-w-6xl mx-auto w-full py-2">
      {/* 상세 로딩 오버레이 (캐시 미스 최초 1회만 노출) */}
      {loadingDetail && (
        <div className="fixed inset-0 z-[105] bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg px-6 py-4 flex items-center gap-3 border border-gray-200">
            <span className="w-5 h-5 border-2 border-blue-900/20 border-t-blue-900 rounded-full animate-spin" />
            <span className="text-sm font-bold text-gray-700">게시글을 불러오는 중...</span>
          </div>
        </div>
      )}

      {view === 'write' && (
        <ArchiveEditor
          initialPost={null}
          defaultAuthor={userId}
          storageUsage={storageUsage}
          onStorageChanged={fetchStorageUsage}
          onCancel={() => {
            setView('list')
            fetchStorageUsage()
          }}
          onSaved={handleSavedPost}
        />
      )}

      {view === 'edit' && selectedPost && (
        <ArchiveEditor
          initialPost={selectedPost}
          defaultAuthor={userId}
          storageUsage={storageUsage}
          onStorageChanged={fetchStorageUsage}
          onCancel={() => {
            setView('detail')
            fetchStorageUsage()
          }}
          onSaved={handleSavedPost}
        />
      )}

      {view === 'detail' && selectedPost && (
        <ArchiveDetail
          post={selectedPost}
          isReadonly={isReadonly}
          onBack={() => {
            setView('list')
            fetchPosts({ silent: true })
          }}
          onEdit={() => setView('edit')}
          onDeleted={handleDeletedPost}
        />
      )}

      {view === 'list' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-6 sm:px-8 py-6">
          {/* 상단 제목 영역 */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-blue-950 tracking-tight">라디오 업무 자료실</h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-100">
                총 {filteredPosts.length}건
              </span>
              {searchQuery && (
                <span className="text-xs text-gray-500">
                  &ldquo;{searchQuery}&rdquo; 검색 결과
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ArchiveStorageBar usage={storageUsage} compact />
              <button
                type="button"
                onClick={() => {
                  fetchPosts({ forceRefresh: true })
                  fetchStorageUsage()
                }}
                disabled={refreshingList}
                title="최신 목록 강제 새로고침"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-blue-900 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-lg transition disabled:opacity-50"
              >
                <svg
                  className={`w-3.5 h-3.5 ${refreshingList ? 'animate-spin' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                새로고침
              </button>
            </div>
          </div>

          {listError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              {listError}
            </div>
          )}

          {/* 심플 게시판 테이블 (레퍼런스 구조 + KBS창원 블루 테마) */}
          <div className="overflow-x-auto border-t-2 border-blue-900">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600 text-[13px]">
                  <th className="py-3.5 px-3 w-16 text-center font-bold">No</th>
                  <th className="py-3.5 px-4 text-center font-bold">제목</th>
                  <th className="py-3.5 px-3 w-28 sm:w-32 text-center font-bold">글쓴이</th>
                  <th className="py-3.5 px-3 w-28 sm:w-32 text-center font-bold">작성시간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {showInitialSkeleton ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-gray-400">
                      <div className="inline-flex items-center gap-2.5">
                        <span className="w-4 h-4 border-2 border-blue-900/20 border-t-blue-900 rounded-full animate-spin" />
                        <span>자료실 목록을 불러오는 중입니다...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedPosts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-gray-400">
                      {searchQuery
                        ? '검색 결과가 없습니다.'
                        : '등록된 자료가 없습니다. 첫 번째 인수인계 자료를 등록해보세요.'}
                    </td>
                  </tr>
                ) : (
                  paginatedPosts.map((post) => (
                    <tr
                      key={post.id}
                      onMouseEnter={() => prefetchPost(post)}
                      onClick={() => handleOpenPost(post)}
                      className={`cursor-pointer transition-colors ${
                        post.isNotice
                          ? 'bg-blue-50/70 hover:bg-blue-100/60'
                          : 'hover:bg-gray-50/90'
                      }`}
                    >
                      {/* No / 공지 깃발 */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {post.isNotice ? (
                          <span
                            title="공지"
                            className="inline-flex items-center justify-center text-blue-900"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4 21V4m0 0h11l-2.5 4.5L15 13H4"
                              />
                            </svg>
                          </span>
                        ) : (
                          <span className="text-gray-600 font-semibold">{post.no}</span>
                        )}
                      </td>

                      {/* 제목 + 첨부 아이콘 */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`truncate ${
                              post.isNotice
                                ? 'font-bold text-blue-950'
                                : 'font-medium text-gray-800'
                            }`}
                          >
                            {post.title}
                          </span>
                          {post.hasImage && (
                            <span
                              title="본문 이미지 포함"
                              className="inline-flex items-center text-blue-600/80 flex-shrink-0"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                            </span>
                          )}
                          {post.attachmentCount > 0 && (
                            <span
                              title={`첨부파일 ${post.attachmentCount}개`}
                              className="inline-flex items-center gap-0.5 text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md flex-shrink-0"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                                />
                              </svg>
                              {post.attachmentCount}
                            </span>
                          )}
                          {post.hasLargeFile && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 flex-shrink-0">
                              대용량
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 글쓴이 */}
                      <td className="py-3.5 px-3 text-center text-gray-500 whitespace-nowrap text-[13px]">
                        {post.author}
                      </td>

                      {/* 작성시간 */}
                      <td
                        title={formatFullDateTime(post.createdAt)}
                        className="py-3.5 px-3 text-center text-gray-400 whitespace-nowrap text-[13px]"
                      >
                        {formatListDate(post.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 mt-5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 text-xs font-bold text-gray-500 hover:text-blue-900 disabled:opacity-30"
              >
                이전
              </button>
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                    pageNum === safePage
                      ? 'bg-blue-900 text-white'
                      : 'text-gray-600 hover:bg-blue-50 hover:text-blue-900'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 text-xs font-bold text-gray-500 hover:text-blue-900 disabled:opacity-30"
              >
                다음
              </button>
            </div>
          )}

          {/* 하단 컨트롤 바: 중앙 검색창 + 우측 글쓰기 버튼 (레퍼런스 구조) */}
          <div className="mt-6 pt-2 grid grid-cols-1 sm:grid-cols-3 items-center gap-3">
            <div className="hidden sm:block" />

            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center justify-center"
            >
              <div className="relative w-full max-w-xs">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => {
                    const val = e.target.value
                    setSearchInput(val)
                    setSearchQuery(val)
                    setCurrentPage(1)
                  }}
                  placeholder="Search"
                  className="w-full pl-3.5 pr-14 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-900/15 transition"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    title="검색어 지우기"
                    className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="submit"
                  title="검색"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-900 transition"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.35z"
                    />
                  </svg>
                </button>
              </div>
            </form>

            <div className="flex justify-end">
              {!isReadonly && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPost(null)
                    setView('write')
                  }}
                  className="px-6 py-2 bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold rounded-full shadow-sm transition"
                >
                  글쓰기
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
