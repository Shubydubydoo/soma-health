import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'
import { validateMessages, validateChatParams } from '@/lib/validate'
import { buildSystemPrompt } from '@/lib/prompts'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 每個 IP 每分鐘最多 15 次（一場對話約 20 回合 → 防止同時跑多場）
const RATE_LIMIT = 15
// 單次請求 body 上限 40KB
const MAX_BODY_BYTES = 40_000

export async function POST(req: NextRequest) {

  // ── 1. IP Rate Limit ──────────────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(ip, RATE_LIMIT)
  if (!rl.ok) {
    return NextResponse.json(
      { error: '請求過於頻繁，請稍後再試' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  // ── 2. Body Size Guard ────────────────────────────────────────────
  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: '請求內容過大' }, { status: 413 })
  }

  // ── 3. Parse JSON ─────────────────────────────────────────────────
  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: '無效的請求格式' }, { status: 400 }) }

  const { messages: rawMessages, scenario, style, mode } = body as Record<string, unknown>

  // ── 4. Whitelist Validation（前端無法自訂 system prompt）────────────
  if (!validateChatParams(scenario, style, mode)) {
    return NextResponse.json({ error: '無效的參數' }, { status: 400 })
  }

  // ── 5. Message Structure + Length Validation ──────────────────────
  const validation = validateMessages(rawMessages)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  // ── 6. Build System Prompt on Backend（key logic stays server-side）
  const systemPrompt = buildSystemPrompt(
    scenario as string,
    style as string,
    mode as string
  )

  // ── 7. Call Anthropic ─────────────────────────────────────────────
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: systemPrompt,
      messages: validation.messages,
    })
    return NextResponse.json({ content: response.content })
  } catch (error: unknown) {
    // 不回傳原始錯誤訊息，防止 API key / model 資訊洩漏
    console.error('Chat API error:', error)
    return NextResponse.json({ error: '服務暫時無法使用，請稍後再試' }, { status: 500 })
  }
}
