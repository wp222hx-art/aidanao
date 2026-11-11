// 平台设置 · 连接 Genspark：API Key 加密存入 D1（AES-GCM，密钥由 ADMIN_CODE 派生），优先于环境变量生效
import type { Context, Next } from 'hono'

export const GSK_HOST_RE = /^https:\/\/([a-z0-9-]+\.)*genspark\.(ai|im|com)$/i
export const DEFAULT_BASE = 'https://www.genspark.ai'
type Over = { GSK_API_KEY?: string; GSK_BASE_URL?: string; AI_MODEL?: string }
let cache: { at: number; val: Over } | null = null
export const bust = () => { cache = null }

const enc = new TextEncoder(), dec = new TextDecoder()
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
async function aes(secret: string) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode('zhidao-settings:' + secret))
  return crypto.subtle.importKey('raw', h, 'AES-GCM', false, ['encrypt', 'decrypt'])
}
export async function seal(secret: string, plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aes(secret), enc.encode(plain)))
  return `v1:${b64(iv)}:${b64(ct)}`
}
export async function open(secret: string, box: string) {
  const [v, iv, ct] = String(box || '').split(':'); if (v !== 'v1') return ''
  try { return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await aes(secret), unb64(ct))) } catch { return '' }
}

export async function readGsk(D: D1Database | undefined, secret: string | undefined): Promise<Over> {
  if (!D) return {}
  try {
    const { results } = await D.prepare("SELECT key, value FROM settings WHERE key IN ('gsk_key','gsk_base','ai_model')").all<any>()
    const m: Record<string, string> = Object.fromEntries((results || []).map((r: any) => [r.key, r.value]))
    const o: Over = {}
    if (m.gsk_key && secret) { const k = await open(secret, m.gsk_key); if (k) o.GSK_API_KEY = k }
    if (m.gsk_base && GSK_HOST_RE.test(m.gsk_base)) o.GSK_BASE_URL = m.gsk_base
    if (m.ai_model) o.AI_MODEL = m.ai_model
    return o
  } catch { return {} } // settings 表尚未迁移时静默回退到环境变量
}

// 全局中间件：把后台保存的连接配置覆盖到 c.env（15 秒缓存）
export async function gskOverlay(c: Context<any>, next: Next) {
  if (c.req.path.startsWith('/api/')) {
    if (!cache || Date.now() - cache.at > 15000) cache = { at: Date.now(), val: await readGsk(c.env.DB, c.env.ADMIN_CODE) }
    // 记下环境变量里的原始 Key（后台据此显示来源），再用后台保存的配置覆盖；不改动共享的 env 对象
    c.env = { ...c.env, __ENV_GSK_KEY: c.env.GSK_API_KEY || '', ...cache.val }
  }
  await next()
}

// 验证一把 Key：调用 Genspark 账户接口
export async function probe(key: string, base = DEFAULT_BASE) {
  try {
    const r = await fetch(`${base.replace(/\/$/, '')}/api/tool_cli/me`, { headers: { 'X-Api-Key': key, 'X-GSK-CLI-Version': 'enterprise-brain/1.0' } })
    if (r.status === 401 || r.status === 403) return { ok: false, reason: 'API Key 无效或已过期' }
    const j: any = await r.json().catch(() => null)
    const d = j?.data && j.status ? j.data : j
    if (!d?.cogen_id && !d?.email) return { ok: false, reason: j?.message || '无法识别该 API Key' }
    return { ok: true, user: { name: d.name || '', email: d.email || '', plan: d.plan_display || d.plan || '', credits: d.credit_balance ?? null } }
  } catch (e: any) { return { ok: false, reason: '无法连接 Genspark：' + (e?.message || '网络错误') } }
}
export const mask = (k: string) => !k ? '' : k.length <= 10 ? k.slice(0, 2) + '••••' : `${k.slice(0, 6)}••••••${k.slice(-4)}`
