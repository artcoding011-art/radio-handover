import { NextRequest, NextResponse } from 'next/server'
import { getMwCompletionDates } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  if (!year || !month) {
    return NextResponse.json({ error: 'Missing year or month' }, { status: 400 })
  }

  try {
    const completedDates = await getMwCompletionDates(year, month)
    return NextResponse.json({ completedDates })
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
