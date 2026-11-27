'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { prepareMarkdownWithHtml } from '@/lib/archiveHtml'

interface MarkdownViewerProps {
  content: string
}

// XSS(<script>, onerror, javascript: 등)는 차단하면서
// 문서 꾸미기용 HTML 태그와 인라인 style/정렬/표 병합 속성을 안전하게 허용
const htmlSanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'u',
    'mark',
    's',
    'del',
    'ins',
    'sub',
    'sup',
    'kbd',
    'details',
    'summary',
    'figure',
    'figcaption',
    'center',
    'font',
    'section',
    'article',
    'header',
    'footer',
    'aside',
  ],
  attributes: {
    ...defaultSchema.attributes,
    '*': [
      ...(defaultSchema.attributes?.['*'] || []),
      'style',
      'className',
      'align',
      'title',
      'dir',
      'width',
      'height',
      'color',
    ],
    td: [
      ...(defaultSchema.attributes?.td || []),
      'colSpan',
      'rowSpan',
      'align',
      'valign',
      'width',
      'style',
    ],
    th: [
      ...(defaultSchema.attributes?.th || []),
      'colSpan',
      'rowSpan',
      'align',
      'valign',
      'width',
      'style',
    ],
    table: [
      ...(defaultSchema.attributes?.table || []),
      'border',
      'cellPadding',
      'cellSpacing',
      'width',
      'style',
    ],
    img: [
      ...(defaultSchema.attributes?.img || []),
      'src',
      'alt',
      'title',
      'width',
      'height',
      'style',
      'align',
    ],
    font: ['color', 'size', 'face'],
    details: ['open'],
    a: [...(defaultSchema.attributes?.a || []), 'target', 'rel'],
  },
}

export default function MarkdownViewer({ content }: MarkdownViewerProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [lightboxAlt, setLightboxAlt] = useState<string>('')

  if (!content.trim()) {
    return <p className="text-gray-400 text-sm italic">작성된 내용이 없습니다.</p>
  }

  const safeContent = prepareMarkdownWithHtml(content)

  return (
    <>
      <div className="markdown-body text-gray-800 leading-relaxed text-[15px] break-words">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, [rehypeSanitize, htmlSanitizeSchema]]}
          components={{
            h1: ({ children, ...props }) => (
              <h1
                {...props}
                className="text-2xl font-bold text-blue-950 border-b border-gray-200 pb-2 mt-6 mb-4 first:mt-0"
              >
                {children}
              </h1>
            ),
            h2: ({ children, ...props }) => (
              <h2
                {...props}
                className="text-xl font-bold text-blue-900 border-b border-gray-100 pb-1.5 mt-5 mb-3 first:mt-0"
              >
                {children}
              </h2>
            ),
            h3: ({ children, ...props }) => (
              <h3
                {...props}
                className="text-lg font-bold text-gray-900 mt-4 mb-2 first:mt-0"
              >
                {children}
              </h3>
            ),
            h4: ({ children, ...props }) => (
              <h4
                {...props}
                className="text-base font-bold text-gray-800 mt-3 mb-1.5"
              >
                {children}
              </h4>
            ),
            p: ({ children, ...props }) => (
              <p {...props} className="my-2.5 leading-7 whitespace-pre-wrap">
                {children}
              </p>
            ),
            ul: ({ children, ...props }) => (
              <ul {...props} className="list-disc pl-6 my-2.5 space-y-1">
                {children}
              </ul>
            ),
            ol: ({ children, ...props }) => (
              <ol {...props} className="list-decimal pl-6 my-2.5 space-y-1">
                {children}
              </ol>
            ),
            li: ({ children, ...props }) => (
              <li {...props} className="leading-7">
                {children}
              </li>
            ),
            blockquote: ({ children, ...props }) => (
              <blockquote
                {...props}
                className="border-l-4 border-blue-900/60 bg-blue-50/50 px-4 py-2.5 my-3 rounded-r-lg text-gray-700"
              >
                {children}
              </blockquote>
            ),
            details: ({ children, ...props }) => (
              <details
                {...props}
                className="my-3 rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-2.5"
              >
                {children}
              </details>
            ),
            summary: ({ children, ...props }) => (
              <summary
                {...props}
                className="cursor-pointer font-bold text-blue-950 select-none"
              >
                {children}
              </summary>
            ),
            mark: ({ children, ...props }) => (
              <mark
                {...props}
                className="bg-yellow-100 text-gray-900 px-1 py-0.5 rounded"
              >
                {children}
              </mark>
            ),
            u: ({ children, ...props }) => (
              <u {...props} className="underline underline-offset-2">
                {children}
              </u>
            ),
            hr: () => <hr className="my-5 border-gray-200" />,
            a: ({ href, children, ...props }) => (
              <a
                {...props}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 underline underline-offset-2 hover:text-blue-900"
              >
                {children}
              </a>
            ),
            table: ({ children, ...props }) => (
              <div className="overflow-x-auto my-4">
                <table
                  {...props}
                  className="min-w-full border-collapse border border-gray-200 text-sm"
                >
                  {children}
                </table>
              </div>
            ),
            thead: ({ children, ...props }) => (
              <thead {...props} className="bg-blue-50/70 text-blue-950">
                {children}
              </thead>
            ),
            th: ({ children, ...props }) => (
              <th
                {...props}
                className="border border-gray-200 px-3 py-2 text-left font-bold"
              >
                {children}
              </th>
            ),
            td: ({ children, ...props }) => (
              <td {...props} className="border border-gray-200 px-3 py-2">
                {children}
              </td>
            ),
            code: ({ className, children, ...props }) => {
              const isBlock = Boolean(className) || String(children).includes('\n')
              if (isBlock) {
                return (
                  <code
                    className={`block bg-gray-900 text-gray-100 rounded-xl p-4 my-3 text-[13px] font-mono overflow-x-auto leading-6 ${className || ''}`}
                    {...props}
                  >
                    {children}
                  </code>
                )
              }
              return (
                <code
                  className="bg-blue-50 text-blue-900 px-1.5 py-0.5 rounded text-[13px] font-mono border border-blue-100"
                  {...props}
                >
                  {children}
                </code>
              )
            },
            pre: ({ children }) => <pre className="my-3 overflow-x-auto">{children}</pre>,
            img: ({ src, alt, width, height, style }) => {
              if (!src) return null
              return (
                <span className="inline-block my-2 align-middle">
                  <img
                    src={src}
                    alt={alt || '첨부 이미지'}
                    width={width}
                    height={height}
                    style={style}
                    loading="lazy"
                    onClick={() => {
                      setLightboxSrc(src)
                      setLightboxAlt(alt || '첨부 이미지')
                    }}
                    className="max-w-full max-h-[540px] rounded-xl border border-gray-200 shadow-sm cursor-zoom-in hover:opacity-95 transition"
                  />
                  {alt && alt !== 'image' && alt !== '첨부 이미지' && (
                    <span className="block text-xs text-gray-400 mt-1">{alt}</span>
                  )}
                </span>
              )
            },
            input: ({ type, checked, ...props }) => {
              if (type === 'checkbox') {
                return (
                  <input
                    type="checkbox"
                    checked={Boolean(checked)}
                    readOnly
                    className="mr-2 accent-blue-900 align-middle"
                    {...props}
                  />
                )
              }
              return <input type={type} {...props} />
            },
          }}
        >
          {safeContent}
        </ReactMarkdown>
      </div>

      {/* 이미지 확대 보기 모달 */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setLightboxSrc(null)}
        >
          <div
            className="relative max-w-[92vw] max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxSrc(null)}
              className="absolute -top-10 right-0 text-white/90 hover:text-white text-sm font-bold px-3 py-1 rounded-lg bg-white/15"
            >
              닫기 ✕
            </button>
            <img
              src={lightboxSrc}
              alt={lightboxAlt}
              className="max-w-full max-h-[84vh] rounded-lg shadow-2xl object-contain bg-white"
            />
            {lightboxAlt && (
              <p className="text-white/80 text-xs mt-2">{lightboxAlt}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
