import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDailyStaff, saveDailyStaff } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: { date: string } }) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const staff = await getDailyStaff(params.date)
    return NextResponse.json({ staff: staff || null })
  } catch (err) {
    console.error('GET daily staff error:', err)
    return NextResponse.json({ message: '서버 오류' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { date: string } }) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const data = await req.json()
    await saveDailyStaff(params.date, data)
    return NextResponse.json({ success: true, staff: data })
  } catch (err) {
    console.error('POST daily staff error:', err)
    return NextResponse.json({ message: '서버 오류' }, { status: 500 })
  }
}
