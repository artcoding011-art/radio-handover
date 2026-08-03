'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'

// ───────────── 타입 ─────────────
interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  ext?: string
  children?: FileNode[]
  modifiedAt?: string
}

interface AnalyzeResult {
  rootPath: string
  totalFiles: number
  totalDirs: number
  totalSize: number
  tree: FileNode[]
  extensions: Record<string, number>
}

export interface ChatHistoryItem {
  id: string;
  query: string;
  answer: string;
  dbSummary: string | null;
  timestamp: number;
}

// ───────────── 유틸 ─────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const EXT_COLORS: Record<string, string> = {
  '.txt': 'bg-gray-100 text-gray-600',
  '.pdf': 'bg-red-100 text-red-600',
  '.doc': 'bg-blue-100 text-blue-700',
  '.docx': 'bg-blue-100 text-blue-700',
  '.xls': 'bg-green-100 text-green-700',
  '.xlsx': 'bg-green-100 text-green-700',
  '.ppt': 'bg-orange-100 text-orange-700',
  '.pptx': 'bg-orange-100 text-orange-700',
  '.hwp': 'bg-sky-100 text-sky-700',
  '.hwpx': 'bg-sky-100 text-sky-700',
  '.mp3': 'bg-purple-100 text-purple-700',
  '.wav': 'bg-purple-100 text-purple-700',
  '.mp4': 'bg-pink-100 text-pink-700',
  '.jpg': 'bg-yellow-100 text-yellow-700',
  '.jpeg': 'bg-yellow-100 text-yellow-700',
  '.png': 'bg-yellow-100 text-yellow-700',
  '.csv': 'bg-teal-100 text-teal-700',
  '.json': 'bg-amber-100 text-amber-700',
  '.md': 'bg-slate-100 text-slate-700',
}

// ───────────── 파일 트리 노드 ─────────────
function FileTreeNode({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 1)
  const isDir = node.type === 'directory'
  const extClass = EXT_COLORS[node.ext || ''] || 'bg-gray-100 text-gray-500'

  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 cursor-pointer group transition-colors`}
        onClick={() => isDir && setOpen(o => !o)}
      >
        {/* 아이콘 */}
        {isDir ? (
          <span className="text-indigo-400 flex-shrink-0">
            {open ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 opacity-60" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
            )}
          </span>
        ) : (
          <span className="w-4 h-4 flex-shrink-0 text-gray-300">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </span>
        )}

        {/* 이름 */}
        <span className={`text-sm font-medium truncate flex-1 min-w-0 ${isDir ? 'text-indigo-700 font-semibold' : 'text-gray-700'}`}>
          {node.name}
        </span>

        {/* 파일: 확장자 + 크기 */}
        {!isDir && (
          <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {node.ext && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${extClass}`}>
                {node.ext.slice(1).toUpperCase()}
              </span>
            )}
            {node.size !== undefined && (
              <span className="text-[11px] text-gray-400">{formatBytes(node.size)}</span>
            )}
          </div>
        )}

        {/* 디렉터리: 토글 화살표 */}
        {isDir && (
          <svg
            className={`w-3.5 h-3.5 flex-shrink-0 text-indigo-300 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {/* 하위 */}
      {isDir && open && node.children && (
        <div>
          {node.children.map((child, i) => (
            <FileTreeNode key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// ───────────── 메인 컴포넌트 ─────────────
export default function SearchTab() {
  const [query, setQuery] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  // AI 검색 상태
  const [isSearching, setIsSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [dbSummary, setDbSummary] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash-lite')
  const [useFolderContext, setUseFolderContext] = useState(false)

  // 파일 업로드 (DnD) 상태
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')

  // 대화 내역 상태
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([])
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('factchat_history')
      if (saved) {
        setChatHistory(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Failed to load chat history', e)
    }
  }, [])

  // DB 컨텍스트 상태
  const [useDbContext, setUseDbContext] = useState(false)
  const [dbOptions, setDbOptions] = useState({
    useHandover: true,
    useMwInspection: true,
    useSchedule: true,
    useTask: true,
    useStaff: true,
  })
  // 날짜 범위: 기본 최근 7일
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  const sevenDaysAgo = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 6)
    return d.toISOString().split('T')[0]
  }, [])
  const [dbFrom, setDbFrom] = useState(sevenDaysAgo)
  const [dbTo, setDbTo] = useState(today)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (isUploading) return

    const droppedFiles = Array.from(e.dataTransfer.files)
    
    // Check for directories or zip
    const hasDirOrZip = droppedFiles.some(f => 
      !f.type && f.size % 4096 === 0 || f.name.endsWith('.zip')
    )
    if (hasDirOrZip) {
      alert('압축파일 및 폴더는 업로드 할 수 없습니다. 개별파일로 올려주세요.')
      return
    }

    setPendingFiles(prev => {
      const newFiles = [...prev, ...droppedFiles]
      if (newFiles.length > 5) {
        alert('최대 5개의 파일까지만 올릴 수 있습니다.')
        return newFiles.slice(0, 5)
      }
      return newFiles
    })
  }, [isUploading])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const startLearning = async () => {
    if (pendingFiles.length === 0) return
    setIsUploading(true)
    
    try {
      // 중복 체크
      const filenames = pendingFiles.map(f => f.name)
      const dupRes = await fetch('/api/search/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames })
      })
      const dupData = await dupRes.json()
      const duplicates = dupData.duplicates || []

      // 진행할 파일 필터링
      const filesToProcess: File[] = []
      for (const file of pendingFiles) {
        if (duplicates.includes(file.name)) {
          const confirmOverwrite = window.confirm(`'${file.name}' 은(는) 이전에 학습시킨 이력이 있는 파일입니다. 다시 학습시키겠습니까?`)
          if (confirmOverwrite) {
            filesToProcess.push(file)
          }
        } else {
          filesToProcess.push(file)
        }
      }

      if (filesToProcess.length === 0) {
        setUploadMessage('학습할 파일이 없습니다.')
        setPendingFiles([])
        setIsUploading(false)
        return
      }

      // 순차적 업로드
      let successCount = 0
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i]
        setUploadMessage(`학습 중... (${i + 1}/${filesToProcess.length}) - ${file.name}`)
        
        const formData = new FormData()
        formData.append('file', file)
        
        const upRes = await fetch('/api/search/upload-and-summarize', {
          method: 'POST',
          body: formData
        })
        if (upRes.ok) {
          successCount++
        }
      }

      setUploadMessage(`총 ${filesToProcess.length}개 중 ${successCount}개 학습 완료!`)
      setPendingFiles([])
      
      setTimeout(() => {
        setUploadMessage('')
      }, 3000)

    } catch (error) {
      alert('학습 중 오류가 발생했습니다.')
      setUploadMessage('')
    } finally {
      setIsUploading(false)
    }
  }

  // AI 검색 호출
  const handleSearch = useCallback(async (searchQuery: string = query) => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    setSearchError(null)
    setSearchResult(null)
    setDbSummary(null)
    try {
      const res = await fetch('/api/factchat/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: searchQuery.trim(), 
          model: selectedModel,
          useFolderContext,
          useDbContext,
          dbContextOptions: useDbContext ? {
            ...dbOptions,
            from: dbFrom,
            to: dbTo,
          } : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '검색 실패')
      setSearchResult(data.answer)
      if (data.dbSummary) setDbSummary(data.dbSummary)

      // 성공 시 대화 내역에 저장
      const newHistoryItem: ChatHistoryItem = {
        id: Date.now().toString(),
        query: searchQuery.trim(),
        answer: data.answer,
        dbSummary: data.dbSummary || null,
        timestamp: Date.now(),
      }
      setChatHistory(prev => {
        const next = [newHistoryItem, ...prev].slice(0, 50)
        localStorage.setItem('factchat_history', JSON.stringify(next))
        return next
      })
    } catch (e: any) {
      setSearchError(e.message || '알 수 없는 오류가 발생했습니다.')
    } finally {
      setIsSearching(false)
    }
  }, [query, selectedModel, useFolderContext, useDbContext, dbOptions, dbFrom, dbTo])





  return (
    <div 
      className="bg-gradient-to-br from-blue-50/60 to-indigo-50/60 rounded-2xl shadow-md border border-gray-100 flex flex-col h-full overflow-hidden w-full relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >

      {/* ── Drag Overlay ── */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-blue-500/20 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-dashed border-blue-500 rounded-2xl pointer-events-none transition-all">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center">
            <svg className="w-16 h-16 text-blue-500 mb-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <h3 className="text-xl font-bold text-gray-800">여기에 파일을 놓아주세요</h3>
            <p className="text-sm text-gray-500 mt-2">단일 파일만 업로드 가능합니다 (PDF, Word, Excel 등)</p>
          </div>
        </div>
      )}

      {/* ── Uploading Overlay ── */}
      {isUploading && (
        <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl transition-all">
          <div className="bg-white px-8 py-6 rounded-2xl shadow-xl flex flex-col items-center border border-gray-100">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <h3 className="text-lg font-bold text-gray-800">{uploadMessage}</h3>
            <p className="text-sm text-gray-500 mt-2">완료될 때까지 창을 닫지 마세요...</p>
          </div>
        </div>
      )}

      {/* ── 우측 상단: 대화 내역 버튼 ── */}
      <button 
        onClick={() => setIsHistoryOpen(true)}
        className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 shadow-sm rounded-lg text-sm font-semibold text-gray-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors z-10"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        대화 내역 보기
      </button>

      {/* ── 사이드 서랍(Drawer): 대화 내역 ── */}
      {isHistoryOpen && (
        <div className="absolute inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsHistoryOpen(false)}></div>
          <div className="relative w-full max-w-sm h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                과거 대화 내역
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    if (confirm('모든 대화 내역을 삭제하시겠습니까?')) {
                      setChatHistory([])
                      localStorage.removeItem('factchat_history')
                    }
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  title="전체 삭제"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <button onClick={() => setIsHistoryOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatHistory.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  저장된 대화 내역이 없습니다.
                </div>
              ) : (
                chatHistory.map(item => (
                  <div 
                    key={item.id}
                    onClick={() => {
                      setQuery(item.query)
                      setSearchResult(item.answer)
                      setDbSummary(item.dbSummary)
                      setIsHistoryOpen(false)
                    }}
                    className="p-3 border border-gray-100 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition group"
                  >
                    <div className="text-xs text-gray-400 mb-1">
                      {new Date(item.timestamp).toLocaleString('ko-KR')}
                    </div>
                    <div className="text-sm font-semibold text-gray-700 line-clamp-2 mb-1 group-hover:text-indigo-700">
                      {item.query}
                    </div>
                    <div className="text-xs text-gray-500 line-clamp-2">
                      {item.answer}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 상단: 타이틀 + 검색창 ── */}
      <div className="flex flex-col items-center justify-center pt-14 pb-8 px-8 flex-shrink-0">
        <p className="text-sm font-semibold text-indigo-400 tracking-[0.2em] uppercase mb-5">
          KBS 창원 라디오 자료검색
        </p>

        {/* R 로고 + 메인 타이틀 인라인 */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"
            style={{ animation: 'rLogoSparkle 2.4s ease-in-out infinite' }}
          >
            <span className="text-white font-black text-xl select-none">R</span>
          </div>
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-700 tracking-tight">
            무엇을 도와드릴까요?
          </h2>
        </div>

        {/* 모델 및 참고 옵션 */}
        <div className="w-full max-w-2xl mb-3 flex flex-col gap-2 px-1">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer group flex-shrink-0">
              <input 
                type="checkbox" 
                checked={useFolderContext}
                onChange={e => setUseFolderContext(e.target.checked)}
                disabled={isSearching}
                className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
              />
              <span className={`text-sm font-semibold transition-colors text-gray-700 group-hover:text-blue-600`}>
                학습된 파일(Wiki) 참고하기
              </span>
            </label>
            <select 
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              disabled={isSearching}
              className="w-full sm:w-auto text-sm font-medium border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-shadow disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite (빠른 속도)</option>
              <option value="gpt-5.4-nano">GPT 5.4 Nano (가성비 최고)</option>
              <option value="claude-haiku-4-5-20251001">Claude 4.5 Haiku (빠른 분석)</option>
            </select>
          </div>

          {/* DB 컨텍스트 옵션 */}
          <div className="border border-indigo-100 rounded-xl bg-indigo-50/40 p-3">
            <label className="flex items-center gap-2 cursor-pointer group mb-2">
              <input
                type="checkbox"
                checked={useDbContext}
                onChange={e => setUseDbContext(e.target.checked)}
                disabled={isSearching}
                className="w-4 h-4 text-indigo-600 bg-white border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
              />
              <span className="text-sm font-bold text-indigo-700 group-hover:text-indigo-900 transition-colors">
                🗄️ DB 데이터 참고하기
              </span>
              <span className="text-[11px] text-indigo-400 font-medium">업무인계서 · 점검일지 등 DB를 AI가 읽습니다</span>
            </label>
            {useDbContext && (
              <div className="ml-6 space-y-2">
                {/* 데이터 종류 체크박스 */}
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: 'useHandover', label: '업무인계서' },
                    { key: 'useMwInspection', label: 'M/W 점검일지' },
                    { key: 'useSchedule', label: '제작일정' },
                    { key: 'useTask', label: '업무일정' },
                    { key: 'useStaff', label: '근무자' },
                  ] as { key: keyof typeof dbOptions; label: string }[]).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dbOptions[key]}
                        onChange={e => setDbOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                        disabled={isSearching}
                        className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-gray-600">{label}</span>
                    </label>
                  ))}
                </div>
                {/* 날짜 범위 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500 font-medium">기간:</span>
                  <input
                    type="date"
                    value={dbFrom}
                    onChange={e => setDbFrom(e.target.value)}
                    disabled={isSearching}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 bg-white disabled:opacity-50"
                  />
                  <span className="text-xs text-gray-400">~</span>
                  <input
                    type="date"
                    value={dbTo}
                    onChange={e => setDbTo(e.target.value)}
                    disabled={isSearching}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 bg-white disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => { setDbFrom(sevenDaysAgo); setDbTo(today) }}
                    disabled={isSearching}
                    className="text-[11px] text-indigo-500 hover:text-indigo-700 font-semibold px-2 py-0.5 rounded border border-indigo-200 hover:bg-indigo-50 transition disabled:opacity-50"
                  >
                    최근 7일
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 검색 입력창 */}
        <div className="w-full max-w-2xl relative shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-[2rem] bg-white border border-gray-100 focus-within:ring-4 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all duration-300 flex items-center pr-2 pl-2 py-1">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="질문을 입력하세요..."
            className="w-full py-4 px-5 rounded-2xl outline-none text-gray-800 text-lg placeholder-gray-400 bg-transparent font-medium"
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            disabled={isSearching}
          />
          <button 
            onClick={() => handleSearch()}
            disabled={isSearching || !query.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-3.5 rounded-xl transition-all shrink-0 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center"
          >
            {isSearching ? (
              <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            )}
          </button>
        </div>


      </div>

      {/* 구분선 */}
      <div className="mx-8 border-t border-blue-100 flex-shrink-0" />

      {/* ── 하단: AI 검색 결과 & 폴더 분석 섹션 ── */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

        {/* 검색 에러 */}
        {searchError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-5 flex items-start gap-4">
            <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-red-800 mb-1">AI 검색 오류</h4>
              <p className="text-sm text-red-700">{searchError}</p>
            </div>
          </div>
        )}

        {/* 검색 결과 */}
        {searchResult && (
          <div className="bg-white rounded-3xl border border-indigo-100 shadow-sm p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-500 to-indigo-600" />
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-indigo-600 text-lg">✨</span>
              </div>
              <h3 className="font-extrabold text-gray-800 text-lg">AI 답변</h3>
            </div>
            {dbSummary && (
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6M9 8h6M9 16h4"/>
                  </svg>
                  {dbSummary}
                </span>
              </div>
            )}
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
              {searchResult}
            </div>
          </div>
        )}

        {/* LLM Wiki 파일 학습 (Dropzone) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-800 text-base">LLM Wiki 문서 학습</h3>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            여기에 올려진 문서들은 자동으로 마크다운(MD)으로 요약되어 앱 내부에 저장되며 팀원들과 공유됩니다.
          </p>

          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors ${
              isDragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <svg className={`w-10 h-10 mb-3 ${isDragOver ? 'text-indigo-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-semibold text-gray-700">학습할 파일을 여기에 놓아주세요 (최대 5개)</p>
            <p className="text-xs text-gray-400 mt-1">지원 형식: PDF, DOCX, XLSX, HWP, TXT 등</p>
          </div>

          {pendingFiles.length > 0 && (
            <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
              <h4 className="text-xs font-bold text-gray-500 mb-2">대기 중인 파일 ({pendingFiles.length}/5)</h4>
              <ul className="space-y-2 mb-4">
                {pendingFiles.map((f, i) => (
                  <li key={i} className="text-sm flex items-center justify-between text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-100 shadow-sm">
                    <span className="truncate">{f.name}</span>
                    <button 
                      onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-600 p-1"
                      disabled={isUploading}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={startLearning}
                disabled={isUploading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    학습 진행 중...
                  </>
                ) : (
                  '학습 시작 (확인)'
                )}
              </button>
            </div>
          )}
          
          {uploadMessage && (
            <div className={`mt-3 text-sm font-semibold text-center px-4 py-2 rounded-xl ${uploadMessage.includes('완료') ? 'bg-green-50 text-green-700' : 'bg-indigo-50 text-indigo-700'}`}>
              {uploadMessage}
            </div>
          )}
        </div>

      </div>

      <style jsx>{`
        @keyframes rLogoSparkle {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); opacity: 1; }
          40% { box-shadow: 0 0 16px 4px rgba(99,102,241,0.45); opacity: 0.88; }
          60% { box-shadow: 0 0 24px 8px rgba(59,130,246,0.35); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
