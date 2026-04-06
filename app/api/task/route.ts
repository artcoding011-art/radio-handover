import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getWeeklyTask, saveWeeklyTask } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const task = await getWeeklyTask()
    return NextResponse.json({ task: task || null })
  } catch (err) {
    console.error('GET weekly task error:', err)
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
    await saveWeeklyTask(data)
    return NextResponse.json({ success: true, task: data })
  } catch (err) {
    console.error('POST weekly task error:', err)
    return NextResponse.json({ message: '서버 오류' }, { status: 500 })
  }
}
