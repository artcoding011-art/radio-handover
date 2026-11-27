'use client'

import { useState, useRef, useEffect, RefObject } from 'react'

interface HtmlFormatToolbarProps {
  mode: 'visual' | 'source'
  textareaRef: RefObject<HTMLTextAreaElement>
  visualEditorRef: RefObject<HTMLDivElement>
  content: string
  onSourceChange: (next: string, selStart?: number, selEnd?: number) => void
  onVisualSync: () => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
}

const TEXT_COLORS = [
  { label: '검정', value: '#111827' },
  { label: '회색', value: '#6b7280' },
  { label: '빨강', value: '#dc2626' },
  { label: '주황', value: '#ea580c' },
  { label: '갈색', value: '#b45309' },
  { label: '초록', value: '#16a34a' },
  { label: 'KBS 블루', value: '#1e3a8a' },
  { label: '파랑', value: '#2563eb' },
  { label: '보라', value: '#7c3aed' },
  { label: '분홍', value: '#db2777' },
]

const BG_COLORS = [
  { label: '노랑', value: '#fef08a' },
  { label: '초록', value: '#bbf7d0' },
  { label: '하늘', value: '#bae6fd' },
  { label: '분홍', value: '#fbcfe8' },
  { label: '보라', value: '#e9d5ff' },
  { label: '회색', value: '#e5e7eb' },
]

const FONT_SIZES = [
  { label: '작게 (12px)', value: '12px' },
  { label: '보통 (14px)', value: '14px' },
  { label: '약간 크게 (16px)', value: '16px' },
  { label: '크게 (18px)', value: '18px' },
  { label: '매우 크게 (22px)', value: '22px' },
  { label: '제목급 (26px)', value: '26px' },
]

type OpenMenu = 'textColor' | 'bgColor' | 'fontSize' | null

function splitLeadingMarkdownPrefix(selected: string): { prefix: string; body: string } {
  if (!selected || selected.includes('\n')) {
    return { prefix: '', body: selected }
  }
  const match = selected.match(/^(\s*(?:#{1,6}|[-*+]|\d+\.)\s+)([\s\S]+)$/)
  if (!match) {
    return { prefix: '', body: selected }
  }
  return { prefix: match[1], body: match[2] }
}

function getClosestBlockTag(
  container: HTMLDivElement | null,
  tags: string[]
): HTMLElement | null {
  if (!container || typeof window === 'undefined') return null
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  let node: Node | null = sel.anchorNode
  while (node && node !== container) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if (tags.includes(el.tagName.toUpperCase())) return el
    }
    node = node.parentNode
  }
  return null
}

export default function HtmlFormatToolbar({
  mode,
  textareaRef,
  visualEditorRef,
  content,
  onSourceChange,
  onVisualSync,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: HtmlFormatToolbarProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
  const [lastTextColor, setLastTextColor] = useState('#dc2626')
  const [lastBgColor, setLastBgColor] = useState('#fef08a')
  const toolbarRef = useRef<HTMLDivElement>(null)

  // source 모드용 선택 백업
  const savedSourceSelRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 })
  // visual 모드용 Range 백업 (팝오버/컬러피커 열어도 선택 영역 보존)
  const savedVisualRangeRef = useRef<Range | null>(null)

  useEffect(() => {
    if (!openMenu) return
    const handleOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [openMenu])

  // ── Visual 모드 헬퍼 ──
  const captureVisualRange = () => {
    const editor = visualEditorRef.current
    if (!editor || typeof window === 'undefined') return
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      if (editor.contains(range.commonAncestorContainer)) {
        savedVisualRangeRef.current = range.cloneRange()
      }
    }
  }

  const focusVisualAndRestoreRange = (): Selection | null => {
    const editor = visualEditorRef.current
    if (!editor || typeof window === 'undefined') return null
    editor.focus()
    const sel = window.getSelection()
    if (!sel) return null

    const hasCurrentInside =
      sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)

    if (!hasCurrentInside && savedVisualRangeRef.current) {
      try {
        sel.removeAllRanges()
        sel.addRange(savedVisualRangeRef.current)
      } catch {
        // 범위 복원 실패 시 에디터 끝에 커서 배치
        const endRange = document.createRange()
        endRange.selectNodeContents(editor)
        endRange.collapse(false)
        sel.removeAllRanges()
        sel.addRange(endRange)
      }
    } else if (!hasCurrentInside) {
      const endRange = document.createRange()
      endRange.selectNodeContents(editor)
      endRange.collapse(false)
      sel.removeAllRanges()
      sel.addRange(endRange)
    }
    return sel
  }

  const runVisualExec = (command: string, value?: string) => {
    focusVisualAndRestoreRange()
    try {
      document.execCommand('styleWithCSS', false, 'true')
    } catch {
      // 일부 브라우저 무시
    }
    document.execCommand(command, false, value)
    captureVisualRange()
    onVisualSync()
  }

  const applyVisualSpanStyle = (cssProp: string, cssVal: string, extraStyle = '') => {
    const sel = focusVisualAndRestoreRange()
    if (!sel || sel.rangeCount === 0) return

    const range = sel.getRangeAt(0)
    if (range.collapsed) {
      const html = `<span style="${cssProp}: ${cssVal};${extraStyle}">텍스트</span>`
      document.execCommand('insertHTML', false, html)
      captureVisualRange()
      onVisualSync()
      return
    }

    // 색상은 execCommand가 여러 블록/줄에 걸친 선택도 자연스럽게 처리
    if (cssProp === 'color') {
      try {
        document.execCommand('styleWithCSS', false, 'true')
      } catch {}
      document.execCommand('foreColor', false, cssVal)
      captureVisualRange()
      onVisualSync()
      return
    }

    if (cssProp === 'background-color') {
      try {
        document.execCommand('styleWithCSS', false, 'true')
      } catch {}
      const ok = document.execCommand('hiliteColor', false, cssVal)
      if (!ok) {
        document.execCommand('backColor', false, cssVal)
      }
      captureVisualRange()
      onVisualSync()
      return
    }

    // font-size 등 일반 인라인 스타일: 선택 영역을 <span>으로 감싸기
    try {
      const span = document.createElement('span')
      span.setAttribute('style', `${cssProp}: ${cssVal};${extraStyle}`)
      const fragment = range.extractContents()
      span.appendChild(fragment)
      range.insertNode(span)

      const newRange = document.createRange()
      newRange.selectNodeContents(span)
      sel.removeAllRanges()
      sel.addRange(newRange)
      savedVisualRangeRef.current = newRange.cloneRange()
    } catch {
      const text = sel.toString() || '텍스트'
      document.execCommand(
        'insertHTML',
        false,
        `<span style="${cssProp}: ${cssVal};${extraStyle}">${text}</span>`
      )
    }
    onVisualSync()
  }

  const applyVisualHeading = (level: 1 | 2 | 3) => {
    focusVisualAndRestoreRange()
    const tag = `H${level}`
    const current = getClosestBlockTag(visualEditorRef.current, ['H1', 'H2', 'H3'])
    if (current && current.tagName.toUpperCase() === tag) {
      document.execCommand('formatBlock', false, 'p')
    } else {
      document.execCommand('formatBlock', false, `h${level}`)
    }
    captureVisualRange()
    onVisualSync()
  }

  const applyVisualBlockquote = () => {
    focusVisualAndRestoreRange()
    const current = getClosestBlockTag(visualEditorRef.current, ['BLOCKQUOTE'])
    document.execCommand('formatBlock', false, current ? 'p' : 'blockquote')
    captureVisualRange()
    onVisualSync()
  }

  const insertVisualHtml = (html: string) => {
    focusVisualAndRestoreRange()
    document.execCommand('insertHTML', false, html)
    captureVisualRange()
    onVisualSync()
  }

  // ── Source(원본 보기) 모드 헬퍼 ──
  const getSourceRange = () => {
    const el = textareaRef.current
    if (el && document.activeElement === el) {
      return {
        start: el.selectionStart ?? content.length,
        end: el.selectionEnd ?? content.length,
      }
    }
    if (savedSourceSelRef.current.start !== savedSourceSelRef.current.end) {
      return {
        start: Math.min(savedSourceSelRef.current.start, content.length),
        end: Math.min(savedSourceSelRef.current.end, content.length),
      }
    }
    if (el) {
      return {
        start: el.selectionStart ?? content.length,
        end: el.selectionEnd ?? content.length,
      }
    }
    return { start: content.length, end: content.length }
  }

  const applySourceEdit = (
    replacement: string,
    rangeStart: number,
    rangeEnd: number,
    nextSelStart: number,
    nextSelEnd: number
  ) => {
    const next = content.slice(0, rangeStart) + replacement + content.slice(rangeEnd)
    onSourceChange(next, nextSelStart, nextSelEnd)
    savedSourceSelRef.current = { start: nextSelStart, end: nextSelEnd }
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(nextSelStart, nextSelEnd)
    })
  }

  const wrapSourceTag = (tag: string, placeholder = '텍스트') => {
    const { start, end } = getSourceRange()
    const rawSelected = content.slice(start, end)
    const { prefix, body } = splitLeadingMarkdownPrefix(rawSelected)
    const effectiveStart = start + prefix.length
    const selected = body
    const openTag = `<${tag}>`
    const closeTag = `</${tag}>`

    if (selected.startsWith(openTag) && selected.endsWith(closeTag)) {
      const unwrapped = selected.slice(openTag.length, selected.length - closeTag.length)
      applySourceEdit(unwrapped, effectiveStart, end, effectiveStart, effectiveStart + unwrapped.length)
      return
    }
    if (
      effectiveStart >= openTag.length &&
      content.slice(effectiveStart - openTag.length, effectiveStart) === openTag &&
      content.slice(end, end + closeTag.length) === closeTag
    ) {
      applySourceEdit(
        selected,
        effectiveStart - openTag.length,
        end + closeTag.length,
        effectiveStart - openTag.length,
        effectiveStart - openTag.length + selected.length
      )
      return
    }

    const inner = selected || placeholder
    const wrapped = `${openTag}${inner}${closeTag}`
    const selStart = effectiveStart + openTag.length
    applySourceEdit(wrapped, effectiveStart, end, selStart, selStart + inner.length)
  }

  const wrapSourceSpanStyle = (styleValue: string, placeholder = '텍스트') => {
    const { start, end } = getSourceRange()
    const rawSelected = content.slice(start, end)
    const { prefix, body } = splitLeadingMarkdownPrefix(rawSelected)
    const effectiveStart = start + prefix.length
    const inner = body || placeholder
    const openTag = `<span style="${styleValue}">`
    const wrapped = `${openTag}${inner}</span>`
    const selStart = effectiveStart + openTag.length
    applySourceEdit(wrapped, effectiveStart, end, selStart, selStart + inner.length)
  }

  // ── 통합 액션 핸들러 (visual / source 자동 분기) ──
  const handleHeading = (level: 1 | 2 | 3) => {
    if (mode === 'visual') {
      applyVisualHeading(level)
      return
    }
    const { start, end } = getSourceRange()
    const tag = `h${level}`
    const openTag = `<${tag}>`
    const closeTag = `</${tag}>`
    if (start !== end) {
      const { body } = splitLeadingMarkdownPrefix(content.slice(start, end))
      const inner = body || '제목'
      applySourceEdit(
        `${openTag}${inner}${closeTag}`,
        start,
        end,
        start + openTag.length,
        start + openTag.length + inner.length
      )
      return
    }
    const lineStart = content.lastIndexOf('\n', start - 1) + 1
    const nextNewline = content.indexOf('\n', start)
    const lineEnd = nextNewline === -1 ? content.length : nextNewline
    const lineText = content.slice(lineStart, lineEnd)
    const headingMatch = lineText.match(/^<h([1-3])>([\s\S]*)<\/h\1>$/)
    if (headingMatch) {
      const inner = headingMatch[2]
      if (Number(headingMatch[1]) === level) {
        applySourceEdit(inner, lineStart, lineEnd, lineStart, lineStart + inner.length)
      } else {
        applySourceEdit(
          `${openTag}${inner}${closeTag}`,
          lineStart,
          lineEnd,
          lineStart + openTag.length,
          lineStart + openTag.length + inner.length
        )
      }
      return
    }
    const { body } = splitLeadingMarkdownPrefix(lineText)
    const inner = body || '제목'
    applySourceEdit(
      `${openTag}${inner}${closeTag}`,
      lineStart,
      lineEnd,
      lineStart + openTag.length,
      lineStart + openTag.length + inner.length
    )
  }

  const handleInlineFormat = (
    type: 'bold' | 'italic' | 'underline' | 'strike'
  ) => {
    if (mode === 'visual') {
      const cmdMap = {
        bold: 'bold',
        italic: 'italic',
        underline: 'underline',
        strike: 'strikeThrough',
      } as const
      runVisualExec(cmdMap[type])
      return
    }
    const tagMap = {
      bold: { tag: 'strong', ph: '굵은 텍스트' },
      italic: { tag: 'em', ph: '기울임 텍스트' },
      underline: { tag: 'u', ph: '밑줄 텍스트' },
      strike: { tag: 's', ph: '취소선 텍스트' },
    }
    wrapSourceTag(tagMap[type].tag, tagMap[type].ph)
  }

  const handleFontSize = (size: string) => {
    if (mode === 'visual') {
      applyVisualSpanStyle('font-size', size)
    } else {
      wrapSourceSpanStyle(`font-size: ${size}`)
    }
    setOpenMenu(null)
  }

  const handleTextColor = (color: string) => {
    setLastTextColor(color)
    if (mode === 'visual') {
      applyVisualSpanStyle('color', color)
    } else {
      wrapSourceSpanStyle(`color: ${color}`)
    }
    setOpenMenu(null)
  }

  const handleBgColor = (color: string) => {
    setLastBgColor(color)
    if (mode === 'visual') {
      applyVisualSpanStyle('background-color', color)
    } else {
      wrapSourceSpanStyle(`background-color: ${color}; padding: 0 3px; border-radius: 3px`)
    }
    setOpenMenu(null)
  }

  const handleAlign = (align: 'left' | 'center' | 'right') => {
    if (mode === 'visual') {
      const cmdMap = {
        left: 'justifyLeft',
        center: 'justifyCenter',
        right: 'justifyRight',
      } as const
      runVisualExec(cmdMap[align])
      return
    }
    const { start, end } = getSourceRange()
    let targetStart = start
    let targetEnd = end
    if (start === end) {
      targetStart = content.lastIndexOf('\n', start - 1) + 1
      const nextNewline = content.indexOf('\n', start)
      targetEnd = nextNewline === -1 ? content.length : nextNewline
    }
    const text = content.slice(targetStart, targetEnd)
    const match = text.match(/^<div style="text-align:\s*(left|center|right);?">([\s\S]*)<\/div>$/)
    if (match) {
      const openTag = `<div style="text-align: ${align}">`
      const inner = match[2]
      applySourceEdit(
        `${openTag}${inner}</div>`,
        targetStart,
        targetEnd,
        targetStart + openTag.length,
        targetStart + openTag.length + inner.length
      )
      return
    }
    const mdHeading = text.match(/^(#{1,6})\s+([\s\S]+)$/)
    const inner = mdHeading
      ? `<h${mdHeading[1].length}>${mdHeading[2]}</h${mdHeading[1].length}>`
      : text || '문단 내용'
    const openTag = `<div style="text-align: ${align}">`
    applySourceEdit(
      `${openTag}${inner}</div>`,
      targetStart,
      targetEnd,
      targetStart + openTag.length,
      targetStart + openTag.length + inner.length
    )
  }

  const handleList = (listTag: 'ul' | 'ol') => {
    if (mode === 'visual') {
      runVisualExec(listTag === 'ul' ? 'insertUnorderedList' : 'insertOrderedList')
      return
    }
    const { start, end } = getSourceRange()
    const selected = content.slice(start, end)
    const lines = selected
      ? selected.split('\n').map((l) => l.trim()).filter(Boolean)
      : ['항목 1', '항목 2']
    const items = lines.map((l) => `  <li>${l}</li>`).join('\n')
    const block = `<${listTag}>\n${items}\n</${listTag}>`
    const prefix = start > 0 && content[start - 1] !== '\n' ? '\n' : ''
    const suffix = end < content.length && content[end] !== '\n' ? '\n' : ''
    const inserted = `${prefix}${block}${suffix}`
    const firstStart = start + prefix.length + `<${listTag}>\n  <li>`.length
    applySourceEdit(inserted, start, end, firstStart, firstStart + lines[0].length)
  }

  const handleBlockquote = () => {
    if (mode === 'visual') {
      applyVisualBlockquote()
      return
    }
    const { start, end } = getSourceRange()
    const selected = content.slice(start, end) || '인용할 내용을 입력하세요'
    const prefix = start > 0 && content[start - 1] !== '\n' ? '\n' : ''
    const openTag = '<blockquote>'
    const inserted = `${prefix}${openTag}${selected}</blockquote>`
    const selStart = start + prefix.length + openTag.length
    applySourceEdit(inserted, start, end, selStart, selStart + selected.length)
  }

  const handleTable = () => {
    const tableHtml = [
      '<table>',
      '  <thead>',
      '    <tr>',
      '      <th>항목</th>',
      '      <th>내용</th>',
      '      <th>비고</th>',
      '    </tr>',
      '  </thead>',
      '  <tbody>',
      '    <tr>',
      '      <td>내용 1</td>',
      '      <td>내용 2</td>',
      '      <td>-</td>',
      '    </tr>',
      '  </tbody>',
      '</table>',
      '<p><br /></p>',
    ].join('\n')

    if (mode === 'visual') {
      insertVisualHtml(tableHtml)
      return
    }
    const { start, end } = getSourceRange()
    const prefix = start > 0 && content[start - 1] !== '\n' ? '\n' : ''
    const inserted = `${prefix}${tableHtml}\n`
    const pos = start + inserted.length
    applySourceEdit(inserted, start, end, pos, pos)
  }

  const handleDetails = () => {
    if (mode === 'visual') {
      insertVisualHtml(
        '<details open><summary>클릭하여 펼치기</summary><p>세부 내용을 입력하세요</p></details><p><br /></p>'
      )
      return
    }
    const { start, end } = getSourceRange()
    const selected = content.slice(start, end) || '세부 내용을 입력하세요'
    const prefix = start > 0 && content[start - 1] !== '\n' ? '\n' : ''
    const header = `<details>\n<summary>클릭하여 펼치기</summary>\n\n`
    const inserted = `${prefix}${header}${selected}\n</details>\n`
    const sStart = start + prefix.length + '<details>\n<summary>'.length
    applySourceEdit(inserted, start, end, sStart, sStart + '클릭하여 펼치기'.length)
  }

  const handleLink = () => {
    if (mode === 'visual') {
      captureVisualRange()
      const url = window.prompt('연결할 URL을 입력하세요:', 'https://')
      if (!url || !url.trim()) return
      const sel = focusVisualAndRestoreRange()
      const selectedText = sel?.toString().trim()
      if (selectedText) {
        document.execCommand('createLink', false, url.trim())
      } else {
        document.execCommand(
          'insertHTML',
          false,
          `<a href="${url.trim()}" target="_blank" rel="noopener noreferrer">${url.trim()}</a>`
        )
      }
      captureVisualRange()
      onVisualSync()
      return
    }
    const { start, end } = getSourceRange()
    const selected = content.slice(start, end) || '링크 제목'
    const inserted = `<a href="https://">${selected}</a>`
    const urlStart = start + '<a href="'.length
    applySourceEdit(inserted, start, end, urlStart, urlStart + 'https://'.length)
  }

  const handleHr = () => {
    if (mode === 'visual') {
      insertVisualHtml('<hr /><p><br /></p>')
      return
    }
    const { start, end } = getSourceRange()
    const snippet = '\n<hr />\n'
    applySourceEdit(snippet, start, end, start + snippet.length, start + snippet.length)
  }

  const handleBr = () => {
    if (mode === 'visual') {
      insertVisualHtml('<br />')
      return
    }
    const { start, end } = getSourceRange()
    const snippet = '<br />\n'
    applySourceEdit(snippet, start, end, start + snippet.length, start + snippet.length)
  }

  const toggleMenu = (menu: OpenMenu) => {
    if (openMenu !== menu) {
      if (mode === 'visual') {
        captureVisualRange()
      } else {
        savedSourceSelRef.current = getSourceRange()
      }
      setOpenMenu(menu)
    } else {
      setOpenMenu(null)
    }
  }

  const btnClass =
    'h-7 min-w-[28px] px-1.5 inline-flex items-center justify-center rounded-md text-gray-700 hover:bg-blue-50 hover:text-blue-900 active:bg-blue-100 transition text-xs font-bold'
  const dividerClass = 'w-px h-4 bg-gray-200 mx-0.5 flex-shrink-0'

  return (
    <div
      ref={toolbarRef}
      className="px-3 py-1.5 bg-white border-b border-gray-200 flex flex-wrap items-center gap-0.5 select-none"
    >
      {/* 실행 취소 / 다시 실행 */}
      <button
        type="button"
        title="실행 취소 (Ctrl+Z)"
        disabled={!canUndo}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onUndo?.()}
        className={`${btnClass} disabled:opacity-30 disabled:pointer-events-none`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l-4-4m0 0l4-4m-4 4h11a4 4 0 010 8h-1" />
        </svg>
      </button>
      <button
        type="button"
        title="다시 실행 (Ctrl+Y / Ctrl+Shift+Z)"
        disabled={!canRedo}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onRedo?.()}
        className={`${btnClass} disabled:opacity-30 disabled:pointer-events-none`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 14l4-4m0 0l-4-4m4 4H8a4 4 0 000 8h1" />
        </svg>
      </button>

      <span className={dividerClass} />

      {/* 제목 (H1 ~ H3) */}
      <button
        type="button"
        title="제목 1"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => handleHeading(1)}
        className={btnClass}
      >
        H1
      </button>
      <button
        type="button"
        title="제목 2"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => handleHeading(2)}
        className={btnClass}
      >
        H2
      </button>
      <button
        type="button"
        title="제목 3"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => handleHeading(3)}
        className={btnClass}
      >
        H3
      </button>

      {/* 글자 크기 드롭다운 */}
      <div className="relative">
        <button
          type="button"
          title="글자 크기 변경"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMenu('fontSize')}
          className={`${btnClass} gap-0.5 px-2 ${openMenu === 'fontSize' ? 'bg-blue-50 text-blue-900' : ''}`}
        >
          <span>크기</span>
          <svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {openMenu === 'fontSize' && (
          <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-blue-200 rounded-xl shadow-lg py-1 w-36">
            {FONT_SIZES.map((sz) => (
              <button
                key={sz.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFontSize(sz.value)}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition flex items-center justify-between"
              >
                <span style={{ fontSize: sz.value === '26px' ? '16px' : undefined }} className="font-medium">
                  {sz.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <span className={dividerClass} />

      {/* 굵게 / 기울임 / 밑줄 / 취소선 */}
      <button
        type="button"
        title="굵게 (Ctrl+B)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => handleInlineFormat('bold')}
        className={`${btnClass} font-black text-[13px]`}
      >
        B
      </button>
      <button
        type="button"
        title="기울임 (Ctrl+I)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => handleInlineFormat('italic')}
        className={`${btnClass} italic font-serif text-[14px]`}
      >
        I
      </button>
      <button
        type="button"
        title="밑줄 (Ctrl+U)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => handleInlineFormat('underline')}
        className={`${btnClass} underline underline-offset-2 text-[13px]`}
      >
        U
      </button>
      <button
        type="button"
        title="취소선"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => handleInlineFormat('strike')}
        className={`${btnClass} line-through text-[13px]`}
      >
        S
      </button>

      <span className={dividerClass} />

      {/* 글자 색상 */}
      <div className="relative">
        <button
          type="button"
          title="글자 색상 변경"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMenu('textColor')}
          className={`${btnClass} flex-col gap-0 px-2 ${openMenu === 'textColor' ? 'bg-blue-50 text-blue-900' : ''}`}
        >
          <span className="leading-none text-[13px] font-extrabold">A</span>
          <span
            className="w-3.5 h-1 rounded-full mt-0.5"
            style={{ backgroundColor: lastTextColor }}
          />
        </button>

        {openMenu === 'textColor' && (
          <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-blue-200 rounded-xl shadow-lg p-2.5 w-52">
            <p className="text-[11px] font-bold text-gray-500 mb-2">글자 색상</p>
            <div className="grid grid-cols-5 gap-1.5 mb-2.5">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleTextColor(c.value)}
                  className="w-7 h-7 rounded-lg border border-gray-200 hover:scale-110 transition shadow-sm"
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
            <label className="flex items-center justify-between text-[11px] text-gray-600 pt-2 border-t border-gray-100 cursor-pointer">
              <span>직접 색상 선택</span>
              <input
                type="color"
                value={lastTextColor}
                onChange={(e) => handleTextColor(e.target.value)}
                className="w-7 h-5 cursor-pointer border-0 bg-transparent"
              />
            </label>
          </div>
        )}
      </div>

      {/* 형광펜 (배경색) */}
      <div className="relative">
        <button
          type="button"
          title="형광펜 / 배경색"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMenu('bgColor')}
          className={`${btnClass} flex-col gap-0 px-2 ${openMenu === 'bgColor' ? 'bg-blue-50 text-blue-900' : ''}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <span
            className="w-3.5 h-1 rounded-full mt-0.5 border border-gray-300/60"
            style={{ backgroundColor: lastBgColor }}
          />
        </button>

        {openMenu === 'bgColor' && (
          <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-blue-200 rounded-xl shadow-lg p-2.5 w-48">
            <p className="text-[11px] font-bold text-gray-500 mb-2">형광펜 (배경색)</p>
            <div className="grid grid-cols-6 gap-1.5">
              {BG_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleBgColor(c.value)}
                  className="w-6 h-6 rounded-md border border-gray-300 hover:scale-110 transition"
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <span className={dividerClass} />

      {/* 문단 정렬 (왼쪽 / 가운데 / 오른쪽) */}
      <button
        type="button"
        title="왼쪽 정렬"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => handleAlign('left')}
        className={btnClass}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" d="M4 6h16M4 10h10M4 14h16M4 18h10" />
        </svg>
      </button>
      <button
        type="button"
        title="가운데 정렬"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => handleAlign('center')}
        className={btnClass}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" d="M4 6h16M7 10h10M4 14h16M7 18h10" />
        </svg>
      </button>
      <button
        type="button"
        title="오른쪽 정렬"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => handleAlign('right')}
        className={btnClass}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" d="M4 6h16M10 10h10M4 14h16M10 18h10" />
        </svg>
      </button>

      <span className={dividerClass} />

      {/* 글머리 목록 / 번호 목록 */}
      <button
        type="button"
        title="글머리 목록"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => handleList('ul')}
        className={btnClass}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" d="M9 6h11M9 12h11M9 18h11M5 6h.01M5 12h.01M5 18h.01" />
        </svg>
      </button>
      <button
        type="button"
        title="번호 목록"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => handleList('ol')}
        className={btnClass}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" d="M10 6h10M10 12h10M10 18h10" />
          <text x="3.5" y="8" fontSize="6.5" fill="currentColor" stroke="none" fontWeight="bold">1</text>
          <text x="3.5" y="14" fontSize="6.5" fill="currentColor" stroke="none" fontWeight="bold">2</text>
          <text x="3.5" y="20" fontSize="6.5" fill="currentColor" stroke="none" fontWeight="bold">3</text>
        </svg>
      </button>

      {/* 인용구 */}
      <button
        type="button"
        title="인용구"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleBlockquote}
        className={btnClass}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h4v4H7.5c0 1.5.5 2.5 2 3M14 7h4v4h-2.5c0 1.5.5 2.5 2 3" />
        </svg>
      </button>

      {/* 표 삽입 */}
      <button
        type="button"
        title="표 삽입"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleTable}
        className={btnClass}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18M3 15h18M9 4v16M15 4v16" />
        </svg>
      </button>

      {/* 접기/펼치기 */}
      <button
        type="button"
        title="접기/펼치기"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleDetails}
        className={btnClass}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* 링크 */}
      <button
        type="button"
        title="링크 삽입"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleLink}
        className={btnClass}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </button>

      {/* 구분선 / 줄바꿈 */}
      <button
        type="button"
        title="구분선"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleHr}
        className={btnClass}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" d="M4 12h16" />
        </svg>
      </button>
      <button
        type="button"
        title="줄바꿈"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleBr}
        className={`${btnClass} text-[11px]`}
      >
        ↵
      </button>
    </div>
  )
}
