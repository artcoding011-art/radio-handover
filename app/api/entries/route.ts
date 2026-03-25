import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { saveEntry, getAllDates, getEntry, getEntriesByMonth } from '@/lib/db'
import { createEmptyEntry } from '@/lib/types'

// GET /api/entries - 모든 날짜 목록 또는 특정 월의 전체 일지
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') // YYYY-MM

    if (month) {
      const entries = await getEntriesByMonth(month)
      return NextResponse.json({ entries })
    }

    const dates = await getAllDates()
    return NextResponse.json({ dates })
  } catch (err) {
    console.error('GET entries error:', err)
    return NextResponse.json({ message: '서버 오류' }, { status: 500 })
  }
}

// POST /api/entries - 새 인수인계서 저장
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { date, ...data } = body

    if (!date) {
      return NextResponse.json({ message: '날짜가 필요합니다.' }, { status: 400 })
    }

    const existing = await getEntry(date)
    const entry = existing ?? createEmptyEntry(date)

    const updated = {
      ...entry,
      ...data,
      date,
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }

    await saveEntry(updated)
    return NextResponse.json({ success: true, entry: updated })
  } catch (err) {
    console.error('POST entry error:', err)
    return NextResponse.json({ message: '서버 오류' }, { status: 500 })
  }
}
