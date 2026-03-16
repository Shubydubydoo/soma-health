import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '說說 — 跟 AI 練習聊天，發現你喜歡的對話感',
  description: '透過 AI 情境對話，輕鬆了解自己的聊天互動模式，找到真正聊得來的感覺。',
  keywords: '說說, 戀愛, 聊天分析, AI對話, 自我探索, 台灣',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '說說',
  },
  openGraph: {
    title: '說說',
    description: '跟 AI 練習聊天，發現你喜歡的對話感',
    locale: 'zh_TW',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FDF8F5',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600&family=Noto+Serif+TC:wght@600&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>{children}</body>
    </html>
  )
}
