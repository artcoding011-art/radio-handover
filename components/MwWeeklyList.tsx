'use client'

import { useState, useEffect } from 'react'
import { format, addMonths, subMonths, startOfMonth, addDays, getDaysInMonth } from 'date-fns'
import { ko } from 'date-fns/locale'

interface MwWeeklyListProps {
  selectedDate: Date
  onDateChange: (date: Date) => void
  refreshKey?: number
}

export default function MwWeeklyList({ selectedDate, onDateChange, refreshKey }: MwWeeklyListProps) {
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(startOfMonth(selectedDate))
  const [completedDates, setCompletedDates] = useState<string[]>([])

  // Sync month view when selectedDate changes externally
  useEffect(() => {
    setCurrentMonthDate(startOfMonth(selectedDate))
  }, [selectedDate])

  useEffect(() => {
    async function fetchCompletion() {
      try {
        const year = format(currentMonthDate, 'yyyy')
        const month = format(currentMonthDate, 'MM')
        const res = await fetch(`/api/mw-inspection/completion?year=${year}&month=${month}`)
        if (res.ok) {
          const data = await res.json()
          setCompletedDates(data.completedDates || [])
        }
      } catch (err) {
        console.error('Failed to fetch completion:', err)
      }
    }
    fetchCompletion()
  }, [currentMonthDate, refreshKey])

  const handlePrevMonth = () => {
    setCurrentMonthDate(prev => subMonths(prev, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonthDate(prev => addMonths(prev, 1))
  }

  // Get all Wednesdays in the currentMonthDate
  const getWednesdays = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const daysInMonth = getDaysInMonth(date)
    const wednesdays = []

    for (let day = 1; day <= daysInMonth; day++) {
      const current = new Date(year, month, day)
      // 3 represents Wednesday in getDay()
      if (current.getDay() === 3) {
        wednesdays.push(current)
      }
    }
    return wednesdays
  }

  const wednesdays = getWednesdays(currentMonthDate)

  return (
    <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100 flex flex-col h-fit overflow-hidden">
      <div className="flex flex-col gap-3 border-b pb-4 mb-4 flex-shrink-0 text-center">
        <h2 className="text-lg font-bold text-gray-800 flex flex-col items-center">
          M/W 점검 일정 
          <span className="text-xs font-semibold text-gray-400 mt-0.5">
            {format(currentMonthDate, 'yyyy년 M월', { locale: ko })}
          </span>
        </h2>
        
        {/* Month Navigation */}
        <div className="flex items-center justify-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-200 mx-auto w-fit">
          <button 
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-white rounded-md transition hover:shadow-sm text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-bold text-gray-700 min-w-[3.5rem] text-center">
            {format(currentMonthDate, 'M월', { locale: ko })}
          </span>
          <button 
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-white rounded-md transition hover:shadow-sm text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {wednesdays.length > 0 ? (
          wednesdays.map((wed, idx) => {
            // Check if selectedDate belongs to this week (Sunday to Saturday)
            const startOfWeek = addDays(wed, -wed.getDay()) // Go back to Sunday
            const endOfWeek = addDays(wed, 6 - wed.getDay()) // Go forward to Saturday
            const isSelected = selectedDate >= startOfWeek && selectedDate <= endOfWeek
            const dateKey = format(wed, 'yyyy-MM-dd')
            const isCompleted = completedDates.includes(dateKey)

            return (
              <div 
                key={wed.toISOString()}
                onClick={() => {
                  setCurrentMonthDate(startOfMonth(wed))
                  onDateChange(wed)
                }}
                className={`p-3 rounded-xl border flex items-center justify-center cursor-pointer transition-all duration-200 group
                  ${isSelected 
                    ? (isCompleted ? 'bg-green-50/80 border-green-400 shadow-sm ring-1 ring-green-100' : 'bg-blue-50/80 border-blue-400 shadow-sm ring-1 ring-blue-100')
                    : (isCompleted ? 'bg-green-50/20 border-green-100' : 'bg-white border-gray-100 hover:border-blue-200 hover:bg-blue-50/30')
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-[12px] transition-colors
                    ${isSelected 
                      ? (isCompleted ? 'bg-green-600 text-white shadow-md' : 'bg-blue-600 text-white shadow-md') 
                      : (isCompleted ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600')
                    }`}
                  >
                    {idx + 1}주
                  </div>

                  <div className="flex flex-col items-start gap-0.5">
                    <h3 className={`font-bold text-[14px] transition-colors 
                      ${isSelected 
                        ? (isCompleted ? 'text-green-900' : 'text-blue-900') 
                        : (isCompleted ? 'text-green-800' : 'text-gray-800')
                      }`}
                    >
                      {format(wed, 'M월 d일', { locale: ko })}
                    </h3>
                    
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wide transition-colors
                      ${isCompleted 
                        ? 'bg-green-100 text-green-700' 
                        : (isSelected ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100')
                      }`}
                    >
                      {isCompleted ? '점검 완료' : '점검 대기'}
                    </span>
                  </div>


                </div>
              </div>
            )
          })
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-400 text-sm">해당 월에 표시할 주차가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  )
}
