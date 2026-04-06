import { NextResponse } from 'next/server'
import { getDailyStaffDates } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const { dates, colors } = await getDailyStaffDates()
    return NextResponse.json({ dates, colors })
  } catch (err) {
    console.error('GET daily staff dates error:', err)
    return NextResponse.json({ message: '서버 오류' }, { status: 500 })
  }
}
