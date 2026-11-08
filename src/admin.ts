// 智导 · 后台管理：平台运营者使用（ADMIN_CODE 口令鉴权，未配置则后台关闭）
import { Hono } from 'hono'
import { AiError, clip } from './ai'
import { now, db, DAY } from './svc-util'
import { RULES, credit, userOf } from './market-util'

type Bindings = { DB?: D1Database; ADMIN_CODE?: string }
const admin = new Hono<{ Bindings: Bindings }>()
admin.onError((err, c) => c.json({ ok: false, error: err.message || '后台服务异常' }, (err instanceof AiError ? err.code : 500) as any))

admin.use('*', async (c, next) => {
  const code = c.env.ADMIN_CODE
  if (!code) return c.json({ ok: false, error: '后台未开启：请在环境变量中设置 ADMIN_CODE' }, 403)
  if (c.req.header('X-Admin-Code') !== code) return c.json({ ok: false, error: '管理口令错误', needAdmin: true }, 401)
  await next()
})

const n = async (D: D1Database, sql: string, ...v: any[]) => ((await D.prepare(sql).bind(...v).first<any>())?.n) || 0

admin.get('/overview', async (c) => {
  const D = db(c), t = now(), d7 = t - 7 * DAY
  const [ideas, real, samples, adopted, hidden, companies, emails7, emailsAll, optout, bots, sessions7, human7, sites, siteViews, likes] = await Promise.all([
    n(D, 'SELECT COUNT(*) AS n FROM ideas'), n(D, 'SELECT COUNT(*) AS n FROM ideas WHERE sample = 0'), n(D, 'SELECT COUNT(*) AS n FROM ideas WHERE sample = 1'),
    n(D, "SELECT COUNT(*) AS n FROM ideas WHERE status IN ('adopted','done')"), n(D, 'SELECT COUNT(*) AS n FROM ideas WHERE hidden = 1'),
    n(D, 'SELECT COUNT(*) AS n FROM companies'), n(D, 'SELECT COUNT(*) AS n FROM email_log WHERE at > ?', d7), n(D, 'SELECT COUNT(*) AS n FROM email_log'),
    n(D, 'SELECT COUNT(*) AS n FROM optout'), n(D, 'SELECT COUNT(*) AS n FROM cs_bots'), n(D, 'SELECT COUNT(*) AS n FROM cs_sessions WHERE created_at > ?', d7),
    n(D, "SELECT COUNT(*) AS n FROM cs_sessions WHERE status = 'human' AND created_at > ?", d7), n(D, 'SELECT COUNT(*) AS n FROM sites'),
    n(D, 'SELECT COALESCE(SUM(views),0) AS n FROM sites'), n(D, 'SELECT COUNT(*) AS n FROM idea_likes'),
  ])
  // 近 14 天每日献策 / 客服会话
  const since = t - 14 * DAY
  const { results: di } = await D.prepare("SELECT CAST((created_at - ?) / 86400000 AS INTEGER) AS d, COUNT(*) AS n FROM ideas WHERE created_at > ? AND sample = 0 GROUP BY d").bind(since, since).all<any>()
  const { results: ds } = await D.prepare("SELECT CAST((created_at - ?) / 86400000 AS INTEGER) AS d, COUNT(*) AS n FROM cs_sessions WHERE created_at > ? GROUP BY d").bind(since, since).all<any>()
  const series = Array.from({ length: 14 }, (_, i) => ({ day: new Date(since + (i + 1) * DAY).toISOString().slice(5, 10), ideas: di?.find((x: any) => x.d === i)?.n || 0, cs: ds?.find((x: any) => x.d === i)?.n || 0 }))
  const { results: ch } = await D.prepare('SELECT channel, COUNT(*) AS n FROM ideas GROUP BY channel').all<any>()
  const { results: kd } = await D.prepare('SELECT kind, COUNT(*) AS n FROM ideas GROUP BY kind').all<any>()
  return c.json({ ok: true, totals: { ideas, real, samples, adopted, hidden, companies, emails7, emailsAll, optout, bots, sessions7, human7, sites, siteViews, likes }, series, channels: ch || [], kinds: kd || [] })
})

admin.get('/market', async (c) => {
  const D = db(c)
  const tot = await D.prepare("SELECT COALESCE(SUM(CASE WHEN delta > 0 THEN delta END),0) AS issued, COALESCE(-SUM(CASE WHEN delta < 0 THEN delta END),0) AS used, COUNT(*) AS n FROM ledger").first<any>()
  const { results: kinds } = await D.prepare('SELECT kind, COUNT(*) AS n, SUM(delta) AS pts FROM ledger GROUP BY kind ORDER BY ABS(SUM(delta)) DESC').all<any>()
  const { results: recent } = await D.prepare('SELECT owner, delta, kind, note, at FROM ledger ORDER BY at DESC LIMIT 80').all<any>()
  const ch = await D.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(escrow),0) AS escrow FROM challenges WHERE hidden = 0").first<any>()
  const so = await D.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(uses),0) AS uses FROM solutions WHERE hidden = 0').first<any>()
  return c.json({ ok: true, issued: tot?.issued || 0, used: tot?.used || 0, txns: tot?.n || 0, kinds: kinds || [], recent: recent || [], challenges: ch?.n || 0, escrow: ch?.escrow || 0, solutions: so?.n || 0, uses: so?.uses || 0 })
})
admin.post('/hide', async (c) => {
  const b = await c.req.json<any>(); const t = ({ challenge: 'challenges', solution: 'solutions' } as any)[b.type]; if (!t) throw new AiError('未知类型', 400)
  await db(c).prepare(`UPDATE ${t} SET hidden = ? WHERE id = ?`).bind(b.value ? 1 : 0, String(b.id).slice(0, 40)).run(); return c.json({ ok: true })
})
admin.get('/ideas', async (c) => {
  const q = clip(c.req.query('q'), 40), f = c.req.query('f') || 'all'
  const where: string[] = [], v: any[] = []
  if (q) { where.push('(title LIKE ? OR target_name LIKE ? OR nickname LIKE ?)'); v.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  if (f === 'hidden') where.push('hidden = 1'); else if (f === 'featured') where.push('featured = 1'); else if (f === 'sample') where.push('sample = 1'); else if (f === 'real') where.push('sample = 0'); else if (f === 'email') where.push("channel = 'email'")
  const { results } = await db(c).prepare(`SELECT id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, channel, email_to, email_msg, status, likes, featured, hidden, sample, eval, created_at FROM ideas ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 200`).bind(...v).all<any>()
  return c.json({ ok: true, ideas: (results || []).map((r: any) => ({ ...r, eval: (() => { try { return JSON.parse(r.eval || '{}') } catch { return {} } })() })) })
})
admin.post('/idea', async (c) => {
  const b = await c.req.json<any>(); const id = clip(b.id, 40), D = db(c)
  if (b.action === 'samples') { await D.prepare('UPDATE ideas SET hidden = ?, updated_at = ? WHERE sample = 1').bind(b.value ? 1 : 0, now()).run(); return c.json({ ok: true }) }
  if (b.action === 'delete') { await D.batch([D.prepare('DELETE FROM ideas WHERE id = ?').bind(id), D.prepare('DELETE FROM idea_likes WHERE idea_id = ?').bind(id)]); return c.json({ ok: true }) }
  const col = ({ feature: 'featured', hide: 'hidden' } as any)[b.action]; if (!col) throw new AiError('未知操作', 400)
  await D.prepare(`UPDATE ideas SET ${col} = ?, updated_at = ? WHERE id = ?`).bind(b.value ? 1 : 0, now(), id).run()
  if (col === 'featured' && b.value) { const it = await D.prepare('SELECT uid, title, sample FROM ideas WHERE id = ?').bind(id).first<any>(); if (it && !it.sample) await credit(D, userOf(it.uid), RULES.feature.pts, 'feature', `《${String(it.title).slice(0, 20)}》入选精选`, `feature:${id}`) }
  return c.json({ ok: true })
})
admin.get('/companies', async (c) => {
  const { results } = await db(c).prepare('SELECT c.id, c.name, c.alias, c.industry, c.email, c.created_at, (SELECT COUNT(*) FROM ideas i WHERE i.company_id = c.id) AS ideas FROM companies c ORDER BY c.created_at DESC LIMIT 200').all<any>()
  return c.json({ ok: true, companies: results || [] })
})
admin.post('/company/delete', async (c) => {
  const b = await c.req.json<any>(); const id = clip(b.id, 40), D = db(c)
  await D.batch([D.prepare('UPDATE ideas SET company_id = NULL WHERE company_id = ?').bind(id), D.prepare('DELETE FROM companies WHERE id = ?').bind(id)])
  return c.json({ ok: true })
})
admin.get('/emails', async (c) => {
  const { results } = await db(c).prepare('SELECT e.to_email, e.at, i.title, i.target_name, i.nickname FROM email_log e LEFT JOIN ideas i ON i.id = e.idea_id ORDER BY e.at DESC LIMIT 200').all<any>()
  const { results: oo } = await db(c).prepare('SELECT email, at FROM optout ORDER BY at DESC LIMIT 200').all<any>()
  return c.json({ ok: true, emails: results || [], optout: oo || [] })
})
admin.get('/cs', async (c) => {
  const { results: bots } = await db(c).prepare('SELECT b.id, b.name, b.company, b.created_at, (SELECT COUNT(*) FROM cs_sessions s WHERE s.bot_id = b.id) AS sessions FROM cs_bots b ORDER BY b.created_at DESC LIMIT 100').all<any>()
  const { results: ss } = await db(c).prepare('SELECT s.*, b.name AS bot FROM cs_sessions s LEFT JOIN cs_bots b ON b.id = s.bot_id ORDER BY s.updated_at DESC LIMIT 100').all<any>()
  return c.json({ ok: true, bots: bots || [], sessions: ss || [] })
})
admin.get('/cs/messages', async (c) => {
  const { results } = await db(c).prepare('SELECT role, text, at FROM cs_msgs WHERE session_id = ? ORDER BY at ASC LIMIT 200').bind(clip(c.req.query('sid'), 40)).all<any>()
  return c.json({ ok: true, msgs: results || [] })
})
admin.get('/sites', async (c) => {
  const { results } = await db(c).prepare('SELECT id, owner, company, title, views, created_at, LENGTH(html) AS size FROM sites ORDER BY created_at DESC LIMIT 200').all<any>()
  return c.json({ ok: true, sites: results || [] })
})
admin.post('/site/delete', async (c) => { const b = await c.req.json<any>(); await db(c).prepare('DELETE FROM sites WHERE id = ?').bind(clip(b.id, 40)).run(); return c.json({ ok: true }) })
admin.get('/cache', async (c) => {
  const { results } = await db(c).prepare('SELECT key, updated_at, LENGTH(value) AS size FROM data_cache ORDER BY updated_at DESC LIMIT 200').all<any>()
  return c.json({ ok: true, cache: results || [] })
})
admin.post('/cache/clear', async (c) => { const b = await c.req.json<any>(); const k = clip(b.key, 200); await (k ? db(c).prepare('DELETE FROM data_cache WHERE key = ?').bind(k) : db(c).prepare('DELETE FROM data_cache')).run(); return c.json({ ok: true }) })

export default admin
