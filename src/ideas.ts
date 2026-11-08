// 智导 · 献策网络：普通用户向企业提交策划案
// 投递规则：目标企业已入驻 → 直推企业收件箱；未入驻但检索到公开邮箱且提案人确认 → 代发邮件（限频 + 可退订）；否则保存为公开献策，等企业入驻后认领
import { Hono } from 'hono'
import { tool, AiError, clip } from './ai'
import { matchCompany } from './idea-util'
import { RULES, credit, userOf, ensureCompanyGrant, rewardAdoption } from './market-util'

type Bindings = { GSK_API_KEY?: string; GSK_BASE_URL?: string; DB?: D1Database; IDEA_MAIL_FROM?: string; BRAIN_ACCESS_CODE?: string; IDEA_MAIL_REDIRECT?: string; IDEA_MAIL_LIVE?: string }
const ideas = new Hono<{ Bindings: Bindings }>()

const rid = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`
const now = () => Date.now()
const DAY = 86400e3
const KINDS = ['proposal', 'suggestion', 'design']
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
  await ensureCompanyGrant(db(c), id)
  return c.json({ ok: true, id, token, name, claimed, grant: RULES.grant.pts })
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
  const idea = await db(c).prepare('SELECT * FROM ideas WHERE id = ? AND company_id = ?').bind(clip(b.ideaId, 40), co.id).first<any>()
  if (!idea) throw new AiError('献策不存在', 404)
  const D = db(c), to = userOf(idea.uid), tt = clip(idea.title, 30)
  let reward: any = null
  if (['adopted', 'done'].includes(b.status) || (b.cmdNo != null && b.status !== 'declined')) reward = await rewardAdoption(D, co, idea, b.reward)
  if (typeof b.reply === 'string' && b.reply.trim() && !idea.sample) await credit(D, to, RULES.reply.pts, 'reply', `「${co.name}」回复了《${tt}》`, `reply:${idea.id}`)
  if (b.status === 'done' && !idea.sample) await credit(D, to, RULES.done.pts, 'done', `《${tt}》落地验收${b.cmdScore != null ? ' ' + b.cmdScore + ' 分' : ''}`, `done:${idea.id}`)
  const sets: string[] = ['updated_at = ?'], vals: any[] = [now()]
  if (STATUS.includes(b.status)) { sets.push('status = ?'); vals.push(b.status) }
  if (typeof b.reply === 'string') { sets.push('reply = ?'); vals.push(clip(b.reply, 600)) }
  if (b.cmdNo != null) { sets.push('cmd_no = ?'); vals.push(+b.cmdNo || null) }
  if (b.cmdScore != null) { sets.push('cmd_score = ?'); vals.push(Math.max(0, Math.min(100, +b.cmdScore || 0))) }
  await db(c).prepare(`UPDATE ideas SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, idea.id).run()
  return c.json({ ok: true, reward })
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
  // 应征悬赏征集令：直接投递到发布企业的收件箱
  const chId = clip(b.challengeId, 40)
  const ch = chId ? await D.prepare("SELECT * FROM challenges WHERE id = ? AND hidden = 0").bind(chId).first<any>() : null
  if (chId && !ch) throw new AiError('征集令不存在', 404)
  if (ch && (ch.status !== 'open' || (ch.deadline && ch.deadline < t))) throw new AiError('该征集令已结束', 400)
  const co = ch?.company_id ? await D.prepare('SELECT id, name FROM companies WHERE id = ?').bind(ch.company_id).first<any>() : await matchCompany(D, T.name, T.short, ...(T.aliases || []))
  if (ch) { T.name = ch.company_name }
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
  const kind = KINDS.includes(b.kind) ? b.kind : 'proposal'
  await D.prepare(`INSERT INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?)`)
    .bind(id, uid, clip(b.nickname, 30), clip(b.contact, 80), clip(T.name, 60), co?.id || null, kind, clip(b.category, 20), title, clip(b.oneLiner, 120), proposal, clip(b.cover, 300), channel, emailTo, emailSource, emailMsg, status, JSON.stringify(b.eval || {}).slice(0, 1000), (Array.isArray(b.tags) ? b.tags : []).slice(0, 4).map((x: any) => clip(x, 12)).join(','), b.listed === false ? 0 : 1, t, t).run()
  if (ch) await D.prepare('UPDATE ideas SET challenge_id = ? WHERE id = ?').bind(ch.id, id).run()
  const pts = (await credit(D, userOf(uid), RULES.submit.pts, 'submit', `提交献策《${clip(title, 20)}》`, `submit:${id}`, RULES.submit.cap)) ? RULES.submit.pts : 0
  return c.json({ ok: true, id, channel, status, company: co ? { id: co.id, name: co.name } : null, emailTo, emailMsg, view: `${origin}/api/ideas/view/${id}`, points: pts, challenge: ch ? { id: ch.id, title: ch.title } : null })
})

const pub = (full = false) => (r: any) => ({ id: r.id, nickname: r.nickname || '匿名用户', contact: full ? r.contact : undefined, target: r.target_name, companyId: r.company_id, category: r.category, title: r.title, oneLiner: r.one_liner, proposal: full ? r.proposal : undefined, channel: r.channel, emailTo: r.email_to ? r.email_to.replace(/(.{2}).*(@.*)/, '$1***$2') : '', emailMsg: r.email_msg, status: r.status, reply: r.reply, eval: (() => { try { return JSON.parse(r.eval || '{}') } catch { return {} } })(), cmdNo: r.cmd_no, cmdScore: r.cmd_score, kind: r.kind || 'proposal', challengeId: r.challenge_id || null, rewardPoints: r.reward_points || 0, rewardCash: r.reward_cash || '', likes: r.likes || 0, featured: !!r.featured, sample: !!r.sample, listed: r.listed !== 0, tags: String(r.tags || '').split(',').filter(Boolean), createdAt: r.created_at, updatedAt: r.updated_at })

ideas.get('/mine', async (c) => {
  const uid = clip(c.req.query('uid'), 40); if (!uid) return c.json({ ok: true, ideas: [] })
  const { results } = await db(c).prepare('SELECT * FROM ideas WHERE uid = ? ORDER BY created_at DESC LIMIT 100').bind(uid).all<any>()
  return c.json({ ok: true, ideas: (results || []).map(pub(true)) })
})
ideas.get('/stats', async (c) => {
  const D = db(c)
  const [a, b2, e, r] = await Promise.all([
    D.prepare('SELECT COUNT(*) AS n FROM ideas WHERE hidden = 0').first<any>(),
    D.prepare('SELECT COUNT(*) AS n FROM companies').first<any>(),
    D.prepare("SELECT COUNT(*) AS n FROM ideas WHERE status = 'adopted' OR status = 'done'").first<any>(),
    D.prepare('SELECT target_name, title, category, status, nickname, created_at FROM ideas WHERE hidden = 0 AND listed = 1 ORDER BY created_at DESC LIMIT 12').all<any>(),
  ])
  const top = await D.prepare('SELECT target_name AS name, COUNT(*) AS n, SUM(likes) AS likes FROM ideas WHERE hidden = 0 AND listed = 1 GROUP BY target_name ORDER BY n DESC, likes DESC LIMIT 8').all<any>()
  const kinds = await D.prepare('SELECT kind, COUNT(*) AS n FROM ideas WHERE hidden = 0 GROUP BY kind').all<any>()
  const likes = await D.prepare('SELECT COUNT(*) AS n FROM idea_likes').first<any>()
  return c.json({ ok: true, ideas: a?.n || 0, companies: b2?.n || 0, adopted: e?.n || 0, recent: (r.results || []).map((x: any) => ({ target: x.target_name, title: x.title, category: x.category, status: x.status, nickname: x.nickname || '匿名用户', at: x.created_at })), hot: top.results || [], kinds: kinds.results || [], likes: likes?.n || 0 })
})

// ---------- 献策市场：公开列表（热门 / 最新 / 精选 / 已采纳）+ 点赞 ----------
ideas.get('/market', async (c) => {
  const kind = c.req.query('kind') || '', sort = c.req.query('sort') || 'hot', q = clip(c.req.query('q'), 30), cat = clip(c.req.query('cat'), 20), uid = clip(c.req.query('uid'), 40)
  const where = ['hidden = 0', 'listed = 1'], v: any[] = []
  if (KINDS.includes(kind)) { where.push('kind = ?'); v.push(kind) }
  if (cat) { where.push('category = ?'); v.push(cat) }
  if (q) { where.push('(title LIKE ? OR target_name LIKE ? OR one_liner LIKE ?)'); v.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  if (sort === 'featured') where.push('featured = 1')
  if (sort === 'adopted') where.push("status IN ('adopted','done','replied')")
  // 热度：点赞 ×3 + 精选 20 + 已采纳 15 + 时间衰减（每天 -1）
  const order = sort === 'new' ? 'created_at DESC' : `(likes * 3 + featured * 20 + (CASE WHEN status IN ('adopted','done') THEN 15 ELSE 0 END) - (${now()} - created_at) / 86400000.0) DESC`
  const { results } = await db(c).prepare(`SELECT * FROM ideas WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 60`).bind(...v).all<any>()
  const rows = (results || []).map(pub(false))
  let liked: string[] = []
  if (uid && rows.length) { const { results: lk } = await db(c).prepare(`SELECT idea_id FROM idea_likes WHERE uid = ? AND idea_id IN (${rows.map(() => '?').join(',')})`).bind(uid, ...rows.map((r) => r.id)).all<any>(); liked = (lk || []).map((x: any) => x.idea_id) }
  return c.json({ ok: true, ideas: rows.map((r) => ({ ...r, liked: liked.includes(r.id) })) })
})
ideas.get('/detail/:id', async (c) => {
  const r = await db(c).prepare('SELECT * FROM ideas WHERE id = ? AND hidden = 0 AND listed = 1').bind(clip(c.req.param('id'), 40)).first<any>()
  if (!r) throw new AiError('献策不存在或未公开', 404)
  const x = pub(true)(r); delete (x as any).contact
  return c.json({ ok: true, idea: x })
})
ideas.post('/like', async (c) => {
  const b = await c.req.json<any>(); const uid = clip(b.uid, 40), id = clip(b.id, 40); if (!uid || !id) throw new AiError('参数缺失', 400)
  const D = db(c)
  const ex = await D.prepare('SELECT 1 AS x FROM idea_likes WHERE idea_id = ? AND uid = ?').bind(id, uid).first<any>()
  if (ex) await D.batch([D.prepare('DELETE FROM idea_likes WHERE idea_id = ? AND uid = ?').bind(id, uid), D.prepare('UPDATE ideas SET likes = MAX(0, likes - 1) WHERE id = ?').bind(id)])
  else {
    await D.batch([D.prepare('INSERT INTO idea_likes (idea_id, uid, at) VALUES (?, ?, ?)').bind(id, uid, now()), D.prepare('UPDATE ideas SET likes = likes + 1 WHERE id = ?').bind(id)])
    // 点赞激励作者：不能给自己点、样板不计、每份献策最多计 50 个赞；取消再点不会重复发放（ref 唯一）
    const it = await D.prepare('SELECT uid, title, sample FROM ideas WHERE id = ?').bind(id).first<any>()
    if (it && !it.sample && it.uid !== uid) {
      const n = await D.prepare("SELECT COUNT(*) AS n FROM ledger WHERE ref LIKE ?").bind(`like:${id}:%`).first<any>()
      if ((n?.n || 0) < RULES.like.cap) await credit(D, userOf(it.uid), RULES.like.pts, 'like', `《${clip(it.title, 20)}》获得点赞`, `like:${id}:${uid}`)
    }
  }
  const r = await D.prepare('SELECT likes FROM ideas WHERE id = ?').bind(id).first<any>()
  return c.json({ ok: true, liked: !ex, likes: r?.likes || 0 })
})

// ---------- 公开页：在线查看 / 退订 ----------
const page = (title: string, body: string) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head><body style="margin:0;background:#f4f6fb;padding:24px 12px"><div style="max-width:680px;margin:0 auto 14px;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif"><a href="/" style="display:inline-block;padding:8px 14px;border-radius:20px;background:#fff;border:1px solid #e2e8f0;color:#2563eb;text-decoration:none;font-size:13px">← 返回智导主页</a></div>${body}</body></html>`
ideas.get('/view/:id', async (c) => {
  const r = await db(c).prepare('SELECT * FROM ideas WHERE id = ? AND hidden = 0').bind(clip(c.req.param('id'), 40)).first<any>()
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
