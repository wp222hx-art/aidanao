// 智导 · 献策网络：普通用户向企业提交策划案
// 投递规则：目标企业已入驻 → 直推企业收件箱；未入驻但检索到公开邮箱且提案人确认 → 代发邮件（限频 + 可退订）；否则保存为公开献策，等企业入驻后认领
import { Hono } from 'hono'
import { tool, AiError, clip } from './ai'
import { matchCompany } from './idea-util'

type Bindings = { GSK_API_KEY?: string; GSK_BASE_URL?: string; DB?: D1Database; IDEA_MAIL_FROM?: string; BRAIN_ACCESS_CODE?: string; IDEA_MAIL_REDIRECT?: string; IDEA_MAIL_LIVE?: string }
const ideas = new Hono<{ Bindings: Bindings }>()

const rid = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`
const now = () => Date.now()
const DAY = 86400e3
const LIMIT = { perEmailDays: 7, perUidDay: 5, globalDay: 30 }
const db = (c: any): D1Database => { if (!c.env.DB) throw new AiError('献策网络数据库未配置（D1 binding DB）', 503); return c.env.DB }
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))
const EMAIL_OK = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

ideas.onError((err, c) => c.json({ ok: false, error: err.message || '献策服务异常' }, (err instanceof AiError ? err.code : 500) as any))

// 会消耗 Genspark 能力（发邮件）的接口沿用访问口令
ideas.use('/submit', async (c, next) => {
  const code = c.env.BRAIN_ACCESS_CODE
  if (code && c.req.header('X-Brain-Code') !== code) return c.json({ ok: false, error: '需要访问口令', needCode: true }, 401)
  await next()
})

// ---------- Markdown → 邮件 HTML（轻量，仅覆盖策划案用到的语法） ----------
function mdHtml(md: string) {
  const inline = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')
  const out: string[] = []; let list: string | null = null
  const close = () => { if (list) { out.push(`</${list}>`); list = null } }
  for (const raw of String(md || '').split('\n')) {
    const l = raw.trim(); let m
    if (!l) { close(); continue }
    if (/^\|.*\|$/.test(l)) { if (/^\|[\s:\-|]+\|$/.test(l)) continue; close(); out.push(`<p style="margin:4px 0;color:#334155">${inline(l.replace(/^\||\|$/g, '').split('|').map((x) => x.trim()).join(' ｜ '))}</p>`); continue }
    if ((m = l.match(/^(#{1,4})\s+(.*)/))) { close(); out.push(`<h${Math.min(4, m[1].length + 1)} style="color:#1e3a8a;margin:18px 0 6px">${inline(m[2])}</h${Math.min(4, m[1].length + 1)}>`); continue }
    if ((m = l.match(/^[-*•]\s+(.*)/))) { if (list !== 'ul') { close(); out.push('<ul style="padding-left:20px;margin:6px 0">'); list = 'ul' } out.push(`<li style="margin:3px 0">${inline(m[1])}</li>`); continue }
    if ((m = l.match(/^\d+[.)、]\s*(.*)/))) { if (list !== 'ol') { close(); out.push('<ol style="padding-left:20px;margin:6px 0">'); list = 'ol' } out.push(`<li style="margin:3px 0">${inline(m[1])}</li>`); continue }
    if ((m = l.match(/^>\s?(.*)/))) { close(); out.push(`<blockquote style="border-left:3px solid #cbd5e1;margin:8px 0;padding:4px 10px;color:#64748b">${inline(m[1])}</blockquote>`); continue }
    close(); out.push(`<p style="margin:6px 0;line-height:1.75">${inline(l)}</p>`)
  }
  close(); return out.join('\n')
}
function emailHtml(o: { origin: string; id: string; target: string; nickname: string; contact: string; title: string; oneLiner: string; opening: string; proposal: string; ev: any }) {
  const ev = o.ev || {}
  return `<div style="max-width:680px;margin:0 auto;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#0f172a;font-size:14px">
<div style="padding:18px 22px;border-radius:14px 14px 0 0;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff">
<div style="font-size:12px;opacity:.85">智导 · 献策网络｜一位用户写给「${esc(o.target)}」的创意提案</div>
<div style="font-size:20px;font-weight:800;margin-top:6px">${esc(o.title)}</div>
<div style="font-size:13px;margin-top:6px;opacity:.95">${esc(o.oneLiner)}</div></div>
<div style="padding:18px 22px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 14px 14px">
<p style="line-height:1.8">${esc(o.opening)}</p>
${ev.total ? `<p style="font-size:12px;color:#475569;background:#f8fafc;border-radius:8px;padding:8px 12px">AI 预评估（仅供参考）：创新 ${ev.novelty} · 契合 ${ev.fit} · 可行 ${ev.feasibility} · 价值 ${ev.value} · 综合 <b>${ev.total}</b></p>` : ''}
${mdHtml(o.proposal)}
<hr style="border:0;border-top:1px solid #e2e8f0;margin:20px 0">
<p style="font-size:13px">提案人：<b>${esc(o.nickname || '匿名用户')}</b>${o.contact ? `　联系方式：${esc(o.contact)}` : '（未留联系方式）'}</p>
<p style="font-size:12px;color:#64748b;line-height:1.7">这封邮件由「智导」代提案人发送：提案人用 AI 把自己的想法整理成了这份策划案。我们没有收取任何费用，也不代表贵司与提案人存在任何约定；如需采用请与提案人直接沟通并自行评估知识产权与合规事项。<br>
<a href="${o.origin}/api/ideas/view/${o.id}" style="color:#2563eb">在线查看本提案</a> ｜ <a href="${o.origin}/#join" style="color:#2563eb">入驻智导，在线接收与回复用户献策</a> ｜ <a href="${o.origin}/api/ideas/optout?id=${o.id}" style="color:#94a3b8">不再接收此类邮件</a></p>
</div></div>`
}
async function sender(c: any) {
  if (c.env.IDEA_MAIL_FROM) return c.env.IDEA_MAIL_FROM
  const d = await tool(c.env, 'email_accounts', {}).catch(() => null)
  return d?.default_gmail_account || d?.default_outlook_account || d?.accounts?.[0]?.email || ''
}

// ---------- 企业入驻 ----------
ideas.post('/company/register', async (c) => {
  const b = await c.req.json<any>()
  const name = clip(b.name, 60).trim(); if (name.length < 2) throw new AiError('请填写企业名称', 400)
  const email = clip(b.email, 120).trim().toLowerCase(); if (email && !EMAIL_OK.test(email)) throw new AiError('邮箱格式不正确', 400)
  const ex = await matchCompany(db(c), name, ...String(b.alias || '').split(/[,，、\s]+/))
  if (ex) {
    const row = await db(c).prepare('SELECT id, token FROM companies WHERE id = ?').bind(ex.id).first<any>()
    if (b.token && row?.token === b.token) return c.json({ ok: true, id: row.id, token: row.token, name: ex.name, existed: true })
    throw new AiError(`「${ex.name}」已入驻献策网络（如为贵司，请使用入驻时保存的企业密钥登录）`, 409)
  }
  const id = rid('co'), token = rid('tk')
  await db(c).prepare('INSERT INTO companies (id, name, alias, industry, business, email, token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, name, clip(b.alias, 120), clip(b.industry, 60), clip(b.business, 200), email, token, now()).run()
  // 入驻前已经积累的公开献策 / 邮件献策，自动认领到收件箱
  const keys = [name, ...String(b.alias || '').split(/[,，、\s]+/)].filter((x) => x.length >= 2)
  let claimed = 0
  for (const k of keys) { const r = await db(c).prepare("UPDATE ideas SET company_id = ?, updated_at = ? WHERE company_id IS NULL AND (target_name = ? OR target_name LIKE ?)").bind(id, now(), k, `%${k}%`).run(); claimed += r.meta?.changes || 0 }
  return c.json({ ok: true, id, token, name, claimed })
})
ideas.post('/company/login', async (c) => {
  const b = await c.req.json<any>()
  const row = await db(c).prepare('SELECT id, name, industry, business, email FROM companies WHERE token = ?').bind(clip(b.token, 60)).first<any>()
  if (!row) throw new AiError('企业密钥无效', 401)
  return c.json({ ok: true, company: row })
})
async function auth(c: any, id: string, token: string) {
  const row = await db(c).prepare('SELECT id, name FROM companies WHERE id = ? AND token = ?').bind(clip(id, 40), clip(token, 60)).first<any>()
  if (!row) throw new AiError('企业身份校验失败', 401)
  return row
}
ideas.post('/company/inbox', async (c) => {
  const b = await c.req.json<any>()
  const co = await auth(c, b.id, b.token)
  const { results } = await db(c).prepare('SELECT * FROM ideas WHERE company_id = ? ORDER BY created_at DESC LIMIT 200').bind(co.id).all<any>()
  return c.json({ ok: true, company: co, ideas: (results || []).map(pub(true)) })
})
const STATUS = ['read', 'adopted', 'replied', 'declined', 'done']
ideas.post('/company/update', async (c) => {
  const b = await c.req.json<any>()
  const co = await auth(c, b.id, b.token)
  const idea = await db(c).prepare('SELECT id FROM ideas WHERE id = ? AND company_id = ?').bind(clip(b.ideaId, 40), co.id).first<any>()
  if (!idea) throw new AiError('献策不存在', 404)
  const sets: string[] = ['updated_at = ?'], vals: any[] = [now()]
  if (STATUS.includes(b.status)) { sets.push('status = ?'); vals.push(b.status) }
  if (typeof b.reply === 'string') { sets.push('reply = ?'); vals.push(clip(b.reply, 600)) }
  if (b.cmdNo != null) { sets.push('cmd_no = ?'); vals.push(+b.cmdNo || null) }
  if (b.cmdScore != null) { sets.push('cmd_score = ?'); vals.push(Math.max(0, Math.min(100, +b.cmdScore || 0))) }
  await db(c).prepare(`UPDATE ideas SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, idea.id).run()
  return c.json({ ok: true })
})

// ---------- 提交献策 ----------
ideas.post('/submit', async (c) => {
  const b = await c.req.json<any>()
  const uid = clip(b.uid, 40); if (!uid) throw new AiError('缺少用户标识', 400)
  const T = b.target || {}
  const title = clip(b.title, 60).trim(), proposal = clip(b.proposal, 8000)
  if (!title || proposal.length < 50) throw new AiError('策划案内容不完整', 400)
  const D = db(c), t = now()
  const sentToday = await D.prepare('SELECT COUNT(*) AS n FROM ideas WHERE uid = ? AND created_at > ?').bind(uid, t - DAY).first<any>()
  if ((sentToday?.n || 0) >= LIMIT.perUidDay) throw new AiError(`每人每天最多提交 ${LIMIT.perUidDay} 份献策，明天再来吧`, 429)
  const co = await matchCompany(D, T.name, T.short, ...(T.aliases || []))
  let channel = 'public', status = 'saved', emailTo = '', emailMsg = '', emailSource = ''
  const id = rid('idea'), origin = new URL(c.req.url).origin
  if (co) { channel = 'inbox'; status = 'delivered' }
  else if (b.emailTo && b.consent === true) {
    emailTo = clip(b.emailTo, 120).trim().toLowerCase()
    if (!EMAIL_OK.test(emailTo)) throw new AiError('收件邮箱格式不正确', 400)
    emailSource = clip(b.emailSource, 300)
    const opt = await D.prepare('SELECT email FROM optout WHERE email = ?').bind(emailTo).first()
    const recent = await D.prepare('SELECT COUNT(*) AS n FROM email_log WHERE to_email = ? AND at > ?').bind(emailTo, t - LIMIT.perEmailDays * DAY).first<any>()
    const global = await D.prepare('SELECT COUNT(*) AS n FROM email_log WHERE at > ?').bind(t - DAY).first<any>()
    if (opt) { emailMsg = '该邮箱已退订献策邮件，已改为公开献策'; }
    else if ((recent?.n || 0) > 0) { emailMsg = `为避免打扰，同一企业邮箱 ${LIMIT.perEmailDays} 天内只代发 1 封；本提案已保存为公开献策，企业入驻后可在收件箱看到`; }
    else if ((global?.n || 0) >= LIMIT.globalDay) { emailMsg = '今日代发名额已用完，已保存为公开献策，明天可重新投递'; }
    else if (String(c.env.IDEA_MAIL_LIVE || '') !== '1' && !String(c.env.IDEA_MAIL_REDIRECT || '').trim()) { emailMsg = '平台尚未开启真实邮件代发（需设置 IDEA_MAIL_LIVE=1），已保存为公开献策'; }
    else {
      const from = await sender(c)
      if (!from) emailMsg = '未配置发信邮箱（IDEA_MAIL_FROM），已保存为公开献策'
      else {
        const subject = clip(b.emailSubject || `一份写给${T.short || T.name}的创意提案：${title}`, 80)
        const html = emailHtml({ origin, id, target: clip(T.name, 60), nickname: clip(b.nickname, 30), contact: clip(b.contact, 80), title, oneLiner: clip(b.oneLiner, 120), opening: clip(b.emailOpening, 300), proposal, ev: b.eval })
        try {
          // 安全闸：配置了 IDEA_MAIL_REDIRECT（本地开发/测试默认开启）时，所有代发邮件一律改投到该地址，绝不打扰真实企业
          const redirect = String(c.env.IDEA_MAIL_REDIRECT || '').trim()
          const realTo = redirect || emailTo
          const r = await tool(c.env, 'email_send', { to: realTo, subject: redirect ? `[测试·原收件人 ${emailTo}] ${subject}` : subject, body: html, body_type: 'html', from_account: from })
          if (!r?.success && r?.success !== undefined) throw new Error(r?.message || '发送失败')
          channel = 'email'; status = 'emailed'; emailMsg = redirect ? `【测试模式】邮件未发给企业，已改投到 ${realTo.replace(/(.{2}).*(@.*)/, '$1***$2')}` : `已由 ${from.replace(/(.{2}).*(@.*)/, '$1***$2')} 代发`
          await D.prepare('INSERT INTO email_log (id, idea_id, to_email, at) VALUES (?, ?, ?, ?)').bind(rid('em'), id, emailTo, t).run()
        } catch (e: any) { emailMsg = `邮件发送失败（${clip(e.message, 80)}），已保存为公开献策` }
      }
    }
  }
  await D.prepare(`INSERT INTO ideas (id, uid, nickname, contact, target_name, company_id, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?)`)
    .bind(id, uid, clip(b.nickname, 30), clip(b.contact, 80), clip(T.name, 60), co?.id || null, clip(b.category, 20), title, clip(b.oneLiner, 120), proposal, clip(b.cover, 300), channel, emailTo, emailSource, emailMsg, status, JSON.stringify(b.eval || {}).slice(0, 1000), t, t).run()
  return c.json({ ok: true, id, channel, status, company: co ? { id: co.id, name: co.name } : null, emailTo, emailMsg, view: `${origin}/api/ideas/view/${id}` })
})

const pub = (full = false) => (r: any) => ({ id: r.id, nickname: r.nickname || '匿名用户', contact: full ? r.contact : undefined, target: r.target_name, companyId: r.company_id, category: r.category, title: r.title, oneLiner: r.one_liner, proposal: full ? r.proposal : undefined, channel: r.channel, emailTo: r.email_to ? r.email_to.replace(/(.{2}).*(@.*)/, '$1***$2') : '', emailMsg: r.email_msg, status: r.status, reply: r.reply, eval: (() => { try { return JSON.parse(r.eval || '{}') } catch { return {} } })(), cmdNo: r.cmd_no, cmdScore: r.cmd_score, createdAt: r.created_at, updatedAt: r.updated_at })

ideas.get('/mine', async (c) => {
  const uid = clip(c.req.query('uid'), 40); if (!uid) return c.json({ ok: true, ideas: [] })
  const { results } = await db(c).prepare('SELECT * FROM ideas WHERE uid = ? ORDER BY created_at DESC LIMIT 100').bind(uid).all<any>()
  return c.json({ ok: true, ideas: (results || []).map(pub(true)) })
})
ideas.get('/stats', async (c) => {
  const D = db(c)
  const [a, b2, e, r] = await Promise.all([
    D.prepare('SELECT COUNT(*) AS n FROM ideas').first<any>(),
    D.prepare('SELECT COUNT(*) AS n FROM companies').first<any>(),
    D.prepare("SELECT COUNT(*) AS n FROM ideas WHERE status = 'adopted' OR status = 'done'").first<any>(),
    D.prepare('SELECT target_name, title, category, status, nickname, created_at FROM ideas ORDER BY created_at DESC LIMIT 12').all<any>(),
  ])
  const top = await D.prepare('SELECT target_name AS name, COUNT(*) AS n FROM ideas GROUP BY target_name ORDER BY n DESC LIMIT 8').all<any>()
  return c.json({ ok: true, ideas: a?.n || 0, companies: b2?.n || 0, adopted: e?.n || 0, recent: (r.results || []).map((x: any) => ({ target: x.target_name, title: x.title, category: x.category, status: x.status, nickname: x.nickname || '匿名用户', at: x.created_at })), hot: top.results || [] })
})

// ---------- 公开页：在线查看 / 退订 ----------
const page = (title: string, body: string) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head><body style="margin:0;background:#f4f6fb;padding:24px 12px">${body}</body></html>`
ideas.get('/view/:id', async (c) => {
  const r = await db(c).prepare('SELECT * FROM ideas WHERE id = ?').bind(clip(c.req.param('id'), 40)).first<any>()
  if (!r) return c.html(page('献策不存在', '<p style="text-align:center">该献策不存在或已删除</p>'), 404)
  const ev = (() => { try { return JSON.parse(r.eval || '{}') } catch { return {} } })()
  return c.html(page(r.title, emailHtml({ origin: new URL(c.req.url).origin, id: r.id, target: r.target_name, nickname: r.nickname, contact: '', title: r.title, oneLiner: r.one_liner, opening: '', proposal: r.proposal, ev })))
})
ideas.get('/optout', async (c) => {
  const r = await db(c).prepare('SELECT email_to FROM ideas WHERE id = ?').bind(clip(c.req.query('id'), 40)).first<any>()
  if (r?.email_to) await db(c).prepare('INSERT OR IGNORE INTO optout (email, at) VALUES (?, ?)').bind(r.email_to, now()).run()
  return c.html(page('已退订', `<div style="max-width:480px;margin:60px auto;background:#fff;border-radius:14px;padding:28px;text-align:center;font-family:sans-serif"><h2>已退订</h2><p style="color:#475569">${r?.email_to ? esc(r.email_to.replace(/(.{2}).*(@.*)/, '$1***$2')) + ' 今后不会再收到智导代发的献策邮件。' : '链接无效。'}</p><p style="font-size:13px;color:#94a3b8">如果希望在线接收、筛选用户献策，可以入驻智导献策网络。</p></div>`))
})

export default ideas
