'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import HandoverForm, { HandoverFormRef } from '@/components/HandoverForm'
import CalendarView from '@/components/CalendarView'
import ScheduleCalendar from '@/components/ScheduleCalendar'
import ScheduleManager from '@/components/ScheduleManager'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { generateExcelHtml } from '@/lib/excel'

declare global {
  interface Window {
    JSZip: any;
  }
}

interface MainClientProps {
  userId: string
}

import { WeeklyScheduleData, DailyScheduleData } from '@/lib/types'

interface SelectedInfo {
  특이사항: string
  근무자: string
  현업주요사항: string
}

interface MonthlyEntry {
  date: string
  근무자: string
  특이사항: string
}

const getMediumColor = (medium: '1R' | '2R' | 'MFM') => {
  switch (medium) {
    case '1R': return {
      text: 'text-blue-700',
      textLight: 'text-blue-500',
      bgLight: 'bg-blue-50',
      bgMarker: 'bg-blue-500',
      borderLight: 'border-blue-200',
      borderHover: 'hover:border-blue-300'
    }
    case '2R': return {
      text: 'text-orange-700',
      textLight: 'text-orange-500',
      bgLight: 'bg-orange-50',
      bgMarker: 'bg-orange-500',
      borderLight: 'border-orange-200',
      borderHover: 'hover:border-orange-300'
    }
    case 'MFM': return {
      text: 'text-pink-700',
      textLight: 'text-pink-500',
      bgLight: 'bg-pink-50',
      bgMarker: 'bg-pink-500',
      borderLight: 'border-pink-200',
      borderHover: 'hover:border-pink-300'
    }
  }
}

export default function MainClient({ userId }: MainClientProps) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [entryDates, setEntryDates] = useState<string[]>([])
  const [selectedInfo, setSelectedInfo] = useState<SelectedInfo | null>(null)
  const [monthlyEntries, setMonthlyEntries] = useState<MonthlyEntry[]>([])
  const [activeMonth, setActiveMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [loggingOut, setLoggingOut] = useState(false)

  const formRef = useRef<HandoverFormRef>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [pendingDate, setPendingDate] = useState<Date | null>(null)
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleData | null>(null)
  const [dailySchedule, setDailySchedule] = useState<DailyScheduleData | null>(null)
  const [recordingDates, setRecordingDates] = useState<string[]>([])
  
  // Custom Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<{ medium: '1R'|'2R'|'MFM', id: string, isDaily: boolean } | null>(null)
  
  // 새로 추가된 상단 탭 상태 ('업무인계서' | '제작일정')
  const [activeMenu, setActiveMenu] = useState<'handover' | 'schedule'>('schedule')

  // JSZip 로드
  useEffect(() => {
    const script = document.createElement('script')
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
    script.async = true
    document.head.appendChild(script)
    return () => {
      document.head.removeChild(script)
    }
  }, [])

  function handleDateChangeRequest(newDate: Date) {
    if (isDirty) {
      setPendingDate(newDate)
    } else {
      setSelectedDate(newDate)
      // 달력이 바뀔 수도 있으므로 현재 월 업데이트
      setCurrentMonth(newDate)
    }
  }

  const handleDownloadMonthlyZip = async () => {
    const monthStr = format(currentMonth, 'yyyy-MM')
    if (!window.JSZip) {
      alert('라이브러리를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }

    try {
      setIsDownloadingZip(true)
      const res = await fetch(`/api/entries?month=${monthStr}`)
      if (!res.ok) throw new Error('Failed to fetch entries')
      const data = await res.json()
      
      if (!data.entries || data.entries.length === 0) {
        alert('해당 월에 저장된 일지가 없습니다.')
        return
      }

      const zip = new window.JSZip()
      data.entries.forEach((entry: any) => {
        const fileName = `인수인계서_${entry.date}.xls`
        const mht = generateExcelHtml(entry)
        zip.file(fileName, mht)
      })

      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = `${monthStr}_전체일지.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Bulk download error:', error)
      alert('다운로드 중 오류가 발생했습니다.')
    } finally {
      setIsDownloadingZip(false)
    }
  }

  async function handleConfirmSaveAndLeave() {
    const success = await formRef.current?.save()
    if (success && pendingDate) {
      setSelectedDate(pendingDate)
      setPendingDate(null)
      setIsDirty(false)
    }
  }

  function handleDiscardAndLeave() {
    if (pendingDate) {
      setSelectedDate(pendingDate)
      setPendingDate(null)
      setIsDirty(false)
    }
  }

  const fetchDates = useCallback(async () => {
    try {
      const res = await fetch('/api/entries')
      if (res.ok) {
        const data = await res.json()
        setEntryDates(data.dates ?? [])
      }
    } catch {}
  }, [])

  const fetchSelectedInfo = useCallback(async (dateStr: string) => {
    try {
      const res = await fetch(`/api/entries/${dateStr}`)
      if (res.ok) {
        const data = await res.json()
        if (data.entry) {
          setSelectedInfo({
            특이사항: data.entry.rMCR?.특이사항 ?? '',
            근무자: data.entry.근무자 ?? '',
            현업주요사항: data.entry.rStudio?.현업주요사항 ?? '',
          })
        } else {
          setSelectedInfo(null)
        }
      }
    } catch {}
  }, [])

  const fetchMonthlyEntries = useCallback(async (yearMonth: string) => {
    try {
      const res = await fetch(`/api/entries/month/${yearMonth}`)
      if (res.ok) {
        const data = await res.json()
        setMonthlyEntries(data.entries ?? [])
      }
    } catch {}
  }, [])

  const fetchWeeklySchedule = useCallback(async () => {
    try {
      const res = await fetch(`/api/schedule?_t=${Date.now()}`)
      if (res.ok) {
        const data = await res.json()
        setWeeklySchedule(data.schedule || null)
      }
    } catch {}
  }, [])

  const fetchDailySchedule = useCallback(async (date: Date) => {
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const res = await fetch(`/api/schedule/daily/${dateStr}?_t=${Date.now()}`)
      if (res.ok) {
        const data = await res.json()
        setDailySchedule(data.schedule || null)
      } else {
        setDailySchedule(null)
      }
    } catch {
      setDailySchedule(null)
    }
  }, [])

  const fetchRecordingDates = useCallback(async () => {
    try {
      const res = await fetch(`/api/schedule/daily/dates?_t=${Date.now()}`)
      if (res.ok) {
        const data = await res.json()
        setRecordingDates(data.dates || [])
      }
    } catch {}
  }, [])

  useEffect(() => { fetchDates() }, [fetchDates])
  useEffect(() => { 
    fetchWeeklySchedule() 
    fetchRecordingDates()
  }, [fetchWeeklySchedule, fetchRecordingDates])
  useEffect(() => { fetchDailySchedule(selectedDate) }, [selectedDate, fetchDailySchedule])

  const requestDeleteTodayProgram = (medium: '1R'|'2R'|'MFM', progId: string, isDaily: boolean) => {
    setDeleteTarget({ medium, id: progId, isDaily })
  }

  const executeDeleteTodayProgram = async () => {
    if (!deleteTarget) return
    const { medium, id: progId, isDaily } = deleteTarget
    setDeleteTarget(null)

    const updated: DailyScheduleData = dailySchedule 
      ? JSON.parse(JSON.stringify(dailySchedule)) 
      : { '1R':[], '2R':[], 'MFM':[], canceledWeeklyIds: [] }

    if (!updated.canceledWeeklyIds) updated.canceledWeeklyIds = []

    if (isDaily) {
      updated[medium] = (updated[medium] || []).filter((p: any) => p.id !== progId)
    } else {
      updated.canceledWeeklyIds.push(progId)
    }

    // 즉각적인 화면 반영 (Optimistic UI Update)
    setDailySchedule(updated)

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    try {
      await fetch(`/api/schedule/daily/${dateStr}?_t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      })
      // 백그라운드 재동기화
      fetchDailySchedule(selectedDate)
      fetchRecordingDates()
    } catch {
      alert('일정 예외 처리 중 오류가 발생했습니다.')
      fetchDailySchedule(selectedDate) // 실패 시 원복
    }
  }

  const handleToggleCompleteTodayProgram = async (progId: string) => {
    const updated: DailyScheduleData = dailySchedule 
      ? JSON.parse(JSON.stringify(dailySchedule)) 
      : { '1R':[], '2R':[], 'MFM':[], canceledWeeklyIds: [], completedProgramIds: [] }

    if (!updated.completedProgramIds) updated.completedProgramIds = []

    const isCompleted = updated.completedProgramIds.includes(progId)
    if (isCompleted) {
      updated.completedProgramIds = updated.completedProgramIds.filter(id => id !== progId)
    } else {
      updated.completedProgramIds.push(progId)
    }

    setDailySchedule(updated)

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    try {
      await fetch(`/api/schedule/daily/${dateStr}?_t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      })
      fetchDailySchedule(selectedDate)
      fetchRecordingDates()
    } catch {
      alert('상태 업데이트 중 오류가 발생했습니다.')
      fetchDailySchedule(selectedDate)
    }
  }

  const handleBulkToggleComplete = async (medium: '1R'|'2R'|'MFM') => {
    if (!dailySchedule || !weeklySchedule) return
    
    const dayIndex = selectedDate.getDay() as 0|1|2|3|4|5|6;
    const wPrograms = (weeklySchedule[medium]?.[dayIndex] || [])
      .filter(p => !dailySchedule.canceledWeeklyIds?.includes(p.id))
    const dPrograms = dailySchedule[medium] || []
    
    const allIdsInMedium = [...wPrograms, ...dPrograms].map(p => p.id)
    if (allIdsInMedium.length === 0) return

    const currentCompleted = dailySchedule.completedProgramIds || []
    const allCompletedInMedium = allIdsInMedium.every(id => currentCompleted.includes(id))

    const updated: DailyScheduleData = JSON.parse(JSON.stringify(dailySchedule))
    if (!updated.completedProgramIds) updated.completedProgramIds = []

    if (allCompletedInMedium) {
      // 해당 매체 항목 완료 ID들만 제거 (해제)
      updated.completedProgramIds = updated.completedProgramIds.filter(id => !allIdsInMedium.includes(id))
    } else {
      // 해당 매체 항목 완료 ID들 모두 추가 (완료)
      const otherCompleted = updated.completedProgramIds.filter(id => !allIdsInMedium.includes(id))
      updated.completedProgramIds = [...otherCompleted, ...allIdsInMedium]
    }

    // 낙관적 업데이트
    setDailySchedule(updated)

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      await fetch(`/api/schedule/daily/${dateStr}?_t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      })
      fetchDailySchedule(selectedDate)
    } catch {
      alert('일괄 처리 중 오류가 발생했습니다.')
      fetchDailySchedule(selectedDate)
    }
  }

  useEffect(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    fetchSelectedInfo(dateStr)
  }, [selectedDate, fetchSelectedInfo])

  useEffect(() => {
    fetchMonthlyEntries(activeMonth)
  }, [activeMonth, fetchMonthlyEntries])

  function handleSaved() {
    fetchDates()
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    fetchSelectedInfo(dateStr)
    fetchMonthlyEntries(activeMonth)
  }

  function handleMonthChange(yearMonth: string) {
    setActiveMonth(yearMonth)
  }

  async function handleLogout() {
    setLoggingOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
  const hasEntry = entryDates.includes(selectedDateStr)
  const [activeYear, activeMonthNum] = activeMonth.split('-')
  const monthLabel = `${activeYear}년 ${parseInt(activeMonthNum)}월`

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col relative">
      
      {/* ── Document Unsaved Warning Modal ── */}
      {pendingDate && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-col items-center w-80 transform transition-all animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-800 mb-2">문서 수정 중</h3>
            <p className="text-sm text-gray-500 mb-6 text-center">작성 완료되지 않은 내용이 있습니다.<br/>저장하고 나가시겠습니까?</p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={handleConfirmSaveAndLeave}
                className="flex-1 bg-blue-900 text-white font-bold py-2.5 rounded-lg hover:bg-blue-800 transition shadow-sm"
              >
                예 (저장)
              </button>
              <button 
                onClick={handleDiscardAndLeave}
                className="flex-1 bg-gray-200 text-gray-700 font-bold py-2.5 rounded-lg hover:bg-gray-300 transition shadow-sm"
              >
                아니오 (무시)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상단 네비게이션 */}
      <header className="bg-blue-900 text-white px-6 py-3 flex items-center justify-between shadow-md flex-shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
              <span className="text-blue-900 font-bold text-base">R</span>
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">KBS창원 라디오</h1>
              <p className="text-blue-300 text-sm hidden sm:block">{format(new Date(), 'yyyy년 MM월 dd일', { locale: ko })}</p>
            </div>
          </div>
          
          {/* 탭 네비게이션 */}
          <nav className="flex items-center gap-1 bg-blue-800/60 p-1.5 rounded-xl ml-4">
            <button 
              onClick={() => setActiveMenu('schedule')}
              className={`px-4 py-1.5 rounded-lg text-[15px] font-bold transition-all ${activeMenu === 'schedule' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-100 hover:text-white hover:bg-blue-700/50'}`}
            >
              제작일정
            </button>
            <button 
              onClick={() => setActiveMenu('handover')}
              className={`px-4 py-1.5 rounded-lg text-[15px] font-bold transition-all ${activeMenu === 'handover' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-100 hover:text-white hover:bg-blue-700/50'}`}
            >
              업무인계서
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-blue-200 text-base">
            <span className="text-blue-400 text-sm mr-1">로그인:</span>{userId}
          </span>
          <button onClick={handleLogout} disabled={loggingOut}
            className="text-base bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition disabled:opacity-50">
            {loggingOut ? '로그아웃 중...' : '로그아웃'}
          </button>
        </div>
      </header>

      {/* 메인: 4:6 분할 (너비 고정으로 탭 전환 시 흔들림 방지) */}
      <main className="flex-1 flex justify-center overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
        <div className="w-full max-w-[1600px] flex gap-5 p-5 h-full">

        {/* 좌측: 인수인계서 (40%) / 제작일정 시 오늘의 제작일정 뷰 */}
        <div className="w-[40%] flex-shrink-0 overflow-hidden">
          {activeMenu === 'handover' ? (
            <HandoverForm 
              ref={formRef}
              date={selectedDate} 
              onSaved={handleSaved} 
              onDirtyChange={setIsDirty} 
            />
          ) : (
            <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 flex flex-col h-full overflow-hidden">
              <h2 className="text-xl font-bold text-gray-800 border-b pb-3 mb-5 flex items-center justify-between">
                <div>오늘의 제작일정 <span className="text-sm font-medium text-gray-500 ml-2">{format(selectedDate, 'M월 d일 (eee)', { locale: ko })}</span></div>
              </h2>
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {weeklySchedule || dailySchedule ? (
                  (['1R', '2R', 'MFM'] as const).map(medium => {
                    const dayIndex = selectedDate.getDay() as 0|1|2|3|4|5|6;
                    const wPrograms = weeklySchedule?.[medium]?.[dayIndex] || [];
                    const dPrograms = dailySchedule?.[medium] || [];
                    
                    const filteredWPrograms = wPrograms.filter(p => !dailySchedule?.canceledWeeklyIds?.includes(p.id))

                    if (wPrograms.length === 0 && dPrograms.length === 0 && filteredWPrograms.length === 0) return null;
                    
                    const mergedPrograms = [
                      ...filteredWPrograms.map(p => ({ ...p, isDaily: false })),
                      ...dPrograms.map(p => ({ ...p, isDaily: true }))
                    ].sort((a, b) => a.startTime.localeCompare(b.startTime));

                    if (mergedPrograms.length === 0) return null;

                    const colors = getMediumColor(medium)
                    
                    const isAllCompleted = mergedPrograms.length > 0 && mergedPrograms.every(p => dailySchedule?.completedProgramIds?.includes(p.id))

                    return (
                      <div key={medium} className={`${colors.bgLight} rounded-xl p-3 border ${colors.borderLight}`}>
                        <div className="flex items-center justify-between mb-2.5">
                          <h3 className={`font-bold ${colors.text} flex items-center gap-1.5 text-[15px]`}>
                            <span className={`w-1.5 h-3.5 ${colors.bgMarker} rounded-full`}></span>
                            {medium}
                          </h3>
                          <button 
                            onClick={() => handleBulkToggleComplete(medium)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all border ${isAllCompleted ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'}`}
                          >
                            <input 
                              type="checkbox" 
                              checked={isAllCompleted}
                              readOnly
                              className={`w-3.5 h-3.5 rounded border-gray-300 pointer-events-none ${isAllCompleted ? 'text-white' : 'text-indigo-600'}`}
                            />
                            <span className="text-[11px] font-bold">일괄체크</span>
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {mergedPrograms.map(prog => {
                            const isCompleted = dailySchedule?.completedProgramIds?.includes(prog.id)
                            return (
                            <div key={prog.id} 
                              onClick={() => handleToggleCompleteTodayProgram(prog.id)}
                              className={`relative overflow-hidden rounded-lg p-2.5 shadow-sm border flex items-center justify-between transition-all duration-300 cursor-pointer hover:shadow-md
                              ${prog.isDaily 
                                ? 'bg-emerald-50/60 border-emerald-200 border-l-4 border-l-emerald-500 shadow-emerald-100' 
                                : `bg-white ${colors.borderLight} border-l-4 border-l-transparent`} 
                              ${isCompleted ? 'opacity-50 bg-gray-50 border-gray-200 grayscale-[0.5]' : ''}`}>
                              <div className="flex-1 flex items-center gap-3">
                                <div className={`flex flex-col justify-center transition-all ${isCompleted ? 'line-through text-gray-400' : ''}`}>
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className={`text-[13px] font-mono font-bold transition-colors ${isCompleted ? 'text-gray-400' : (prog.isDaily ? 'text-emerald-700' : colors.textLight)}`}>
                                      {prog.startTime} ~ {prog.endTime}
                                    </span>
                                    {prog.isDaily && (
                                      <span className={`px-1.5 py-0.5 text-[9px] font-black rounded flex items-center gap-1 uppercase tracking-wider transition-colors 
                                        ${isCompleted ? 'bg-gray-200 text-gray-500' : 'bg-emerald-500 text-white shadow-sm'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full bg-red-400 ${isCompleted ? 'bg-gray-400' : 'animate-pulse'}`}></span>
                                        녹음
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`font-bold text-[14px] transition-colors ${isCompleted ? 'text-gray-400' : 'text-gray-800'}`}>
                                      {prog.programName}
                                    </span>
                                    {!isCompleted && (
                                      <span className="px-1.5 py-0.5 text-[9px] font-black rounded bg-blue-100 text-blue-600 flex items-center gap-1 uppercase tracking-wider">
                                        <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"></span>
                                        제작중
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); requestDeleteTodayProgram(medium, prog.id, prog.isDaily); }}
                                title={prog.isDaily ? '이 녹음 스케줄 삭제' : '이 요일의 주간 스케줄 결방(예외) 처리'}
                                className={`w-7 h-7 ml-2 flex items-center justify-center rounded-md transition-colors flex-shrink-0 relative z-10 ${prog.isDaily ? 'text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              
                              {isCompleted && (
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 pointer-events-none select-none z-0">
                                  <div className="border-[3px] border-red-500 text-red-500 font-black text-xl px-3 py-0.5 rounded opacity-40 tracking-widest shadow-sm">
                                    제작완료
                                  </div>
                                </div>
                              )}
                            </div>
                          )})}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-10 text-gray-400 text-sm">등록된 일정 템플릿이 없습니다. 우측 메뉴에서 일정을 먼저 추가해주세요.</div>
                )}
                {(weeklySchedule || dailySchedule) && (['1R', '2R', 'MFM'] as const).every(medium => {
                    const w = weeklySchedule?.[medium]?.[selectedDate.getDay() as 0|1|2|3|4|5|6] || [];
                    const filteredW = w.filter(p => !dailySchedule?.canceledWeeklyIds?.includes(p.id));
                    const d = dailySchedule?.[medium] || [];
                    return filteredW.length === 0 && d.length === 0;
                }) && (
                  <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-sm">
                    해당 일자에 등록된 스케줄이 없습니다.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 우측: 캘린더 + 정보 (60%) */}
        <div className="flex-1 max-w-[900px] flex flex-col gap-3 overflow-y-auto min-w-0">

          {/* 캘린더 */}
          {activeMenu === 'handover' ? (
            <CalendarView
              selectedDate={selectedDate}
              entryDates={entryDates}
              onDateChange={handleDateChangeRequest}
              onMonthChange={handleMonthChange}
              onDownloadMonthlyZip={handleDownloadMonthlyZip}
              isDownloading={isDownloadingZip}
            />
          ) : (
            <ScheduleCalendar
              selectedDate={selectedDate}
              onDateChange={handleDateChangeRequest}
              onMonthChange={handleMonthChange}
              recordingDates={recordingDates}
            />
          )}

          {/* 우측 하단 상세 정보 (업무인계서 활성화 시에만 패널 표시) */}
          {activeMenu === 'handover' ? (
            <>
              {/* 선택 날짜 정보 */}
              <div className="bg-white rounded-xl shadow-md p-4 flex-shrink-0">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">선택된 날짜</h3>
                <p className="text-blue-800 font-bold text-base">
                  {format(selectedDate, 'yyyy년 MM월 dd일 (eee)', { locale: ko })}
                </p>

                {hasEntry ? (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-emerald-600 text-sm">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0" />
                      <span>작성 완료{selectedInfo?.근무자 ? ` · 근무자: ${selectedInfo.근무자}` : ''}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-1.5 text-gray-400 text-sm">
                    <span className="w-2 h-2 bg-gray-300 rounded-full" />
                    <span>아직 작성되지 않음</span>
                  </div>
                )}
              </div>

              {/* 선택 날짜 현업주요사항 */}
              {hasEntry && selectedInfo?.현업주요사항?.trim() && (
                <div className="bg-white rounded-xl shadow-md overflow-hidden flex-shrink-0 border-2 border-indigo-100">
                  <div className="bg-gradient-to-r from-indigo-50 to-white border-b border-indigo-100 px-4 py-3">
                    <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      현업주요사항
                    </h3>
                  </div>
                  <div className="p-4 bg-indigo-50/30">
                    <p className="text-base font-semibold text-indigo-950 whitespace-pre-wrap leading-relaxed tracking-wide">
                      {selectedInfo.현업주요사항}
                    </p>
                  </div>
                </div>
              )}

              {/* 이달의 특이사항 */}
              <div className="bg-white rounded-xl shadow-md p-4 flex-shrink-0">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {monthLabel} 특이사항
                </h3>
                {monthlyEntries.length === 0 ? (
                  <p className="text-sm text-gray-400">이달 특이사항 기록 없음</p>
                ) : (
                  <div className="space-y-3">
                    {monthlyEntries.map((e) => (
                      <div key={e.date}
                        onClick={() => handleDateChangeRequest(new Date(e.date + 'T00:00:00'))}
                        className="cursor-pointer hover:bg-gray-50 rounded-lg p-2 -mx-2 transition">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-blue-700">
                            {format(new Date(e.date + 'T00:00:00'), 'MM/dd (eee)', { locale: ko })}
                          </span>
                          {e.근무자 && (
                            <span className="text-sm text-gray-400">{e.근무자}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                          {e.특이사항}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <ScheduleManager 
              selectedDate={selectedDate} 
              initialWeeklySchedule={weeklySchedule} 
              initialDailySchedule={dailySchedule}
              onUpdated={() => { 
                fetchWeeklySchedule(); 
                fetchDailySchedule(selectedDate);
                fetchRecordingDates();
              }} 
              onOptimisticSync={(w, d) => {
                if (w) setWeeklySchedule(w)
                if (d) setDailySchedule(d)
              }}
            />
          )}
          
          <div className="mt-1 flex justify-end text-right flex-shrink-0">
            <span className="text-[12px] text-gray-300 font-medium italic">
              Copyright by 허준, Build Date : 2026.03
            </span>
          </div>
        </div>
        </div>
      </main>

      {/* 커스텀 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-[320px] mx-auto transform animate-[popIn_0.2s_ease-out]">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <div className="p-2 bg-red-50 rounded-full">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800">일정 삭제</h3>
            </div>
            <p className="text-base text-slate-600 mb-6 pl-1 font-medium">제작일정을 삭제하시겠습니까?</p>
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setDeleteTarget(null)} 
                className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
              >
                아니오
              </button>
              <button 
                onClick={executeDeleteTodayProgram} 
                className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors shadow-sm shadow-red-200"
              >
                예
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
