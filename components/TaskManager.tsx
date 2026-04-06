'use client'

import { useState, useEffect } from 'react'
import { WeeklyTaskData, DailyTaskData, TaskItem, DailyScheduleData } from '@/lib/types'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

function createEmptyWeeklyTask(): WeeklyTaskData {
  return [[], [], [], [], [], [], []] as WeeklyTaskData
}

function createEmptyDailyTask(): DailyTaskData {
  return { tasks: [], canceledWeeklyIds: [], completedTaskIds: [] }
}

export default function TaskManager({ 
  selectedDate,
  initialWeeklyTask, 
  initialDailyTask,
  initialDailySchedule,
  onUpdated,
  onOptimisticSync,
  onToggleRecordingTask
}: { 
  selectedDate: Date,
  initialWeeklyTask: WeeklyTaskData | null, 
  initialDailyTask: DailyTaskData | null,
  initialDailySchedule?: DailyScheduleData | null,
  onUpdated: () => void,
  onOptimisticSync: (w: WeeklyTaskData | null, d: DailyTaskData | null) => void,
  onToggleRecordingTask?: (id: string) => void
}) {
  const [tab, setTab] = useState<'weekly' | 'daily'>('daily')
  
  const [weeklyTask, setWeeklyTask] = useState<WeeklyTaskData | null>(initialWeeklyTask || createEmptyWeeklyTask())
  const [dailyTask, setDailyTask] = useState<DailyTaskData | null>(initialDailyTask || createEmptyDailyTask())
  
  const [activeDay, setActiveDay] = useState<number>(0)
  
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [newTask, setNewTask] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

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
    if (initialWeeklyTask) {
      setWeeklyTask(initialWeeklyTask)
    } else {
      setWeeklyTask(createEmptyWeeklyTask())
    }
  }, [initialWeeklyTask])

  useEffect(() => {
    if (initialDailyTask) {
      setDailyTask(initialDailyTask)
    } else {
      setDailyTask(createEmptyDailyTask())
    }
  }, [initialDailyTask])

  useEffect(() => {
    setActiveDay(selectedDate.getDay())
  }, [selectedDate])

  const handleSaveWeeklyToServer = async (newData: WeeklyTaskData) => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData)
      })
      if (!res.ok) throw new Error('Failed to save weekly task')
    } catch (err) {
      alert('주간 업무 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveDailyToServer = async (newData: DailyTaskData) => {
    setIsSaving(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const res = await fetch(`/api/task/daily/${dateStr}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData)
      })
      if (!res.ok) throw new Error('Failed to save daily task')
    } catch (err) {
      alert('일별 업무 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddTask = async () => {
    if (!newStart || !newEnd || !newTask.trim()) return
    if (!isValidTime(newStart) || !isValidTime(newEnd)) {
      alert('시간은 00:00 ~ 23:59 사이의 형식으로 정확히 입력해주세요. (예: 14:30)')
      return
    }

    const generateId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11) + Date.now();

    const newItem: TaskItem = {
      id: generateId(),
      startTime: newStart,
      endTime: newEnd,
      taskName: newTask.trim()
    }

    if (tab === 'weekly') {
      if (!weeklyTask) return
      const updated: WeeklyTaskData = JSON.parse(JSON.stringify(weeklyTask))
      updated[activeDay as 0|1|2|3|4|5|6].push(newItem)
      updated[activeDay as 0|1|2|3|4|5|6].sort((a, b) => a.startTime.localeCompare(b.startTime))
      setWeeklyTask(updated)
      onOptimisticSync(updated, null)
      await handleSaveWeeklyToServer(updated)
    } else {
      if (!dailyTask) return
      const updated: DailyTaskData = JSON.parse(JSON.stringify(dailyTask))
      updated.tasks.push(newItem)
      updated.tasks.sort((a, b) => a.startTime.localeCompare(b.startTime))
      setDailyTask(updated)
      onOptimisticSync(null, updated)
      await handleSaveDailyToServer(updated)
    }
    
    onUpdated()
    setNewStart('')
    setNewEnd('')
    setNewTask('')
  }

  const requestDelete = (id: string) => setDeleteTargetId(id)

  const executeDelete = async () => {
    if (!deleteTargetId) return
    const id = deleteTargetId
    setDeleteTargetId(null)

    if (tab === 'weekly') {
      if (!weeklyTask) return
      const updated: WeeklyTaskData = JSON.parse(JSON.stringify(weeklyTask))
      updated[activeDay as 0|1|2|3|4|5|6] = updated[activeDay as 0|1|2|3|4|5|6].filter((p: TaskItem) => p.id !== id)
      setWeeklyTask(updated)
      onOptimisticSync(updated, null)
      await handleSaveWeeklyToServer(updated)
    } else {
      if (!dailyTask) return
      const updated: DailyTaskData = JSON.parse(JSON.stringify(dailyTask))
      updated.tasks = updated.tasks.filter((p: TaskItem) => p.id !== id)
      setDailyTask(updated)
      onOptimisticSync(null, updated)
      await handleSaveDailyToServer(updated)
    }
    
    onUpdated()
  }

  const handleToggleComplete = async (taskId: string) => {
    if (!dailyTask) return
    const updated: DailyTaskData = JSON.parse(JSON.stringify(dailyTask))
    const completedIds = updated.completedTaskIds || []
    
    if (completedIds.includes(taskId)) {
      updated.completedTaskIds = completedIds.filter(id => id !== taskId)
    } else {
      updated.completedTaskIds = [...completedIds, taskId]
    }
    
    setDailyTask(updated)
    onOptimisticSync(null, updated)
    await handleSaveDailyToServer(updated)
    onUpdated()
  }

  let currentDayTasks: any[] = tab === 'weekly' 
    ? (weeklyTask?.[activeDay as 0|1|2|3|4|5|6] || [])
    : (dailyTask?.tasks || [])

  if (tab === 'daily' && initialDailySchedule) {
    const recordingTasks: any[] = [];
    (['1R', '2R', 'MFM'] as const).forEach(medium => {
      (initialDailySchedule[medium] || []).forEach((prog: any) => {
        recordingTasks.push({
          id: `rec_${prog.id}`,
          realId: prog.id,
          startTime: prog.startTime,
          endTime: prog.endTime,
          taskName: `[${medium}] ${prog.programName}`,
          isRecording: true
        });
      });
    });
    currentDayTasks = [...currentDayTasks, ...recordingTasks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  const targetLabel = tab === 'weekly' ? `${DAYS[activeDay]}요일 주간 업무` : `${format(selectedDate, 'MM.dd (eee)', { locale: ko })} 일간 업무`

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden flex flex-col mt-4">
      
      {/* 최상단 메인 탭 */}
      <div className="flex bg-slate-100 border-b border-gray-200">
        <button 
          onClick={() => setTab('weekly')}
          className={`flex-1 py-3 text-sm font-bold transition-all flex justify-center items-center gap-2 ${tab === 'weekly' ? 'bg-white text-indigo-700 shadow-[inset_0_3px_0_0_#4f46e5]' : 'text-gray-500 hover:bg-slate-50'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          주간업무
        </button>
        <button 
          onClick={() => setTab('daily')}
          className={`flex-1 py-3 text-sm font-bold transition-all flex justify-center items-center gap-2 ${tab === 'daily' ? 'bg-white text-amber-600 shadow-[inset_0_3px_0_0_#d97706]' : 'text-gray-500 hover:bg-slate-50'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          일간업무
        </button>
      </div>

      {/* 본문 영역 */}
      <div className="p-4 flex-1 overflow-y-auto">
        
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-bold text-gray-700">업무 목록</div>
          {isSaving && <span className="text-xs text-indigo-500 font-semibold animate-pulse px-2">저장 중...</span>}
        </div>

        {/* 요일 선택 서브 탭 (주간일 때만 노출) */}
        {tab === 'weekly' && (
          <div className="flex bg-gray-50 rounded-lg p-1.5 mb-4 gap-1">
            {DAYS.map((day, idx) => (
              <button
                key={day}
                onClick={() => setActiveDay(idx)}
                className={`flex-1 py-1 text-sm font-bold rounded-md transition-all ${
                  activeDay === idx 
                    ? `bg-white text-indigo-700 shadow-sm border border-indigo-100` 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        )}

        {tab === 'daily' && (
           <div className="mb-4 py-1.5 px-3 rounded-lg bg-amber-50 text-amber-800 font-bold border border-amber-100 flex items-center gap-2">
             <span className="text-[13px]">선택된 날짜 :</span>
             <span className="text-[14px] underline underline-offset-4 decoration-amber-300">{format(selectedDate, 'yyyy년 MM월 dd일 (eee)', { locale: ko })}</span>
           </div>
        )}

        {/* 일정 리스트 */}
        <div className="mb-5 space-y-1.5">
          {currentDayTasks.length === 0 ? (
            <div className={`text-center py-4 rounded-lg border border-dashed border-gray-200 text-gray-400 text-sm bg-gray-50/50`}>
              해당 구역에 등록된 일정이 없습니다.
            </div>
          ) : (
            currentDayTasks.map(t => {
              const isCompleted = t.isRecording 
                ? initialDailySchedule?.completedProgramIds?.includes(t.realId)
                : dailyTask?.completedTaskIds?.includes(t.id)

              return (
                <div key={t.id} className={`flex items-center justify-between bg-white border rounded-lg p-2.5 transition-all shadow-sm ${isCompleted ? 'bg-gray-50/80 border-gray-200' : (t.isRecording ? 'border-emerald-200 hover:border-emerald-300' : (tab === 'daily' ? 'border-amber-200 hover:border-amber-300' : 'border-indigo-100 hover:border-indigo-200'))}`}>
                  <div className="flex items-center gap-3">
                    {tab === 'daily' && (
                      <button 
                        onClick={() => {
                          if (t.isRecording && onToggleRecordingTask) onToggleRecordingTask(t.realId);
                          else handleToggleComplete(t.id);
                        }}
                        className={`w-6 h-6 flex items-center justify-center rounded border transition-colors ${isCompleted ? (t.isRecording ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-amber-500 border-amber-500 text-white') : `border-gray-300 text-transparent ${t.isRecording ? 'hover:border-emerald-500' : 'hover:border-amber-500'}`}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </button>
                    )}
                    <div className={`${tab === 'weekly' ? 'bg-indigo-50 text-indigo-700' : (t.isRecording ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')} font-mono font-bold text-[13px] px-2 py-0.5 rounded`}>
                      {t.startTime} ~ {t.endTime}
                    </div>
                    {t.isRecording && (
                      <span className={`px-1.5 py-0.5 text-[9px] font-black rounded flex items-center gap-1 uppercase tracking-wider transition-colors 
                        ${isCompleted ? 'bg-gray-200 text-gray-500' : 'bg-emerald-500 text-white shadow-sm'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full bg-red-400 ${isCompleted ? 'bg-gray-400' : 'animate-pulse'}`}></span>
                        녹음
                      </span>
                    )}
                    <div className={`font-semibold text-[14px] ${isCompleted ? 'text-gray-400 line-through decoration-amber-500/50' : 'text-gray-800'}`}>
                      {t.taskName}
                    </div>
                  </div>
                  {!t.isRecording && (
                    <button 
                      onClick={() => requestDelete(t.id)}
                      className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}

                </div>
              )
            })
          )}
        </div>

        {/* 일정 추가 폼 */}
        <div className={`border rounded-lg p-3 ${tab === 'daily' ? 'bg-amber-50/30 border-amber-100' : 'bg-indigo-50/30 border-indigo-100'}`}>
          <h4 className="text-[13px] font-bold text-slate-700 mb-2.5 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
            새 일정 추가 <span className="text-gray-400 font-normal">({targetLabel})</span>
          </h4>
          <div className="flex gap-1.5">
            <input 
              type="text" 
              placeholder="시작 (00:00)"
              maxLength={5}
              value={newStart}
              onChange={e => formatTimeInput(e.target.value, setNewStart)}
              className="w-[90px] px-2 py-2 border border-gray-300 rounded-lg text-sm text-center font-mono placeholder:text-[11px] placeholder:font-sans focus:outline-none focus:ring-1 focus:border-indigo-500 focus:ring-indigo-500"
            />
            <span className="text-gray-400 flex items-center">-</span>
            <input 
              type="text" 
              placeholder="종료 (00:00)"
              maxLength={5}
              value={newEnd}
              onChange={e => formatTimeInput(e.target.value, setNewEnd)}
              className="w-[90px] px-2 py-2 border border-gray-300 rounded-lg text-sm text-center font-mono placeholder:text-[11px] placeholder:font-sans focus:outline-none focus:ring-1 focus:border-indigo-500 focus:ring-indigo-500"
            />
            <input 
              type="text" 
              placeholder="업무명 입력"
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder:text-[11px] focus:outline-none focus:ring-1 focus:border-indigo-500 focus:ring-indigo-500"
            />
            <button 
              onClick={handleAddTask}
              disabled={newStart.length < 5 || newEnd.length < 5 || !newTask.trim()}
              className={`px-4 py-2 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${tab === 'weekly' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700'}`}
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
