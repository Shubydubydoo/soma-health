import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'

export const metadata: Metadata = { title: '隱私權政策 — 說說' }

export default function Privacy() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px 80px', color: '#2C1F1A', fontFamily: "'Noto Sans TC', sans-serif", lineHeight: 1.8, background: '#FDF8F5', minHeight: '100vh' }}>
      <Link href="/" style={{ fontSize: 13, color: '#8C6055', textDecoration: 'none' }}>← 回首頁</Link>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '24px 0 8px', color: '#2C1F1A' }}>隱私權政策</h1>
      <p style={{ fontSize: 13, color: '#C8A090', marginBottom: 32 }}>最後更新：2025 年</p>
      <Section title="1. 我們收集什麼資料">
        我們不儲存您的對話內容。您與 AI 的對話僅在您的瀏覽器 session 中存在，頁面關閉後即消失。
        我們僅收集：匿名的 IP 位址（用於防止濫用）、您主動輸入的 Email（僅用於寄送分析報告）。
      </Section>
      <Section title="2. 資料如何使用">IP 位址用於 API 速率限制。Email 僅用於您主動要求的報告寄送，不用於行銷，不分享給第三方。</Section>
      <Section title="3. 第三方服務">
        本服務使用 Anthropic Claude API 處理 AI 對話。您的對話內容會傳送至 Anthropic 伺服器以生成回覆。
        如您選擇寄送 Email 報告，我們使用 Resend 服務發送郵件。
      </Section>
      <Section title="4. 資料保留">對話資料：不保留。Email：報告寄出後不保留。IP：用於速率限制計算，不持久化儲存。</Section>
      <Section title="5. Cookie">本服務使用 localStorage 儲存使用記錄（如連續使用天數），此資料僅存在您的裝置上。</Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 500, color: '#2C1F1A', marginBottom: 8 }}>{title}</h2>
      <div style={{ fontSize: 14, color: '#8C6055' }}>{children}</div>
    </div>
  )
}
