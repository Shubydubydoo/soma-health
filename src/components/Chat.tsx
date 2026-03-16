'use client'
import { useEffect, useRef, useState, KeyboardEvent, type ChangeEvent } from 'react'
import styles from './Chat.module.css'
import { type Message } from '@/lib/types'

interface ChatProps {
  scenarioLabel: string
  turns: number
  messages: Message[]
  loading: boolean
  onSend: (text: string) => void
  onAnalyze: () => void
  onReset: () => void
}

function parseMessage(text: string) {
  const m = text.match(/^\*([^*]+)\*\s*([\s\S]*)/)
  if (m) return { action: m[1].trim(), speech: m[2].trim() }
  return { action: '', speech: text }
}

export default function Chat({ scenarioLabel, turns, messages, loading, onSend, onAnalyze, onReset }: ChatProps) {
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSend() {
    const txt = input.trim()
    if (!txt || loading) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    onSend(txt)
  }

  function autoResize(e: ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px'
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topbar}>
        <span className={styles.badge}>{scenarioLabel}</span>
        <div className={styles.actions}>
          <span className={styles.cnt}>{turns} 則對話</span>
          <button className={`${styles.btn} ${styles.primary}`} onClick={onAnalyze}>分析我 ↗</button>
          <button className={styles.btn} onClick={onReset}>重設</button>
        </div>
      </div>

      <div className={styles.msgs}>
        {messages.map((msg, i) => {
          if (msg.role === 'assistant') {
            const { action, speech } = parseMessage(msg.content)
            return (
              <div key={i} className={styles.row}>
                <div className={`${styles.av} ${styles.aiAv}`}>✦</div>
                <div className={styles.bw}>
                  {action && <div className={styles.act}>*{action}*</div>}
                  {speech && <div className={`${styles.bbl} ${styles.ai}`}>{speech}</div>}
                </div>
              </div>
            )
          }
          return (
            <div key={i} className={`${styles.row} ${styles.me}`}>
              <div className={`${styles.av} ${styles.meAv}`}>我</div>
              <div className={styles.bw}>
                <div className={`${styles.bbl} ${styles.mine}`}>{msg.content}</div>
              </div>
            </div>
          )
        })}

        {loading && (
          <div className={styles.typingRow}>
            <div className={`${styles.av} ${styles.aiAv}`}>✦</div>
            <div className={styles.typingBbl}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className={styles.inputRow}>
        <textarea
          ref={textareaRef}
          className={styles.ci}
          rows={1}
          value={input}
          placeholder="輸入你的回應，按 Enter 送出..."
          onChange={autoResize}
          onKeyDown={handleKey}
        />
        <button className={styles.sendBtn} onClick={handleSend} disabled={loading || !input.trim()}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 7L13 2L9.5 7L13 12L1 7Z" fill="white" />
          </svg>
        </button>
      </div>
    </div>
  )
}
