'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import styles from './Setup.module.css'
import { SCENARIOS, STYLES, type Mode, type Style } from '@/lib/types'

interface SetupProps {
  scenario: string
  mode: Mode | ''
  style: Style | ''
  onScenario: (v: string) => void
  onMode: (v: Mode) => void
  onStyle: (v: Style) => void
  onStart: () => void
}

function useStreak() {
  const [streak, setStreak] = useState(0)
  const [totalSessions, setTotalSessions] = useState(0)
  useEffect(() => {
    const today = new Date().toDateString()
    const lastVisit = localStorage.getItem('ss_last_visit')
    const storedStreak = parseInt(localStorage.getItem('ss_streak') || '0')
    const storedTotal = parseInt(localStorage.getItem('ss_total') || '0')
    let newStreak = storedStreak
    if (lastVisit !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString()
      newStreak = lastVisit === yesterday ? storedStreak + 1 : 1
      localStorage.setItem('ss_last_visit', today)
      localStorage.setItem('ss_streak', String(newStreak))
    }
    setStreak(newStreak)
    setTotalSessions(storedTotal)
  }, [])
  return { streak, totalSessions }
}

export function recordSession() {
  if (typeof window === 'undefined') return
  const total = parseInt(localStorage.getItem('ss_total') || '0')
  localStorage.setItem('ss_total', String(total + 1))
}

export default function Setup({ scenario, mode, style, onScenario, onMode, onStyle, onStart }: SetupProps) {
  const ready = scenario && mode && style
  const { streak, totalSessions } = useStreak()

  return (
    <div className={styles.wrap}>
      <div className={styles.hero}>
        <div className={styles.heroBlob1} />
        <div className={styles.heroBlob2} />
        <div className={styles.heroBlob3} />
        <div className={styles.heroContent}>
          <div className={styles.logoMark}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <path d="M13 3C8.6 3 5 6.6 5 11c0 2.3.9 4.4 2.4 5.9L6 22l4.4-1.4C11.5 21 12.2 21.2 13 21.2c4.4 0 8-3.6 8-8s-3.6-8-8-8z" fill="white" opacity=".95"/>
              <circle cx="9.5" cy="11" r="1.4" fill="#E8826A"/>
              <circle cx="13" cy="11" r="1.4" fill="#E8826A"/>
              <circle cx="16.5" cy="11" r="1.4" fill="#E8826A"/>
            </svg>
          </div>
          <h1 className={styles.title}>說說</h1>
          <p className={styles.sub}>跟 AI 練習聊天，發現你喜歡的對話感</p>
          {streak > 0 && (
            <div className={styles.streak}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1C3.5 3.5 2 5.5 3 7.5c.4.8 1.1 1.3 1.8 1.5C4 8.2 4.5 7 5 6.5c.5 1 1 2.5.5 3.5.3-.1.6-.3.8-.5C8.5 8.5 9.5 7 9.5 5.5c0-2-1.8-3.8-3.5-4.5z" fill="#E8826A"/></svg>
              {streak >= 3 ? `🔥 連續 ${streak} 天` : `✦ 連續 ${streak} 天`}
              {totalSessions > 0 && ` · 已完成 ${totalSessions} 場`}
            </div>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.label}>選擇情境</div>
        <div className={styles.pills}>
          {SCENARIOS.map(s => (
            <button
              key={s.value}
              className={`${styles.pill} ${scenario === s.value ? styles.on : ''}`}
              onClick={() => onScenario(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.label}>聊天份量</div>
        <div className={styles.pills}>
          <button className={`${styles.pill} ${mode === 'quick' ? styles.on : ''}`} onClick={() => onMode('quick')}>
            快速閒聊 · 約20分鐘
          </button>
          <button className={`${styles.pill} ${mode === 'deep' ? styles.on : ''}`} onClick={() => onMode('deep')}>
            深入暢聊 · 不限時
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.label}>對方個性</div>
        <div className={styles.pills}>
          {STYLES.map(s => (
            <button
              key={s}
              className={`${styles.pill} ${style === s ? styles.onRose : ''}`}
              onClick={() => onStyle(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.ctaWrap}>
        <button className={styles.startBtn} disabled={!ready} onClick={onStart}>
          開始今天的對話 ✦
        </button>
      </div>

      <div className={styles.support}>
        <a
          className={styles.bmcBtn}
          href="https://buymeacoffee.com/YOUR_BMC_USERNAME"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 5h12l-1.5 8H3.5L2 5z" fill="#FFDD00" stroke="#E8826A" strokeWidth="1.2"/><path d="M5 5V3.5C5 2.7 5.7 2 6.5 2h3C10.3 2 11 2.7 11 3.5V5" stroke="#E8826A" strokeWidth="1.2" strokeLinecap="round"/></svg>
          支持說說 ☕
        </a>
      </div>

      <div className={styles.legal}>
        <Link href="/terms">服務條款</Link>
        <span>·</span>
        <Link href="/privacy">隱私權政策</Link>
      </div>
    </div>
  )
}
