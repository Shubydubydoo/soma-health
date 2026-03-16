interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

export function rateLimit(ip: string, limitPerMinute = 20): { ok: boolean; remaining: number } {
  const now = Date.now()
  const windowMs = 60 * 1000
  const entry = store.get(ip)

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limitPerMinute - 1 }
  }

  if (entry.count >= limitPerMinute) {
    return { ok: false, remaining: 0 }
  }

  entry.count++
  return { ok: true, remaining: limitPerMinute - entry.count }
}

// 清理過期 entry — 用 Array.from 避免 downlevelIteration 問題
setInterval(() => {
  const now = Date.now()
  Array.from(store.entries()).forEach(([key, entry]) => {
    if (now > entry.resetAt) store.delete(key)
  })
}, 5 * 60 * 1000)
