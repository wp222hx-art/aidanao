// 智导 · 服务中心：数据雷达 / 热点视频 / 贸易数据 / 政务助手 / 网站交付
// 数据类接口全部带 D1 缓存：过期后被访问即自动重新抓取（实时更新，不依赖定时任务）
import { Hono } from 'hono'
import { tool, llm, AiError, clip } from './ai'
import { eng, rid, now, lines, esc, db, parseBatch, evidence, srcRef, cached } from './svc-util'

type Bindings = { GSK_API_KEY?: string; GSK_BASE_URL?: string; DB?: D1Database }
const svc = new Hono<{ Bindings: Bindings }>()
svc.onError((err, c) => c.json({ ok: false, error: err.message || '服务异常' }, (err instanceof AiError ? err.code : 500) as any))

const H = 3600e3
const search = async (c: any, queries: string[]) => {
  const d = await tool(c.env, 'batch_web_search', { queries: queries.slice(0, 6) })
  return parseBatch(String(d?.result || ''))
}
const ctxOf = (b: any) => `企业：${clip(b.company, 60)}\n行业：${clip(b.industry, 60)}\n主营：${clip(b.business, 160)}\n关键词：${lines(b.keywords, 6, 16).join('、')}`

// ---------- ① 数据雷达：行业动态 + 政策 + 竞品 + 需求信号，AI 结构化分析 ----------
svc.post('/radar', async (c) => {
  const b = await c.req.json<any>()
  const kw = lines(b.keywords, 4, 16), ind = clip(b.industry, 30), co = clip(b.company, 40)
  if (!ind && !kw.length) throw new AiError('缺少行业或关键词', 400)
  const key = `radar:${ind}:${kw.join(',')}`
  const out = await cached(c, key, 6 * H, !!b.refresh, async () => {
    const k0 = kw[0] || ind
    const src = await search(c, [`${ind} 行业 最新动态 2026`, `${ind} 政策 补贴 2026`, `${k0} 市场规模 增速 数据`, `${k0} 招标 采购 需求`, `${k0} 竞争格局 头部企业`, `${ind} 价格 原材料 走势`])
    const r = await llm(c.env, '你是产业研究分析师。只根据检索证据写结论，每条结论必须标注来源序号 src（数字），没有证据的不写。数字保留原文口径，不得编造。输出 JSON。',
      `${ctxOf(b)}\n\n【检索证据】\n${evidence(src, 18)}\n\n输出 JSON：{"headline":"一句话行业态势（≤40字）","heat":0-100 的行业景气度估计,"metrics":[{"name":"指标名","value":"数值+单位（原文）","trend":"up|down|flat","src":序号}](3-6个),"signals":[{"type":"政策|需求|竞争|价格|技术","title":"≤30字","impact":"对本企业的影响≤50字","level":"high|mid|low","src":序号}](4-8个),"actions":["建议企业本周可做的动作≤40字"](3个)}`,
      { model: eng(b), effort: 'medium' })
    return {
      headline: clip(r.headline, 60), heat: Math.max(0, Math.min(100, Math.round(+r.heat || 0))),
      metrics: (r.metrics || []).slice(0, 6).map((m: any) => ({ name: clip(m.name, 20), value: clip(m.value, 30), trend: ['up', 'down', 'flat'].includes(m.trend) ? m.trend : 'flat', source: srcRef(src, m.src) })),
      signals: (r.signals || []).slice(0, 8).map((s: any) => ({ type: clip(s.type, 6), title: clip(s.title, 40), impact: clip(s.impact, 70), level: ['high', 'mid', 'low'].includes(s.level) ? s.level : 'mid', source: srcRef(src, s.src) })).filter((s: any) => s.source),
      actions: lines(r.actions, 3, 60), sources: src.slice(0, 18).map((s) => ({ title: clip(s.title, 60), url: s.url })),
    }
  })
  return c.json({ ok: true, ...out })
})

// ---------- ② 热点视频：按企业特色检索可参考的视频，AI 解读可借鉴点 ----------
svc.post('/videos', async (c) => {
  const b = await c.req.json<any>()
  const kw = lines(b.keywords, 3, 16), ind = clip(b.industry, 30)
  const key = `videos:${ind}:${kw.join(',')}`
  const out = await cached(c, key, 12 * H, !!b.refresh, async () => {
    const qs = [...new Set([`${kw[0] || ind} 案例`, `${ind} 营销 爆款`, `${kw[1] || kw[0] || ind} 产品 宣传片`])].slice(0, 3)
    const res = await Promise.all(qs.map((q) => tool(c.env, 'youtube', { action: 'search', query: q }).catch(() => [])))
    const seen = new Set<string>(); const vids: any[] = []
    res.forEach((arr: any, qi: number) => (Array.isArray(arr) ? arr : []).slice(0, 8).forEach((v: any) => {
      if (!v?.video_id || seen.has(v.video_id)) return; seen.add(v.video_id)
      vids.push({ id: v.video_id, title: clip(v.title, 80), url: v.link, channel: clip(v.channel?.name, 30), views: +v.views || 0, length: clip(v.length, 10), published: clip(v.published_date, 16), thumb: v.thumbnail?.static || '', q: qs[qi] })
    }))
    if (!vids.length) return { videos: [], summary: '没有检索到相关视频' }
    const r = await llm(c.env, '你是短视频营销顾问。从候选视频中挑出对这家企业最有参考价值的，说明可借鉴点（选题、镜头、话术、结构），并给出可直接拍的选题。只能使用给定的视频 id。输出 JSON。',
      `${ctxOf(b)}\n\n【候选视频】\n${vids.map((v) => `${v.id} | ${v.title} | ${v.channel} | 播放 ${v.views} | ${v.length} | ${v.published}`).join('\n')}\n\n输出 JSON：{"summary":"这批视频的共同规律≤60字","picks":[{"id":"视频id","why":"可借鉴点≤50字","angle":"选题|镜头|话术|结构","score":0-100}](6-9个),"ideas":[{"title":"我们可以拍的选题≤24字","hook":"开头 3 秒钩子≤30字","format":"口播|实拍|动画|测评|案例"}](3个)}`,
      { model: eng(b), effort: 'medium' })
    const byId = new Map(vids.map((v) => [v.id, v]))
    const picks = (r.picks || []).map((p: any) => byId.get(p.id) && { ...byId.get(p.id), why: clip(p.why, 70), angle: clip(p.angle, 6), score: Math.round(+p.score || 0) }).filter(Boolean).slice(0, 9)
    return { summary: clip(r.summary, 90), videos: picks.length ? picks : vids.slice(0, 9), ideas: (r.ideas || []).slice(0, 3).map((x: any) => ({ title: clip(x.title, 30), hook: clip(x.hook, 40), format: clip(x.format, 6) })) }
  })
  return c.json({ ok: true, ...out })
})

// ---------- ③ 贸易数据：海关 / 商务部等公开数据检索 + 结构化 ----------
svc.post('/trade', async (c) => {
  const b = await c.req.json<any>()
  const p = clip(b.product, 30).trim() || lines(b.keywords, 1, 16)[0] || clip(b.industry, 20)
  if (!p) throw new AiError('请输入产品或行业', 400)
  const key = `trade:${p}`
  const out = await cached(c, key, 24 * H, !!b.refresh, async () => {
    const src = await search(c, [`${p} 出口 海关 数据 2026`, `${p} 进口 数据 同比`, `${p} 出口 主要国家 市场`, `${p} HS编码 税率`, `${p} 贸易 关税 政策 2026`, `${p} 跨境电商 出口`])
    const r = await llm(c.env, '你是外贸数据分析师。只根据检索证据整理贸易数据，每个数字标注来源序号 src；证据没有的数据宁缺毋滥。输出 JSON。',
      `产品/行业：${p}\n${ctxOf(b)}\n\n【检索证据】\n${evidence(src, 18)}\n\n输出 JSON：{"hs":"可能的 HS 编码（证据里有才写，否则空）","overview":"贸易态势≤60字","figures":[{"name":"指标（如 1-9月出口额）","value":"数值+单位","yoy":"同比（原文，没有写空）","src":序号}](3-6),"markets":[{"name":"国家/地区","note":"份额/增速/特点≤30字","src":序号}](3-6),"policies":[{"title":"关税/认证/政策≤30字","impact":"影响≤40字","src":序号}](2-4),"opportunities":["出海或进口替代机会≤40字"](3)}`,
      { model: eng(b), effort: 'medium' })
    return {
      product: p, hs: clip(r.hs, 20), overview: clip(r.overview, 90),
      figures: (r.figures || []).slice(0, 6).map((f: any) => ({ name: clip(f.name, 24), value: clip(f.value, 30), yoy: clip(f.yoy, 16), source: srcRef(src, f.src) })).filter((f: any) => f.source),
      markets: (r.markets || []).slice(0, 6).map((m: any) => ({ name: clip(m.name, 16), note: clip(m.note, 40), source: srcRef(src, m.src) })),
      policies: (r.policies || []).slice(0, 4).map((x: any) => ({ title: clip(x.title, 40), impact: clip(x.impact, 60), source: srcRef(src, x.src) })),
      opportunities: lines(r.opportunities, 3, 60), sources: src.slice(0, 18).map((s) => ({ title: clip(s.title, 60), url: s.url })),
      links: [{ name: '海关总署 统计数据', url: 'http://www.customs.gov.cn/customs/302249/zfxxgk/2799825/302274/index.html' }, { name: '中国国际贸易单一窗口', url: 'https://www.singlewindow.cn/' }, { name: '商务部 商务数据中心', url: 'https://data.mofcom.gov.cn/' }],
    }
  })
  return c.json({ ok: true, ...out })
})

// ---------- ④ 政务助手：只做办事指引，引用官方来源，不代办、不代填 ----------
svc.post('/gov/ask', async (c) => {
  const b = await c.req.json<any>()
  const q = clip(b.q, 200).trim(); if (q.length < 2) throw new AiError('请描述你要办的事', 400)
  const region = clip(b.region, 20)
  const src = await search(c, [`${q} ${region} 办理流程 材料 site:gov.cn`, `${q} 办理条件 时限 官方`, `${q} ${region} 政务服务网 网上办理`])
  const gov = src.filter((s) => /gov\.cn|chinatax|gsxt|samr|customs|singlewindow|12366|mofcom/.test(s.url))
  const pool = gov.length >= 3 ? gov : src
  const r = await llm(c.env, `你是企业政务办事顾问。只根据检索证据（优先政府官网）给出办事指引：条件、材料、步骤、时限、费用、官方办理入口。各地规定不同的要明确提示“以当地主管部门为准”。不得编造网址，链接只能用证据里的。你只提供指引，不能代办、不能代填、不收集任何账号密码。输出 JSON。`,
    `企业：${clip(b.company, 40)}（${clip(b.industry, 30)}，${region || '地区未知'}）\n问题：${q}\n\n【检索证据】\n${evidence(pool, 12)}\n\n输出 JSON：{"title":"事项名称","dept":"主管部门","conditions":["≤40字"],"materials":["≤40字"],"steps":["≤50字"](3-7),"timeline":"办理时限","fee":"费用","entry":{"name":"官方办理入口名称","src":序号},"notes":["注意事项≤50字"](2-4),"srcs":[引用的序号]}`,
    { model: eng(b), effort: 'medium' })
  return c.json({ ok: true, title: clip(r.title, 40), dept: clip(r.dept, 40), conditions: lines(r.conditions, 5, 60), materials: lines(r.materials, 8, 60), steps: lines(r.steps, 7, 80), timeline: clip(r.timeline, 40), fee: clip(r.fee, 40), entry: r.entry ? { name: clip(r.entry.name, 30), source: srcRef(pool, r.entry.src) } : null, notes: lines(r.notes, 4, 70), sources: (r.srcs || []).map((i: any) => srcRef(pool, i)).filter(Boolean).slice(0, 6) })
})

// ---------- ⑤ 网站交付：AI 生成企业落地页（单文件 HTML），存 D1，/s/:id 公开访问 ----------
const SITE_CSP = "default-src 'none'; img-src * data:; style-src 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src https://cdn.jsdelivr.net https://fonts.gstatic.com; script-src 'unsafe-inline' https://cdn.tailwindcss.com; frame-ancestors *"
svc.post('/site/make', async (c) => {
  const b = await c.req.json<any>()
  const co = clip(b.company, 60).trim(); if (!co) throw new AiError('缺少企业名称', 400)
  const style = clip(b.style, 40) || '明亮、专业、现代'
  const html = await llm(c.env,
    `你是顶级网页设计师 + 前端工程师。为企业生成一个可直接上线的单文件落地页（完整 HTML 文档）。
要求：
1. 使用 <script src="https://cdn.tailwindcss.com"></script> 和 Font Awesome（https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css），不引用其他外部资源，不使用任何图片 URL（用渐变、图标、几何装饰代替）。
2. 结构：导航 → Hero（价值主张 + 两个按钮）→ 核心数据（标注"示例数据"）→ 产品/服务卡片 → 解决方案/案例 → 客户评价（标注"示例"）→ 合作流程 → FAQ → 联系我们（表单仅前端展示）→ 页脚。
3. 中文文案专业具体，贴合企业真实主营；不编造资质、奖项、客户名称（用"某头部客户"等）。
4. 风格：${style}；响应式；有细腻的悬停与滚动动效（纯 CSS / 少量内联 JS）。
5. 只输出 HTML 代码本身，不要任何解释，不要 Markdown 代码块。`,
    `企业：${co}\n行业：${clip(b.industry, 60)}\n主营：${clip(b.business, 300)}\n优势：${lines(b.strengths, 5, 60).join('；')}\n目标客户：${clip(b.audience, 80)}\n联系方式：${clip(b.contact, 80) || '（用占位：400-000-0000 / hello@example.com）'}`,
    { model: eng(b, 'claude-opus-5-5'), effort: 'medium', json: false }) as string
  let doc = String(html).replace(/^```(?:html)?\s*|\s*```$/g, '').trim()
  const st = doc.search(/<!doctype html|<html/i); if (st > 0) doc = doc.slice(st)
  if (!/<html/i.test(doc) || doc.length < 1500) throw new AiError('网站生成结果不完整，请重试', 502)
  const id = rid('site')
  await db(c).prepare('INSERT INTO sites (id, owner, company, title, html, views, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)').bind(id, clip(b.uid, 40), co, `${co} 官网`, clip(doc, 200000), now()).run()
  return c.json({ ok: true, id, url: `/s/${id}`, size: doc.length })
})
svc.get('/sites', async (c) => {
  const uid = clip(c.req.query('uid'), 40)
  const { results } = await db(c).prepare('SELECT id, company, title, views, created_at FROM sites WHERE owner = ? ORDER BY created_at DESC LIMIT 20').bind(uid).all<any>()
  return c.json({ ok: true, sites: results || [] })
})
export const serveSite = async (c: any) => {
  const r = await db(c).prepare('SELECT html FROM sites WHERE id = ?').bind(clip(c.req.param('id'), 40)).first<any>()
  if (!r) return c.html(`<p style="font-family:sans-serif;text-align:center;margin-top:80px">网站不存在或已下线 · <a href="/">返回智导主页</a></p>`, 404)
  c.executionCtx?.waitUntil?.(db(c).prepare('UPDATE sites SET views = views + 1 WHERE id = ?').bind(c.req.param('id')).run())
  return new Response(r.html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': SITE_CSP, 'X-Content-Type-Options': 'nosniff' } })
}
export { esc }
export default svc
