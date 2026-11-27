import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { downloadArchiveFile, validateArchiveFilePath } from '@/lib/githubArchive'

export const dynamic = 'force-dynamic'

function getMimeTypeByExt(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    pdf: 'application/pdf',
    txt: 'text/plain; charset=utf-8',
    md: 'text/markdown; charset=utf-8',
    csv: 'text/csv; charset=utf-8',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    hwp: 'application/x-hwp',
    hwpx: 'application/vnd.hancom.hwpx',
    zip: 'application/zip',
  }
  return map[ext] || 'application/octet-stream'
}

// GET /api/archive/file?path=posts/...&download=1&name=원본명
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const filePath = searchParams.get('path') || ''
    const isDownload = searchParams.get('download') === '1'
    const requestedName = searchParams.get('name') || filePath.split('/').pop() || 'file'

    if (!validateArchiveFilePath(filePath)) {
      return NextResponse.json({ message: '잘못된 파일 경로입니다.' }, { status: 400 })
    }

    const result = await downloadArchiveFile(filePath)
    if (!result) {
      return NextResponse.json({ message: '파일을 찾을 수 없습니다.' }, { status: 404 })
    }

    const mimeType = getMimeTypeByExt(filePath)
    const isSafeInlineImage =
      !isDownload &&
      ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'].includes(mimeType)

    const headers = new Headers()
    headers.set('Content-Type', mimeType)
    headers.set('Content-Length', String(result.buffer.length))
    headers.set('X-Content-Type-Options', 'nosniff')

    if (isSafeInlineImage) {
      headers.set('Content-Disposition', 'inline')
      headers.set('Cache-Control', 'private, max-age=3600')
    } else {
      const encodedName = encodeURIComponent(requestedName)
      const asciiFallback = requestedName.replace(/[^\x20-\x7E]/g, '_') || 'download'
      headers.set(
        'Content-Disposition',
        `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`
      )
      headers.set('Cache-Control', 'private, no-cache')
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers,
    })
  } catch (err: any) {
    console.error('[GET /api/archive/file] error:', err)
    return NextResponse.json(
      { message: err?.message || '파일을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
