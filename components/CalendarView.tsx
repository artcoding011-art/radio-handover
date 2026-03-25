'use client'

import Calendar from 'react-calendar'
import { format } from 'date-fns'

type ValuePiece = Date | null
type Value = ValuePiece | [ValuePiece, ValuePiece]

interface CalendarViewProps {
  selectedDate: Date
  entryDates: string[]
  onDateChange: (date: Date) => void
  onMonthChange: (yearMonth: string) => void // YYYY-MM
  onDownloadMonthlyZip?: () => void
  isDownloading?: boolean
}

export default function CalendarView({ 
  selectedDate, 
  entryDates, 
  onDateChange, 
  onMonthChange,
  onDownloadMonthlyZip,
  isDownloading
}: CalendarViewProps) {
  const entrySet = new Set(entryDates)

  function tileClassName({ date, view }: { date: Date; view: string }) {
    if (view === 'month' && entrySet.has(format(date, 'yyyy-MM-dd'))) return 'has-entry'
    return null
  }

  function tileContent({ date, view }: { date: Date; view: string }) {
    if (view === 'month' && entrySet.has(format(date, 'yyyy-MM-dd'))) {
      return (
        <div className="absolute bottom-1 left-0 right-0 flex justify-center">
          <span className="text-emerald-600 font-extrabold text-[10px] leading-none tracking-tight">작성완료</span>
        </div>
      )
    }
    return null
  }

  function handleChange(value: Value) {
    if (value instanceof Date) onDateChange(value)
    else if (Array.isArray(value) && value[0] instanceof Date) onDateChange(value[0])
  }

  function handleActiveStartDateChange({ activeStartDate }: { activeStartDate: Date | null }) {
    if (activeStartDate) onMonthChange(format(activeStartDate, 'yyyy-MM'))
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden flex-shrink-0">
      <Calendar
        onChange={handleChange}
        value={selectedDate}
        locale="ko-KR"
        tileClassName={tileClassName}
        tileContent={tileContent}
        calendarType="gregory"
        onActiveStartDateChange={handleActiveStartDateChange}
      />
      <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-emerald-600 font-extrabold text-xs">작성완료</span>
            <span>작성됨</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-800 inline-block" />
            <span>선택</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-100 border border-blue-300 inline-block" />
            <span>오늘</span>
          </div>
        </div>
        
        {onDownloadMonthlyZip && (
          <button 
            onClick={(e) => { e.stopPropagation(); onDownloadMonthlyZip(); }}
            disabled={isDownloading}
            className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-200 transition-all font-bold text-[12px] disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {isDownloading ? '압축 중...' : '당월 일지 전체 다운로드'}
          </button>
        )}
      </div>
    </div>
  )
}
