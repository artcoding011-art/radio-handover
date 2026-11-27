import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ARCHIVE_BUCKET } from './archiveTypes'

export const SUPABASE_STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024 // 1 GB (Supabase Free Plan)

export interface StorageUsageInfo {
  available: boolean
  usedBytes: number
  limitBytes: number
  remainingBytes: number
  fileCount: number
  percent: number
}

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  // 서버에 SERVICE_ROLE_KEY가 있으면 우선 사용하고, 없으면 ANON_KEY 사용
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''

  if (!url || !key) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * 대용량 파일(Supabase Storage) 1회용 다운로드 URL 발급 (유효시간 5분)
 */
export async function createSupabaseDownloadUrl(
  filePath: string,
  originalName: string
): Promise<string> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.storage
    .from(SUPABASE_ARCHIVE_BUCKET)
    .createSignedUrl(filePath, 300, {
      download: originalName || true,
    })

  if (error || !data?.signedUrl) {
    throw new Error(
      `대용량 파일 다운로드 링크 생성 실패: ${error?.message || '알 수 없는 오류'}`
    )
  }

  return data.signedUrl
}

/**
 * Supabase Storage에서 파일 삭제 (게시글 삭제·첨부 제거·작성 취소 시 용량 즉시 반환)
 */
export async function deleteSupabaseArchiveFiles(paths: string[]): Promise<void> {
  const validPaths = paths.filter((p) => typeof p === 'string' && p.startsWith('posts/'))
  if (validPaths.length === 0) return

  const supabase = getSupabaseClient()
  const { error } = await supabase.storage
    .from(SUPABASE_ARCHIVE_BUCKET)
    .remove(validPaths)

  if (error) {
    console.warn('[Supabase Archive] 파일 삭제 경고:', error.message)
  }
}

/**
 * Supabase Storage(archive-files 버킷) 실제 사용량 및 잔여 용량 조회
 */
export async function getSupabaseArchiveStorageUsage(): Promise<StorageUsageInfo> {
  const limitBytes = SUPABASE_STORAGE_LIMIT_BYTES
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('get_archive_storage_usage')

    if (error || !data) {
      return {
        available: false,
        usedBytes: 0,
        limitBytes,
        remainingBytes: limitBytes,
        fileCount: 0,
        percent: 0,
      }
    }

    const usedBytes = Math.max(0, Number(data.usedBytes || 0))
    const fileCount = Math.max(0, Number(data.fileCount || 0))
    const remainingBytes = Math.max(0, limitBytes - usedBytes)
    const percent = Math.min(100, Number(((usedBytes / limitBytes) * 100).toFixed(1)))

    return {
      available: true,
      usedBytes,
      limitBytes,
      remainingBytes,
      fileCount,
      percent,
    }
  } catch (err) {
    console.warn('[Supabase Archive] 용량 조회 경고:', err)
    return {
      available: false,
      usedBytes: 0,
      limitBytes,
      remainingBytes: limitBytes,
      fileCount: 0,
      percent: 0,
    }
  }
}
