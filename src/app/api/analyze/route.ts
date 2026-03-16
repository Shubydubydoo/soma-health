import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'
import { validateMessages } from '@/lib/validate'
import { buildAnalysisPrompt } from '@/lib/prompts'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  // 1. Rate limiting — 分析每 IP 每分鐘最多 5 次（比聊天更嚴）
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`analyze:${ip}`, 5)
  if (!rl.ok) {
    return NextResponse.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 })
  }

  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > 50000) {
    return NextResponse.json({ error: '請求內容過大' }, { status: 413 })
  }

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: '無效的請求' }, { status: 400 }) }

  const { messages: rawMessages } = body as Record<string, unknown>

  // 2. 驗證訊息（對話歷史）
  const validation = validateMessages(rawMessages)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  // 3. 分析 prompt 在後端建立，前端只傳對話歷史
  const userTurns = validation.messages.filter(m => m.role === 'user').length
  const isShort = userTurns < 8
  const prompt = buildAnalysisPrompt(validation.messages, isShort)

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })
    return NextResponse.json({ content: response.content })
  } catch (error: unknown) {
    console.error('Analyze API error:', error)
    return NextResponse.json({ error: '服務暫時無法使用，請稍後再試' }, { status: 500 })
  }
}
