// 服务层公共工具
import { AiError, clip } from './ai'

export const MODEL_RE = /^[a-z0-9][a-z0-9.\-]{1,60}$/i
export const eng = (b: any, def = 'gpt-5.5') => (b && typeof b.engine === 'string' && MODEL_RE.test(b.engine)) ? b.engine : def
export const rid = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`
export const now = () => Date.now()
export const DAY = 86400e3
export const lines = (x: unknown, n = 6, w = 80) => (Array.isArray(x) ? x : []).slice(0, n).map((v) => clip(typeof v === 'string' ? v : JSON.stringify(v), w)).filter(Boolean)
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))
export const db = (c: any): D1Database => { if (!c.env.DB) throw new AiError('数据库未配置（D1 binding DB）', 503); return c.env.DB }

// batch_web_search 的文本结果 → [{title, snippet, url}]
export function parseBatch(text: string) {
  const out: { title: string; snippet: string; url: string }[] = []
  const re = /##\s*(.+?)\n-\s*Snippet:\s*([\s\S]*?)\n-\s*URL_\d+:\s*(\S+)/g; let m
  while ((m = re.exec(text))) out.push({ title: m[1].trim(), snippet: clip(m[2].trim(), 240), url: m[3].trim() })
  const seen = new Set<string>()
  return out.filter((x) => !seen.has(x.url) && seen.add(x.url))
}
export const evidence = (src: { title: string; snippet: string; url: string }[], n = 14) => src.slice(0, n).map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}\n${s.url}`).join('\n\n')
// 把 LLM 返回的来源序号映射为真实链接，防止编造来源
export const srcRef = (src: any[], i: any) => { const k = (+i || 0) - 1; const s = src[k]; return s ? { title: clip(s.title, 60), url: s.url } : null }

// 数据缓存：未过期直接返回；过期或手动刷新时重新抓取（“实时更新”= 访问即自动刷新过期数据，无需定时任务）
export async function cached<T extends object>(c: any, key: string, ttl: number, refresh: boolean, fn: () => Promise<T>) {
  const D: D1Database | undefined = c.env.DB
  const k = clip(key, 200)
  if (D && !refresh) {
    const r = await D.prepare('SELECT value, updated_at FROM data_cache WHERE key = ?').bind(k).first<any>()
    if (r && now() - r.updated_at < ttl) { try { return { ...JSON.parse(r.value), cached: true, updatedAt: r.updated_at, ttl } } catch { } }
  }
  const v = await fn(); const t = now()
  if (D) await D.prepare('INSERT OR REPLACE INTO data_cache (key, value, updated_at) VALUES (?, ?, ?)').bind(k, JSON.stringify(v), t).run()
  return { ...v, cached: false, updatedAt: t, ttl }
}
