'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { DailyStaffData, GlobalStaff, StaffRole } from '@/lib/types'

interface StaffManagerProps {
  date: Date
  dailyStaff: DailyStaffData | null
  globalStaff: GlobalStaff[]
  onSaveDailyStaff: (data: DailyStaffData) => Promise<void>
  onSaveGlobalStaff: (data: GlobalStaff[]) => Promise<void>
}

const COLOR_PRESETS = [
  { value: 'bg-blue-500', label: '파랑' },
  { value: 'bg-emerald-500', label: '초록' },
  { value: 'bg-amber-500', label: '주황' },
  { value: 'bg-purple-500', label: '보라' },
  { value: 'bg-pink-500', label: '분홍' },
  { value: 'bg-indigo-500', label: '남색' },
  { value: 'bg-red-500', label: '빨강' },
  { value: 'bg-teal-500', label: '청록' },
]

export default function StaffManager({ date, dailyStaff, globalStaff, onSaveDailyStaff, onSaveGlobalStaff }: StaffManagerProps) {
  // 오늘 근무하는 직원 목록 (Read-Only + Delete 가능)
  const assignments = dailyStaff?.assignments || []

  // 글로벌 직원 명부 상태
  const [roster, setRoster] = useState<GlobalStaff[]>([])
  
  // 새 직원 입력 폼용 상태
  const [newRole, setNewRole] = useState<StaffRole>('부 근무자')
  const [newName, setNewName] = useState('')
  const [isSavingRoster, setIsSavingRoster] = useState(false)

  useEffect(() => {
    setRoster(globalStaff)
    const hasPrimary = globalStaff.some(s => s.role === '주 근무자')
    setNewRole(hasPrimary ? '부 근무자' : '주 근무자')
  }, [globalStaff])

  const handleAddNewStaff = async () => {
    if (!newName.trim()) return

    const usedColors = roster.map(a => a.color)
    const available = COLOR_PRESETS.find(c => !usedColors.includes(c.value))?.value || COLOR_PRESETS[0].value

    const newStaff: GlobalStaff = {
      id: `staff_${Date.now()}_${Math.random()}`,
      name: newName.trim(),
      role: newRole,
      color: available
    }

    const updatedRoster = [...roster, newStaff]
    setRoster(updatedRoster)
    setNewName('')
    
    if (newRole === '주 근무자') setNewRole('부 근무자')

    setIsSavingRoster(true)
    await onSaveGlobalStaff(updatedRoster)
    setIsSavingRoster(false)
  }

  const handleRemoveStaff = async (id: string) => {
    const updatedRoster = roster.filter(s => s.id !== id)
    setRoster(updatedRoster)
    
    setIsSavingRoster(true)
    await onSaveGlobalStaff(updatedRoster)
    setIsSavingRoster(false)
  }

  const handleUpdateColor = async (id: string, color: string) => {
    const updatedRoster = roster.map(s => s.id === id ? { ...s, color } : s)
    setRoster(updatedRoster)

    setIsSavingRoster(true)
    await onSaveGlobalStaff(updatedRoster)
    setIsSavingRoster(false)
  }

  const handleRemoveDailyAssignment = async (id: string) => {
    const updatedAssignments = assignments.filter(a => a.id !== id)
    await onSaveDailyStaff({ assignments: updatedAssignments })
  }

  const sortedAssignments = [...assignments].sort((a, b) => {
    if (a.role === '주 근무자' && b.role !== '주 근무자') return -1;
    if (a.role !== '주 근무자' && b.role === '주 근무자') return 1;
    return 0;
  })

  const sortedRoster = [...roster].sort((a, b) => {
    if (a.role === '주 근무자' && b.role !== '주 근무자') return -1;
    if (a.role !== '주 근무자' && b.role === '주 근무자') return 1;
    return 0;
  })

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-full overflow-hidden">
      {/* 1. 오늘의 근무자 배정 현황 (Top) */}
      <div className="px-6 py-4 border-b border-gray-100 bg-blue-50 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2">
            오늘의 근무자 현황
            <span className="text-sm font-normal text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
              {format(date, 'MM/dd')}
            </span>
          </h2>
          <p className="text-sm text-blue-600 mt-1">우측 캘린더 화면에서 추가한 오늘의 일정이 표시됩니다.</p>
        </div>
      </div>

      <div className="p-6 border-b border-gray-100 bg-white">
        {sortedAssignments.length === 0 ? (
          <div className="py-6 text-center text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-sm">
            등록된 근무자가 없습니다.<br/>우측 일정 입력 영역에서 추가해주세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {sortedAssignments.map((a) => {
              const isPrimary = a.role === '주 근무자'
              return (
                <div key={a.id} className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm ${isPrimary ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-gray-100'}`}>
                  <div className={`w-3 h-10 rounded-full ${a.color}`} />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-800">
                      {a.role} <span className="text-blue-600 ml-1">{a.name}</span>
                    </div>
                    <div className="text-xs font-bold text-gray-500 mt-0.5 bg-gray-100 inline-block px-1.5 py-0.5 rounded">
                      {a.shift}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRemoveDailyAssignment(a.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
                    title="일정 삭제"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 2. 전역 직원 명부 관리 (Bottom) */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-800">전체 직원 명부</h3>
          <p className="text-xs text-gray-500 mt-0.5">이곳에 지정된 직원은 우측 스케줄 등록 시 선택할 수 있습니다.</p>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto bg-gray-50 space-y-6">
        
        {/* 새 직원 추가 폼 */}
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <select 
            value={newRole} 
            onChange={e => setNewRole(e.target.value as StaffRole)}
            className="w-full sm:w-[110px] bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="주 근무자">주 근무자</option>
            <option value="부 근무자">부 근무자</option>
          </select>
          <input 
            type="text" 
            placeholder="직원 이름"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddNewStaff() }}
            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-gray-400"
          />
          <button 
            onClick={handleAddNewStaff}
            className="bg-gray-800 hover:bg-gray-900 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap"
          >
            명부에 추가
          </button>
        </div>

        {/* 직원 명부 칩 표시 */}
        <div className="flex flex-wrap gap-2.5">
          {sortedRoster.length === 0 ? (
            <div className="text-gray-400 text-sm py-2 px-1">등록된 직원이 없습니다. 위 입력창에서 주 근무자를 먼저 명부에 추가해주세요.</div>
          ) : (
            sortedRoster.map((s) => {
              const isPrimary = s.role === '주 근무자'
              return (
                <div 
                  key={s.id} 
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-sm transition-all group ${
                    isPrimary ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                  }`}
                >
                  {/* 색상 선택기 */}
                  <div className="relative">
                    <select
                      title="색상 변경"
                      value={s.color}
                      onChange={(e) => handleUpdateColor(s.id, e.target.value)}
                      className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer`}
                    >
                      {COLOR_PRESETS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <div className={`w-3.5 h-3.5 rounded-full ${s.color} shadow-inner`}></div>
                  </div>
                  
                  <div className="flex flex-col mx-1 leading-none mt-0.5">
                    <span className={`text-[10px] uppercase tracking-wide ${isPrimary ? 'text-blue-600 font-bold' : 'text-gray-400 font-bold'}`}>{s.role}</span>
                    <span className={`text-sm ${isPrimary ? 'font-bold text-blue-900' : 'font-medium text-gray-800'}`}>{s.name}</span>
                  </div>

                  <button 
                    onClick={() => handleRemoveStaff(s.id)}
                    className="ml-1 text-gray-300 hover:text-red-500 p-0.5 rounded-full hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )
            })
          )}
        </div>

      </div>
    </div>
  )
}
