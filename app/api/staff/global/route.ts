import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getGlobalStaff, saveGlobalStaff } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const staff = await getGlobalStaff()
    return NextResponse.json({ staff: staff || null })
  } catch (err) {
    console.error('GET global staff error:', err)
    return NextResponse.json({ message: '서버 오류' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const data = await req.json()
    await saveGlobalStaff(data)
    return NextResponse.json({ success: true, staff: data })
  } catch (err) {
    console.error('POST global staff error:', err)
    return NextResponse.json({ message: '서버 오류' }, { status: 500 })
  }
}
