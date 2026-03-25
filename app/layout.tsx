import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '라디오 업무 인수인계서',
  description: '라디오 방송 업무 인수인계 관리 시스템',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="bg-gray-100 min-h-screen">{children}</body>
    </html>
  )
}
