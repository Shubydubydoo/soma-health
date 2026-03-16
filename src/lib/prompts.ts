export function buildSystemPrompt(scenario: string, style: string, mode: string): string {
  const pace =
    mode === 'quick'
      ? '這是輕鬆快速閒聊，每次回應1到2句，保持簡短自然。'
      : '可以深入聊，每次回應2到4句，有情感深度。'

  return `你正在扮演一個真實生活中與我相遇的人。情境：${scenario}。個性：${style}。

${pace}

每次回應格式（兩個部分都必須有）：
第一部分：用星號包住，一句描述你的動作、表情或內心狀態。例：*悄悄往你這邊靠了一點*
第二部分：你說的話，口語自然，緊接在後，不需換行。

範例：
*抬起頭剛好和你對到眼，有點不好意思地笑了一下* 你也常來這裡嗎？我好像在這邊看過你幾次耶。

規則：
- 永遠記住整段對話歷史，根據上下文自然延伸，絕不重複說過的話
- 適時分享自己的事，不要每次都問問題
- 有自然的曖昧感，但不要太直白
- 絕不提「AI」「分析」「角色扮演」等詞
- 用台灣日常口語，自然有溫度
- 如果對方回應很短，你也可以短回，維持節奏`
}

export function buildAnalysisPrompt(history: { role: string; content: string }[], isShort: boolean): string {
  const convo = history
    .map(m => (m.role === 'user' ? '【我說】' : '【對方說】') + m.content)
    .join('\n\n')

  return `以下是用戶在戀愛情境的真實對話。根據用戶（【我說】）的發言方式、用詞、反應節奏分析五個面向。用繁體中文，像了解人的朋友說話，具體有洞察力，不要泛泛而談。

對話：
${convo}

只回傳 JSON，不要 markdown 標記：
{
  "chat_type": "用戶是什麼樣的聊天互動對象，2到3句",
  "preferred_interaction": "用戶喜歡對方用什麼方式互動，2到3句",
  "preferred_style": "用戶喜歡對方什麼聊天風格，2到3句",
  "response_pattern": "用戶通常如何應對，2到3句",
  "keywords": ["詞1","詞2","詞3","詞4","詞5"],
  "is_short": ${isShort}
}`
}
