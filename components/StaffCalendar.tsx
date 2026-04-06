'use client'

import Calendar from 'react-calendar'
import { format } from 'date-fns'

type ValuePiece = Date | null
type Value = ValuePiece | [ValuePiece, ValuePiece]

interface StaffCalendarProps {
  selectedDate: Date
  onDateChange: (date: Date) => void
  onMonthChange: (yearMonth: string) => void // YYYY-MM
  staffColorsMap?: Record<string, string[]> // date 'yyyy-MM-dd' -> array of color classes (e.g. ['bg-blue-500', 'bg-red-500'])
}

export default function StaffCalendar({ 
  selectedDate, 
  onDateChange, 
  onMonthChange,
  staffColorsMap = {}
}: StaffCalendarProps) {
  
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
          tileClassName="relative"
          tileContent={({ date, view }) => {
            if (view === 'month') {
              const dateStr = format(date, 'yyyy-MM-dd')
              const colors = staffColorsMap[dateStr] || []

              return (
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-[2px] pointer-events-none">
                  {colors.length > 0 && (
                    <div className="w-[85%] flex gap-[2px] justify-center z-10 px-1 hover:w-[100%] transition-all opacity-90">
                      {colors.map((colorClass, idx) => (
                        <div key={idx} className={`flex-1 h-[4px] ${colorClass} rounded-full`} />
                      ))}
                    </div>
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
            <div className="w-3 h-1 bg-gray-500 rounded-full" />
            <span>근무자 표시</span>
          </div>
        </div>
    </div>
  )
}
