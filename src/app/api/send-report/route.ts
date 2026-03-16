import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'
import { type AnalysisResult } from '@/lib/types'

function emailCard(label: string, text: string): string {
  return `<div style="background:#1a1a1e;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px 18px;margin-bottom:12px;">
    <div style="font-size:11px;font-weight:500;color:#6a6860;letter-spacing:0.08em;margin-bottom:7px;text-transform:uppercase;">${label}</div>
    <div style="font-size:14px;line-height:1.75;color:#f0eee8;">${text}</div>
  </div>`
}

function buildEmailHtml(result: AnalysisResult, scenario: string): string {
  const kwHtml = (result.keywords || [])
    .map(k => `<span style="display:inline-block;padding:4px 12px;border-radius:14px;background:#2a1520;color:#f0a0c0;border:1px solid rgba(212,83,126,0.3);font-size:13px;margin:3px;">${k}</span>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f11;font-family:'Noto Sans TC',system-ui,sans-serif;color:#f0eee8;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="font-size:24px;font-weight:600;letter-spacing:0.06em;color:#f0eee8;margin:0 0 6px;">說說</h1>
      <p style="font-size:13px;color:#6a6860;margin:0;">你的聊天樣貌分析報告</p>
      ${scenario ? `<p style="font-size:12px;color:#a09e98;margin:8px 0 0;padding:4px 12px;background:#222228;border-radius:12px;display:inline-block;">情境：${scenario}</p>` : ''}
    </div>
    ${emailCard('你是什麼樣的聊天對象', result.chat_type)}
    ${emailCard('你喜歡對方怎麼跟你互動', result.preferred_interaction)}
    ${emailCard('你喜歡對方的聊天風格', result.preferred_style)}
    ${emailCard('你通常如何應對對方', result.response_pattern)}
    <div style="background:#1a1a1e;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px 18px;margin-bottom:16px;">
      <div style="font-size:11px;font-weight:500;color:#6a6860;letter-spacing:0.08em;margin-bottom:10px;text-transform:uppercase;">你想找的對象關鍵字</div>
      <div>${kwHtml}</div>
    </div>
    <div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06);">
      <p style="font-size:12px;color:#6a6860;margin:0;">由 說說 生成 · 僅供參考</p>
    </div>
  </div>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`email:${ip}`, 3)
  if (!rl.ok) {
    return NextResponse.json({ error: '請稍後再試' }, { status: 429 })
  }

  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > 60000) {
    return NextResponse.json({ error: '內容過大' }, { status: 413 })
  }

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: '無效的請求' }, { status: 400 }) }

  const { email, result, scenario } = body as {
    email?: string
    result?: AnalysisResult
    scenario?: string
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: '請輸入有效的 Email' }, { status: 400 })
  }
  if (!result) {
    return NextResponse.json({ error: '缺少分析資料' }, { status: 400 })
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email 服務未設定' }, { status: 503 })
  }

  const html = buildEmailHtml(result, scenario ?? '')

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `說說 <${process.env.FROM_EMAIL ?? 'noreply@example.com'}>`,
        to: [email],
        subject: '你的聊天樣貌分析報告 ✦',
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('Resend error:', err)
      return NextResponse.json({ error: '寄送失敗，請稍後再試' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Email send error:', e)
    return NextResponse.json({ error: '寄送失敗，請稍後再試' }, { status: 500 })
  }
}
