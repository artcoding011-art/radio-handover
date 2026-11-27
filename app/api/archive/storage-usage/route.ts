import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSupabaseArchiveStorageUsage } from '@/lib/supabaseArchive'

export const dynamic = 'force-dynamic'

// GET /api/archive/storage-usage - Supabase 대용량 파일 저장소 사용량/잔여 용량 조회
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const usage = await getSupabaseArchiveStorageUsage()
    return NextResponse.json(usage, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err: any) {
    console.error('[GET /api/archive/storage-usage] error:', err)
    return NextResponse.json(
      { message: err?.message || '저장소 용량을 조회하지 못했습니다.' },
      { status: 500 }
    )
  }
}
