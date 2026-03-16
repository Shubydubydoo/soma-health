import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'

export const metadata: Metadata = { title: '服務條款 — 說說' }

export default function Terms() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px 80px', color: '#2C1F1A', fontFamily: "'Noto Sans TC', sans-serif", lineHeight: 1.8, background: '#FDF8F5', minHeight: '100vh' }}>
      <Link href="/" style={{ fontSize: 13, color: '#8C6055', textDecoration: 'none' }}>← 回首頁</Link>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '24px 0 8px', color: '#2C1F1A' }}>服務條款</h1>
      <p style={{ fontSize: 13, color: '#C8A090', marginBottom: 32 }}>最後更新：2025 年</p>
      <Section title="1. 接受條款">使用「說說」即表示您同意本服務條款。若您不同意，請勿使用本服務。</Section>
      <Section title="2. 服務說明">說說提供 AI 情境對話體驗，協助使用者了解自身的聊天互動模式。本服務僅供娛樂與自我探索參考，不構成任何形式的心理諮詢或感情建議。</Section>
      <Section title="3. 使用規範">您同意不將本服務用於任何非法用途，不嘗試破解或濫用本服務的 API，不透過自動化方式大量存取本服務。</Section>
      <Section title="4. AI 對話內容">本服務使用 Anthropic Claude AI 模型生成對話內容。AI 生成的內容不代表本服務立場，亦不保證準確性。分析結果僅供參考。</Section>
      <Section title="5. 免責聲明">本服務依「現狀」提供，不提供任何明示或暗示的保證。對於因使用本服務而產生的任何直接或間接損失，本服務不承擔責任。</Section>
      <Section title="6. 條款修改">我們保留隨時修改本條款的權利。重大變更將以網站公告方式通知用戶。繼續使用本服務即表示您接受修改後的條款。</Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 500, color: '#2C1F1A', marginBottom: 8 }}>{title}</h2>
      <p style={{ fontSize: 14, color: '#8C6055', margin: 0 }}>{children}</p>
    </div>
  )
}
