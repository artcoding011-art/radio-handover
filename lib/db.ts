import { HandoverEntry } from './types'
import { createClient } from '@supabase/supabase-js'

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// --- 데이터베이스 접근 로직 (Supabase) ---

export async function saveEntry(entry: HandoverEntry): Promise<void> {
  if (!supabase) return memoryStore.set(`entry:${entry.date}`, entry)
  
  const { error } = await supabase
    .from('handover_entries')
    .upsert({ 
      date: entry.date, 
      data: entry,
      updated_at: new Date().toISOString()
    })
  
  if (error) {
    console.error('Error saving entry to Supabase:', error)
    throw error
  }
}

export async function getEntry(date: string): Promise<HandoverEntry | null> {
  if (!supabase) return memoryStore.get(`entry:${date}`)

  const { data, error } = await supabase
    .from('handover_entries')
    .select('data')
    .eq('date', date)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
    console.error('Error getting entry from Supabase:', error)
    return null
  }

  return data?.data || null
}

export async function getAllDates(): Promise<string[]> {
  if (!supabase) return memoryStore.smembers('entry:dates')

  const { data, error } = await supabase
    .from('handover_entries')
    .select('date')
    .order('date', { ascending: true })

  if (error) {
    console.error('Error getting all dates from Supabase:', error)
    return []
  }

  return data?.map(row => row.date) || []
}

export async function deleteEntry(date: string): Promise<void> {
  if (!supabase) return memoryStore.del(`entry:${date}`)

  const { error } = await supabase
    .from('handover_entries')
    .delete()
    .eq('date', date)

  if (error) {
    console.error('Error deleting entry from Supabase:', error)
    throw error
  }
}

export async function saveWeeklySchedule(data: any): Promise<void> {
  if (!supabase) return memoryStore.set('calendar_schedule', data)

  const { error } = await supabase
    .from('schedules')
    .upsert({ id: 'calendar_schedule', data, updated_at: new Date().toISOString() })

  if (error) {
    console.error('Error saving weekly schedule to Supabase:', error)
    throw error
  }
}

export async function getWeeklySchedule(): Promise<any> {
  if (!supabase) return memoryStore.get('calendar_schedule')

  const { data, error } = await supabase
    .from('schedules')
    .select('data')
    .eq('id', 'calendar_schedule')
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error getting weekly schedule from Supabase:', error)
    return null
  }

  return data?.data || null
}

export async function saveDailySchedule(date: string, data: any): Promise<void> {
  const id = `schedule:daily:${date}`
  if (!supabase) return memoryStore.set(id, data)

  const { error } = await supabase
    .from('schedules')
    .upsert({ id, data, updated_at: new Date().toISOString() })

  if (error) {
    console.error('Error saving daily schedule to Supabase:', error)
    throw error
  }
}

export async function getDailySchedule(date: string): Promise<any> {
  const id = `schedule:daily:${date}`
  if (!supabase) return memoryStore.get(id)

  const { data, error } = await supabase
    .from('schedules')
    .select('data')
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error getting daily schedule from Supabase:', error)
    return null
  }

  return data?.data || null
}

export async function getDailyRecordingDates(): Promise<string[]> {
  if (!supabase) return memoryStore.keys('schedule:daily:*')

  const { data, error } = await supabase
    .from('schedules')
    .select('id, data')
    .like('id', 'schedule:daily:%')

  if (error) {
    console.error('Error getting recording dates from Supabase:', error)
    return []
  }

  const recordingDates: string[] = []
  for (const row of (data || [])) {
    const scheduleData = row.data
    const hasRecording = (scheduleData['1R']?.length > 0) || (scheduleData['2R']?.length > 0) || (scheduleData['MFM']?.length > 0)
    if (hasRecording) {
      recordingDates.push(row.id.replace('schedule:daily:', ''))
    }
  }

  return recordingDates.sort()
}

export async function getCompletedScheduleDates(): Promise<string[]> {
  const weekly = await getWeeklySchedule()
  if (!weekly) return []

  const { data: dailyRows, error } = supabase
    ? await supabase.from('schedules').select('id, data').like('id', 'schedule:daily:%')
    : { data: await memoryStore.keys('schedule:daily:*').then(keys => Promise.all(keys.map(async k => ({ id: k, data: await memoryStore.get(k) })))), error: null }

  if (error) return []

  const completedDates: string[] = []
  const dailyMap = new Map<string, any>()
  dailyRows?.forEach((row: any) => {
    dailyMap.set(row.id.replace('schedule:daily:', ''), row.data)
  })

  // 최근 3개월 정도만 체크 (성능을 위해)
  const today = new Date()
  for (let i = -30; i <= 60; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const dayIndex = d.getDay() as 0|1|2|3|4|5|6

    const daily = dailyMap.get(dateStr)
    const completedIds = daily?.completedProgramIds || []
    const canceledIds = daily?.canceledWeeklyIds || []

    const mediums: ('1R'|'2R'|'MFM')[] = ['1R', '2R', 'MFM']
    let totalItems = 0
    let completedItems = 0

    for (const m of mediums) {
      const weeklyProgs = (weekly[m]?.[dayIndex] || []).filter((p: any) => !canceledIds.includes(p.id))
      const dailyProgs = daily?.[m] || []
      
      const allProgsForDay = [...weeklyProgs, ...dailyProgs]
      totalItems += allProgsForDay.length
      allProgsForDay.forEach(p => {
        if (completedIds.includes(p.id)) completedItems++
      })
    }

    if (totalItems > 0 && totalItems === completedItems) {
      completedDates.push(dateStr)
    }
  }

  return completedDates
}

export async function getEntriesByMonth(month: string): Promise<HandoverEntry[]> {
  if (!supabase) {
    const allDates = await getAllDates()
    const monthDates = allDates.filter(d => d.startsWith(month))
    const entries = await Promise.all(monthDates.map(date => getEntry(date)))
    return entries.filter((e): e is HandoverEntry => e !== null)
  }

  const { data, error } = await supabase
    .from('handover_entries')
    .select('data')
    .like('date', `${month}%`)
    .order('date', { ascending: true })

  if (error) {
    console.error('Error getting month entries from Supabase:', error)
    return []
  }

  return data?.map(row => row.data as HandoverEntry) || []
}

// --- 로컬 메모리 스토어 (최종 폴백용 - 기존 로직 유지) ---
import fs from 'fs'
import path from 'path'
const LOCAL_DB_PATH = path.join(process.cwd(), 'local_db.json')

function loadLocalData(): Record<string, any> {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const data = fs.readFileSync(LOCAL_DB_PATH, 'utf-8').trim()
      if (!data) return {}
      try {
        return JSON.parse(data)
      } catch (parseError) {
        console.error('JSON Parse Error in local_db.json:', parseError)
        console.error('Raw data causing error:', data.slice(0, 100) + '...')
        // If it's corrupted, try to move it to a backup and start fresh to avoid infinite crash loop
        const backupPath = `${LOCAL_DB_PATH}.bak.${Date.now()}`
        fs.renameSync(LOCAL_DB_PATH, backupPath)
        console.warn(`Corrupted local_db.json moved to ${backupPath}`)
        return {}
      }
    }
  } catch (error) {
    console.error('Error reading local DB:', error)
  }
  return {}
}

const memoryStore = {
  get: async (key: string) => {
    const db = loadLocalData()
    return db[key] ?? null
  },
  set: async (key: string, value: any) => { 
    const db = loadLocalData()
    db[key] = value
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2), 'utf-8')
  },
  del: async (key: string) => { 
    const db = loadLocalData()
    delete db[key]
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2), 'utf-8')
  },
  smembers: async (key: string) => {
    const db = loadLocalData()
    return db[key] ?? []
  },
  keys: async (pattern: string) => {
    const db = loadLocalData()
    if (pattern === 'entry:dates') return [] 
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
    return Object.keys(db).filter(k => regex.test(k))
  }
}
