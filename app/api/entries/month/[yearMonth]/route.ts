import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAllDates, getEntry } from '@/lib/db'

// GET /api/entries/month/[yearMonth] - 해당 월의 모든 특이사항 반환
export async function GET(
  req: NextRequest,
  { params }: { params: { yearMonth: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })

  try {
    const allDates = await getAllDates()
    const monthDates = allDates.filter((d) => d.startsWith(params.yearMonth))

    const entries = await Promise.all(
      monthDates.map(async (date) => {
        const entry = await getEntry(date)
        return {
          date,
          근무자: entry?.근무자 ?? '',
          특이사항: entry?.rMCR?.특이사항 ?? '',
        }
      })
    )

    // 특이사항이 있는 것만, 날짜 오름차순
    const filtered = entries
      .filter((e) => e.특이사항.trim() !== '')
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ entries: filtered })
  } catch (err) {
    console.error('GET month entries error:', err)
    return NextResponse.json({ message: '서버 오류' }, { status: 500 })
  }
}
