'use client'

import Calendar from 'react-calendar'
import { format } from 'date-fns'

type ValuePiece = Date | null
type Value = ValuePiece | [ValuePiece, ValuePiece]

interface ScheduleCalendarProps {
  selectedDate: Date
  onDateChange: (date: Date) => void
  onMonthChange: (yearMonth: string) => void // YYYY-MM
  recordingDates?: string[]
}

export default function ScheduleCalendar({ 
  selectedDate, 
  onDateChange, 
  onMonthChange,
  recordingDates = []
}: ScheduleCalendarProps) {
  
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
          calendarType="gregory"
          onActiveStartDateChange={handleActiveStartDateChange}
          tileClassName={({ view }) => view === 'month' ? 'relative' : null}
          tileContent={({ date, view }) => {
            if (view === 'month') {
              const dateStr = format(date, 'yyyy-MM-dd')
              if (recordingDates.includes(dateStr)) {
                return (
                  <div className="absolute bottom-0 left-0 right-0 flex justify-center px-1 pb-[1px]">
                    <div className="w-full h-[3px] bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                  </div>
                )
              }
            }
            return null
          }}
        />
        <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-start text-[13px] text-gray-500 gap-4">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-800 inline-block" />
            <span>선택된 일정</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-100 border border-blue-300 inline-block" />
            <span>오늘</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-1 bg-emerald-500 rounded-full shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
            <span>녹음 일정</span>
          </div>
        </div>
    </div>
  )
}
