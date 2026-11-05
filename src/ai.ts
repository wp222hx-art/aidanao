// 企业智脑 · Genspark 能力代理层
// 所有调用都使用企业主本人的 Genspark 授权（GSK_API_KEY，仅存于服务端 Secret / .dev.vars），
// 前端永远拿不到密钥。底层与 `gsk` CLI 走同一套接口：/api/tool_cli/<tool> 与 /api/llm_proxy/v1。
import { Hono } from 'hono'
import { DIVISIONS } from './industries'

type Bindings = { GSK_API_KEY?: string; GSK_BASE_URL?: string; AI_MODEL?: string }
const ai = new Hono<{ Bindings: Bindings }>()

const base = (e: Bindings) => (e.GSK_BASE_URL || 'https://www.genspark.ai').replace(/\/$/, '')
const model = (e: Bindings) => e.AI_MODEL || 'gpt-5-mini'

class AiError extends Error { constructor(msg: string, public code = 500) { super(msg) } }

// ---- 调用 Genspark 工具（与 gsk CLI 同协议：NDJSON 流，最后一行带 status） ----
async function tool(e: Bindings, name: string, args: Record<string, unknown>) {
  if (!e.GSK_API_KEY) throw new AiError('未配置 Genspark 授权（GSK_API_KEY）', 503)
  const r = await fetch(`${base(e)}/api/tool_cli/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': e.GSK_API_KEY, 'X-GSK-CLI-Version': 'enterprise-brain/1.0' },
    body: JSON.stringify(args),
  })
  const text = await r.text()
  if (r.status === 401 || r.status === 403) throw new AiError('Genspark 授权无效或已过期', 401)
  if (r.status === 429) throw new AiError('Genspark 调用过于频繁，请稍后再试', 429)
  let final: any = null
  for (const line of text.trim().split('\n')) {
    const l = line.trim(); if (!l.startsWith('{')) continue
    try { const j = JSON.parse(l); if (j.status || j.version === undefined) final = j } catch { }
  }
  if (!final) throw new AiError(`Genspark 工具 ${name} 无返回（HTTP ${r.status}）`, 502)
  if (final.status !== 'ok') throw new AiError(final.message || `Genspark 工具 ${name} 调用失败`, 502)
  return final.data
}

// ---- 调用大模型（Genspark LLM 代理，同一授权） ----
async function llm(e: Bindings, system: string, user: string, opt: { json?: boolean; effort?: string } = {}) {
  if (!e.GSK_API_KEY) throw new AiError('未配置 Genspark 授权（GSK_API_KEY）', 503)
  const body: any = { model: model(e), messages: [{ role: 'system', content: system }, { role: 'user', content: user }], reasoning_effort: opt.effort || 'minimal' }
  if (opt.json !== false) body.response_format = { type: 'json_object' }
  const r = await fetch(`${base(e)}/api/llm_proxy/v1/chat/completions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${e.GSK_API_KEY}` }, body: JSON.stringify(body),
  })
  if (r.status === 401 || r.status === 403) throw new AiError('Genspark 授权无效或已过期', 401)
  if (!r.ok) throw new AiError(`大模型调用失败（HTTP ${r.status}）`, 502)
  const j: any = await r.json()
  const content: string = j?.choices?.[0]?.message?.content || ''
  if (opt.json === false) return content
  try { return JSON.parse(content) } catch {
    const m = content.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]) } catch { } }
    throw new AiError('大模型返回格式异常', 502)
  }
}

const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n)
const fileUrl = (u: string) => `/api/ai/file?u=${encodeURIComponent(u.split('?')[0])}`
const DIV_TEXT = DIVISIONS.map(([c, d, n, cat]) => `${c}${d} ${n}（${cat}）`).join('\n')
const DIV_SET = new Map(DIVISIONS.map(([c, d, n, cat]) => [`${c}${d}`, { code: c, div: d, divName: n, indName: cat }]))

ai.onError((err, c) => {
  const code = err instanceof AiError ? err.code : 500
  return c.json({ ok: false, error: err.message || 'AI 服务异常' }, code as any)
})

// ---------- 连接状态 ----------
ai.get('/status', async (c) => {
  const e = c.env
  if (!e.GSK_API_KEY) return c.json({ ok: true, connected: false, reason: '未配置 GSK_API_KEY' })
  try {
    const r = await fetch(`${base(e)}/api/tool_cli/me`, { headers: { 'X-Api-Key': e.GSK_API_KEY } })
    if (r.status === 401 || r.status === 403) return c.json({ ok: true, connected: false, reason: '授权无效或已过期' })
    const j: any = await r.json()
    const d = j?.data && j.status ? j.data : j
    if (!d?.cogen_id && !d?.email) return c.json({ ok: true, connected: false, reason: j?.message || '授权无效' })
    return c.json({ ok: true, connected: true, user: { name: d.name, email: d.email, plan: d.plan_display || d.plan, credits: d.credit_balance }, model: model(e) })
  } catch (err: any) { return c.json({ ok: true, connected: false, reason: err.message }) }
})

// ---------- ① 行业智能归类：全网检索企业体系 → 大模型归入 97 个国标大类 ----------
ai.post('/classify', async (c) => {
  const { name } = await c.req.json<{ name: string }>()
  const n = clip(name, 60).trim(); if (!n) throw new AiError('缺少企业名称', 400)
  const sr = await tool(c.env, 'batch_web_search', { queries: [`${n} 公司简介`, `${n} 主营业务 产品`, `${n} 经营范围`] }).catch(() => null)
  const evidence = clip(sr?.result, 7000)
  const out = await llm(c.env,
    '你是国民经济行业分类（GB/T 4754-2017）专家。根据检索证据判断企业主营业务，并归入给定的大类列表。只能使用列表中的代码。输出 JSON。',
    `企业名称：${n}\n\n【全网检索证据】\n${evidence || '（无检索结果，仅凭企业名称推断）'}\n\n【可选大类】\n${DIV_TEXT}\n\n输出 JSON：{"business":"主营业务一句话","keywords":["业务关键词,最多8个"],"candidates":[{"code":"如C39","confidence":0到100整数,"reason":"20字内依据"}],"found":检索证据是否确实描述了该企业(true/false)}\ncandidates 按可能性从高到低给出 1-3 个。`)
  const cands = (out.candidates || []).map((x: any) => {
    const m = DIV_SET.get(String(x.code || '').toUpperCase().replace(/\s/g, ''))
    return m ? { ...m, conf: Math.max(1, Math.min(99, Math.round(+x.confidence || 50))), reason: clip(x.reason, 60) } : null
  }).filter(Boolean).slice(0, 3)
  return c.json({ ok: true, name: n, business: clip(out.business, 120), keywords: (out.keywords || []).slice(0, 8), found: !!out.found, cands, evidenceChars: evidence.length })
})

// ---------- ② 企业深度画像 ----------
ai.post('/profile', async (c) => {
  const b = await c.req.json<any>()
  const n = clip(b.name, 60)
  const sr = await tool(c.env, 'batch_web_search', { queries: [`${n} 公司简介 主营业务`, `${n} 客户 竞争对手 市场`, `${n} 最新动态 2026`] }).catch(() => null)
  const evidence = clip(sr?.result, 8000)
  const out = await llm(c.env,
    '你是资深商业战略顾问，擅长用商业模式画布、价值链、七域经营诊断分析企业。结论要具体、可执行，基于证据；证据不足时明确写“推断”。输出 JSON。',
    `企业：${n}\n行业：${clip(b.industry, 40)} › ${clip(b.division, 40)}\n\n【全网检索证据】\n${evidence || '（无）'}\n\n【可选部门ID】${clip(b.deptIds, 800)}\n\n输出 JSON：{
"positioning":"企业定位，60字内",
"business":"主营业务一句话，40字内",
"chain":["价值链环节，6-7个，每个≤6字"],
"domains":[{"name":"战略目标|市场获客|销售转化|交付运营|客户留存|财务现金|组织协同（固定这7个，顺序一致）","score":0-100,"note":"20字内判断依据"}],
"canvas":{"客户细分":"","价值主张":"","渠道通路":"","收入来源":"","核心资源":"","成本结构":""},
"opportunities":["4条具体的生意机会，每条≤45字"],
"risks":["3条风险，每条≤35字"],
"competitors":["主要竞争对手，最多5个"],
"leadKeywords":["用于全网找订单的检索关键词，4-6个"],
"recommendedDepts":["从可选部门ID中选择8-14个最需要的"],
"confidence":0-100（证据越充分越高）}`)
  const SEVEN = ['战略目标', '市场获客', '销售转化', '交付运营', '客户留存', '财务现金', '组织协同']
  const ds: any[] = Array.isArray(out.domains) ? out.domains : []
  out.domains = SEVEN.map((name, i) => { const d = ds.find((x) => x?.name === name) || ds[i] || {}; return { name, score: Math.max(0, Math.min(100, Math.round(+d.score || 60))), note: clip(d.note, 40) } })
  out.confidence = Math.max(10, Math.min(95, Math.round(+out.confidence || 50)))
  return c.json({ ok: true, profile: out, evidenceChars: evidence.length })
})

// ---------- ③ 商机雷达：全网检索采购/招标/需求 → 大模型分级 ----------
ai.post('/leads', async (c) => {
  const b = await c.req.json<any>()
  const kws: string[] = (b.keywords || []).filter(Boolean).slice(0, 3)
  if (!kws.length) throw new AiError('缺少检索关键词', 400)
  const results = await Promise.all(kws.flatMap((k) => [`${k} 采购公告 2026`, `${k} 招标 需求`]).slice(0, 4).map((q) => tool(c.env, 'web_search', { q }).catch(() => null)))
  const seen = new Set<string>(); const items: any[] = []
  results.forEach((r) => (r?.organic_results || []).forEach((x: any) => { if (x.link && !seen.has(x.link)) { seen.add(x.link); items.push({ title: x.title, link: x.link, snippet: x.snippet, date: x.date }) } }))
  if (!items.length) return c.json({ ok: true, leads: [], searched: 0 })
  const list = items.slice(0, 24).map((x, i) => `[${i}] ${x.title} | ${clip(x.snippet, 160)} | ${x.date || ''}`).join('\n')
  const out = await llm(c.env,
    '你是 B2B 销售情报分析师。从检索结果中挑出对该企业真正有价值的商机（采购/招标/询价/合作需求），排除新闻评论、百科、无关内容。输出 JSON。',
    `企业：${clip(b.company, 60)}（${clip(b.industry, 40)}）\n主营：${clip(b.business, 120)}\n\n【检索结果】\n${list}\n\n输出 JSON：{"leads":[{"i":序号,"grade":"A|B|C","match":0-100,"value":预估金额(元,整数,无法判断给0),"buyer":"采购方(未知写未知)","reason":"30字内为什么值得跟进","next":"20字内下一步动作"}]}\nA=高度匹配且有明确采购意向；B=相关可跟进；C=弱相关。最多 8 条，宁缺毋滥。`)
  const leads = (out.leads || []).map((l: any) => { const it = items[+l.i]; if (!it) return null; return { title: it.title, link: it.link, desc: clip(it.snippet, 200), date: it.date, grade: ['A', 'B', 'C'].includes(l.grade) ? l.grade : 'C', match: Math.round(+l.match || 50), value: Math.max(0, Math.round(+l.value || 0)), buyer: clip(l.buyer, 40), reason: clip(l.reason, 80), next: clip(l.next, 50) } }).filter(Boolean)
  return c.json({ ok: true, leads, searched: items.length })
})

// ---------- ④ 老板指令拆解 ----------
ai.post('/command', async (c) => {
  const b = await c.req.json<any>()
  const depts = (b.depts || []).map((d: any) => `${d.id}:${d.name}`).join('，')
  const out = await llm(c.env,
    '你是企业的 AI 首席运营官，把老板的一句话指令拆解成可执行、可验收的部门任务。高风险动作（追加预算、群发触达、报价签约、人事决定、对外支付、税务申报、对外发布）必须标记 needApproval=true。输出 JSON。',
    `企业：${clip(b.company, 60)}（${clip(b.industry, 40)}）\n老板指令：${clip(b.text, 300)}\n可用部门（id:名称）：${depts}${b.feedback ? `\n\n【上一轮反馈，必须据此改进拆解】\n${clip(b.feedback, 600)}` : ''}${(b.knowledge || []).length ? `\n\n【企业已沉淀的经验，拆解时遵循】\n- ${(b.knowledge || []).slice(0, 5).map((k: any) => clip(k, 80)).join('\n- ')}` : ''}\n\n输出 JSON：{"goal":"把指令改写成可衡量目标，40字内","tasks":[{"deptId":"必须是上面的id","title":"任务标题≤24字","deliverable":"交付物≤30字","sla":预计分钟(60-480),"needApproval":true/false}]}\n给 3-6 个任务，覆盖最相关的部门。`)
  const ids = new Set((b.depts || []).map((d: any) => d.id))
  const tasks = (out.tasks || []).filter((t: any) => ids.has(t.deptId)).slice(0, 6).map((t: any) => ({ deptId: t.deptId, title: clip(t.title, 40), deliverable: clip(t.deliverable, 60), sla: Math.max(60, Math.min(480, +t.sla || 180)), needApproval: !!t.needApproval }))
  return c.json({ ok: true, goal: clip(out.goal, 80), tasks })
})

// ---------- ⑤ Agent 真实执行 + 独立评测（五维） ----------
ai.post('/execute', async (c) => {
  const b = await c.req.json<any>()
  const ctx = `企业：${clip(b.company, 60)}（${clip(b.industry, 40)}）\n主营：${clip(b.business, 150)}\n部门：${clip(b.dept, 20)}\n执行Agent：${clip(b.agent, 30)}${b.goal ? `\n本任务所属指令目标：${clip(b.goal, 120)}` : ''}`
  let research = ''
  if (b.research) { const sr = await tool(c.env, 'web_search', { q: clip(`${b.company} ${b.task}`, 60) }).catch(() => null); research = (sr?.organic_results || []).slice(0, 5).map((x: any) => `- ${x.title}：${clip(x.snippet, 120)}（${x.link}）`).join('\n') }
  const output = await llm(c.env,
    `你是企业中的「${clip(b.agent, 30)}」，隶属${clip(b.dept, 20)}。产出可直接使用的工作成果（Markdown，600字以内）：结论先行、分点、带数字/步骤/责任人建议；引用外部信息要注明来源；不确定处标注“需人工确认”。不得承诺未经验证的收益；高风险动作只给建议不执行。`,
    `${ctx}\n\n任务：${clip(b.task, 200)}\n交付物：${clip(b.deliverable || '按任务要求', 80)}${(b.knowledge || []).length ? `\n\n【企业经验库，执行时遵循】\n- ${(b.knowledge || []).slice(0, 5).map((k: any) => clip(k, 80)).join('\n- ')}` : ''}${research ? `\n\n【可用的公开检索信息】\n${research}` : ''}${b.feedback ? `\n\n【上一版评测未通过，评审意见】${clip(b.feedback, 300)}\n【上一版】${clip(b.previous, 1500)}\n请针对意见改进后重新输出完整成果。` : ''}`,
    { json: false, effort: 'low' }) as string
  if (b.evaluate === false) return c.json({ ok: true, output, researched: !!research })
  const r = await evaluate(c.env, ctx, clip(b.task, 200), output)
  return c.json({ ok: true, output, ...r, researched: !!research })
})

// ---- 独立评审：另一次调用扮演质检官，按五维打分（准确30/证据20/时效15/合规15/价值20） ----
async function evaluate(e: Bindings, ctx: string, task: string, output: string) {
  const ev = await llm(e,
    '你是独立的 AI 质检官，严格评测其他 Agent 的工作成果，不偏袒。输出 JSON。',
    `${ctx}\n任务：${task}\n\n【待评测成果】\n${clip(output, 5000)}\n\n按五维打分（0-100）：acc 准确性（无事实错误/无幻觉/逻辑自洽）、evi 证据溯源（结论有依据或来源）、time 时效与完整度（是否完整回应任务）、comp 合规安全（无违规承诺、无隐私泄露、高风险动作未越权）、val 业务价值（可落地、能带来订单/降本/提效）。\n输出 JSON：{"acc":0,"evi":0,"time":0,"comp":0,"val":0,"feedback":"若需返工给出40字内具体修改意见；通过则写亮点"}`)
  const sc = (k: string) => Math.max(0, Math.min(100, Math.round(+ev[k] || 0)))
  const evals = { acc: sc('acc'), evi: sc('evi'), time: sc('time'), comp: sc('comp'), val: sc('val') }
  const total = Math.round(evals.acc * .3 + evals.evi * .2 + evals.time * .15 + evals.comp * .15 + evals.val * .2)
  return { evals, total, verdict: total >= 80 ? 'pass' : 'rework', feedback: clip(ev.feedback, 160) }
}

ai.post('/evaluate', async (c) => {
  const b = await c.req.json<any>()
  const ctx = `企业：${clip(b.company, 60)}（${clip(b.industry, 40)}）\n部门：${clip(b.dept, 20)}\n执行Agent：${clip(b.agent, 30)}`
  return c.json({ ok: true, ...(await evaluate(c.env, ctx, clip(b.task, 200), String(b.output || ''))) })
})

// ---------- 指令级验收与复盘（提升机制） ----------
ai.post('/review', async (c) => {
  const b = await c.req.json<any>()
  const results = (b.results || []).slice(0, 10).map((r: any, i: number) => `【${i + 1}】${clip(r.dept, 20)}｜${clip(r.title, 40)}｜校验${Math.round(+r.score || 0)}分｜返工${+r.rework || 0}次${r.human ? '｜人工通过' : ''}\n${clip(r.output, 700)}`).join('\n\n')
  const out = await llm(c.env,
    '你是企业的 AI 首席运营官，对一条老板指令的整体执行结果做验收与复盘：判断目标是否达成、提炼可复用经验、给出下一轮改进方向。客观、具体，不夸大。输出 JSON。',
    `企业：${clip(b.company, 60)}（${clip(b.industry, 40)}）\n老板指令：${clip(b.text, 200)}\n目标：${clip(b.goal, 120)}\n部门：${clip((b.depts || []).join('、'), 300)}\n\n【各部门交付】\n${results}\n\n输出 JSON：{"score":0-100（整体完成质量与目标贴合度）,"verdict":"achieved|partial|failed","summary":"60字内验收结论","lessons":[{"dept":"适用部门名称，通用写全局","text":"40字内可复用经验，写成下次照做的规则"}],"next":["下一轮可迭代的方向，每条30字内，1-3条"]}\nlessons 给 1-3 条。`)
  const lessons = (out.lessons || []).slice(0, 3).map((l: any) => typeof l === 'string' ? { dept: '全局', text: clip(l, 80) } : { dept: clip(l.dept || '全局', 20), text: clip(l.text, 80) }).filter((l: any) => l.text)
  return c.json({ ok: true, score: Math.max(0, Math.min(100, Math.round(+out.score || 0))), verdict: ['achieved', 'partial', 'failed'].includes(out.verdict) ? out.verdict : 'partial', summary: clip(out.summary, 120), lessons, next: (out.next || []).slice(0, 3).map((x: any) => clip(x, 60)) })
})

// ---------- ⑥ 简历解析 ----------
ai.post('/resume', async (c) => {
  const b = await c.req.json<any>()
  const out = await llm(c.env, '你是资深 HRBP，客观评估员工简历与岗位匹配度。输出 JSON。',
    `部门：${clip(b.dept, 20)}  岗位：${clip(b.pos, 30)}\n简历：${clip(b.resume, 3000)}\n\n输出 JSON：{"years":工龄整数,"skills":["技能标签,最多8个,每个≤6字"],"value":0-100岗位价值评分,"role":"建议定位(核心骨干/业务骨干/执行岗/培养对象)","strengths":"25字内优势","gaps":"25字内待提升","pairAgent":"建议协作的AI角色,10字内"}`)
  return c.json({ ok: true, ...out })
})

// ---------- ⑦ 经营日报 ----------
ai.post('/brief', async (c) => {
  const b = await c.req.json<any>()
  const text = await llm(c.env,
    '你是企业的 AI 经营参谋，给老板写当日经营简报：先给 3 句话结论，再列「今日成果」「风险与卡点」「明日重点（带负责部门）」「需要老板决策」。Markdown，500字以内，直接、具体，用数字说话；仿真数据要说明“基于平台运行数据”。',
    `企业：${clip(b.company, 60)}（${clip(b.industry, 40)}）\n运行数据：${clip(JSON.stringify(b.data), 5000)}`, { json: false, effort: 'low' })
  return c.json({ ok: true, text })
})

// ---------- ⑧ 营销文案 ----------
ai.post('/copy', async (c) => {
  const b = await c.req.json<any>()
  const out = await llm(c.env, '你是品牌营销文案专家，遵守《广告法》，不使用“最、第一、国家级、100%”等绝对化用语。输出 JSON。',
    `企业：${clip(b.company, 60)}（${clip(b.industry, 40)}）\n主营：${clip(b.business, 120)}\n主题：${clip(b.theme, 40)}\n输出 JSON：{"title":"主标题≤12字","sub":"副标题≤22字","cta":"行动号召≤8字","imagePrompt":"用于AI生成海报背景图的英文画面描述，不含任何文字，40词内","videoPrompt":"用于AI生成5秒宣传短视频的英文镜头描述，50词内","post":"适合小红书/朋友圈的推广文案，120字内"}`)
  return c.json({ ok: true, ...out })
})

// ---------- ⑨ 海报图 / 宣传视频（Genspark 生成模型） ----------
ai.post('/image', async (c) => {
  const b = await c.req.json<any>()
  const d = await tool(c.env, 'image_generation', { query: clip(b.prompt, 600) + ', no text, no letters, no watermark', aspect_ratio: b.aspect || '3:4' })
  const g = d?.generated_images?.[0]; const u = g?.image_urls?.[0]
  if (!u) throw new AiError('图片生成失败', 502)
  return c.json({ ok: true, url: fileUrl(u), credits: g.estimated_credits ?? null, model: g.model })
})
ai.post('/video', async (c) => {
  const b = await c.req.json<any>()
  const d = await tool(c.env, 'video_generation', { query: clip(b.prompt, 600), model: 'minimax/h3-lite', duration: 5, aspect_ratio: b.aspect || '9:16', video_size: '480p' })
  const v = d?.generated_videos?.[0]; const u = v?.video_urls?.[0]
  if (!u) throw new AiError(v?.failure_reason || '视频生成失败', 502)
  return c.json({ ok: true, url: fileUrl(u), poster: v.poster_urls?.[0] ? fileUrl(v.poster_urls[0]) : null, model: v.model })
})

// ---------- ⑩ Genspark 超级智能体（深度任务，异步） ----------
ai.post('/agent', async (c) => {
  const b = await c.req.json<any>()
  const d = await tool(c.env, 'create_task', {
    task_type: 'super_agent', task_name: clip(b.name || '企业智脑深度任务', 40),
    query: clip(b.query, 3000),
    instructions: clip(b.instructions || '你在为一家企业的老板执行深度任务。先检索事实再下结论，注明来源；输出结构化、可执行的中文成果；不要承诺未经验证的收益。', 1500),
  })
  return c.json({ ok: true, runId: d.run_id, state: d.run_status || d.status })
})
ai.get('/agent/status', async (c) => {
  const id = c.req.query('id') || ''
  if (!/^sb_task_run::[\w:-]+$/.test(id)) throw new AiError('无效的任务ID', 400)
  const s = await tool(c.env, 'task_status', { project_id: id })
  let result: any = null
  if (s.state === 'succeeded' && s.project_id) {
    const info = await tool(c.env, 'task_info', { project_id: s.project_id }).catch(() => null)
    const rc = info?.result_content
    const msgs = (info?.recent_activity || []).filter((m: any) => m.role === 'assistant' && m.content)
    result = { text: clip(rc?.content ? rc.content.slice(1).join('\n\n') : msgs.map((m: any) => m.content).join('\n\n'), 12000), file: rc?.file_name || '', hasError: !!rc?.has_error }
  }
  return c.json({ ok: true, state: s.state, taskUrl: s.task_url, projectId: s.project_id, result })
})

// ---------- 文件代理：Genspark 文件需授权访问，由服务端换取临时地址后转发 ----------
ai.get('/file', async (c) => {
  const u = c.req.query('u') || ''
  if (!/^https:\/\/www\.genspark\.ai\/api\/files\/s\/[\w-]+$/.test(u)) return c.text('bad url', 400)
  const d = await tool(c.env, 'file/download', { file_wrapper_url: u })
  const r = await fetch(d.download_url)
  if (!r.ok || !r.body) return c.text('file unavailable', 502)
  return new Response(r.body, { headers: { 'Content-Type': r.headers.get('Content-Type') || d.content_type || 'application/octet-stream', 'Cache-Control': 'private, max-age=3000' } })
})

export default ai
