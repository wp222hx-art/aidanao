// 智导 · 撮合体系：智点钱包 / 排行榜 / 悬赏征集令 / 同行方案库 / 智能撮合
// 智点 = 平台内激励积分：可用于发布征集令、打赏、购买同行方案；现金奖励由企业与提案人线下约定，平台不经手资金
import { Hono } from 'hono'
import { llm, AiError, clip } from './ai'
import { rid, now, db, lines, DAY } from './svc-util'
import { RULES, credit, debit, userOf, coOf, ensureCompanyGrant } from './market-util'

type Bindings = { GSK_API_KEY?: string; GSK_BASE_URL?: string; DB?: D1Database }
const mkt = new Hono<{ Bindings: Bindings }>()
mkt.onError((err, c) => c.json({ ok: false, error: err.message || '撮合服务异常' }, (err instanceof AiError ? err.code : 500) as any))

async function coAuth(c: any, id: string, token: string) {
  const r = await db(c).prepare('SELECT id, name, industry, business FROM companies WHERE id = ? AND token = ?').bind(clip(id, 40), clip(token, 60)).first<any>()
  if (!r) throw new AiError('企业身份校验失败', 401)
  return r
}
const wallet = async (D: D1Database, owner: string) => (await D.prepare('SELECT balance, earned, spent FROM wallets WHERE owner = ?').bind(owner).first<any>()) || { balance: 0, earned: 0, spent: 0 }
const kw = (s: string) => [...new Set(String(s || '').replace(/[，。、；：！？,.;:!?()（）「」【】《》\s#\-]+/g, ' ').split(' ').flatMap((w) => w.length > 4 ? [w.slice(0, 2), w.slice(2, 4), w.slice(-2)] : [w]).filter((w) => w.length >= 2))]
const overlap = (a: string[], b: string) => a.reduce((n, w) => n + (b.includes(w) ? 1 : 0), 0)

mkt.get('/rules', (c) => c.json({ ok: true, rules: RULES }))

// ---------- 钱包 ----------
mkt.post('/wallet', async (c) => {
  const b = await c.req.json<any>(), D = db(c)
  let owner = ''
  if (b.co) { const co = await coAuth(c, b.co.id, b.co.token); await ensureCompanyGrant(D, co.id); owner = coOf(co.id) }
  else { const uid = clip(b.uid, 40); if (!uid) throw new AiError('缺少用户标识', 400); owner = userOf(uid) }
  const w = await wallet(D, owner)
  const { results } = await D.prepare('SELECT delta, kind, note, at FROM ledger WHERE owner = ? ORDER BY at DESC LIMIT 60').bind(owner).all<any>()
  let rank = null
  if (owner.startsWith('u:') && w.earned > 0) rank = ((await D.prepare("SELECT COUNT(*) AS n FROM wallets WHERE owner LIKE 'u:%' AND earned > ?").bind(w.earned).first<any>())?.n || 0) + 1
  return c.json({ ok: true, ...w, rank, ledger: results || [] })
})

// ---------- 排行榜：献策达人 / 共享先锋 ----------
mkt.get('/leaderboard', async (c) => {
  const D = db(c), since = now() - 30 * DAY
  const { results: all } = await D.prepare(`SELECT w.owner, w.earned, w.sample, (SELECT nickname FROM ideas i WHERE 'u:' || i.uid = w.owner AND nickname != '' ORDER BY created_at DESC LIMIT 1) AS name,
    (SELECT COUNT(*) FROM ideas i WHERE 'u:' || i.uid = w.owner) AS ideas, (SELECT COUNT(*) FROM ideas i WHERE 'u:' || i.uid = w.owner AND status IN ('adopted','done')) AS adopted
    FROM wallets w WHERE w.owner LIKE 'u:%' AND w.earned > 0 ORDER BY w.earned DESC LIMIT 20`).all<any>()
  const { results: month } = await D.prepare(`SELECT l.owner, SUM(l.delta) AS earned, (SELECT nickname FROM ideas i WHERE 'u:' || i.uid = l.owner AND nickname != '' ORDER BY created_at DESC LIMIT 1) AS name
    FROM ledger l WHERE l.owner LIKE 'u:%' AND l.delta > 0 AND l.at > ? GROUP BY l.owner ORDER BY earned DESC LIMIT 10`).bind(since).all<any>()
  const { results: sharers } = await D.prepare(`SELECT owner_name AS name, anonymous, SUM(uses) AS uses, SUM(earned) AS earned, COUNT(*) AS n, MAX(sample) AS sample FROM solutions WHERE hidden = 0 GROUP BY owner ORDER BY uses DESC, earned DESC LIMIT 10`).all<any>()
  const strip = (r: any) => ({ name: r.name || '匿名用户', earned: r.earned || 0, ideas: r.ideas, adopted: r.adopted, sample: !!r.sample })
  return c.json({ ok: true, all: (all || []).map(strip), month: (month || []).map(strip), sharers: (sharers || []).map((r: any) => ({ name: r.anonymous ? '匿名企业' : r.name, uses: r.uses || 0, earned: r.earned || 0, n: r.n, sample: !!r.sample })) })
})

// ---------- 悬赏征集令：企业发布问题 + 托管智点悬赏，用户应征 ----------
const chPub = (r: any) => ({ id: r.id, companyId: r.company_id, company: r.company_name, industry: r.industry, title: r.title, problem: r.problem, category: r.category, kindPref: r.kind_pref, rewardPoints: r.reward_points, escrow: r.escrow, rewardCash: r.reward_cash, deadline: r.deadline, status: r.deadline && r.deadline < now() && r.status === 'open' ? 'expired' : r.status, sample: !!r.sample, entries: r.entries ?? 0, createdAt: r.created_at })
mkt.get('/challenges', async (c) => {
  const st = c.req.query('status') || 'open', q = clip(c.req.query('q'), 30)
  const where = ['hidden = 0'], v: any[] = []
  if (st === 'open') { where.push("status = 'open' AND (deadline IS NULL OR deadline > ?)"); v.push(now()) }
  if (q) { where.push('(title LIKE ? OR company_name LIKE ? OR problem LIKE ?)'); v.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  const { results } = await db(c).prepare(`SELECT *, (SELECT COUNT(*) FROM ideas i WHERE i.challenge_id = challenges.id) AS entries FROM challenges WHERE ${where.join(' AND ')} ORDER BY sample ASC, reward_points DESC, created_at DESC LIMIT 60`).bind(...v).all<any>()
  return c.json({ ok: true, challenges: (results || []).map(chPub) })
})
mkt.get('/challenge/:id', async (c) => {
  const r = await db(c).prepare('SELECT *, (SELECT COUNT(*) FROM ideas i WHERE i.challenge_id = challenges.id) AS entries FROM challenges WHERE id = ? AND hidden = 0').bind(clip(c.req.param('id'), 40)).first<any>()
  if (!r) throw new AiError('征集令不存在', 404)
  return c.json({ ok: true, challenge: chPub(r) })
})
mkt.post('/challenge/create', async (c) => {
  const b = await c.req.json<any>(), D = db(c)
  const co = await coAuth(c, b.id, b.token); await ensureCompanyGrant(D, co.id)
  const title = clip(b.title, 40).trim(), problem = clip(b.problem, 1500).trim()
  if (title.length < 4 || problem.length < 10) throw new AiError('请写清征集标题和要解决的问题', 400)
  const pts = Math.max(0, Math.min(50000, Math.round(+b.rewardPoints || 0)))
  const days = Math.max(3, Math.min(90, Math.round(+b.days || 14)))
  const id = rid('ch'), t = now()
  if (pts > 0) await debit(D, coOf(co.id), pts, 'escrow', `征集令「${title}」悬赏托管`, `escrow:${id}`)
  await D.prepare('INSERT INTO challenges (id, company_id, company_name, industry, brief, title, problem, category, kind_pref, reward_points, escrow, reward_cash, deadline, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, co.id, co.name, clip(b.industry || co.industry, 40), clip(co.business, 200), title, problem, clip(b.category, 20), ['proposal', 'suggestion', 'design'].includes(b.kindPref) ? b.kindPref : '', pts, pts, clip(b.rewardCash, 60), t + days * DAY, 'open', t, t).run()
  return c.json({ ok: true, id })
})
mkt.post('/challenge/mine', async (c) => {
  const b = await c.req.json<any>(); const co = await coAuth(c, b.id, b.token)
  const { results } = await db(c).prepare('SELECT *, (SELECT COUNT(*) FROM ideas i WHERE i.challenge_id = challenges.id) AS entries FROM challenges WHERE company_id = ? ORDER BY created_at DESC LIMIT 50').bind(co.id).all<any>()
  return c.json({ ok: true, challenges: (results || []).map(chPub) })
})
// 结束征集：剩余托管智点退回企业钱包
mkt.post('/challenge/close', async (c) => {
  const b = await c.req.json<any>(), D = db(c); const co = await coAuth(c, b.id, b.token)
  const ch = await D.prepare('SELECT * FROM challenges WHERE id = ? AND company_id = ?').bind(clip(b.challengeId, 40), co.id).first<any>()
  if (!ch) throw new AiError('征集令不存在', 404)
  if (ch.status === 'closed') return c.json({ ok: true, refund: 0 })
  const left = ch.escrow || 0
  await D.prepare("UPDATE challenges SET status = 'closed', escrow = 0, updated_at = ? WHERE id = ?").bind(now(), ch.id).run()
  if (left > 0) await credit(D, coOf(co.id), left, 'refund', `征集令「${clip(ch.title, 20)}」结束，退回托管`, `refund:${ch.id}`)
  return c.json({ ok: true, refund: left })
})

// ---------- 智能撮合：征集令 ↔ 献策 ↔ 同行方案（关键词相关度，零成本、实时） ----------
mkt.post('/match', async (c) => {
  const b = await c.req.json<any>(), D = db(c)
  const text = clip([b.text, b.industry, b.company].filter(Boolean).join(' '), 600), words = kw(text)
  if (!words.length) return c.json({ ok: true, challenges: [], ideas: [], solutions: [] })
  const [ch, id, so] = await Promise.all([
    D.prepare("SELECT *, (SELECT COUNT(*) FROM ideas i WHERE i.challenge_id = challenges.id) AS entries FROM challenges WHERE hidden = 0 AND status = 'open' AND (deadline IS NULL OR deadline > ?) ORDER BY created_at DESC LIMIT 200").bind(now()).all<any>(),
    D.prepare('SELECT id, title, one_liner, target_name, category, kind, likes, tags, sample FROM ideas WHERE hidden = 0 AND listed = 1 ORDER BY created_at DESC LIMIT 300').all<any>(),
    D.prepare('SELECT id, title, problem, industry, tags, price, uses, score, sample, owner_name, anonymous FROM solutions WHERE hidden = 0 ORDER BY created_at DESC LIMIT 300').all<any>(),
  ])
  const rank = <T,>(rows: T[], f: (r: any) => string, n: number) => rows.map((r: any) => ({ r, s: overlap(words, f(r)) })).filter((x) => x.s > 0).sort((a, b2) => b2.s - a.s).slice(0, n)
  return c.json({
    ok: true,
    challenges: rank(ch.results || [], (r) => `${r.title} ${r.problem} ${r.industry} ${r.company_name} ${r.category}`, 6).map((x) => ({ ...chPub(x.r), match: x.s })),
    ideas: rank(id.results || [], (r) => `${r.title} ${r.one_liner} ${r.target_name} ${r.category} ${r.tags}`, 6).map((x) => ({ id: x.r.id, title: x.r.title, oneLiner: x.r.one_liner, target: x.r.target_name, kind: x.r.kind, likes: x.r.likes, sample: !!x.r.sample, match: x.s })),
    solutions: rank(so.results || [], (r) => `${r.title} ${r.problem} ${r.industry} ${r.tags}`, 6).map((x) => ({ id: x.r.id, title: x.r.title, problem: x.r.problem, industry: x.r.industry, price: x.r.price, uses: x.r.uses, score: x.r.score, sample: !!x.r.sample, author: x.r.anonymous ? '匿名企业' : x.r.owner_name, match: x.s })),
  })
})

// ---------- 同行方案库：企业把验证过的方案共享给同行 ----------
const soPub = (full = false) => (r: any) => ({ id: r.id, author: r.anonymous ? '匿名企业' : (r.owner_name || '匿名企业'), industry: r.industry, title: r.title, problem: r.problem, approach: full ? r.approach : undefined, results: r.results, score: r.score, tags: String(r.tags || '').split(',').filter(Boolean), price: r.price, uses: r.uses, earned: r.earned, sample: !!r.sample, createdAt: r.created_at })
mkt.get('/solutions', async (c) => {
  const q = clip(c.req.query('q'), 30), ind = clip(c.req.query('industry'), 30), sort = c.req.query('sort') || 'hot', price = c.req.query('price') || ''
  const where = ['hidden = 0'], v: any[] = []
  if (q) { where.push('(title LIKE ? OR problem LIKE ? OR tags LIKE ?)'); v.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  if (ind) { where.push('industry LIKE ?'); v.push(`%${ind}%`) }
  if (price === 'free') where.push('price = 0'); else if (price === 'paid') where.push('price > 0')
  const order = sort === 'new' ? 'created_at DESC' : sort === 'score' ? 'score DESC' : 'uses DESC, score DESC'
  const { results } = await db(c).prepare(`SELECT * FROM solutions WHERE ${where.join(' AND ')} ORDER BY sample ASC, ${order} LIMIT 60`).bind(...v).all<any>()
  return c.json({ ok: true, solutions: (results || []).map(soPub(false)) })
})
// AI 脱敏整理：把企业内部项目档案提炼成可复用、不泄密的同行方案
mkt.post('/solution/draft', async (c) => {
  const b = await c.req.json<any>()
  const out = await llm(c.env,
    '你是行业知识编辑。把一家企业内部完成的项目，提炼成可以给同行参考复用的「方案卡」。必须脱敏：去掉企业名称、客户名称、人名、具体金额、联系方式和任何可识别的内部信息，数字改成区间或比例并标注「约」。保留可复用的方法、步骤、工具和关键经验。输出 JSON。',
    `行业：${clip(b.industry, 60)}\n项目指令：${clip(b.text, 200)}\n目标：${clip(b.goal, 200)}\n验收：${clip(b.acceptance, 300)}\n复盘经验：${lines(b.lessons, 5, 120).join('；')}\n各部门做了什么：\n${lines(b.steps, 12, 200).join('\n')}\n\n输出 JSON：{"title":"方案标题≤24字","problem":"解决什么问题≤60字","approach":"Markdown 方案正文 500-1000 字，章节：## 适用场景 / ## 核心做法 / ## 实施步骤（编号） / ## 所需资源与工具 / ## 关键经验与避坑","results":"效果描述≤60字（脱敏，用比例或区间）","tags":["3-4 个关键词"]}`,
    { model: 'gpt-5.4-mini', effort: 'medium' })
  return c.json({ ok: true, title: clip(out.title, 40), problem: clip(out.problem, 100), approach: clip(out.approach, 5000), results: clip(out.results, 100), tags: lines(out.tags, 4, 12) })
})
mkt.post('/solution/share', async (c) => {
  const b = await c.req.json<any>(), D = db(c)
  let owner = '', name = clip(b.ownerName, 40)
  if (b.co) { const co = await coAuth(c, b.co.id, b.co.token); owner = coOf(co.id); name = co.name } else { const uid = clip(b.uid, 40); if (!uid) throw new AiError('缺少用户标识', 400); owner = userOf(uid) }
  const title = clip(b.title, 40).trim(), approach = clip(b.approach, 6000)
  if (title.length < 4 || approach.length < 80) throw new AiError('方案内容不完整', 400)
  const id = rid('so'), price = Math.max(0, Math.min(5000, Math.round(+b.price || 0)))
  await D.prepare('INSERT INTO solutions (id, owner, owner_name, anonymous, industry, title, problem, approach, results, score, tags, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, owner, name, b.anonymous ? 1 : 0, clip(b.industry, 60), title, clip(b.problem, 200), approach, clip(b.results, 200), Math.max(0, Math.min(100, Math.round(+b.score || 0))), lines(b.tags, 4, 12).join(','), price, now()).run()
  const got = await credit(D, owner, RULES.share.pts, 'share', `共享方案《${clip(title, 20)}》`, `share:${id}`, RULES.share.cap)
  return c.json({ ok: true, id, reward: got ? RULES.share.pts : 0 })
})
// 使用方案：免费方案作者 +2；付费方案扣使用者智点，作者得 80%
mkt.post('/solution/use', async (c) => {
  const b = await c.req.json<any>(), D = db(c)
  const s = await D.prepare('SELECT * FROM solutions WHERE id = ? AND hidden = 0').bind(clip(b.id, 40)).first<any>()
  if (!s) throw new AiError('方案不存在', 404)
  let user = ''
  if (b.co) { const co = await coAuth(c, b.co.id, b.co.token); await ensureCompanyGrant(D, co.id); user = coOf(co.id) } else { const uid = clip(b.uid, 40); if (!uid) throw new AiError('缺少用户标识', 400); user = userOf(uid) }
  const used = await D.prepare('SELECT paid FROM solution_uses WHERE solution_id = ? AND user = ?').bind(s.id, user).first<any>()
  let paid = 0
  if (!used) {
    if (user === s.owner || s.sample) { /* 作者本人查看 / 样板方案（演示用）不计费 */ }
    else if (s.price > 0) {
      await debit(D, user, s.price, 'buy', `使用同行方案《${clip(s.title, 20)}》`, `buy:${s.id}:${user}`); paid = s.price
      const cut = Math.floor(s.price * RULES.paidCut.rate)
      if (!s.sample) await credit(D, s.owner, cut, 'royalty', `方案《${clip(s.title, 20)}》被同行付费使用`, `royalty:${s.id}:${user}`)
      await D.prepare('UPDATE solutions SET earned = earned + ? WHERE id = ?').bind(s.sample ? 0 : cut, s.id).run()
    } else if (!s.sample) {
      const ok = await credit(D, s.owner, RULES.freeUse.pts, 'use', `方案《${clip(s.title, 20)}》被同行使用`, `use:${s.id}:${user}`, RULES.freeUse.cap)
      if (ok) await D.prepare('UPDATE solutions SET earned = earned + ? WHERE id = ?').bind(RULES.freeUse.pts, s.id).run()
    }
    await D.prepare('INSERT OR IGNORE INTO solution_uses (solution_id, user, paid, at) VALUES (?, ?, ?, ?)').bind(s.id, user, paid, now()).run()
    if (user !== s.owner) await D.prepare('UPDATE solutions SET uses = uses + 1 WHERE id = ?').bind(s.id).run()
  }
  return c.json({ ok: true, paid, solution: soPub(true)(s) })
})
mkt.post('/solution/mine', async (c) => {
  const b = await c.req.json<any>(), D = db(c)
  const owner = b.co ? coOf((await coAuth(c, b.co.id, b.co.token)).id) : userOf(clip(b.uid, 40))
  const { results } = await D.prepare('SELECT * FROM solutions WHERE owner = ? ORDER BY created_at DESC LIMIT 50').bind(owner).all<any>()
  return c.json({ ok: true, solutions: (results || []).map(soPub(true)) })
})

export default mkt
