import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getMwInspection, saveMwInspection, deleteMwInspection } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')

  if (!date) {
    return NextResponse.json({ message: '날짜가 필요합니다' }, { status: 400 })
  }

  try {
    const data = await getMwInspection(date)
    return NextResponse.json({ data: data || null })
  } catch (err) {
    console.error('GET mw_inspection error:', err)
    return NextResponse.json({ message: '서버 오류' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const { date, data } = await req.json()
    if (!date || !data) {
      return NextResponse.json({ message: '필수 데이터 누락' }, { status: 400 })
    }
    
    await saveMwInspection(date, data)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('POST mw_inspection error:', err)
    return NextResponse.json({ message: '서버 오류' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')

  if (!date) {
    return NextResponse.json({ message: '날짜가 필요합니다' }, { status: 400 })
  }

  try {
    await deleteMwInspection(date)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE mw_inspection error:', err)
    return NextResponse.json({ message: '서버 오류' }, { status: 500 })
  }
}
