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

export async function saveWeeklyTask(data: any): Promise<void> {
  if (!supabase) return memoryStore.set('calendar_task', data)

  const { error } = await supabase
    .from('schedules')
    .upsert({ id: 'calendar_task', data, updated_at: new Date().toISOString() })

  if (error) {
    console.error('Error saving weekly task to Supabase:', error)
    throw error
  }
}

export async function getWeeklyTask(): Promise<any> {
  if (!supabase) return memoryStore.get('calendar_task')

  const { data, error } = await supabase
    .from('schedules')
    .select('data')
    .eq('id', 'calendar_task')
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error getting weekly task from Supabase:', error)
    return null
  }

  return data?.data || null
}

export async function saveDailyTask(date: string, data: any): Promise<void> {
  const id = `task:daily:${date}`
  if (!supabase) return memoryStore.set(id, data)

  const { error } = await supabase
    .from('schedules')
    .upsert({ id, data, updated_at: new Date().toISOString() })

  if (error) {
    console.error('Error saving daily task to Supabase:', error)
    throw error
  }
}

export async function getDailyTask(date: string): Promise<any> {
  const id = `task:daily:${date}`
  if (!supabase) return memoryStore.get(id)

  const { data, error } = await supabase
    .from('schedules')
    .select('data')
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error getting daily task from Supabase:', error)
    return null
  }

  return data?.data || null
}

export async function saveDailyStaff(date: string, data: any): Promise<void> {
  const id = `staff:daily:${date}`
  if (!supabase) return memoryStore.set(id, data)

  const { error } = await supabase
    .from('schedules')
    .upsert({ id, data, updated_at: new Date().toISOString() })

  if (error) {
    console.error('Error saving daily staff to Supabase:', error)
    throw error
  }
}

export async function getDailyStaff(date: string): Promise<any> {
  const id = `staff:daily:${date}`
  if (!supabase) return memoryStore.get(id)

  const { data, error } = await supabase
    .from('schedules')
    .select('data')
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error getting daily staff from Supabase:', error)
    return null
  }

  return data?.data || null
}

export async function getDailyStaffDates(): Promise<{ dates: string[], colors: Record<string, string[]> }> {
  if (!supabase) {
    const keys = await memoryStore.keys('staff:daily:*')
    // memoryStore fallback.. (로컬 환경 테스트용이므로 깊게 처리 생략 또는 대충 처리)
    return { dates: keys.map((k: string) => k.replace('staff:daily:', '')), colors: {} }
  }

  const { data, error } = await supabase
    .from('schedules')
    .select('id, data')
    .like('id', 'staff:daily:%')

  if (error) {
    console.error('Error getting staff dates from Supabase:', error)
    return { dates: [], colors: {} }
  }

  const staffDates: string[] = []
  const colors: Record<string, string[]> = {}
  
  for (const row of (data || [])) {
    const staffData = row.data
    if (staffData.assignments?.length > 0) {
      const dateStr = row.id.replace('staff:daily:', '')
      staffDates.push(dateStr)
      colors[dateStr] = staffData.assignments.filter((a: any) => a.name.trim() !== '').map((a: any) => a.color)
    }
  }

  return { dates: staffDates.sort(), colors }
}

export async function saveGlobalStaff(data: any): Promise<void> {
  const id = `staff:global`
  if (!supabase) return memoryStore.set(id, data)

  const { error } = await supabase
    .from('schedules')
    .upsert({ id, data, updated_at: new Date().toISOString() })

  if (error) {
    console.error('Error saving global staff to Supabase:', error)
    throw error
  }
}

export async function getGlobalStaff(): Promise<any> {
  const id = `staff:global`
  if (!supabase) return memoryStore.get(id)

  const { data, error } = await supabase
    .from('schedules')
    .select('data')
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error getting global staff from Supabase:', error)
    return null
  }

  return data?.data || null
}


export async function saveMwInspection(date: string, data: any): Promise<void> {
  const id = `mw_inspection:${date}`
  if (!supabase) return memoryStore.set(id, data)

  const { error } = await supabase
    .from('schedules')
    .upsert({ id, data, updated_at: new Date().toISOString() })

  if (error) {
    console.error('Error saving MwInspection to Supabase:', error)
    throw error
  }
}

export async function getMwInspection(date: string): Promise<any> {
  const id = `mw_inspection:${date}`
  if (!supabase) return memoryStore.get(id)

  const { data, error } = await supabase
    .from('schedules')
    .select('data')
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error getting MwInspection from Supabase:', error)
    return null
  }

  return data?.data || null
}

export async function getMwCompletionDates(year: string, month: string): Promise<string[]> {
  const prefix = 'mw_inspection:'
  const pattern = `${year}-${month}`
  
  if (!supabase) {
    const keys = await memoryStore.keys(`${prefix}${pattern}*`)
    return keys.map(k => k.replace(prefix, ''))
  }

  const { data, error } = await supabase
    .from('schedules')
    .select('id')
    .like('id', `${prefix}${pattern}%`)

  if (error) {
    console.error('Error getting MwCompletionDates from Supabase:', error)
    return []
  }

  return data?.map(row => row.id.replace(prefix, '')) || []
}

export async function deleteMwInspection(date: string): Promise<void> {
  const id = `mw_inspection:${date}`
  if (!supabase) return memoryStore.del(id)

  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting MwInspection from Supabase:', error)
    throw error
  }
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

  // 최근 2개월 전부터 2개월 후까지 체크 (달력 표시 범위 고려)
  const today = new Date()
  for (let i = -60; i <= 60; i++) {
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

export async function getDailyTaskDates(): Promise<string[]> {
  if (!supabase) return memoryStore.keys('task:daily:*')

  const { data, error } = await supabase
    .from('schedules')
    .select('id, data')
    .like('id', 'task:daily:%')

  if (error) {
    console.error('Error getting task dates from Supabase:', error)
    return []
  }

  const taskDates: string[] = []
  for (const row of (data || [])) {
    const taskData = row.data
    if (taskData.tasks?.length > 0) {
      taskDates.push(row.id.replace('task:daily:', ''))
    }
  }

  return taskDates.sort()
}

export async function getCompletedTaskDates(): Promise<string[]> {
  // 1. 업무 데이터 로드
  const weeklyTask = await getWeeklyTask()
  if (!weeklyTask) return []

  const { data: dailyTaskRows } = supabase
    ? await supabase.from('schedules').select('id, data').like('id', 'task:daily:%')
    : { data: await memoryStore.keys('task:daily:*').then(keys => Promise.all(keys.map(async k => ({ id: k, data: await memoryStore.get(k) })))) }

  // 2. 녹음 일정 데이터 로드 (동기화를 위해 필요)
  const weeklySchedule = await getWeeklySchedule()
  const { data: dailyScheduleRows } = supabase
    ? await supabase.from('schedules').select('id, data').like('id', 'schedule:daily:%')
    : { data: await memoryStore.keys('schedule:daily:*').then(keys => Promise.all(keys.map(async k => ({ id: k, data: await memoryStore.get(k) })))) }

  const completedDates: string[] = []
  
  // 맵핑 생성
  const dailyTaskMap = new Map<string, any>()
  dailyTaskRows?.forEach((row: any) => {
    dailyTaskMap.set(row.id.replace('task:daily:', ''), row.data)
  })

  const dailyScheduleMap = new Map<string, any>()
  dailyScheduleRows?.forEach((row: any) => {
    dailyScheduleMap.set(row.id.replace('schedule:daily:', ''), row.data)
  })

  const today = new Date()
  for (let i = -60; i <= 60; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const dayIndex = d.getDay() as 0|1|2|3|4|5|6

    // --- 업무(Tasks) 체크 ---
    const dailyT = dailyTaskMap.get(dateStr)
    const tCompletedIds = dailyT?.completedTaskIds || []
    const tCanceledIds = dailyT?.canceledWeeklyIds || []

    const weeklyTProgs = (weeklyTask[dayIndex] || []).filter((p: any) => !tCanceledIds.includes(p.id))
    const dailyTProgs = dailyT?.tasks || []
    
    // --- 녹음(Schedules) 체크 ---
    const dailyS = dailyScheduleMap.get(dateStr)
    const sCompletedIds = dailyS?.completedProgramIds || []
    const sCanceledIds = dailyS?.canceledWeeklyIds || []

    const recordingProgs: any[] = []
    if (weeklySchedule) {
      (['1R', '2R', 'MFM'] as const).forEach(medium => {
        (weeklySchedule[medium]?.[dayIndex] || []).forEach((p: any) => {
          if (!sCanceledIds.includes(p.id)) recordingProgs.push(p)
        })
      })
    }
    if (dailyS) {
      (['1R', '2R', 'MFM'] as const).forEach(medium => {
        (dailyS[medium] || []).forEach((p: any) => recordingProgs.push(p))
      })
    }
    
    // --- 전체 병합 및 완료 확인 ---
    const allItems = [...weeklyTProgs, ...dailyTProgs, ...recordingProgs]
    const totalCount = allItems.length
    if (totalCount === 0) continue

    let completedCount = 0
    // 업무 완료 확인
    const taskIds = [...weeklyTProgs, ...dailyTProgs].map(p => p.id)
    taskIds.forEach(id => {
      if (tCompletedIds.includes(id)) completedCount++
    })
    // 녹음 완료 확인
    recordingProgs.forEach(p => {
      if (sCompletedIds.includes(p.id)) completedCount++
    })

    if (totalCount === completedCount) {
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
