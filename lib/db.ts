import { HandoverEntry } from './types'

// Vercel KV를 사용하거나 로컬 개발 시 메모리 스토어 사용
let kv: any = null

async function getKV() {
  if (kv) return kv
  
  // Vercel KV 환경 변수가 없으면 무조건 로컬 메모리 스토어 사용
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    // console.log("Using local memory store")
    kv = memoryStore
    return kv
  }

  try {
    const { kv: vercelKV } = await import('@vercel/kv')
    kv = vercelKV
    return kv
  } catch {
    // 로컬 개발용 메모리 스토어 폴백
    kv = memoryStore
    return kv
  }
}

import fs from 'fs'
import path from 'path'

// 로컬 파일 스토어 (Next.js 개발 중 메모리 증발 방지용)
const LOCAL_DB_PATH = path.join(process.cwd(), 'local_db.json')

function loadLocalData(): Record<string, any> {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const data = fs.readFileSync(LOCAL_DB_PATH, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error reading local DB:', error)
  }
  return {}
}

function saveLocalData(data: Record<string, any>) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error writing local DB:', error)
  }
}

const memoryStore = {
  get: async (key: string) => {
    const db = loadLocalData()
    return db[key] ?? null
  },
  set: async (key: string, value: any) => { 
    const db = loadLocalData()
    db[key] = value
    saveLocalData(db)
  },
  del: async (key: string) => { 
    const db = loadLocalData()
    delete db[key]
    saveLocalData(db)
  },
  smembers: async (key: string) => {
    const db = loadLocalData()
    return db[key] ?? []
  },
  sadd: async (key: string, ...values: string[]) => {
    const db = loadLocalData()
    if (!db[key]) db[key] = []
    for (const v of values) {
      if (!db[key].includes(v)) db[key].push(v)
    }
    saveLocalData(db)
  },
  keys: async (pattern: string) => {
    const db = loadLocalData()
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
    return Object.keys(db).filter(k => regex.test(k))
  }
}

export async function saveEntry(entry: HandoverEntry): Promise<void> {
  const store = await getKV()
  await store.set(`entry:${entry.date}`, entry)
  await store.sadd('entry:dates', entry.date)
}

export async function getEntry(date: string): Promise<HandoverEntry | null> {
  const store = await getKV()
  return store.get(`entry:${date}`)
}

export async function getAllDates(): Promise<string[]> {
  const store = await getKV()
  const dates = await store.smembers('entry:dates')
  return Array.isArray(dates) ? dates.sort() : []
}

export async function deleteEntry(date: string): Promise<void> {
  const store = await getKV()
  await store.del(`entry:${date}`)
}

export async function getEntriesByMonth(month: string): Promise<HandoverEntry[]> {
  const allDates = await getAllDates()
  const monthDates = allDates.filter(d => d.startsWith(month))
  
  const entries = await Promise.all(
    monthDates.map(date => getEntry(date))
  )
  return entries.filter((e): e is HandoverEntry => e !== null)
}

export async function getWeeklySchedule(): Promise<any> {
  const store = await getKV()
  return await store.get('calendar_schedule')
}

export async function saveWeeklySchedule(data: any): Promise<void> {
  const store = await getKV()
  await store.set('calendar_schedule', data)
}

export async function getDailySchedule(date: string): Promise<any> {
  const store = await getKV()
  return await store.get(`schedule:daily:${date}`)
}

export async function saveDailySchedule(date: string, data: any): Promise<void> {
  const store = await getKV()
  await store.set(`schedule:daily:${date}`, data)
}

export async function getDailyRecordingDates(): Promise<string[]> {
  const store = await getKV()
  let keys: string[] = []
  
  if (typeof store.keys === 'function') {
    keys = await store.keys('schedule:daily:*')
  }

  const recordingDates: string[] = []
  
  for (const key of keys) {
    const data = await store.get(key)
    if (data) {
      const hasRecording = (data['1R']?.length > 0) || (data['2R']?.length > 0) || (data['MFM']?.length > 0)
      if (hasRecording) {
        recordingDates.push(key.replace('schedule:daily:', ''))
      }
    }
  }
  
  return recordingDates
}
