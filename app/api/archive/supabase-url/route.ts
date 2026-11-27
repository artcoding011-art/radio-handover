import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { validateArchiveFilePath } from '@/lib/githubArchive'
import { createSupabaseDownloadUrl } from '@/lib/supabaseArchive'

export const dynamic = 'force-dynamic'

// GET /api/archive/supabase-url?path=posts/...&name=원본명
// 로그인 세션 검증 후 대용량 파일의 1회용 Supabase 다운로드 URL로 리다이렉트
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const filePath = searchParams.get('path') || ''
    const fileName = searchParams.get('name') || filePath.split('/').pop() || 'download'

    if (!validateArchiveFilePath(filePath)) {
      return NextResponse.json({ message: '잘못된 파일 경로입니다.' }, { status: 400 })
    }

    const signedUrl = await createSupabaseDownloadUrl(filePath, fileName)
    return NextResponse.redirect(signedUrl, 302)
  } catch (err: any) {
    console.error('[GET /api/archive/supabase-url] error:', err)
    return NextResponse.json(
      { message: err?.message || '대용량 파일 다운로드 링크 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
