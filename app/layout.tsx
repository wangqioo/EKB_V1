import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '企业知识库',
  description: '企业级智能知识管理系统',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
