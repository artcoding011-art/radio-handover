import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getCompletedScheduleDates } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const dates = await getCompletedScheduleDates()
    return NextResponse.json({ dates })
  } catch (err) {
    console.error('GET completed dates error:', err)
    return NextResponse.json({ message: '서버 오류' }, { status: 500 })
  }
}
