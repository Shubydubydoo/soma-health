export interface ValidMessage {
  role: 'user' | 'assistant'
  content: string
}

const MAX_MESSAGES = 60          // 最多 60 則對話（30 來回）
const MAX_MESSAGE_LENGTH = 1000  // 每則訊息最多 1000 字
const MAX_TOTAL_CHARS = 20000    // 整段對話總字數上限

export function validateMessages(raw: unknown): { ok: true; messages: ValidMessage[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: '格式錯誤' }
  if (raw.length === 0) return { ok: false, error: '訊息不能為空' }
  if (raw.length > MAX_MESSAGES) return { ok: false, error: '對話過長' }

  let totalChars = 0

  const messages: ValidMessage[] = []

  for (const msg of raw) {
    if (typeof msg !== 'object' || msg === null) return { ok: false, error: '訊息格式錯誤' }
    const { role, content } = msg as Record<string, unknown>

    if (role !== 'user' && role !== 'assistant') return { ok: false, error: '無效的 role' }
    if (typeof content !== 'string') return { ok: false, error: '訊息內容必須是字串' }
    if (content.length > MAX_MESSAGE_LENGTH) return { ok: false, error: '單則訊息過長' }

    totalChars += content.length
    if (totalChars > MAX_TOTAL_CHARS) return { ok: false, error: '對話總長度超過限制' }

    messages.push({ role, content: content.trim() })
  }

  return { ok: true, messages }
}

// 驗證情境與個性是否在白名單內（防止前端亂傳 system prompt）
const VALID_SCENARIOS = [
  '辦公室，你是我的資深同事，比我早兩年進公司',
  '公寓電梯，你和我住同棟但不太熟，今天在電梯裡偶遇',
  '高鐵車廂，你和我同一班出差高鐵，被分配到相鄰座位',
  '大學校園，你是我的學長或學姐，今天在圖書館碰到',
  '深夜便利商店，深夜11點，你和我都在買東西，在微波爐前搭話',
  '健身房，你和我都是常客，今天在休息區坐在一起',
  '咖啡廳，你坐到我隔壁桌，我們互相有點好奇',
  '路上重逢，你是我大學時期的朋友，畢業三年後偶遇',
]

const VALID_STYLES = ['溫柔體貼', '幽默風趣', '理性穩重', '活潑外向', '神秘低調']
const VALID_MODES = ['quick', 'deep']

export function validateChatParams(scenario: unknown, style: unknown, mode: unknown): boolean {
  return (
    typeof scenario === 'string' && VALID_SCENARIOS.includes(scenario) &&
    typeof style === 'string' && VALID_STYLES.includes(style) &&
    typeof mode === 'string' && VALID_MODES.includes(mode)
  )
}
