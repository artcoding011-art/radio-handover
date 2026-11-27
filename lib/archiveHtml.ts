import { marked } from 'marked'

/**
 * CommonMark 마크다운 파서가 HTML 블록(<table>, <ul>, <ol>, <details> 등) 내부의
 * "빈 줄 + 4칸 이상 들여쓰기"를 코드 블록(<pre><code>)으로 오인하지 않도록 보정합니다.
 * (``` 코드 펜스 내부는 건드리지 않습니다.)
 */
export function prepareMarkdownWithHtml(source: string): string {
  if (!source) return ''

  // 백틱 코드 펜스(```...```)를 임시 플레이스홀더로 보호
  const codeFences: string[] = []
  let protectedSrc = source.replace(/```[\s\S]*?```/g, (match) => {
    const idx = codeFences.length
    codeFences.push(match)
    return `%%CODE_FENCE_${idx}%%`
  })

  // HTML 블록 태그 내부의 빈 줄 제거 및 과도한 들여쓰기(4칸 이상)를 2칸으로 축소
  const blockTags = ['table', 'ul', 'ol', 'details', 'blockquote']
  for (const tag of blockTags) {
    const regex = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi')
    protectedSrc = protectedSrc.replace(regex, (block) =>
      block
        .split('\n')
        .map((line) => {
          const trimmed = line.trim()
          if (!trimmed) return ''
          // 들여쓰기를 최대 2칸으로 제한해 CommonMark 들여쓰기 코드블록 오인 원천 차단
          const leadingSpaces = line.match(/^[ \t]*/)?.[0].length ?? 0
          return leadingSpaces > 0 ? `  ${trimmed}` : trimmed
        })
        .filter(Boolean)
        .join('\n')
    )
  }

  // 보호했던 코드 펜스 복원
  return protectedSrc.replace(/%%CODE_FENCE_(\d+)%%/g, (_m, i) => codeFences[Number(i)] || '')
}

/**
 * 마크다운 + HTML 혼합 원문을 비주얼 편집기(contentEditable)용 HTML로 변환합니다.
 */
export function sourceToEditableHtml(source: string): string {
  const trimmed = (source || '').trim()
  if (!trimmed) return ''

  const safeSource = prepareMarkdownWithHtml(source)
  const rendered = marked.parse(safeSource, {
    gfm: true,
    breaks: true,
    async: false,
  }) as string

  // 기본적인 script/인라인 이벤트 핸들러 제거
  return rendered
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .trim()
}

/**
 * contentEditable에서 추출한 HTML을 깔끔하고 표준화된 HTML로 정리합니다.
 * - <font color="..."> -> <span style="color: ...">
 * - <b> / <i> -> <strong> / <em>
 * - align 속성 -> style="text-align: ..."
 * - CommonMark와 충돌하지 않도록 HTML 블록 내부 빈 줄 / 4칸 들여쓰기 제거
 */
export function normalizeVisualHtml(rawHtml: string): string {
  if (typeof window === 'undefined') return rawHtml

  const container = document.createElement('div')
  container.innerHTML = rawHtml

  // 빈 에디터(<br>만 남는 경우) 정리
  const plainText = (container.textContent || '').trim()
  const hasMediaOrBlock = Boolean(container.querySelector('img, table, hr, details'))
  if (!plainText && !hasMediaOrBlock) {
    return ''
  }

  // <font> -> <span>
  container.querySelectorAll('font').forEach((fontEl) => {
    const span = document.createElement('span')
    const color = fontEl.getAttribute('color')
    const face = fontEl.getAttribute('face')
    if (color) span.style.color = color
    if (face) span.style.fontFamily = face
    while (fontEl.firstChild) {
      span.appendChild(fontEl.firstChild)
    }
    fontEl.replaceWith(span)
  })

  // <b> -> <strong>, <i> -> <em>
  container.querySelectorAll('b').forEach((bEl) => {
    const strong = document.createElement('strong')
    while (bEl.firstChild) strong.appendChild(bEl.firstChild)
    bEl.replaceWith(strong)
  })
  container.querySelectorAll('i').forEach((iEl) => {
    const em = document.createElement('em')
    while (iEl.firstChild) em.appendChild(iEl.firstChild)
    iEl.replaceWith(em)
  })

  // align 속성을 표준 style="text-align: ..."으로 통일
  container.querySelectorAll('[align]').forEach((el) => {
    const align = el.getAttribute('align')
    if (align && ['left', 'center', 'right', 'justify'].includes(align.toLowerCase())) {
      ;(el as HTMLElement).style.textAlign = align.toLowerCase()
    }
    el.removeAttribute('align')
  })

  // 위험 태그/속성 제거
  container.querySelectorAll('script, iframe, object, embed').forEach((el) => el.remove())

  // 최상위 블록 요소 단위로 깔끔하게 줄바꿈 포맷팅 (내부 빈 줄/4칸 들여쓰기 방지)
  let html = container.innerHTML.trim()
  html = html
    .replace(
      /(<\/(?:p|h[1-6]|ul|ol|blockquote|table|details|pre)>|<hr\s*\/?>)[ \t]*(?!\n)/gi,
      '$1\n'
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return prepareMarkdownWithHtml(html)
}
