'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { MwInspectionData, MwDataRow } from '@/lib/types'

interface MwInspectionFormProps {
  date: Date
  onSaveSuccess?: () => void
}

function createEmptyMwData(date: Date): MwInspectionData {
  const emptyRow: MwDataRow = { 
    isOperating: false, 
    pd: '5', 
    mpx: '-40.9', 
    leftLvl: '-40.9', 
    rightLvl: '-40.9', 
    vs2: '27.2', 
    vsPlus: '12.6', 
    vsMinus: '-12.1', 
    t: '33' 
  }
  return {
    time: format(new Date(), 'HH:mm'),
    temperature: '20',
    humidity: '50',
    inspector: '',
    '1R_TX1': { ...emptyRow },
    '1R_TX2': { ...emptyRow },
    '2R_TX1': { ...emptyRow },
    '2R_TX2': { ...emptyRow },
    'MFM_TX1': { ...emptyRow },
    'MFM_TX2': { ...emptyRow },
  }
}

export default function MwInspectionForm({ date, onSaveSuccess }: MwInspectionFormProps) {
  const dateStr = format(date, 'yyyy-MM-dd')
  const dateDisplay = format(date, 'yyyy년 M월 d일', { locale: ko })
  
  const [data, setData] = useState<MwInspectionData>(createEmptyMwData(date))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSavePopup, setShowSavePopup] = useState(false)

  const [isNew, setIsNew] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/mw-inspection?date=${dateStr}`)
      .then(res => res.json())
      .then(res => {
        if (res.data) {
          setData(res.data)
          setIsNew(false)
        } else {
          setData(createEmptyMwData(date))
          setIsNew(true)
        }
      })
      .catch(err => {
        console.error('Failed to fetch MW inspection data:', err)
        setData(createEmptyMwData(date))
        setIsNew(true)
      })
      .finally(() => setLoading(false))
  }, [dateStr, date])

  const [toastMessage, setToastMessage] = useState('저장되었습니다.')

  const handleSave = async () => {
    // ... (unchanged validation)
    if (!data.temperature) { alert('온도를 입력해주세요.'); return }
    if (!data.humidity) { alert('습도를 입력해주세요.'); return }
    if (!data.inspector) { alert('점검자를 입력하세요.'); return }

    const checkMedium = (m: '1R' | '2R' | 'MFM') => {
      const tx1 = data[`${m}_TX1` as keyof MwInspectionData] as MwDataRow
      const tx2 = data[`${m}_TX2` as keyof MwInspectionData] as MwDataRow
      return tx1.isOperating || tx2.isOperating
    }
    if (!checkMedium('1R')) { alert('1R 매체의 운영 중인 TX를 선택해야 합니다.'); return }
    if (!checkMedium('2R')) { alert('2R 매체의 운영 중인 TX를 선택해야 합니다.'); return }
    if (!checkMedium('MFM')) { alert('MFM 매체의 운영 중인 TX를 선택해야 합니다.'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/mw-inspection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, data })
      })
      if (res.ok) {
        setToastMessage('저장되었습니다.')
        setShowSavePopup(true)
        setTimeout(() => setShowSavePopup(false), 3000)
        setIsNew(false)
        if (onSaveSuccess) onSaveSuccess()
      }
    } catch (err) {
      console.error('Failed to save MW inspection data:', err)
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('정말 수정상태로 되돌리시겠습니까?\n저장된 데이터가 삭제되고 점검 대기 상태로 변경됩니다.')) {
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/mw-inspection?date=${dateStr}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setData(createEmptyMwData(date))
        setIsNew(true)
        if (onSaveSuccess) onSaveSuccess()
        setToastMessage('점검 대기 상태로 변경되었습니다.')
        setShowSavePopup(true)
        setTimeout(() => setShowSavePopup(false), 3000)
      }
    } catch (err) {
      console.error('Failed to delete MW inspection data:', err)
      alert('상태 변경에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const updateHeader = (field: keyof Pick<MwInspectionData, 'time'|'temperature'|'humidity'|'inspector'>, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const updateRow = (rowKey: keyof Omit<MwInspectionData, 'time'|'temperature'|'humidity'|'inspector'>, field: keyof MwDataRow, value: any) => {
    setData(prev => ({
      ...prev,
      [rowKey]: {
        ...(prev[rowKey] as MwDataRow),
        [field]: value
      }
    }))
  }

  const DataRowComponent = ({ mediumLabel, rowLabel, rowKey, isEven }: { mediumLabel?: string, rowLabel: string, rowKey: keyof Omit<MwInspectionData, 'time'|'temperature'|'humidity'|'inspector'>, isEven: boolean }) => {
    const rowData = data[rowKey] as MwDataRow
    const isOperating = rowData.isOperating

    return (
      <tr className={`border-b border-gray-200 transition-colors ${isOperating ? 'bg-blue-50/80 shadow-inner' : (isEven ? 'bg-gray-50/50' : 'bg-white')}`}>
        {mediumLabel && (
          <td rowSpan={2} className={`border-r border-gray-200 text-center font-bold text-gray-700 align-middle transition-colors ${isOperating ? 'bg-blue-100/30' : 'bg-gray-50/80'}`}>
            {mediumLabel}
          </td>
        )}
        <td className={`border-r border-gray-200 py-3 px-4 flex items-center justify-between transition-colors w-44 shrink-0 ${isOperating ? 'bg-blue-100/50' : ''}`}>
          <span className={`font-bold transition-colors ${isOperating ? 'text-blue-900' : 'text-gray-700'} text-[14px] whitespace-nowrap`}>{rowLabel}</span>
          <label className="flex items-center gap-2 cursor-pointer group shrink-0" title="동작 중인 TX 표시">
            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0 ${isOperating ? 'bg-blue-600 border-blue-600 shadow-sm' : 'bg-white border-gray-300 group-hover:border-blue-400'}`}>
              {isOperating && <div className="w-2 h-2 bg-white rounded-full animate-pulse" />}
            </div>
            <input 
              type="checkbox" 
              className="hidden" 
              checked={isOperating} 
              onChange={(e) => {
                // When toggling one TX, we should likely untoggle the other for the same medium
                const medium = rowKey.split('_')[0]
                const tx1Key = `${medium}_TX1` as keyof MwInspectionData
                const tx2Key = `${medium}_TX2` as keyof MwInspectionData
                setData(prev => ({
                  ...prev,
                  [tx1Key]: { ...(prev[tx1Key] as MwDataRow), isOperating: rowKey === tx1Key ? e.target.checked : false },
                  [tx2Key]: { ...(prev[tx2Key] as MwDataRow), isOperating: rowKey === tx2Key ? e.target.checked : false }
                }))
              }} 
            />
            <span className={`text-[12px] font-bold transition-colors whitespace-nowrap ${isOperating ? 'text-blue-700' : 'text-gray-400 group-hover:text-blue-600'}`}>동작</span>
          </label>
        </td>
        {(['pd', 'mpx', 'leftLvl', 'rightLvl', 'vs2', 'vsPlus', 'vsMinus', 't'] as (keyof MwDataRow)[]).map(field => (
          <td key={field} className="border-r border-gray-200 p-0 text-center last:border-r-0">
            <input 
              type="text" 
              value={rowData[field] as string} 
              onChange={(e) => updateRow(rowKey, field, e.target.value)}
              className={`w-full text-center py-3 bg-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 text-[15px] transition-all
                ${isOperating ? 'font-black text-blue-900 drop-shadow-sm' : 'font-medium text-gray-800'}`}
            />
          </td>
        ))}
      </tr>
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex-1 flex items-center justify-center">
        <div className="text-gray-400 font-medium animate-pulse">데이터를 불러오는 중입니다...</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex-1 flex flex-col overflow-hidden relative">
      {/* Toast Notification */}
      {showSavePopup && (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-fade-in-down border border-slate-700">
          <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="font-medium text-[15px]">{toastMessage}</p>
        </div>
      )}

      {/* Header */}
      <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight text-gray-800">M/W 점검 일지</h2>
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
            **동작 중인 TX를 표시하시고, M/W 장비 점검 부탁드립니다.**
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!isNew && (
            <button 
              onClick={handleDelete} 
              disabled={saving}
              className="flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600 text-[14px] font-bold px-5 py-2.5 bg-white text-red-600 border border-red-200 hover:bg-red-50 active:bg-red-100 transition-all rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              수정
            </button>
          )}
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 text-[14px] font-bold px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-all rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-[#f8fafc]/50">
        <div className="max-w-[1200px] mx-auto bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden p-6 mb-6">
          
          {/* Top Form Section */}
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="font-bold text-[18px] text-gray-800 tracking-tight select-none">
                {dateDisplay}
              </div>
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-transparent transition-all">
                <span className="text-gray-400 font-bold mr-1">(</span>
                <input 
                  type="text" 
                  className="w-12 bg-transparent text-center font-bold text-gray-700 focus:outline-none text-[15px]" 
                  value={data.time} 
                  onChange={e => updateHeader('time', e.target.value)} 
                  placeholder="09:00"
                />
                <span className="text-gray-400 font-bold ml-1">)</span>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-transparent transition-all">
                <span className="text-gray-500 font-bold text-[14px]">온도:</span>
                <input type="text" className="w-[50px] bg-transparent focus:outline-none text-right font-bold text-gray-800" value={data.temperature} onChange={e => updateHeader('temperature', e.target.value)} />
                <span className="text-gray-500 font-bold ml-1">℃</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-transparent transition-all">
                <span className="text-gray-500 font-bold text-[14px]">습도:</span>
                <input type="text" className="w-[50px] bg-transparent focus:outline-none text-right font-bold text-gray-800" value={data.humidity} onChange={e => updateHeader('humidity', e.target.value)} />
                <span className="text-gray-500 font-bold ml-1">%</span>
              </div>
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-transparent transition-all">
                <span className="text-blue-700 font-extrabold text-[14px]">점검자 :</span>
                <input type="text" className="w-[90px] bg-transparent focus:outline-none font-bold text-blue-900 border-b border-blue-200" value={data.inspector} onChange={e => updateHeader('inspector', e.target.value)} placeholder="이름 입력" />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="border border-gray-300 rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="border-r border-gray-300 w-16 py-3 font-bold text-gray-600 text-[13px] tracking-wide relative">
                    <div className="absolute top-0 right-0 p-1 text-[10px] text-gray-400">비고</div>
                    <div className="absolute bottom-0 left-0 p-1 text-[10px] text-gray-400">매체</div>
                    <svg className="absolute inset-0 w-full h-full text-gray-300" preserveAspectRatio="none">
                      <line x1="0" y1="0" x2="100%" y2="100%" stroke="currentColor" strokeWidth="1"/>
                    </svg>
                  </th>
                  <th className="border-r border-gray-300 w-44" />
                  <th className="border-r border-gray-300 py-3 font-extrabold text-blue-800 text-[14px]">Pd</th>
                  <th className="border-r border-gray-300 py-3 font-bold text-gray-700 text-[13px] leading-tight">
                    MPX<br/><span className="font-medium text-[11px] text-gray-500">(주파수별 relative)(dB)</span>
                  </th>
                  <th className="border-r border-gray-300 py-3 font-bold text-gray-700 text-[13px]">left LVL <span className="font-medium text-[11px] text-gray-500">(dB)</span></th>
                  <th className="border-r border-gray-300 py-3 font-bold text-gray-700 text-[13px]">Right LVL <span className="font-medium text-[11px] text-gray-500">(dB)</span></th>
                  <th className="border-r border-gray-300 py-3 font-bold text-gray-700 text-[13px]">VS2 <span className="font-medium text-[11px] text-gray-500">(V)</span></th>
                  <th className="border-r border-gray-300 py-3 font-bold text-gray-700 text-[13px]">VS+ <span className="font-medium text-[11px] text-gray-500">(V)</span></th>
                  <th className="border-r border-gray-300 py-3 font-bold text-gray-700 text-[13px]">VS- <span className="font-medium text-[11px] text-gray-500">(V)</span></th>
                  <th className="py-3 font-bold text-gray-700 text-[13px]">T <span className="font-medium text-[11px] text-gray-500">(℃)</span></th>
                </tr>
                <tr className="bg-gray-50 border-b-2 border-gray-300">
                  <td colSpan={2} className="border-r border-gray-300 text-right pr-4 py-2 font-bold text-gray-500 text-[13px]">정상값</td>
                  <td className="border-r border-gray-300 text-center font-bold text-emerald-600 text-[14px]">5</td>
                  <td className="border-r border-gray-300 text-center text-[12px] font-bold text-emerald-600 leading-tight">48khz: -3.9<br/>32khz: -5.9</td>
                  <td className="border-r border-gray-300 text-center font-bold text-emerald-600 text-[13px]">-40 ~ -60</td>
                  <td className="border-r border-gray-300 text-center font-bold text-emerald-600 text-[13px]">0 ~ 8</td>
                  <td className="border-r border-gray-300 text-center font-bold text-emerald-600 text-[13px]">27.2</td>
                  <td className="border-r border-gray-300 text-center font-bold text-emerald-600 text-[13px]">12.6</td>
                  <td className="border-r border-gray-300 text-center font-bold text-emerald-600 text-[13px]">-12.1</td>
                  <td className="text-center font-bold text-emerald-600 text-[13px]">≒38</td>
                </tr>
              </thead>
              <tbody>
                <DataRowComponent mediumLabel="1R" rowLabel="TX-1 (주)" rowKey="1R_TX1" isEven={false} />
                <DataRowComponent rowLabel="TX-2 (예)" rowKey="1R_TX2" isEven={true} />
                <DataRowComponent mediumLabel="2R" rowLabel="TX-1 (주)" rowKey="2R_TX1" isEven={false} />
                <DataRowComponent rowLabel="TX-2 (예)" rowKey="2R_TX2" isEven={true} />
                <DataRowComponent mediumLabel="MFM" rowLabel="TX-1 (주)" rowKey="MFM_TX1" isEven={false} />
                <DataRowComponent rowLabel="TX-2 (예)" rowKey="MFM_TX2" isEven={true} />
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  )
}
