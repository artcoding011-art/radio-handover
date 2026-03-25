import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getEntry } from '@/lib/db'

// GET /api/entries/[date] - 특정 날짜 인수인계서 조회
export async function GET(
  req: NextRequest,
  { params }: { params: { date: string } }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const entry = await getEntry(params.date)
    if (!entry) {
      return NextResponse.json({ entry: null })
    }
    return NextResponse.json({ entry })
  } catch (err) {
    console.error('GET entry error:', err)
    return NextResponse.json({ message: '서버 오류' }, { status: 500 })
  }
}
