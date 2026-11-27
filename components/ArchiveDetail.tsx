'use client'

import { useState } from 'react'
import { ArchivePost, GITHUB_MAX_FILE_BYTES } from '@/lib/archiveTypes'
import MarkdownViewer from './MarkdownViewer'

interface ArchiveDetailProps {
  post: ArchivePost
  isReadonly?: boolean
  onBack: () => void
  onEdit: () => void
  onDeleted: () => void
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function ArchiveDetail({
  post,
  isReadonly = false,
  onBack,
  onEdit,
  onDeleted,
}: ArchiveDetailProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleConfirmDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/archive/${encodeURIComponent(post.id)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || '삭제에 실패했습니다.')
      }
      setShowDeleteModal(false)
      onDeleted()
    } catch (err: any) {
      setDeleteError(err?.message || '게시글 삭제 중 오류가 발생했습니다.')
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* 상단 액션 바 */}
      <div className="px-6 py-3.5 border-b border-gray-200 bg-gray-50/70 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-600 hover:text-blue-900 transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          목록으로
        </button>

        {!isReadonly && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="px-3.5 py-1.5 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-3.5 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition"
            >
              삭제
            </button>
          </div>
        )}
      </div>

      {/* 게시글 헤더 */}
      <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          {post.isNotice ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-900 text-white">
              공지
            </span>
          ) : (
            <span className="text-xs font-bold text-gray-400">No. {post.no}</span>
          )}
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug mb-3">
          {post.title}
        </h2>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-500">
          <span>
            글쓴이 <strong className="text-gray-700 ml-1">{post.author}</strong>
          </span>
          <span>
            작성시간 <strong className="text-gray-700 ml-1">{formatDateTime(post.createdAt)}</strong>
          </span>
          {post.updatedAt && post.updatedAt !== post.createdAt && (
            <span>
              수정시간 <strong className="text-gray-700 ml-1">{formatDateTime(post.updatedAt)}</strong>
            </span>
          )}
        </div>
      </div>

      {/* 마크다운 본문 */}
      <div className="px-6 sm:px-8 py-7 min-h-[260px]">
        <MarkdownViewer content={post.content} />
      </div>

      {/* 일반 첨부파일 목록 */}
      {post.attachments && post.attachments.length > 0 && (
        <div className="px-6 sm:px-8 py-5 border-t border-gray-200 bg-blue-50/30">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-blue-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <h3 className="text-sm font-bold text-blue-950">
              첨부파일 ({post.attachments.length})
            </h3>
          </div>

          <ul className="space-y-2">
            {post.attachments.map((file) => {
              const isLarge = file.storage === 'supabase' || file.size > GITHUB_MAX_FILE_BYTES
              const downloadUrl =
                file.storage === 'supabase'
                  ? `/api/archive/supabase-url?path=${encodeURIComponent(
                      file.path
                    )}&name=${encodeURIComponent(file.name)}`
                  : `/api/archive/file?path=${encodeURIComponent(
                      file.path
                    )}&download=1&name=${encodeURIComponent(file.name)}`
              return (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-3 bg-white border border-gray-200 hover:border-blue-300 rounded-xl px-4 py-2.5 transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-100 uppercase flex-shrink-0">
                      {file.name.split('.').pop()?.slice(0, 6) || 'FILE'}
                    </span>
                    {isLarge && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 flex-shrink-0">
                        대용량 파일
                      </span>
                    )}
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {file.name}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatFileSize(file.size)}
                    </span>
                  </div>

                  <a
                    href={downloadUrl}
                    download={file.storage === 'supabase' ? undefined : file.name}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg transition flex-shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    다운로드
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">게시글 삭제</h3>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              <strong className="text-gray-900">&ldquo;{post.title}&rdquo;</strong> 게시글과 첨부된 모든 파일이 삭제됩니다. 계속하시겠습니까?
            </p>
            {deleteError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                {deleteError}
              </p>
            )}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50"
              >
                {deleting ? '삭제 중...' : '삭제하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
