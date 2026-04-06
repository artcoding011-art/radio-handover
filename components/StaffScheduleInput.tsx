'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { GlobalStaff, WorkShift } from '@/lib/types'

interface StaffScheduleInputProps {
  selectedDate: Date
  globalStaff: GlobalStaff[]
  onAddSchedule: (staff: GlobalStaff, shift: WorkShift) => Promise<void>
  onBulkAddWeekdays: (staff: GlobalStaff, shift: WorkShift) => Promise<void>
}

export default function StaffScheduleInput({ 
  selectedDate, 
  globalStaff, 
  onAddSchedule, 
  onBulkAddWeekdays 
}: StaffScheduleInputProps) {
  
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [selectedShift, setSelectedShift] = useState<WorkShift>('종일(09:00~18:00)')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleAddSingle = async () => {
    if (!selectedStaffId) {
      alert('직원을 선택해주세요.')
      return
    }
    const staff = globalStaff.find(s => s.id === selectedStaffId)
    if (!staff) return

    setIsProcessing(true)
    try {
      await onAddSchedule(staff, selectedShift)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBulkAdd = async () => {
    if (!selectedStaffId) {
      alert('직원을 선택해주세요.')
      return
    }
    const staff = globalStaff.find(s => s.id === selectedStaffId)
    if (!staff) return

    if (!confirm(`${format(selectedDate, 'M월')} 전체 평일(월~금)에 [${staff.name}] 직원을 [${selectedShift}]로 일괄 배정하시겠습니까?`)) {
      return
    }

    setIsProcessing(true)
    try {
      await onBulkAddWeekdays(staff, selectedShift)
      alert('월간 일괄 배정이 완료되었습니다.')
    } finally {
      setIsProcessing(false)
    }
  }

  // 주 근무자가 위로 오도록 정렬
  const sortedStaff = [...globalStaff].sort((a, b) => {
    if (a.role === '주 근무자' && b.role !== '주 근무자') return -1;
    if (a.role !== '주 근무자' && b.role === '주 근무자') return 1;
    return 0;
  })

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-3 p-5">
      <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
        근무 스케줄 할당
      </h3>

      <div className="flex flex-col sm:flex-row gap-3 items-end">
        
        {/* 시간대 선택 */}
        <div className="w-full sm:w-1/3">
          <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">시간대</label>
          <select 
            value={selectedShift}
            onChange={e => setSelectedShift(e.target.value as WorkShift)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={isProcessing}
          >
            <option value="종일(09:00~18:00)">종일(09:00~18:00)</option>
            <option value="오전(09:00~14:00)">오전(09:00~14:00)</option>
            <option value="오후(14:00~18:00)">오후(14:00~18:00)</option>
          </select>
        </div>

        {/* 직원 선택 */}
        <div className="w-full sm:w-1/3">
          <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">직원 (좌측 명부 연동)</label>
          <select
            value={selectedStaffId}
            onChange={e => setSelectedStaffId(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={isProcessing || sortedStaff.length === 0}
          >
            <option value="" disabled>-- 직원 선택 --</option>
            {sortedStaff.map((s) => (
              <option key={s.id} value={s.id}>
                [{s.role === '주 근무자' ? '주' : '부'}] {s.name}
              </option>
            ))}
          </select>
          {sortedStaff.length === 0 && (
            <div className="text-[10px] text-red-500 mt-1">좌측 전체 직원 명부에서 직원을 등록해주세요.</div>
          )}
        </div>

        {/* 동작 버튼 */}
        <div className="w-full sm:w-1/3 flex gap-2">
          <button
            onClick={handleAddSingle}
            disabled={isProcessing || !selectedStaffId}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2.5 rounded-lg font-bold shadow-sm transition-all text-sm whitespace-nowrap"
          >
            {format(selectedDate, 'd일')} 일정 추가
          </button>
          
          <button
            onClick={handleBulkAdd}
            disabled={isProcessing || !selectedStaffId}
            className="flex-1 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white px-4 py-2.5 rounded-lg font-bold shadow-sm transition-all text-sm flex flex-col items-center justify-center leading-tight whitespace-nowrap relative group"
          >
            <span>{format(selectedDate, 'M월')} 일괄 입력</span>
            <span className="text-[10px] text-gray-300 font-normal">월~금 전체 적용</span>
          </button>
        </div>

      </div>
    </div>
  )
}
