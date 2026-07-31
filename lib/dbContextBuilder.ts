import {
  getEntry,
  getMwInspection,
  getDailySchedule,
  getDailyTask,
  getDailyStaff,
  getWeeklySchedule,
  getWeeklyTask,
} from '@/lib/db'

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getDatesInRange(from: string, to: string): string[] {
  const result: string[] = []
  const cur = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  while (cur <= end) {
    result.push(toDateStr(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

export function parseDateRangeFromQuery(
  query: string,
  defaultDays = 7
): { from: string; to: string; label: string } {
  const today = new Date()
  const q = query.toLowerCase()

  if (q.includes('오늘') || q.includes('today')) {
    const d = toDateStr(today)
    return { from: d, to: d, label: '오늘' }
  }
  if (q.includes('어제') || q.includes('yesterday')) {
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const d = toDateStr(yesterday)
    return { from: d, to: d, label: '어제' }
  }
  if (q.includes('이번 주') || q.includes('이번주') || q.includes('금주')) {
    const dow = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
    return { from: toDateStr(monday), to: toDateStr(today), label: '이번 주' }
  }
  if (q.includes('지난 주') || q.includes('지난주')) {
    const dow = today.getDay()
    const lastMonday = new Date(today)
    lastMonday.setDate(today.getDate() - (dow === 0 ? 13 : dow + 6))
    const lastSunday = new Date(lastMonday)
    lastSunday.setDate(lastMonday.getDate() + 6)
    return { from: toDateStr(lastMonday), to: toDateStr(lastSunday), label: '지난 주' }
  }
  if (q.includes('이번 달') || q.includes('이번달')) {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: toDateStr(firstDay), to: toDateStr(today), label: '이번 달' }
  }
  if (q.includes('지난 달') || q.includes('지난달')) {
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0)
    return { from: toDateStr(firstDay), to: toDateStr(lastDay), label: '지난 달' }
  }
  const recentMatch = q.match(/최근\s*(\d+)\s*일/)
  if (recentMatch) {
    const n = parseInt(recentMatch[1])
    const to2 = new Date()
    const from2 = new Date(to2)
    from2.setDate(to2.getDate() - (n - 1))
    return { from: toDateStr(from2), to: toDateStr(to2), label: '최근 ' + n + '일' }
  }
  const dateMatch = query.match(/(\d{4})[-.](\d{1,2})[-.](\d{1,2})/)
  if (dateMatch) {
    const d = dateMatch[1] + '-' + dateMatch[2].padStart(2, '0') + '-' + dateMatch[3].padStart(2, '0')
    return { from: d, to: d, label: d }
  }
  const toD = new Date()
  const fromD = new Date(toD)
  fromD.setDate(toD.getDate() - (defaultDays - 1))
  return { from: toDateStr(fromD), to: toDateStr(toD), label: '최근 ' + defaultDays + '일' }
}

async function buildHandoverContext(from: string, to: string): Promise<string> {
  const dates = getDatesInRange(from, to).reverse()
  const lines: string[] = ['[업무인계서] (' + from + ' ~ ' + to + ')\n']
  let count = 0
  for (const date of dates) {
    const entry = await getEntry(date)
    if (!entry) continue
    lines.push('◆ ' + date)
    lines.push('  근무자: ' + (entry.근무자 || '-') + ' | 결재자: ' + (entry.결재자 || '-'))
    if (entry.rStudio?.현업주요사항?.trim()) {
      lines.push('  현업주요사항: ' + entry.rStudio.현업주요사항.trim())
    }
    if (entry.rMCR?.특이사항?.trim()) {
      lines.push('  특이사항: ' + entry.rMCR.특이사항.trim())
    }
    const abnormals: string[] = []
    const checkItems = entry.rStudio?.체크항목
    if (checkItems) {
      for (const [item, vals] of Object.entries(checkItems)) {
        const v = vals as unknown as Record<string, string>
        for (const [medium, status] of Object.entries(v)) {
          if (status && status !== '정상' && medium !== '매체') {
            abnormals.push(item + '(' + medium + '): ' + status)
          }
        }
      }
    }
    if (abnormals.length > 0) lines.push('  비정상 항목: ' + abnormals.join(', '))
    lines.push('')
    count++
  }
  if (count === 0) return ''
  return lines.join('\n')
}

async function buildMwContext(from: string, to: string): Promise<string> {
  const dates = getDatesInRange(from, to).reverse()
  const lines: string[] = ['[M/W 점검일지] (' + from + ' ~ ' + to + ')\n']
  let count = 0
  for (const date of dates) {
    const data = await getMwInspection(date)
    if (!data) continue
    lines.push('◆ ' + date)
    lines.push('  점검자: ' + ((data as any).inspector || '-') + ' | 시간: ' + ((data as any).time || '-') + ' | 온도: ' + ((data as any).temperature || '-') + '°C | 습도: ' + ((data as any).humidity || '-') + '%')
    const txKeys = ['1R_TX1', '1R_TX2', '2R_TX1', '2R_TX2', 'MFM_TX1', 'MFM_TX2']
    for (const key of txKeys) {
      const tx = (data as any)[key]
      if (!tx) continue
      const status = tx.isOperating ? '운영중' : '미운영'
      lines.push('  ' + key + ': ' + status + ' | PD:' + (tx.pd || '-') + ' MPX:' + (tx.mpx || '-') + ' L:' + (tx.leftLvl || '-') + ' R:' + (tx.rightLvl || '-') + ' T:' + (tx.t || '-') + '°C')
    }
    lines.push('')
    count++
  }
  if (count === 0) return ''
  return lines.join('\n')
}

async function buildScheduleContext(from: string, to: string): Promise<string> {
  const dates = getDatesInRange(from, to).reverse()
  const weekly = await getWeeklySchedule()
  const lines: string[] = ['[제작일정] (' + from + ' ~ ' + to + ')\n']
  const mediums = ['1R', '2R', 'MFM'] as const
  let count = 0
  for (const date of dates) {
    const daily = await getDailySchedule(date)
    const dayIdx = new Date(date + 'T00:00:00').getDay() as 0|1|2|3|4|5|6
    const allProgs: string[] = []
    for (const medium of mediums) {
      const wProgs = (weekly?.[medium]?.[dayIdx] || [])
        .filter((p: any) => !daily?.canceledWeeklyIds?.includes(p.id))
      const dProgs = daily?.[medium] || []
      const progs = [...wProgs, ...dProgs].sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))
      for (const p of progs) {
        const done = daily?.completedProgramIds?.includes(p.id) ? '✓완료' : '○진행'
        allProgs.push('    [' + medium + '] ' + done + ' ' + p.startTime + '~' + p.endTime + ' ' + p.programName)
      }
    }
    if (allProgs.length > 0) {
      lines.push('◆ ' + date)
      lines.push(...allProgs)
      lines.push('')
      count++
    }
  }
  if (count === 0) return ''
  return lines.join('\n')
}

async function buildTaskContext(from: string, to: string): Promise<string> {
  const dates = getDatesInRange(from, to).reverse()
  const weekly = await getWeeklyTask()
  const lines: string[] = ['[업무일정] (' + from + ' ~ ' + to + ')\n']
  let count = 0
  for (const date of dates) {
    const daily = await getDailyTask(date)
    const dayIdx = new Date(date + 'T00:00:00').getDay() as 0|1|2|3|4|5|6
    const wTasks = (weekly?.[dayIdx] || []).filter((p: any) => !daily?.canceledWeeklyIds?.includes(p.id))
    const dTasks = daily?.tasks || []
    const allTasks = [...wTasks, ...dTasks].sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))
    if (allTasks.length > 0) {
      lines.push('◆ ' + date)
      for (const t of allTasks) {
        const done = daily?.completedTaskIds?.includes(t.id) ? '✓완료' : '○진행'
        lines.push('    ' + done + ' ' + t.startTime + '~' + t.endTime + ' ' + t.taskName)
      }
      lines.push('')
      count++
    }
  }
  if (count === 0) return ''
  return lines.join('\n')
}

async function buildStaffContext(from: string, to: string): Promise<string> {
  const dates = getDatesInRange(from, to).reverse()
  const lines: string[] = ['[근무자 배정] (' + from + ' ~ ' + to + ')\n']
  let count = 0
  for (const date of dates) {
    const data = await getDailyStaff(date)
    if (!(data as any)?.assignments?.length) continue
    lines.push('◆ ' + date)
    for (const a of (data as any).assignments) {
      lines.push('    ' + a.role + ' ' + a.name + ' (' + a.shift + ')')
    }
    lines.push('')
    count++
  }
  if (count === 0) return ''
  return lines.join('\n')
}

export interface DbContextOptions {
  useHandover: boolean
  useMwInspection: boolean
  useSchedule: boolean
  useTask: boolean
  useStaff: boolean
  from?: string
  to?: string
}

export interface DbContextResult {
  context: string
  summary: string
  daysLoaded: number
}

export async function buildDbContext(
  query: string,
  options: DbContextOptions,
  defaultDays = 7
): Promise<DbContextResult> {
  let from: string
  let to: string
  let label: string

  if (options.from && options.to) {
    from = options.from
    to = options.to
    label = from + ' ~ ' + to
  } else {
    const parsed = parseDateRangeFromQuery(query, defaultDays)
    from = parsed.from
    to = parsed.to
    label = parsed.label
  }

  const daysLoaded = getDatesInRange(from, to).length
  const sections: string[] = []
  const loadedTypes: string[] = []

  if (options.useHandover) {
    const ctx = await buildHandoverContext(from, to)
    if (ctx) { sections.push(ctx); loadedTypes.push('업무인계서') }
  }
  if (options.useMwInspection) {
    const ctx = await buildMwContext(from, to)
    if (ctx) { sections.push(ctx); loadedTypes.push('M/W 점검일지') }
  }
  if (options.useSchedule) {
    const ctx = await buildScheduleContext(from, to)
    if (ctx) { sections.push(ctx); loadedTypes.push('제작일정') }
  }
  if (options.useTask) {
    const ctx = await buildTaskContext(from, to)
    if (ctx) { sections.push(ctx); loadedTypes.push('업무일정') }
  }
  if (options.useStaff) {
    const ctx = await buildStaffContext(from, to)
    if (ctx) { sections.push(ctx); loadedTypes.push('근무자 배정') }
  }

  const context = sections.length > 0
    ? '=== DB 참고 데이터 (' + label + ' / ' + daysLoaded + '일치) ===\n\n' + sections.join('\n---\n\n')
    : ''

  const summary = loadedTypes.length > 0
    ? 'DB에서 ' + label + ' (' + daysLoaded + '일치) 데이터를 불러왔습니다: ' + loadedTypes.join(', ') + '.'
    : 'DB에서 해당 기간(' + label + ') 데이터를 찾을 수 없습니다.'

  return { context, summary, daysLoaded }
}
