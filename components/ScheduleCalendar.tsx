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
  completedDates?: string[]
}

export default function ScheduleCalendar({ 
  selectedDate, 
  onDateChange, 
  onMonthChange,
  recordingDates = [],
  completedDates = []
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
          tileClassName={({ date, view }) => {
            if (view === 'month') {
              const dateStr = format(date, 'yyyy-MM-dd')
              if (completedDates.includes(dateStr)) return 'completed-tile'
            }
            return 'relative'
          }}
          tileContent={({ date, view }) => {
            if (view === 'month') {
              const dateStr = format(date, 'yyyy-MM-dd')
              const isCompleted = completedDates.includes(dateStr)
              const hasRecording = recordingDates.includes(dateStr)

              return (
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-[2px] pointer-events-none">
                  {isCompleted && (
                    <div className="absolute inset-0 bg-emerald-50/60 flex items-center justify-center">
                       <svg className="w-5 h-5 text-emerald-500/40" fill="currentColor" viewBox="0 0 20 20">
                         <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                       </svg>
                    </div>
                  )}
                  {hasRecording && (
                    <div className="w-[80%] h-[3px] bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)] z-10" />
                  )}
                </div>
              )
            }
            return null
          }}
        />
        <div className="px-4 py-2 border-t border-gray-100 flex flex-wrap items-center justify-start text-[12px] text-gray-500 gap-x-4 gap-y-1">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-800 inline-block" />
            <span>선택</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-100 border border-blue-300 inline-block" />
            <span>오늘</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-1 bg-emerald-500 rounded-full shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
            <span>녹음</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-emerald-50 rounded border border-emerald-200 flex items-center justify-center">
              <svg className="w-2 h-2 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span>제작완료</span>
          </div>
        </div>

        <style jsx global>{`
          .react-calendar__tile.completed-tile {
            position: relative !important;
          }
          .react-calendar__tile.completed-tile abbr {
            position: relative;
            z-index: 10;
          }
        `}</style>
    </div>
  )
}
