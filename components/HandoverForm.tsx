'use client'

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { HandoverEntry, ColumnValues, createEmptyEntry } from '@/lib/types'
import SignaturePad from './SignaturePad'


export interface HandoverFormRef {
  save: () => Promise<boolean>
}

interface HandoverFormProps {
  date: Date
  onSaved?: () => void
  onDirtyChange?: (isDirty: boolean) => void
  batchEntry?: HandoverEntry
  onBatchRenderReady?: () => void
  tasksString?: string
}

// 입력 컬럼: 1R / 2R / MFM (매체 제거)
const COLS: (keyof ColumnValues)[] = ['1R', '2R', 'MFM']

// 콤보박스
function ColSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full h-9 border-0 text-center text-[15px] focus:outline-none focus:bg-blue-50 bg-transparent cursor-pointer
        ${value === '정상' ? 'text-emerald-600 font-semibold' : ''}
        ${value === '불량' ? 'text-red-500 font-semibold' : ''}
        ${value === '' ? 'text-gray-400' : ''}
      `}
    >
      <option value="">-</option>
      <option value="정상" className="text-emerald-600 font-semibold">정상</option>
      <option value="불량" className="text-red-500 font-semibold bg-red-50">불량</option>
    </select>
  )
}

// colSpan=4: 항목 + 1R + 2R + MFM
function SectionHeader({ title, color = 'bg-gray-500' }: { title: string; color?: string }) {
  return (
    <tr>
      <td colSpan={4} className={`${color} text-center font-bold text-white py-2.5 text-[17px] tracking-wide`}>
        {title}
      </td>
    </tr>
  )
}

function ColHeaders() {
  return (
    <tr className="bg-gray-100">
      <th className="border border-gray-300 py-2 px-3 text-[14px] font-semibold text-gray-600 text-left w-24">항목</th>
      {COLS.map((col) => (
        <th key={col} className="border border-gray-300 py-2 text-[14px] font-semibold text-gray-600 w-16 text-center">
          {col}
        </th>
      ))}
    </tr>
  )
}

function DataRow({ label, values, onChange }: {
  label: string
  values: ColumnValues
  onChange: (col: keyof ColumnValues, val: string) => void
}) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="border border-gray-300 py-2 px-3 text-[13px] text-gray-700 w-24">{label}</td>
      {COLS.map((col) => (
        <td key={col} className="border border-gray-300 p-0 w-16">
          <ColSelect value={values[col]} onChange={(v) => onChange(col, v)} />
        </td>
      ))}
    </tr>
  )
}


const HandoverForm = forwardRef<HandoverFormRef, HandoverFormProps>(({ date, onSaved, onDirtyChange, batchEntry, onBatchRenderReady, tasksString }, ref) => {
  const dateStr = format(date, 'yyyy-MM-dd')
  const [entry, setEntry] = useState<HandoverEntry>(createEmptyEntry(dateStr))
  const [originalEntryStr, setOriginalEntryStr] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isNew, setIsNew] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showSavePopup, setShowSavePopup] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    // 배치 렌더링 모드일 경우 즉시 데이터 주입
    if (batchEntry) {
      setEntry(batchEntry)
      setOriginalEntryStr(JSON.stringify(batchEntry))
      setLoading(false)
      setShowForm(true)
      setIsEditing(false)
      setIsNew(false)
      if (onBatchRenderReady) {
        // DOM 렌더링 될 때까지 한 프레임 대기 후 콜백
        setTimeout(() => {
          onBatchRenderReady()
        }, 50)
      }
      return
    }

    setLoading(true)
    setSaved(false)
    fetch(`/api/entries/${dateStr}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.entry) { 
          setEntry(data.entry)
          setOriginalEntryStr(JSON.stringify(data.entry))
          setIsNew(false)
          setShowForm(true) // 데이터가 있으면 무조건 무조건 폼을 켬
          setIsEditing(false) // 저장된 데이터가 있으면 보기 모드로 시작
        }
        else { 
          const empty = createEmptyEntry(dateStr)
          // 기본 서명이 있다면 자동 입력
          const defaultSign = localStorage.getItem('handover_default_signature')
          if (defaultSign) {
            empty.서명 = defaultSign
          }
          if (tasksString) {
            empty.rStudio.현업주요사항 = tasksString
          }
          setEntry(empty)
          setOriginalEntryStr(JSON.stringify(empty))
          setIsNew(true)
          setShowForm(false) // 데이터가 없으면 무조건 폼을 끔 (신규작성 화면)
          setIsEditing(true) // 빈 화면에서 신규작성을 시작하므로 쓰기 모드
        }
      })
      .catch(() => { 
        const empty = createEmptyEntry(dateStr)
        if (tasksString) {
          empty.rStudio.현업주요사항 = tasksString
        }
        setEntry(empty)
        setOriginalEntryStr(JSON.stringify(empty))
        setShowForm(false); setIsEditing(true) 
      })
      .finally(() => setLoading(false))
  }, [dateStr])

  useEffect(() => {
    if (isEditing && originalEntryStr) {
      let isDirty = JSON.stringify(entry) !== originalEntryStr;
      
      // 원래 정보가 없던 신규 폼인 경우, 주요 정보(글씨)가 없으면 알람을 띄우지 않음
      if (isNew) {
        const hasInfo = entry.근무자.trim() !== '' || 
                        entry.결재자.trim() !== '' || 
                        entry.rStudio.현업주요사항.trim() !== '' || 
                        entry.rMCR.특이사항.trim() !== '';
        if (!hasInfo) {
          isDirty = false;
        }
      }

      onDirtyChange?.(isDirty);
    } else {
      onDirtyChange?.(false);
    }
  }, [entry, originalEntryStr, isEditing, isNew, onDirtyChange])

  useImperativeHandle(ref, () => ({
    save: async () => await handleSave()
  }))

  async function handleSave() {
    const noWorker = !entry.근무자.trim();
    const noApprover = !entry.결재자.trim();
    
    if (noWorker && noApprover) {
      setValidationError('근무자와 결재자를 기록해주세요.');
      return false;
    } else if (noWorker) {
      setValidationError('근무자를 기록해주세요.');
      return false;
    } else if (noApprover) {
      setValidationError('결재자를 기록해주세요.');
      return false;
    }

    setSaving(true)
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
      if (res.ok) { 
        setSaved(true); 
        setIsNew(false); 
        setIsEditing(false); // 저장하면 자동으로 보기 모드로 전환
        setOriginalEntryStr(JSON.stringify(entry)); // 원본 데이터 갱신
        onSaved?.(); 
        setShowSavePopup(true);
        setTimeout(() => setSaved(false), 3000) 
        return true;
      }
    } finally { setSaving(false) }
    return false;
  }

  const [isExporting, setIsExporting] = useState(false);

  async function handleExportPdf() {
    if (isNew || isEditing) {
      setDownloadError('저장되지 않아 다운받을수 없습니다.');
      return;
    }
    setDownloadError(null);
    setIsExporting(true);
    
    // 리액트 상태 업데이트 후 렌더링(스크롤 제거)을 기다림
    await new Promise(r => setTimeout(r, 100));
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const el = document.getElementById('handover-print-area');
      if (!el) throw new Error('Print area not found');

      // html2canvas 옵션: 해상도(scale)를 1.5로 올려서 선명도 확보 (단축된 용량 유지)
      const canvas = await html2canvas(el, { scale: 1.5, backgroundColor: '#ffffff' });
      
      // 이미지 포맷을 PNG 대비 용량이 훨씬 적은 JPEG로 변경 및 압축률(0.85) 설정
      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      
      // PDF 크기를 캔버스 크기에 딱 맞춤
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const pdf = new jsPDF({
        orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: [imgWidth, imgHeight]
      });

      // 'FAST' 압축 옵션 추가
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
      pdf.save(`인수인계서_${entry.date}.pdf`);
    } catch (error) {
      console.error('PDF export failed', error);
      setDownloadError('PDF 변환에 실패했습니다.');
    } finally {
      setIsExporting(false);
    }
  }

  function updateTopLevel(field: '근무자' | '결재자', value: string) {
    setEntry((e) => ({ ...e, [field]: value }))
  }
  function updateRStudio(field: keyof HandoverEntry['rStudio'], col: keyof ColumnValues, val: string) {
    if (field === '현업주요사항') return
    setEntry((e) => ({ ...e, rStudio: { ...e.rStudio, [field]: { ...(e.rStudio[field] as ColumnValues), [col]: val } } }))
  }
  function updateRStudioCheck(key: keyof HandoverEntry['rStudio']['체크항목'], col: keyof ColumnValues, val: string) {
    setEntry((e) => ({ ...e, rStudio: { ...e.rStudio, 체크항목: { ...e.rStudio.체크항목, [key]: { ...e.rStudio.체크항목[key], [col]: val } } } }))
  }
  function updateRMCR(field: keyof HandoverEntry['rMCR'], col: keyof ColumnValues, val: string) {
    if (field === '특이사항') return
    setEntry((e) => ({ ...e, rMCR: { ...e.rMCR, [field]: { ...(e.rMCR[field] as ColumnValues), [col]: val } } }))
  }
  function updateAFS(field: keyof HandoverEntry['afs'], col: keyof ColumnValues, val: string) {
    setEntry((e) => ({ ...e, afs: { ...e.afs, [field]: { ...e.afs[field], [col]: val } } }))
  }

  const dateDisplay = format(date, 'yyyy년 MM월 dd일 (eee)', { locale: ko })

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md flex items-center justify-center h-full">
        <div className="text-gray-400 text-base">불러오는 중...</div>
      </div>
    )
  }

  if (!showForm) {
    return (
      <div className="bg-white rounded-xl shadow-md flex flex-col items-center justify-center h-full gap-4 text-center p-6">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-2">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{dateDisplay}</h3>
          <p className="text-gray-500 mt-1">저장된 문서가 없습니다</p>
        </div>
        <button 
          onClick={() => { setShowForm(true); setIsEditing(true); }}
          className="mt-4 bg-blue-900 text-white font-semibold text-base px-6 py-2.5 rounded-lg hover:bg-blue-800 transition shadow-sm"
        >
          신규작성
        </button>
      </div>
    )
  }

  const isExportMode = isExporting || !!batchEntry;
  return (
    <div id="handover-print-area" className={`bg-white rounded-xl shadow-md flex flex-col relative ${isExportMode ? 'h-auto overflow-visible' : 'h-full overflow-x-auto'}`}>
      {/* 저장 완료 팝업 */}
      {showSavePopup && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center w-72 transform transition-all animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-4 shadow-sm">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">저장되었습니다!</h3>
            <p className="text-sm text-gray-500 mb-6 text-center">작성된 내용이 안전하게 저장되었습니다.</p>
            <button 
              onClick={() => setShowSavePopup(false)}
              className="w-full bg-blue-900 text-white font-bold text-base py-3 rounded-xl hover:bg-blue-800 transition shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 필수항목 누락 팝업 */}
      {validationError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center w-72 transform transition-all animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4 shadow-sm">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">입력 필요</h3>
            <p className="text-sm text-gray-500 mb-6 text-center">{validationError}</p>
            <button 
              onClick={() => setValidationError(null)}
              className="w-full bg-blue-900 text-white font-bold text-base py-3 rounded-xl hover:bg-blue-800 transition shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 다운로드 불가 팝업 */}
      {downloadError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center w-72 transform transition-all animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4 shadow-sm">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">다운로드 불가</h3>
            <p className="text-sm text-gray-500 mb-6 text-center">{downloadError}</p>
            <button 
              onClick={() => setDownloadError(null)}
              className="w-full bg-blue-900 text-white font-bold text-base py-3 rounded-xl hover:bg-blue-800 transition shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="bg-blue-900 text-white px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="font-bold text-[19px]">라디오 업무 인수인계서</h2>
          <p className="text-blue-200 text-[13px] mt-0.5">창원방송총국 기술국</p>
        </div>
        <div className="flex items-center gap-2" data-html2canvas-ignore="true">
          {!isNew && !saved && <span className="text-sm bg-emerald-600 text-white px-2 py-0.5 rounded-full">저장됨</span>}
          {saved && <span className="text-sm bg-emerald-400 text-white px-2 py-0.5 rounded-full animate-pulse">✓ 저장 완료!</span>}
          <button onClick={handleExportPdf} disabled={isExporting}
            className="bg-red-600 hover:bg-red-500 text-white text-base px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 shadow-sm disabled:opacity-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {isExporting ? '변환 중...' : 'PDF'}
          </button>
          
          {isEditing ? (
            <button onClick={handleSave} disabled={saving}
              className="bg-white text-blue-900 font-semibold text-base px-4 py-1.5 rounded-lg hover:bg-blue-50 transition disabled:opacity-50">
              {saving ? '저장 중...' : '저장'}
            </button>
          ) : (
            <button onClick={() => setIsEditing(true)}
              className="bg-white text-blue-900 font-semibold text-base px-4 py-1.5 rounded-lg hover:bg-blue-50 transition">
              수정
            </button>
          )}
        </div>
      </div>

      <fieldset disabled={!isEditing} className="flex-1 flex flex-col min-h-0 border-0 p-0 m-0">
        {/* 근무자 / 결재자 */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-center gap-8 flex-shrink-0">
        <span className="text-gray-500 text-[15px] font-medium whitespace-nowrap min-w-fit">{dateDisplay}</span>
        <label className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-gray-600 text-[15px] font-medium">근무자:</span>
          {!isEditing ? (
            <div className="border-b border-gray-300 px-1 pb-1 w-24 text-[15px] min-h-[28px] text-gray-800">{entry.근무자}</div>
          ) : (
            <input type="text" value={entry.근무자} onChange={(e) => updateTopLevel('근무자', e.target.value)}
              className="border-b border-gray-300 focus:border-blue-500 focus:outline-none px-1 pb-1 w-24 text-[15px]" placeholder="이름" />
          )}
        </label>
        <label className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-gray-600 text-[15px] font-medium">결재자:</span>
          {!isEditing ? (
            <div className="border-b border-gray-300 px-1 pb-1 w-24 text-[15px] min-h-[28px] text-gray-800">{entry.결재자}</div>
          ) : (
            <input type="text" value={entry.결재자} onChange={(e) => updateTopLevel('결재자', e.target.value)}
              className="border-b border-gray-300 focus:border-blue-500 focus:outline-none px-1 pb-1 w-24 text-[15px]" placeholder="이름" />
          )}
        </label>
        <div className="flex items-center gap-1.5 ml-4">
          <span className="text-gray-600 text-[15px] font-medium whitespace-nowrap">확인 :</span>
          <SignaturePad 
            value={entry.서명} 
            onChange={(val) => setEntry(e => ({ ...e, 서명: val }))} 
            disabled={!isEditing} 
          />
        </div>
      </div>

      {/* 폼 */}
      <div className={`p-4 ${isExporting ? 'overflow-visible h-auto' : 'overflow-auto flex-1'}`}>
        <table className="w-full min-w-[650px] border-collapse border border-gray-300 mx-auto">
          <tbody>

            {/* ── R-Studio ── */}
            <SectionHeader title="R-Studio" color="bg-blue-700" />
            <ColHeaders />
            <DataRow label="일일편성정보 확인 (로컬,CM)"
              values={entry.rStudio.일일편성정보확인}
              onChange={(col, val) => updateRStudio('일일편성정보확인', col, val)} />

            {/* 체크항목 + 현업주요사항 */}
            <tr>
              <td className="border border-gray-300 align-top py-2 px-3 text-[13px] text-gray-600 w-32">
                <p className="font-semibold text-gray-700 mb-1">체크 항목</p>
                <p>1. Mixer 램프/파워 상태</p>
                <p>2. Display모니터/라우터 확인</p>
                <p>3. 로컬녹음단말 녹음여부 확인</p>
                <p>4. ST내부 모니터/스피커 확인</p>
              </td>
              <td colSpan={3} className="border border-gray-300 p-0 align-top">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border-b border-gray-200 py-1.5 px-3 text-[13px] text-gray-500 font-semibold text-left w-24">항목</th>
                      {COLS.map((c) => (
                        <th key={c} className="border-b border-l border-gray-200 py-1.5 text-[13px] text-gray-500 font-semibold text-center w-16">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      { key: 'mixer' as const, label: 'Mixer 램프/파워' },
                      { key: 'display모니터' as const, label: 'Display/라우터' },
                      { key: '로컬녹음단말' as const, label: '로컬녹음단말' },
                      { key: 'ST내부모니터' as const, label: 'ST내부 모니터' },
                    ]).map(({ key, label }) => (
                      <tr key={key} className="hover:bg-gray-50">
                        <td className="border-b border-gray-200 py-1.5 px-3 text-[13px] text-gray-600 w-24">{label}</td>
                        {COLS.map((col) => (
                          <td key={col} className="border-b border-l border-gray-200 p-0 w-16">
                            <ColSelect value={entry.rStudio.체크항목[key][col]}
                              onChange={(v) => updateRStudioCheck(key, col, v)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2">
                  <p className="text-[15px] text-gray-500 font-medium mb-1">*현업주요사항</p>
                  <textarea value={entry.rStudio.현업주요사항}
                    onChange={(e) => setEntry((en) => ({ ...en, rStudio: { ...en.rStudio, 현업주요사항: e.target.value } }))}
                    className="w-full border border-gray-200 rounded p-1.5 text-[15px] focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                    rows={2} placeholder="현업 주요사항을 입력하세요..." />
                </div>
              </td>
            </tr>

            {/* ── R-MCR ── */}
            <SectionHeader title="R-MCR" color="bg-gray-500" />
            <ColHeaders />
            <tr className="hover:bg-gray-50">
              <td className="border border-gray-300 py-2 px-3 text-[13px] text-gray-700 leading-tight w-24">
                LG MUX / PIC(1R/2R/MFM) <br/> / D-KNC → 모니터
              </td>
              {COLS.map((col) => (
                <td key={col} className="border border-gray-300 p-0 w-16">
                  <ColSelect value={entry.rMCR.모니터[col]} onChange={(v) => updateRMCR('모니터', col, v)} />
                </td>
              ))}
            </tr>
            <DataRow label="매체별 송출서버 (주)(예)" values={entry.rMCR.매체별송출서버}
              onChange={(col, val) => updateRMCR('매체별송출서버', col, val)} />
            <DataRow label="디스플레이서버 시간성보" values={entry.rMCR.디스플레이서버시간성보}
              onChange={(col, val) => updateRMCR('디스플레이서버시간성보', col, val)} />
            <DataRow label="편성단말" values={entry.rMCR.편성단말}
              onChange={(col, val) => updateRMCR('편성단말', col, val)} />
            <tr>
              <td colSpan={4} className="border border-gray-300 px-3 py-2">
                <p className="text-[15px] font-medium text-gray-600 mb-1">*특이사항</p>
                <textarea value={entry.rMCR.특이사항}
                  onChange={(e) => setEntry((en) => ({ ...en, rMCR: { ...en.rMCR, 특이사항: e.target.value } }))}
                  className="w-full border border-gray-200 rounded p-1.5 text-[15px] focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                  rows={2} placeholder="특이사항을 입력하세요..." />
              </td>
            </tr>

            {/* ── AFS ── */}
            <SectionHeader title="AFS - 1R/2R/MFM" color="bg-gray-600" />
            <ColHeaders />
            {([
              { field: '라우터' as const, label: '라우터 (주)(예)' },
              { field: 'CASS' as const, label: 'CASS (주)(예)(C/O)' },
              { field: '1R_MFM송출서버' as const, label: '1R/MFM 송출서버 (주)(예)' },
              { field: '2R송출서버' as const, label: '2R 송출서버 (주)(예)' },
              { field: '디스플레이서버' as const, label: '디스플레이 서버' },
              { field: '편성단말' as const, label: '편성단말' },
              { field: 'DB서버' as const, label: 'DB서버' },
              { field: '네트워크스위치' as const, label: '네트워크스위치' },
              { field: '통합제어디코더' as const, label: '통합제어디코더' },
            ] as const).map(({ field, label }) => (
              <DataRow key={field} label={label} values={entry.afs[field]}
                onChange={(col, val) => updateAFS(field, col, val)} />
            ))}

          </tbody>
        </table>
      </div>
      </fieldset>
    </div>
  )
})

export default HandoverForm
