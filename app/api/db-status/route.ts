import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// GET /api/db-status
// DB 데이터의 fingerprint(변경 감지용 해시)를 반환합니다.
// updated_at 컬럼 대신 실제 데이터 내용을 기반으로 변경을 감지합니다.
export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    // 오늘 날짜 기준 (한국시간 KST = UTC+9)
    const { searchParams } = new URL(req.url)
    const today = searchParams.get('date') || (() => {
      const now = new Date()
      const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
      return kst.toISOString().split('T')[0]
    })()

    // Supabase 환경인 경우
    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey)

      // 오늘 날짜의 일정 데이터 + 주간 일정 + 오늘 날짜의 업무 데이터 조회
      const [schedulesResult, entriesResult] = await Promise.all([
        supabase
          .from('schedules')
          .select('id, data')
          .in('id', [
            `schedule:daily:${today}`,
            'calendar_schedule',
            `task:daily:${today}`,
            'calendar_task',
            `staff:daily:${today}`,
          ]),
        supabase
          .from('handover_entries')
          .select('date, data')
          .eq('date', today)
          .limit(1),
      ])

      // 조회된 데이터를 직렬화하여 fingerprint 생성
      const combined = JSON.stringify({
        schedules: schedulesResult.data || [],
        entries: entriesResult.data || [],
      })

      // 간단한 문자열 해시 (djb2 변형)
      let hash = 5381
      for (let i = 0; i < combined.length; i++) {
        hash = ((hash << 5) + hash) ^ combined.charCodeAt(i)
        hash = hash >>> 0 // 32비트 부호없는 정수로 유지
      }
      const fingerprint = hash.toString(16).padStart(8, '0')

      console.log(`[DB Status] today=${today}, fingerprint=${fingerprint}, dataLen=${combined.length}`)

      return NextResponse.json({ 
        latestUpdatedAt: fingerprint,
        debug: { today, dataLength: combined.length }
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        }
      })
    }

    // 로컬 메모리 스토어(local_db.json) 폴백
    const LOCAL_DB_PATH = path.join(process.cwd(), 'local_db.json')
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const stat = fs.statSync(LOCAL_DB_PATH)
      return NextResponse.json({
        latestUpdatedAt: stat.mtime.toISOString(),
      }, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
      })
    }

    return NextResponse.json({ latestUpdatedAt: new Date(0).toISOString() })
  } catch (err) {
    console.error('GET db-status error:', err)
    return NextResponse.json(
      { latestUpdatedAt: new Date(0).toISOString() },
      { status: 200 }
    )
  }
}

