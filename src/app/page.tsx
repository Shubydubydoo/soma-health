'use client'
import { useState, useCallback } from 'react'
import styles from './page.module.css'
import Setup, { recordSession } from '@/components/Setup'
import Chat from '@/components/Chat'
import Analysis from '@/components/Analysis'
import { buildAnalysisPrompt } from '@/lib/prompts'
import { SCENARIOS, type Screen, type Mode, type Style, type Message, type AnalysisResult } from '@/lib/types'

export default function Home() {
  const [screen, setScreen] = useState<Screen>('setup')

  // setup state
  const [scenario, setScenario] = useState('')
  const [mode, setMode] = useState<Mode | ''>('')
  const [style, setStyle] = useState<Style | ''>('')

  // chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [turns, setTurns] = useState(0)
  const [chatLoading, setChatLoading] = useState(false)

  // analysis state
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState('')

  const scenarioLabel = SCENARIOS.find(s => s.value === scenario)?.label || ''

  const callChat = useCallback(async (msgs: Message[], sc: string, st: string, mo: string): Promise<string | null> => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs, scenario: sc, style: st, mode: mo }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return data.content?.[0]?.text?.trim() || null
  }, [])

  const handleStart = useCallback(async () => {
    if (!scenario || !mode || !style) return
    setMessages([])
    setTurns(0)
    setScreen('chat')
    setChatLoading(true)

    try {
      const openingMsg: Message[] = [{ role: 'user', content: '請根據你的個性和情境，主動開口打第一個招呼，開啟今天的相遇。' }]
      const reply = await callChat(openingMsg, scenario, style, mode)
      if (reply) setMessages([{ role: 'assistant', content: reply }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : '連線錯誤'
      setMessages([{ role: 'assistant', content: `（系統錯誤：${msg}）` }])
    } finally {
      setChatLoading(false)
    }
  }, [scenario, mode, style, callChat])

  const handleSend = useCallback(async (text: string) => {
    const userMsg: Message = { role: 'user', content: text }
    const nextMsgs = [...messages, userMsg]
    setMessages(nextMsgs)
    setTurns(t => t + 1)
    setChatLoading(true)

    try {
      const reply = await callChat(nextMsgs, scenario, style, mode)
      if (reply) setMessages(m => [...m, { role: 'assistant', content: reply }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : '連線錯誤'
      setMessages(m => [...m, { role: 'assistant', content: `（系統錯誤：${msg}）` }])
    } finally {
      setChatLoading(false)
    }
  }, [messages, scenario, style, mode, callChat])

  const handleAnalyze = useCallback(async () => {
    setScreen('analysis')
    setAnalysisResult(null)
    setAnalysisError('')

    if (turns < 3) return

    setAnalysisLoading(true)
    const isShort = turns < 8
    const prompt = buildAnalysisPrompt(messages, isShort)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const raw = (data.content?.[0]?.text || '{}').replace(/```json|```/g, '').trim()
      const result: AnalysisResult = JSON.parse(raw)
      setAnalysisResult(result)
      recordSession()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知錯誤'
      setAnalysisError(`分析出錯：${msg}，請返回繼續聊天後再試。`)
    } finally {
      setAnalysisLoading(false)
    }
  }, [messages, turns])

  const handleReset = useCallback(() => {
    setMessages([])
    setTurns(0)
    setAnalysisResult(null)
    setAnalysisError('')
    setScreen('setup')
  }, [])

  return (
    <main className={styles.main}>
      {screen === 'setup' && (
        <Setup
          scenario={scenario}
          mode={mode}
          style={style}
          onScenario={setScenario}
          onMode={setMode}
          onStyle={setStyle}
          onStart={handleStart}
        />
      )}
      {screen === 'chat' && (
        <Chat
          scenarioLabel={scenarioLabel}
          turns={turns}
          messages={messages}
          loading={chatLoading}
          onSend={handleSend}
          onAnalyze={handleAnalyze}
          onReset={handleReset}
        />
      )}
      {screen === 'analysis' && (
        <Analysis
          result={analysisResult}
          loading={analysisLoading}
          turns={turns}
          error={analysisError}
          scenario={SCENARIOS.find(s => s.value === scenario)?.label || ''}
          onBack={() => setScreen('chat')}
        />
      )}
    </main>
  )
}
