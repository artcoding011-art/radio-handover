'use client'

import { useState, useEffect } from 'react'
import { WeeklyScheduleData, DailyScheduleData, ScheduleProgram } from '@/lib/types'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const MEDIUMS = ['1R', '2R', 'MFM'] as const

const getMediumColor = (medium: '1R' | '2R' | 'MFM') => {
  switch (medium) {
    case '1R': return {
      text: 'text-blue-700',
      bgTab: 'bg-blue-600',
      bgTabHover: 'hover:bg-blue-700',
      bgLight: 'bg-blue-50',
      borderLight: 'border-blue-100',
      borderHover: 'hover:border-blue-200',
      borderFocus: 'focus:border-blue-500 focus:ring-blue-500'
    }
    case '2R': return {
      text: 'text-orange-700',
      bgTab: 'bg-orange-500',
      bgTabHover: 'hover:bg-orange-600',
      bgLight: 'bg-orange-50',
      borderLight: 'border-orange-100',
      borderHover: 'hover:border-orange-200',
      borderFocus: 'focus:border-orange-500 focus:ring-orange-500'
    }
    case 'MFM': return {
      text: 'text-pink-700',
      bgTab: 'bg-pink-600',
      bgTabHover: 'hover:bg-pink-700',
      bgLight: 'bg-pink-50',
      borderLight: 'border-pink-100',
      borderHover: 'hover:border-pink-200',
      borderFocus: 'focus:border-pink-500 focus:ring-pink-500'
    }
  }
}

function createEmptyWeeklySchedule(): WeeklyScheduleData {
  return {
    '1R': [[], [], [], [], [], [], []],
    '2R': [[], [], [], [], [], [], []],
    'MFM': [[], [], [], [], [], [], []],
  } as WeeklyScheduleData
}

function createEmptyDailySchedule(): DailyScheduleData {
  return { '1R': [], '2R': [], 'MFM': [], canceledWeeklyIds: [], completedProgramIds: [] }
}

export default function ScheduleManager({ 
  selectedDate,
  initialWeeklySchedule, 
  initialDailySchedule,
  onUpdated,
  onOptimisticSync
}: { 
  selectedDate: Date,
  initialWeeklySchedule: WeeklyScheduleData | null, 
  initialDailySchedule: DailyScheduleData | null,
  onUpdated: () => void,
  onOptimisticSync: (w: WeeklyScheduleData | null, d: DailyScheduleData | null) => void
}) {
  const [tab, setTab] = useState<'weekly' | 'daily'>('weekly')
  
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleData | null>(initialWeeklySchedule || createEmptyWeeklySchedule())
  const [dailySchedule, setDailySchedule] = useState<DailyScheduleData | null>(initialDailySchedule || createEmptyDailySchedule())
  
  const [activeMedium, setActiveMedium] = useState<'1R' | '2R' | 'MFM'>('1R')
  const [activeDay, setActiveDay] = useState<number>(0)
  
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [newProgram, setNewProgram] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Custom Delete Modal State
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  // 포매터
  const formatTimeInput = (value: string, setter: (v: string) => void) => {
    let v = value.replace(/[^\d]/g, '')
    if (v.length > 4) v = v.slice(0, 4)
    if (v.length >= 3) {
      setter(`${v.slice(0, 2)}:${v.slice(2)}`)
    } else {
      setter(v)
    }
  }

  const isValidTime = (time: string) => {
    return /^([01][0-9]|2[0-3]):([0-5][0-9])$/.test(time)
  }

  useEffect(() => {
    if (initialWeeklySchedule) {
      setWeeklySchedule(initialWeeklySchedule)
    } else {
      setWeeklySchedule(createEmptyWeeklySchedule())
    }
  }, [initialWeeklySchedule])

  useEffect(() => {
    if (initialDailySchedule) {
      setDailySchedule(initialDailySchedule)
    } else {
      setDailySchedule(createEmptyDailySchedule())
    }
  }, [initialDailySchedule])

  useEffect(() => {
    setActiveDay(selectedDate.getDay())
  }, [selectedDate])

  const handleSaveWeeklyToServer = async (newData: WeeklyScheduleData) => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData)
      })
      if (!res.ok) throw new Error('Failed to save weekly')
    } catch (err) {
      alert('주간 일정 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveDailyToServer = async (newData: DailyScheduleData) => {
    setIsSaving(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const res = await fetch(`/api/schedule/daily/${dateStr}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData)
      })
      if (!res.ok) throw new Error('Failed to save daily')
    } catch (err) {
      alert('일별 일정 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddProgram = async () => {
    if (!newStart || !newEnd || !newProgram.trim()) return
    if (!isValidTime(newStart) || !isValidTime(newEnd)) {
      alert('시간은 00:00 ~ 23:59 사이의 형식으로 정확히 입력해주세요. (예: 14:30)')
      return
    }

    const generateId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11) + Date.now();

    const newProg: ScheduleProgram = {
      id: generateId(),
      startTime: newStart,
      endTime: newEnd,
      programName: newProgram.trim()
    }

    if (tab === 'weekly') {
      if (!weeklySchedule) return
      const updated: WeeklyScheduleData = JSON.parse(JSON.stringify(weeklySchedule))
      updated[activeMedium][activeDay as 0|1|2|3|4|5|6].push(newProg)
      updated[activeMedium][activeDay as 0|1|2|3|4|5|6].sort((a, b) => a.startTime.localeCompare(b.startTime))
      setWeeklySchedule(updated)
      onOptimisticSync(updated, null)
      await handleSaveWeeklyToServer(updated)
    } else {
      if (!dailySchedule) return
      const updated: DailyScheduleData = JSON.parse(JSON.stringify(dailySchedule))
      updated[activeMedium].push(newProg)
      updated[activeMedium].sort((a, b) => a.startTime.localeCompare(b.startTime))
      setDailySchedule(updated)
      onOptimisticSync(null, updated)
      await handleSaveDailyToServer(updated)
    }
    
    onUpdated()
    setNewStart('')
    setNewEnd('')
    setNewProgram('')
  }

  const requestDelete = (id: string) => setDeleteTargetId(id)

  const executeDelete = async () => {
    if (!deleteTargetId) return
    const id = deleteTargetId
    setDeleteTargetId(null)

    if (tab === 'weekly') {
      if (!weeklySchedule) return
      const updated: WeeklyScheduleData = JSON.parse(JSON.stringify(weeklySchedule))
      updated[activeMedium][activeDay as 0|1|2|3|4|5|6] = updated[activeMedium][activeDay as 0|1|2|3|4|5|6].filter((p: ScheduleProgram) => p.id !== id)
      setWeeklySchedule(updated)
      onOptimisticSync(updated, null)
      await handleSaveWeeklyToServer(updated)
    } else {
      if (!dailySchedule) return
      const updated: DailyScheduleData = JSON.parse(JSON.stringify(dailySchedule))
      updated[activeMedium] = updated[activeMedium].filter((p: ScheduleProgram) => p.id !== id)
      setDailySchedule(updated)
      onOptimisticSync(null, updated)
      await handleSaveDailyToServer(updated)
    }
    
    onUpdated()
  }

  const handleToggleComplete = async (progId: string) => {
    if (!dailySchedule) return
    const updated: DailyScheduleData = JSON.parse(JSON.stringify(dailySchedule))
    const completedIds = updated.completedProgramIds || []
    
    if (completedIds.includes(progId)) {
      updated.completedProgramIds = completedIds.filter(id => id !== progId)
    } else {
      updated.completedProgramIds = [...completedIds, progId]
    }
    
    setDailySchedule(updated)
    onOptimisticSync(null, updated)
    await handleSaveDailyToServer(updated)
    onUpdated()
  }

  const currentDayPrograms = tab === 'weekly' 
    ? (weeklySchedule?.[activeMedium][activeDay as 0|1|2|3|4|5|6] || [])
    : (dailySchedule?.[activeMedium] || [])

  const targetLabel = tab === 'weekly' ? `${DAYS[activeDay]}요일 주간 반복 일정` : `${format(selectedDate, 'MM.dd (eee)', { locale: ko })} 녹음 추가 일정`

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden flex flex-col mt-4">
      
      {/* 최상단 메인 탭 */}
      <div className="flex bg-slate-100 border-b border-gray-200">
        <button 
          onClick={() => setTab('weekly')}
          className={`flex-1 py-3 text-sm font-bold transition-all flex justify-center items-center gap-2 ${tab === 'weekly' ? 'bg-white text-indigo-700 shadow-[inset_0_3px_0_0_#4f46e5]' : 'text-gray-500 hover:bg-slate-50'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          주간 기본 편성 관리 (매주 반복)
        </button>
        <button 
          onClick={() => setTab('daily')}
          className={`flex-1 py-3 text-sm font-bold transition-all flex justify-center items-center gap-2 ${tab === 'daily' ? 'bg-white text-emerald-700 shadow-[inset_0_3px_0_0_#10b981]' : 'text-gray-500 hover:bg-slate-50'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          녹음 일정 관리(일별 추가)
        </button>
      </div>

      {/* 본문 영역 */}
      <div className="p-4 flex-1 overflow-y-auto">
        
        {/* 매체 선택 탭 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1.5">
            {MEDIUMS.map(m => (
              <button
                key={m}
                onClick={() => setActiveMedium(m)}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all ${
                  activeMedium === m 
                    ? `${tab === 'weekly' ? getMediumColor(m).bgTab : 'bg-emerald-600'} text-white shadow-sm`
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {isSaving && <span className="text-xs text-indigo-500 font-semibold animate-pulse px-2">저장 중...</span>}
        </div>

        {/* 요일 선택 서브 탭 (주간일 때만 노출) */}
        {tab === 'weekly' && (
          <div className="flex bg-gray-50 rounded-lg p-1.5 mb-4 gap-1">
            {DAYS.map((day, idx) => (
              <button
                key={day}
                onClick={() => setActiveDay(idx)}
                className={`flex-1 py-1 텍스트-sm font-bold rounded-md transition-all ${
                  activeDay === idx 
                    ? `bg-white ${getMediumColor(activeMedium).text} shadow-sm` 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        )}

        {tab === 'daily' && (
           <div className="mb-4 py-1.5 px-3 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-100 flex items-center gap-2">
             <span className="text-[13px]">선택된 날짜 :</span>
             <span className="text-[14px] underline underline-offset-4 decoration-emerald-300">{format(selectedDate, 'yyyy년 MM월 dd일 (eee)', { locale: ko })}</span>
           </div>
        )}

        {/* 일정 리스트 */}
        <div className="mb-5 space-y-1.5">
          {currentDayPrograms.length === 0 ? (
            <div className={`text-center py-4 rounded-lg border border-dashed border-gray-200 text-gray-400 text-sm ${tab === 'daily' ? 'bg-emerald-50/30' : `${getMediumColor(activeMedium).bgLight}/30`}`}>
              해당 구역에 등록된 일정이 없습니다.
            </div>
          ) : (
            currentDayPrograms.map(prog => {
              const isCompleted = dailySchedule?.completedProgramIds?.includes(prog.id)
              return (
                <div key={prog.id} className={`flex items-center justify-between bg-white border rounded-lg p-2.5 transition-all shadow-sm ${isCompleted ? 'bg-emerald-50/40 border-emerald-200' : (tab === 'daily' ? 'border-emerald-200 hover:border-emerald-300' : `${getMediumColor(activeMedium).borderLight} ${getMediumColor(activeMedium).borderHover}`)}`}>
                  <div className="flex items-center gap-3">
                    {tab === 'daily' && (
                      <button 
                        onClick={() => handleToggleComplete(prog.id)}
                        className={`w-6 h-6 flex items-center justify-center rounded border transition-colors ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 text-transparent hover:border-emerald-500'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </button>
                    )}
                    <div className={`${tab === 'weekly' ? `${getMediumColor(activeMedium).bgLight} ${getMediumColor(activeMedium).text}` : 'bg-emerald-50 text-emerald-700'} font-mono font-bold text-[13px] px-2 py-0.5 rounded`}>
                      {prog.startTime} ~ {prog.endTime}
                    </div>
                    <div className={`font-semibold text-[14px] ${isCompleted ? 'text-gray-400 line-through decoration-emerald-500/50' : 'text-gray-800'}`}>
                      {prog.programName}
                    </div>
                  </div>
                  <button 
                    onClick={() => requestDelete(prog.id)}
                    className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* 일정 추가 폼 */}
        <div className={`border rounded-lg p-3 ${tab === 'daily' ? 'bg-emerald-50/30 border-emerald-100' : `${getMediumColor(activeMedium).bgLight}/30 ${getMediumColor(activeMedium).borderLight}`}`}>
          <h4 className="text-[13px] font-bold text-slate-700 mb-2.5 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
            새 일정 추가 <span className="text-gray-400 font-normal">({activeMedium} / {targetLabel})</span>
          </h4>
          <div className="flex gap-1.5">
            <input 
              type="text" 
              placeholder="시작 (00:00)"
              maxLength={5}
              value={newStart}
              onChange={e => formatTimeInput(e.target.value, setNewStart)}
              className={`w-[90px] px-2 py-2 border border-gray-300 rounded-lg text-sm text-center font-mono placeholder:text-[11px] placeholder:font-sans focus:outline-none focus:ring-1 ${tab === 'weekly' ? getMediumColor(activeMedium).borderFocus : 'focus:border-emerald-500 focus:ring-emerald-500'}`}
            />
            <span className="text-gray-400 flex items-center">-</span>
            <input 
              type="text" 
              placeholder="종료 (00:00)"
              maxLength={5}
              value={newEnd}
              onChange={e => formatTimeInput(e.target.value, setNewEnd)}
              className={`w-[90px] px-2 py-2 border border-gray-300 rounded-lg text-sm text-center font-mono placeholder:text-[11px] placeholder:font-sans focus:outline-none focus:ring-1 ${tab === 'weekly' ? getMediumColor(activeMedium).borderFocus : 'focus:border-emerald-500 focus:ring-emerald-500'}`}
            />
            <input 
              type="text" 
              placeholder="프로그램명 입력"
              value={newProgram}
              onChange={e => setNewProgram(e.target.value)}
              className={`flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder:text-[11px] focus:outline-none focus:ring-1 ${tab === 'weekly' ? getMediumColor(activeMedium).borderFocus : 'focus:border-emerald-500 focus:ring-emerald-500'}`}
            />
            <button 
              onClick={handleAddProgram}
              disabled={newStart.length < 5 || newEnd.length < 5 || !newProgram.trim()}
              className={`px-4 py-2 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${tab === 'weekly' ? `${getMediumColor(activeMedium).bgTab} ${getMediumColor(activeMedium).bgTabHover}` : 'bg-emerald-600 hover:bg-emerald-700'}`}
            >
              추가
            </button>
          </div>
        </div>
      </div>

      {/* 커스텀 삭제 확인 모달 */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-[10000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-[320px] mx-auto transform animate-[popIn_0.2s_ease-out]">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <div className="p-2 bg-red-50 rounded-full">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800">일정 삭제</h3>
            </div>
            <p className="text-base text-slate-600 mb-6 pl-1 font-medium">일정을 삭제하시겠습니까?</p>
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setDeleteTargetId(null)} 
                className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
              >
                아니오
              </button>
              <button 
                onClick={executeDelete} 
                className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors shadow-sm shadow-red-200"
              >
                예
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
