export type Screen = 'setup' | 'chat' | 'analysis'

export type Mode = 'quick' | 'deep'

export type Style = '溫柔體貼' | '幽默風趣' | '理性穩重' | '活潑外向' | '神秘低調'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface AnalysisResult {
  chat_type: string
  preferred_interaction: string
  preferred_style: string
  response_pattern: string
  keywords: string[]
  is_short: boolean
}

export const SCENARIOS = [
  { label: '辦公室 · 上司下屬', value: '辦公室，你是我的資深同事，比我早兩年進公司' },
  { label: '電梯偶遇',           value: '公寓電梯，你和我住同棟但不太熟，今天在電梯裡偶遇' },
  { label: '出差車廂',           value: '高鐵車廂，你和我同一班出差高鐵，被分配到相鄰座位' },
  { label: '校園學長學妹',       value: '大學校園，你是我的學長或學姐，今天在圖書館碰到' },
  { label: '深夜便利商店',       value: '深夜便利商店，深夜11點，你和我都在買東西，在微波爐前搭話' },
  { label: '健身房鄰居',         value: '健身房，你和我都是常客，今天在休息區坐在一起' },
  { label: '咖啡廳陌生人',       value: '咖啡廳，你坐到我隔壁桌，我們互相有點好奇' },
  { label: '老友重逢',           value: '路上重逢，你是我大學時期的朋友，畢業三年後偶遇' },
] as const

export const STYLES: Style[] = ['溫柔體貼', '幽默風趣', '理性穩重', '活潑外向', '神秘低調']
