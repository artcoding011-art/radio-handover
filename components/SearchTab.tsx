'use client'

import { useState, useCallback, useMemo } from 'react'

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
  const [folderPath, setFolderPath] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  // AI 검색 상태
  const [isSearching, setIsSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [dbSummary, setDbSummary] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash-lite')
  const [useFolderContext, setUseFolderContext] = useState(false)

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

  // 폴더 분석 호출
  const handleAnalyze = useCallback(async () => {
    if (!folderPath.trim()) return
    setAnalyzing(true)
    setAnalyzeError(null)
    setAnalyzeResult(null)
    try {
      const res = await fetch('/api/search/analyze-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: folderPath.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '분석 실패')
      setAnalyzeResult(data.result)
    } catch (e: any) {
      setAnalyzeError(e.message || '알 수 없는 오류가 발생했습니다.')
    } finally {
      setAnalyzing(false)
    }
  }, [folderPath])

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
          folderPath: folderPath.trim(),
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
    } catch (e: any) {
      setSearchError(e.message || '알 수 없는 오류가 발생했습니다.')
    } finally {
      setIsSearching(false)
    }
  }, [query, selectedModel, useFolderContext, folderPath, useDbContext, dbOptions, dbFrom, dbTo])

  // 상위 확장자 Top 5
  const topExtensions = analyzeResult
    ? Object.entries(analyzeResult.extensions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : []

  return (
    <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/60 rounded-2xl shadow-md border border-gray-100 flex flex-col h-full overflow-hidden w-full relative">

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
                disabled={isSearching || !folderPath.trim()}
                className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
              />
              <span className={`text-sm font-semibold transition-colors ${!folderPath.trim() ? 'text-gray-400' : 'text-gray-700 group-hover:text-blue-600'}`}>
                📁 하단 폴더 문서 참고하기
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

        {/* 빠른 검색 버튼 */}
        <div className="mt-5 flex flex-wrap gap-3 justify-center text-sm font-semibold">
          {['오늘 스케줄 알려줘', '최근 인수인계 내역 검색', '근무자 배정 현황'].map(text => (
            <button
              key={text}
              onClick={() => {
                setQuery(text);
                handleSearch(text);
              }}
              disabled={isSearching}
              className="px-5 py-2 bg-white hover:bg-gray-50 disabled:opacity-50 rounded-full transition-all border border-gray-200 shadow-sm hover:shadow text-blue-800 hover:text-blue-900"
            >
              {text}
            </button>
          ))}
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

        {/* 폴더 경로 설정 카드 (기존 기능 유지) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-800 text-base">분석 대상 폴더 설정</h3>
          </div>
          <p className="text-sm text-gray-400 mb-3">
            서버(로컬 머신)에서 접근 가능한 폴더 절대 경로를 입력하세요. 하위 폴더까지 자동으로 탐색합니다.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={folderPath}
              onChange={e => setFolderPath(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              placeholder="예: /Users/admin/Documents/자료"
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm text-gray-800 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition bg-gray-50 font-mono"
            />
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !folderPath.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition shadow-sm hover:shadow-md flex items-center gap-2 shrink-0"
            >
              {analyzing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  분석 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  폴더 분석
                </>
              )}
            </button>
          </div>
        </div>

        {/* 에러 */}
        {analyzeError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700 font-medium">{analyzeError}</p>
          </div>
        )}

        {/* 분석 결과 */}
        {analyzeResult ? (
          <>
            {/* 요약 통계 카드 */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '전체 파일', value: `${analyzeResult.totalFiles.toLocaleString()}개`, icon: '📄' },
                { label: '전체 폴더', value: `${analyzeResult.totalDirs.toLocaleString()}개`, icon: '📁' },
                { label: '총 용량', value: formatBytes(analyzeResult.totalSize), icon: '💾' },
              ].map(({ label, value, icon }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-1">
                  <span className="text-2xl">{icon}</span>
                  <p className="text-xl font-extrabold text-indigo-700">{value}</p>
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                </div>
              ))}
            </div>

            {/* 확장자 분포 */}
            {topExtensions.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h4 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-1.5">
                  <span>📊</span> 파일 형식 분포 (Top 5)
                </h4>
                <div className="space-y-2">
                  {topExtensions.map(([ext, count]) => {
                    const pct = Math.round((count / analyzeResult.totalFiles) * 100)
                    const colorClass = EXT_COLORS[ext] || 'bg-gray-100 text-gray-600'
                    return (
                      <div key={ext} className="flex items-center gap-3">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded w-16 text-center flex-shrink-0 ${colorClass}`}>
                          {ext === '(없음)' ? '기타' : ext.toUpperCase()}
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-2 bg-indigo-400 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">{count}개</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 파일 트리 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h4 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-1.5">
                <span>🗂</span> 파일 트리
                <span className="ml-auto text-xs font-normal text-gray-400 font-mono truncate">{analyzeResult.rootPath}</span>
              </h4>
              <div className="max-h-[400px] overflow-y-auto border border-gray-50 rounded-xl p-2 bg-gray-50/50">
                {analyzeResult.tree.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">폴더가 비어 있습니다.</p>
                ) : (
                  analyzeResult.tree.map((node, i) => (
                    <FileTreeNode key={i} node={node} depth={0} />
                  ))
                )}
              </div>
            </div>
          </>
        ) : !analyzeError && (
          /* 빈 상태 */
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm p-8 flex flex-col items-center justify-center min-h-[160px] text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-400">아직 분석된 자료가 없습니다</p>
            <p className="text-xs text-gray-300 mt-1">위에서 폴더를 지정하면 파일 목록과 분석 결과가 여기에 표시됩니다</p>
          </div>
        )}

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
