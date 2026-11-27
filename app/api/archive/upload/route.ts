import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  deleteArchiveFile,
  uploadArchiveFile,
  validateArchiveFilePath,
  validatePostId,
} from '@/lib/githubArchive'
import { deleteSupabaseArchiveFiles } from '@/lib/supabaseArchive'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB (Vercel 서버리스 요청 제한 4.5MB 고려)

// POST /api/archive/upload - 이미지 또는 일반 첨부파일 업로드
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }
  if (session.role === 'readonly') {
    return NextResponse.json({ message: '읽기 전용 계정은 파일을 업로드할 수 없습니다.' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const postId = String(formData.get('postId') || '').trim()
    const kind = String(formData.get('kind') || '').trim() // 'image' | 'file'

    if (!file) {
      return NextResponse.json({ message: '업로드할 파일이 없습니다.' }, { status: 400 })
    }
    if (!validatePostId(postId)) {
      return NextResponse.json({ message: '유효하지 않은 게시글 ID입니다.' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: '파일 크기는 최대 4MB까지 업로드할 수 있습니다.' },
        { status: 413 }
      )
    }

    const mimeType = file.type || 'application/octet-stream'
    const isImage =
      kind === 'image' ||
      (kind !== 'file' && mimeType.startsWith('image/') && !mimeType.includes('svg'))

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const attachment = await uploadArchiveFile({
      postId,
      originalName: file.name || (isImage ? 'image.png' : 'attachment'),
      buffer,
      mimeType,
      isImage,
    })

    const fileUrl = `/api/archive/file?path=${encodeURIComponent(attachment.path)}`

    return NextResponse.json({
      success: true,
      attachment,
      url: fileUrl,
    })
  } catch (err: any) {
    console.error('[POST /api/archive/upload] error:', err)
    return NextResponse.json(
      { message: err?.message || '파일 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE /api/archive/upload - 작성 중 취소되거나 제거된 파일 정리
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }
  if (session.role === 'readonly') {
    return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const paths: string[] = Array.isArray(body?.paths) ? body.paths : []
    const supabasePaths: string[] = Array.isArray(body?.supabasePaths) ? body.supabasePaths : []

    for (const filePath of paths) {
      if (validateArchiveFilePath(filePath)) {
        await deleteArchiveFile(filePath, `chore(archive): cleanup ${filePath}`)
      }
    }

    const validSupabasePaths = supabasePaths.filter((p) => validateArchiveFilePath(p))
    if (validSupabasePaths.length > 0) {
      await deleteSupabaseArchiveFiles(validSupabasePaths)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DELETE /api/archive/upload] error:', err)
    return NextResponse.json(
      { message: err?.message || '파일 정리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
