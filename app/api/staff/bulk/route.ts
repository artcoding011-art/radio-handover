import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDailyStaff, saveDailyStaff } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const { dates, assignment } = await req.json()
    if (!dates || !Array.isArray(dates) || !assignment) {
      return NextResponse.json({ message: '잘못된 요청입니다.' }, { status: 400 })
    }

    // 모든 대상 날짜에 대해 기존 데이터를 조회하고 새로운 assignment를 추가함
    for (const dateStr of dates) {
      let currentData: { assignments: any[] } = { assignments: [] }
      const existing = await getDailyStaff(dateStr)
      if (existing && existing.assignments) {
        currentData.assignments = existing.assignments
      }
      
      // 고유 ID 재생성을 위해 timestamp 약간씩 변경
      const newAssignment = {
        ...assignment,
        id: `bulk_${Date.now()}_${Math.random()}`
      }
      
      currentData.assignments.push(newAssignment)
      await saveDailyStaff(dateStr, currentData)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST bulk staff error:', err)
    return NextResponse.json({ message: '서버 오류' }, { status: 500 })
  }
}
