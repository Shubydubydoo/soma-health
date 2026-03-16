'use client'
import { useState } from 'react'
import styles from './Analysis.module.css'
import { type AnalysisResult } from '@/lib/types'

interface AnalysisProps {
  result: AnalysisResult | null
  loading: boolean
  turns: number
  error: string
  scenario: string
  onBack: () => void
}

const KW_COLORS = [styles.ka, styles.kb, styles.kc, styles.kd, styles.ka]

export default function Analysis({ result, loading, turns, error, scenario, onBack }: AnalysisProps) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [sendError, setSendError] = useState('')

  async function sendReport() {
    if (!email || !result) return
    setSending(true)
    setSendStatus('idle')
    try {
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, result, scenario }),
      })
      const data = await res.json()
      if (data.error) { setSendStatus('error'); setSendError(data.error) }
      else { setSendStatus('ok'); setEmail('') }
    } catch {
      setSendStatus('error')
      setSendError('網路錯誤，請稍後再試')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.top}>
        <button className={styles.backBtn} onClick={onBack}>← 繼續聊</button>
        <h2 className={styles.title}>你的戀愛樣貌分析</h2>
      </div>

      <div className={styles.body}>
        {loading && <div className={styles.loading}>正在分析你的互動模式...</div>}

        {!loading && error && <div className={styles.warn}>{error}</div>}

        {!loading && turns < 3 && !error && (
          <div className={styles.warn}>
            你目前只有 {turns} 則對話，資料還不夠喔！建議再多聊幾句，讓分析更準確 ✦
          </div>
        )}

        {!loading && result && (
          <>
            {result.is_short && (
              <div className={styles.warn}>
                對話還不夠多，以下分析僅供參考，多聊幾句後會更準確 ✦
              </div>
            )}
            <Card label="你是什麼樣的聊天對象" text={result.chat_type} />
            <Card label="你喜歡對方怎麼跟你互動" text={result.preferred_interaction} />
            <Card label="你喜歡對方的聊天風格" text={result.preferred_style} />
            <Card label="你通常如何應對對方" text={result.response_pattern} />
            <div className={styles.card}>
              <div className={styles.cardLabel}>你想找的對象關鍵字</div>
              <div className={styles.kws}>
                {result.keywords.map((k, i) => (
                  <span key={i} className={`${styles.kw} ${KW_COLORS[i % KW_COLORS.length]}`}>{k}</span>
                ))}
              </div>
            </div>

            {/* Email 寄送區塊 */}
            <div className={styles.emailCard}>
              <div className={styles.emailTitle}>儲存這份報告</div>
              <div className={styles.emailSub}>輸入 Email，把分析結果寄給自己</div>
              <div className={styles.emailRow}>
                <input
                  className={styles.emailInput}
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendReport()}
                />
                <button
                  className={styles.emailBtn}
                  onClick={sendReport}
                  disabled={sending || !email}
                >
                  {sending ? '寄送中...' : '寄出 ↗'}
                </button>
              </div>
              {sendStatus === 'ok' && (
                <div className={styles.sendOk}>✓ 已寄出！請檢查你的信箱</div>
              )}
              {sendStatus === 'error' && (
                <div className={styles.sendErr}>{sendError}</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Card({ label, text }: { label: string; text: string }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardLabel}>{label}</div>
      <div className={styles.cardText}>{text}</div>
    </div>
  )
}
