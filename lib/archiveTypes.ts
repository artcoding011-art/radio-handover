export type ArchiveStorageType = 'github' | 'supabase'

export const GITHUB_MAX_FILE_BYTES = 4 * 1024 * 1024 // 4MB (초과 시 대용량 파일로 분류)
export const ARCHIVE_MAX_FILE_BYTES = 50 * 1024 * 1024 // 50MB (최대 업로드 한도)
export const SUPABASE_ARCHIVE_BUCKET = 'archive-files'

export interface ArchiveAttachment {
  id: string
  name: string        // 원본 파일명
  path: string        // 저장 경로 (posts/{postId}/files/...)
  size: number        // 바이트 단위 파일 크기
  mimeType: string
  isImage: boolean
  uploadedAt: string
  storage?: ArchiveStorageType // 미지정 시 'github' (하위 호환)
}

export interface ArchivePostSummary {
  id: string
  no: number
  title: string
  author: string
  isNotice: boolean
  createdAt: string
  updatedAt: string
  attachmentCount: number
  hasImage: boolean
  hasLargeFile?: boolean
  attachmentNames?: string[]
}

export interface ArchivePost extends ArchivePostSummary {
  content: string
  attachments: ArchiveAttachment[]
  images: ArchiveAttachment[]
}

export interface ArchiveIndex {
  lastNo: number
  posts: ArchivePostSummary[]
}
