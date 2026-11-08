// 企业智脑 · Genspark 能力代理层
// 所有调用都使用企业主本人的 Genspark 授权（GSK_API_KEY，仅存于服务端 Secret / .dev.vars），
// 前端永远拿不到密钥。底层与 `gsk` CLI 走同一套接口：/api/tool_cli/<tool> 与 /api/llm_proxy/v1。
import { Hono } from 'hono'
import { DIVISIONS } from './industries'

type Bindings = { GSK_API_KEY?: string; GSK_BASE_URL?: string; AI_MODEL?: string; DB?: D1Database; IDEA_MAIL_FROM?: string; IDEA_MAIL_REDIRECT?: string; IDEA_MAIL_LIVE?: string; BRAIN_ACCESS_CODE?: string }
import { matchCompany } from './idea-util'
const ai = new Hono<{ Bindings: Bindings }>()

const base = (e: Bindings) => (e.GSK_BASE_URL || 'https://www.genspark.ai').replace(/\/$/, '')
// Ultra 推理引擎：所有智能体输出默认使用 Genspark 顶级模型 + high 推理深度（可在后台「大师智库」切换引擎）
const ENGINES: Record<string, string> = { 'gpt-5.5': 'GPT-5.5 Ultra', 'claude-opus-5-5': 'Claude Opus 5.5 Ultra', 'gpt-6.1-sol': 'GPT-6.1 Sol Ultra', 'gpt-6-astra': 'GPT-6 Astra Ultra' }
const model = (e: Bindings) => (e.AI_MODEL && ENGINES[e.AI_MODEL]) ? e.AI_MODEL : 'gpt-5.5'
const MODEL_RE = /^[a-z0-9][a-z0-9.\-]{1,60}$/i
// 模型由前端「模型配置中心」按角色选择（列表来自 Genspark CLI 同一接口实时读取），这里只做格式校验
const eng = (b: any, e: Bindings) => (b && typeof b.engine === 'string' && MODEL_RE.test(b.engine)) ? b.engine : model(e)
const eff = (b: any) => ['medium', 'high', 'xhigh'].includes(b?.effort) ? b.effort : 'high'

class AiError extends Error { constructor(msg: string, public code = 500) { super(msg) } }

// ---- 调用 Genspark 工具（与 gsk CLI 同协议：NDJSON 流，最后一行带 status） ----
async function tool(e: Bindings, name: string, args: Record<string, unknown>) {
  if (!e.GSK_API_KEY) throw new AiError('未配置 AI 授权（GSK_API_KEY）', 503)
  const r = await fetch(`${base(e)}/api/tool_cli/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': e.GSK_API_KEY, 'X-GSK-CLI-Version': 'enterprise-brain/1.0' },
    body: JSON.stringify(args),
  })
  const text = await r.text()
  if (r.status === 401 || r.status === 403) throw new AiError('AI 授权无效或已过期', 401)
  if (r.status === 429) throw new AiError('AI 调用过于频繁，请稍后再试', 429)
  let final: any = null
  for (const line of text.trim().split('\n')) {
    const l = line.trim(); if (!l.startsWith('{')) continue
    try { const j = JSON.parse(l); if (j.status || j.version === undefined) final = j } catch { }
  }
  if (!final) throw new AiError(`AI 工具 ${name} 无返回（HTTP ${r.status}）`, 502)
  if (final.status !== 'ok') throw new AiError(final.message || `AI 工具 ${name} 调用失败`, 502)
  return final.data
}

// ---- 调用大模型（Genspark LLM 代理，同一授权） ----
async function llm(e: Bindings, system: string, user: string, opt: { json?: boolean; effort?: string; model?: string } = {}) {
  if (!e.GSK_API_KEY) throw new AiError('未配置 AI 授权（GSK_API_KEY）', 503)
  const body: any = { model: opt.model || model(e), messages: [{ role: 'system', content: system }, { role: 'user', content: user }], reasoning_effort: (opt.effort && opt.effort !== 'low') ? opt.effort : 'high' }
  if (opt.json !== false && !String(body.model).startsWith('claude')) body.response_format = { type: 'json_object' }
  // 一律流式读取：Ultra 深度推理耗时较长，上游对非流式请求约 120s 超时
  body.stream = true
  const r = await fetch(`${base(e)}/api/llm_proxy/v1/chat/completions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${e.GSK_API_KEY}` }, body: JSON.stringify(body),
  })
  if (r.status === 401 || r.status === 403) throw new AiError('AI 授权无效或已过期', 401)
  if (!r.ok) throw new AiError(`大模型调用失败（HTTP ${r.status}）`, 502)
  let content = ''
  if (body.stream && r.body) {
    const reader = r.body.getReader(), dec = new TextDecoder(); let buf = ''
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      buf += dec.decode(value, { stream: true })
      let i; while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1)
        if (!line.startsWith('data:')) continue
        const d = line.slice(5).trim(); if (d === '[DONE]') continue
        try { const j = JSON.parse(d); content += j?.choices?.[0]?.delta?.content || '' } catch { }
      }
    }
    if (!content) throw new AiError('大模型未返回内容', 502)
    if (opt.json === false) return content
    try { return JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, '')) } catch {
      const m = content.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]) } catch { } }
      throw new AiError('大模型返回格式异常', 502)
    }
  }
  const j: any = await r.json()
  content = j?.choices?.[0]?.message?.content || ''
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
    return c.json({ ok: true, connected: true, user: { name: d.name, email: d.email, plan: d.plan_display || d.plan, credits: d.credit_balance }, model: model(e), engines: ENGINES })
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
    '你是企业的 AI 首席运营官，把老板的一句话指令拆解成可执行、可验收、结果导向的部门任务。每个任务要写清楚具体交付物（文件/清单/方案/测算表等）。按难度指定所需能力级别：std 一般级（信息整理、清单执行）、master 大师级（专业分析、方案设计、测算）、leader 超级领袖级（战略决策、跨部门统筹、重大商业判断）。高风险动作（追加预算、群发触达、报价签约、人事决定、对外支付、税务申报、对外发布）必须标记 needApproval=true。输出 JSON。',
    `企业：${clip(b.company, 60)}（${clip(b.industry, 40)}）\n老板指令：${clip(b.text, 300)}\n可用部门（id:名称）：${depts}${b.feedback ? `\n\n【上一轮反馈，必须据此改进拆解】\n${clip(b.feedback, 600)}` : ''}${(b.knowledge || []).length ? `\n\n【企业已沉淀的经验，拆解时遵循】\n- ${(b.knowledge || []).slice(0, 5).map((k: any) => clip(k, 80)).join('\n- ')}` : ''}\n\n输出 JSON：{"goal":"把指令改写成可衡量目标，40字内","tasks":[{"deptId":"必须是上面的id","title":"任务标题≤24字","deliverable":"交付物≤30字","sla":预计分钟(60-480),"needApproval":true/false}]}\n给 3-6 个任务，覆盖最相关的部门。`)
  const ids = new Set((b.depts || []).map((d: any) => d.id))
  const tasks = (out.tasks || []).filter((t: any) => ids.has(t.deptId)).slice(0, 6).map((t: any) => ({ deptId: t.deptId, title: clip(t.title, 40), deliverable: clip(t.deliverable, 60), sla: Math.max(60, Math.min(480, +t.sla || 180)), needApproval: !!t.needApproval, level: ['std', 'master', 'leader'].includes(t.level) ? t.level : 'master' }))
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
    `企业：${clip(b.company, 60)}（${clip(b.industry, 40)}）\n老板指令：${clip(b.text, 200)}\n目标：${clip(b.goal, 120)}\n部门：${clip((b.depts || []).join('、'), 300)}${b.decision ? `\n\n【老板决策】选定方案 ${clip(b.decision.option, 40)}${b.decision.recommended && b.decision.recommended !== b.decision.key ? `（AI 推荐的是 ${clip(b.decision.recommended, 10)}）` : '（与 AI 推荐一致）'}；可行性校验 ${+b.decision.feasibility || 0} 分\n量化目标：${(b.targets || []).slice(0, 6).map((t: any) => `${clip(t.kpi, 30)}→${clip(t.target, 40)}`).join('；')}` : ''}\n\n【各部门交付】\n${results}\n\n输出 JSON：{"score":0-100（整体完成质量与目标贴合度）,"verdict":"achieved|partial|failed","summary":"60字内验收结论","lessons":[{"dept":"适用部门名称，通用写全局","text":"40字内可复用经验，写成下次照做的规则"}],"next":["下一轮可迭代的方向，每条30字内，1-3条"],"decision":{"score":0-100（老板这次决策的质量与见效度：所选方案是否被各部门成果有效承接、目标是否有可执行路径）,"effect":"决策带来的可见结果，≤60字","gap":"距离目标还差什么，≤50字","nextDecision":"老板下一步最该拍板的一件事，≤40字"}}\nlessons 给 1-3 条。`, { model: eng(b, c.env), effort: eff(b) })
  const lessons = (out.lessons || []).slice(0, 3).map((l: any) => typeof l === 'string' ? { dept: '全局', text: clip(l, 80) } : { dept: clip(l.dept || '全局', 20), text: clip(l.text, 80) }).filter((l: any) => l.text)
  return c.json({ ok: true, score: Math.max(0, Math.min(100, Math.round(+out.score || 0))), verdict: ['achieved', 'partial', 'failed'].includes(out.verdict) ? out.verdict : 'partial', summary: clip(out.summary, 120), lessons, next: (out.next || []).slice(0, 3).map((x: any) => clip(x, 60)), decision: out.decision ? { score: Math.max(0, Math.min(100, Math.round(+out.decision.score || 0))), effect: clip(out.decision.effect, 120), gap: clip(out.decision.gap, 100), nextDecision: clip(out.decision.nextDecision, 80) } : null })
})


// =====================================================================
// 分级执行管线：规划 → 调用工具（决策调用库）→ 撰写 → 独立验收。每一步由前端记录到执行表。
// =====================================================================
const TIER: Record<string, { name: string; calls: number; read: number; words: number; crit: number; pass: number; tools: string[]; rule: string }> = {
  std: { name: '一般级', calls: 2, read: 1, words: 1400, crit: 3, pass: 80, tools: ['search', 'crawl'],
    rule: '执行级成果：可直接照做的步骤表（动作/负责人/时间/产出/验收口径），信息准确完整，附 1 张执行清单表。' },
  master: { name: '大师级', calls: 3, read: 2, words: 2200, crit: 4, pass: 83, tools: ['search', 'batch', 'crawl', 'imgsearch'],
    rule: '专业方法论驱动：显式使用与任务匹配的框架（如 AARRR、4P/4C、销售漏斗、波特五力、价值链、RFM、TCO 比价、STAR 面试法等），至少 2 张数据测算/对比表，给出 2 个方案的取舍理由。' },
  leader: { name: '超级领袖级', calls: 5, read: 3, words: 3000, crit: 5, pass: 86, tools: ['search', 'batch', 'crawl', 'imgsearch', 'image', 'doc'],
    rule: '战略级决策成果：SCQA 结论先行；3 个可选方案对比（投入/收益/风险/周期）并明确推荐；ROI 或单位经济测算表（写明口径与假设）；风险矩阵与对冲动作；30/60/90 天里程碑（负责人+量化目标）；列出需要老板拍板的关键决策点。' },
}
const TOOL_DESC: Record<string, string> = {
  search: 'search：全网检索，1 个关键词（返回标题/摘要/链接）',
  batch: 'batch：多路并行检索，queries 填 2-4 个关键词',
  crawl: 'crawl：深读网页正文（系统会自动对检索结果中最相关的页面执行，不要写进 calls）',
  imgsearch: 'imgsearch：图片检索，找参考视觉/竞品物料',
  image: 'image：AI 生成图片（海报/视觉稿），query 写英文画面描述，不含文字',
  doc: 'doc：长文档/PDF 深度分析，需要 url 与 query(问题)',
}
const tierOf = (k: string) => TIER[k] || TIER.std
const allowTools = (tier: string, tools: unknown) => { const t = tierOf(tier); const want = Array.isArray(tools) && tools.length ? tools.map(String) : t.tools; return want.filter((x) => t.tools.includes(x)) }
const lines = (x: unknown, n = 6, w = 80) => (Array.isArray(x) ? x : []).slice(0, n).map((v) => clip(v, w)).filter(Boolean)
// 大师身份：每个部门智能体都以「行业 × 部门」顶级专家身份思考；思维方式与边界可由老板在后台调整
function personaBlock(b: any) {
  const P = b.persona || {}
  const rules = [...lines(P.boundaries, 8), ...lines(b.rules, 8)]
  return `【你的专业身份】${clip(P.title || `${b.dept || ''}专家`, 30)}「${clip(P.name || '', 12)}」${P.motto ? `——${clip(P.motto, 40)}` : ''}
${lines(P.resume, 5).length ? `【履历】\n- ${lines(P.resume, 5).join('\n- ')}\n` : ''}${lines(P.thinking, 6).length ? `【你的思维方式（按此顺序思考）】\n${lines(P.thinking, 6).map((x, i) => `${i + 1}. ${x}`).join('\n')}\n` : ''}${lines(P.frameworks, 8, 30).length ? `【惯用方法论】${lines(P.frameworks, 8, 30).join('、')}\n` : ''}${P.style ? `【表达风格】${clip(P.style, 80)}\n` : ''}${rules.length ? `【必须遵守的边界（红线，违反即不合格）】\n- ${rules.join('\n- ')}\n` : ''}【协作关系】你是${clip(b.company, 60)}${clip(b.dept, 20)}的首席智能体，协助负责人 ${clip(b.owner || '部门负责人', 10)}（${clip(b.pos || '', 20)}，${tierOf(b.tier).name}能力）完成任务。`
}
const persona = (b: any) => `${clip(b.persona?.title || (b.dept || '') + '专家', 30)}「${clip(b.persona?.name || '', 12)}」`
const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10)
const ctxOf = (b: any) => `当前日期：${today()}（检索与时间表述以此为准，优先近 12 个月信息）\n企业：${clip(b.company, 60)}（${clip(b.industry, 40)}）\n主营：${clip(b.business, 150)}\n部门：${clip(b.dept, 20)}${b.goal ? `\n所属老板指令目标：${clip(b.goal, 300)}` : ''}${b.strategy ? `\n【公司级发展规划（已经可行性校验与老板确认，部门成果必须与之一致）】\n${clip(b.strategy, 900)}` : ''}`

ai.post('/task/plan', async (c) => {
  const b = await c.req.json<any>()
  const T = tierOf(b.tier), tools = allowTools(b.tier, b.tools)
  const callable = tools.filter((x) => x !== 'crawl')
  const out = await llm(c.env,
    `${personaBlock(b)}\n\n你以「${T.name}」水准完成任务，先做执行规划：抓住任务本质 → 选定方法论框架 → 制定可量化、可核验的验收标准 → 规划需要调用的 AI 工具。验收标准必须包含数字、数量、格式或明确的判定条件，禁止“全面、深入、有效”这类无法核验的措辞。输出 JSON。`,
    `${ctxOf(b)}\n\n任务：${clip(b.task, 200)}\n交付物：${clip(b.deliverable, 120)}\n能力级别要求：${T.rule}\n\n【可用工具（决策调用库）】\n${tools.map((x) => '- ' + TOOL_DESC[x]).join('\n') || '（无外部工具，仅凭专业知识）'}\n工具调用上限：${T.calls} 次${(b.knowledge || []).length ? `\n\n【企业经验库】\n- ${(b.knowledge || []).slice(0, 5).map((k: any) => clip(k, 80)).join('\n- ')}` : ''}${b.feedback ? `\n\n【上一轮验收未通过，问题】${clip(b.feedback, 400)}` : ''}\n\n输出 JSON：{"understanding":"任务本质与成功标志，50字内","framework":"采用的方法论/框架及用法，60字内","criteria":[{"text":"可量化验收标准，30字内"}],"calls":[{"tool":"${callable.join('|') || 'none'}","query":"关键词或画面描述","queries":["batch 时填"],"url":"doc 时填","why":"15字内"}],"read":需要深读的网页数(0-${T.read}),"outline":["成果章节标题，4-7个"]}\n验收标准正好 ${T.crit} 条；calls 不超过 ${T.calls} 个，检索词要具体（含行业、地区、年份、产品等），不需要外部信息时 calls 为空数组。`,
    { model: eng(b, c.env), effort: eff(b) })
  const calls = (Array.isArray(out.calls) ? out.calls : []).filter((x: any) => callable.includes(x?.tool)).slice(0, T.calls).map((x: any) => ({ tool: x.tool, query: clip(x.query, 120), queries: (x.queries || []).slice(0, 4).map((q: any) => clip(q, 60)), url: clip(x.url, 400), why: clip(x.why, 40) }))
  const criteria = (out.criteria || []).slice(0, T.crit).map((x: any) => clip(typeof x === 'string' ? x : x.text, 80)).filter(Boolean)
  return c.json({ ok: true, tier: b.tier, model: eng(b, c.env), understanding: clip(out.understanding, 120), framework: clip(out.framework, 140), criteria, calls, read: tools.includes('crawl') ? Math.max(0, Math.min(T.read, +out.read || 0)) : 0, outline: (out.outline || []).slice(0, 8).map((x: any) => clip(x, 30)) })
})

function parseBatch(text: string) {
  const out: any[] = []; const re = /##\s*(.+?)\n-\s*Snippet:\s*([\s\S]*?)\n-\s*URL_\d+:\s*(\S+)/g; let m
  while ((m = re.exec(text))) out.push({ title: m[1].trim(), snippet: clip(m[2].trim(), 220), url: m[3].trim() })
  return out
}
ai.post('/task/tool', async (c) => {
  const b = await c.req.json<any>()
  const tools = allowTools(b.tier, b.tools)
  if (!tools.includes(b.tool)) throw new AiError(`「${tierOf(b.tier).name}」无权调用工具 ${b.tool}`, 403)
  const t0 = Date.now()
  let sources: any[] = [], text = '', images: any[] = [], summary = ''
  if (b.tool === 'search') {
    const d = await tool(c.env, 'web_search', { q: clip(b.query, 120) })
    sources = (d?.organic_results || []).slice(0, 6).map((x: any) => ({ title: clip(x.title, 100), url: x.link, snippet: clip(x.snippet, 220), date: x.date || '' }))
    summary = `检索「${clip(b.query, 30)}」→ ${sources.length} 条结果`
  } else if (b.tool === 'batch') {
    const qs = (b.queries?.length ? b.queries : [b.query]).filter(Boolean).slice(0, 4).map((q: any) => clip(q, 60))
    const d = await tool(c.env, 'batch_web_search', { queries: qs.length > 1 ? qs : [...qs, qs[0] + ' 2026'] })
    const seen = new Set<string>(); sources = parseBatch(String(d?.result || '')).filter((x) => !seen.has(x.url) && seen.add(x.url)).slice(0, 10)
    summary = `多路检索 ${qs.length} 个关键词 → ${sources.length} 条结果`
  } else if (b.tool === 'crawl') {
    if (!/^https?:\/\//.test(b.url || '')) throw new AiError('缺少网页地址', 400)
    const d = await tool(c.env, 'crawler', { url: b.url })
    text = clip(String(d?.result || '').replace(/\n{3,}/g, '\n\n'), 4500)
    sources = [{ title: clip(b.title || b.url, 100), url: b.url, snippet: clip(text.replace(/\s+/g, ' '), 220) }]
    summary = `深读网页 ${text.length} 字`
  } else if (b.tool === 'imgsearch') {
    const d = await tool(c.env, 'image_search', { query: clip(b.query, 80) })
    images = (Array.isArray(d) ? d : d?.images || []).slice(0, 4).map((x: any) => ({ url: x.image_url, title: clip(x.title, 60), link: x.link }))
    sources = images.map((x) => ({ title: x.title, url: x.link || x.url, snippet: '参考图片' }))
    summary = `图片检索 → ${images.length} 张参考图`
  } else if (b.tool === 'image') {
    const d = await tool(c.env, 'image_generation', { query: clip(b.query, 500) + ', professional commercial design, no text, no watermark', aspect_ratio: '3:4' })
    const u = d?.generated_images?.[0]?.image_urls?.[0]; if (!u) throw new AiError('图片生成失败', 502)
    images = [{ url: fileUrl(u), title: 'AI 生成视觉稿' }]; summary = 'AI 生成视觉稿 1 张'
  } else if (b.tool === 'doc') {
    const d = await tool(c.env, 'summarize_large_document', { url: b.url, question: clip(b.query, 200) })
    text = clip(String(d?.result || d?.answer || JSON.stringify(d)), 4000); sources = [{ title: '长文档分析', url: b.url, snippet: clip(text, 200) }]; summary = `长文档分析 ${text.length} 字`
  } else throw new AiError('未知工具', 400)
  return c.json({ ok: true, tool: b.tool, summary, sources, text, images, ms: Date.now() - t0 })
})

ai.post('/task/produce', async (c) => {
  const b = await c.req.json<any>()
  const T = tierOf(b.tier)
  const ev = (b.evidence || []).slice(0, 14).map((x: any, i: number) => `[${i + 1}] ${clip(x.title, 80)}（${clip(x.url, 200)}）\n${clip(x.text || x.snippet, 1500)}`).join('\n\n')
  const imgs = (b.images || []).slice(0, 3).map((x: any) => `![${clip(x.title, 20)}](${x.url})`).join('\n')
  const output = await llm(c.env,
    `${personaBlock(b)}\n\n你的工作以结果为导向：交付物要能直接拿去执行，或让老板据此拍板。
硬性要求：
1. 开头写「## 结论」：3 行以内给出核心判断和关键数字。
2. 逐条满足【验收标准】，文末附「## 验收对照表」（| 标准 | 完成情况 | 所在章节 |）。
3. 事实与数据只能来自【证据包】或公认的行业基准；引用证据时在句末标注 [n]，文末「## 来源」列出 [n] 标题 + URL；没有证据支撑的数字标注「估算」并写明测算口径。
4. 不写空话套话（如“加强管理”“提升效率”“多措并举”“持续优化”）。每条建议都要写清：动作、负责岗位、时间、量化目标。
5. 用 Markdown：二级/三级标题、编号列表、表格。
6. 能力级别要求：${T.rule}
7. 篇幅不超过 ${T.words} 字。高风险动作（报价签约、投放预算、对外发布、人事、支付）只写方案与审批要点，不能声称已经执行。`,
    `${ctxOf(b)}\n\n任务：${clip(b.task, 200)}\n交付物：${clip(b.deliverable, 120)}\n方法论框架：${clip(b.framework, 160)}\n成果章节：${(b.outline || []).map((x: any) => clip(x, 30)).join(' / ')}\n\n【验收标准】\n${(b.criteria || []).map((x: any, i: number) => `${i + 1}. ${clip(x, 80)}`).join('\n')}${(b.knowledge || []).length ? `\n\n【企业经验库（必须遵循）】\n- ${(b.knowledge || []).slice(0, 5).map((k: any) => clip(k, 80)).join('\n- ')}` : ''}\n\n【证据包】\n${ev || '（本任务未调用外部工具，仅基于专业知识；具体数字须标注估算）'}${imgs ? `\n\n【可嵌入成果的视觉稿】\n${imgs}` : ''}${b.feedback ? `\n\n【上一版验收未通过——必须逐条修正】\n${clip(b.feedback, 600)}\n【上一版成果】\n${clip(b.previous, 2500)}` : ''}`,
    { json: false, model: eng(b, c.env), effort: eff(b) }) as string
  return c.json({ ok: true, output, model: eng(b, c.env), chars: output.length })
})

ai.post('/task/accept', async (c) => {
  const b = await c.req.json<any>()
  const T = tierOf(b.tier)
  const crit: string[] = (b.criteria || []).slice(0, 6).map((x: any) => clip(x, 80))
  const out = await llm(c.env,
    `你是独立验收官，不偏袒执行方。执行方的专业身份是${persona(b)}，其边界：${[...lines(b.persona?.boundaries, 8), ...lines(b.rules, 8)].join('；') || '无'}；违反边界的条目判为 miss。` + '逐条按验收标准核对成果，并引用成果原文作为证据；核对引用标注 [n] 是否在来源列表中。没有来源、也没标注「估算」的具体数据，算作准确性问题。空话套话扣业务价值分。输出 JSON。',
    `${ctxOf(b)}\n任务：${clip(b.task, 200)}\n能力级别：${T.name}（${T.rule}）\n\n【验收标准】\n${crit.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\n【可用来源数】${+b.sources || 0}\n\n【待验收成果】\n${clip(b.output, 9000)}\n\n输出 JSON：{"items":[{"i":标准序号,"status":"met|partial|miss","evidence":"引用成果原文，50字内","note":"判定理由，30字内"}],"acc":0-100,"evi":0-100,"time":0-100,"comp":0-100,"val":0-100,"feedback":"未通过时给出具体修改清单，120字内；通过时写亮点，60字内"}\n维度：acc 准确性；evi 证据溯源；time 完整度；comp 合规安全；val 业务价值（可落地、能带来订单/降本/提效）。`,
    { model: eng(b, c.env), effort: eff(b) })
  const sc = (k: string) => Math.max(0, Math.min(100, Math.round(+out[k] || 0)))
  const evals = { acc: sc('acc'), evi: sc('evi'), time: sc('time'), comp: sc('comp'), val: sc('val') }
  const items = crit.map((text, i) => { const it = (out.items || []).find((x: any) => +x.i === i + 1) || (out.items || [])[i] || {}; return { text, status: ['met', 'partial', 'miss'].includes(it.status) ? it.status : 'miss', evidence: clip(it.evidence, 100), note: clip(it.note, 60) } })
  const met = items.filter((x) => x.status === 'met').length, partial = items.filter((x) => x.status === 'partial').length, miss = items.length - met - partial
  const dim = evals.acc * .3 + evals.evi * .2 + evals.time * .15 + evals.comp * .15 + evals.val * .2
  const critScore = items.length ? (met + partial * .5) / items.length * 100 : dim
  const total = Math.round(dim * .6 + critScore * .4)
  const pass = total >= T.pass && miss === 0
  return c.json({ ok: true, evals, items, met, partial, miss, total, pass, threshold: T.pass, feedback: clip(out.feedback, 240) })
})


// =====================================================================
// 大师智库：为每个部门生成「行业 × 部门」大师身份（姓名 / 履历 / 思维方式 / 方法论 / 边界）
// =====================================================================
ai.post('/persona/batch', async (c) => {
  const b = await c.req.json<any>()
  const depts = (b.depts || []).slice(0, 24).map((d: any) => `${d.id}｜${clip(d.name, 20)}｜KPI：${clip((d.kpi || []).join('、'), 60)}｜职责：${clip((d.tasks || []).slice(0, 4).join('、'), 80)}`).join('\n')
  const out = await llm(c.env,
    '你是顶级猎头与组织设计专家，为企业的每个部门配置一位「行业 × 部门」顶级大师作为首席智能体。大师要有鲜明的专业身份、可信的履历（虚构人物，但符合行业真实职业路径，不冒用真实名人）、可执行的思维方式和清晰的工作边界。输出 JSON。',
    `企业：${clip(b.company, 60)}\n行业：${clip(b.industry, 60)}\n主营：${clip(b.business, 150)}\n\n【部门（id｜名称｜KPI｜职责）】\n${depts}\n\n为每个部门输出一位大师，JSON：{"personas":[{"deptId":"必须与上面 id 一致","title":"如「零售业营销大师」：行业简称+部门专业+大师，≤12字","name":"中文姓名","motto":"一句话信条，≤20字","resume":["3-4 条履历，每条≤40字，含年限/规模/代表战绩数字"],"thinking":["4-5 步思维方式，每步≤30字，体现该行业该岗位的专业思考顺序"],"frameworks":["4-6 个惯用方法论/模型名"],"style":"表达风格，≤30字","boundaries":["3-4 条工作边界/红线，每条≤30字，如合规、数据口径、权限"],"kpis":["该大师对结果负责的 3 个量化指标"]}]}`,
    { model: eng(b, c.env), effort: eff(b) })
  const ids = new Set((b.depts || []).map((d: any) => d.id))
  const personas = (out.personas || []).filter((p: any) => ids.has(p.deptId)).map((p: any) => ({
    deptId: p.deptId, title: clip(p.title, 20), name: clip(p.name, 8), motto: clip(p.motto, 40), resume: lines(p.resume, 4, 60), thinking: lines(p.thinking, 5, 50),
    frameworks: lines(p.frameworks, 6, 24), style: clip(p.style, 60), boundaries: lines(p.boundaries, 4, 50), kpis: lines(p.kpis, 3, 30) }))
  return c.json({ ok: true, personas, model: eng(b, c.env) })
})

// =====================================================================
// 部门汇报材料：Word（成果文档）+ Excel（数据表）+ 创意 PPT（AI 生成幻灯片）
// =====================================================================
ai.post('/task/package', async (c) => {
  const b = await c.req.json<any>()
  const n = Math.max(3, Math.min(8, +b.slides || 4))
  const out = await llm(c.env,
    `${personaBlock(b)}\n\n你同时是顶级商业演示设计师（麦肯锡式结构 + 发布会级视觉），要把已通过验收的成果，整理成向老板汇报用的三件套：Excel 数据表 + 创意 PPT 的逐页设计。
PPT 设计原则：金字塔原理（结论先行，每页只讲一个观点，标题就是结论句）；SCQA 叙事线（情境→冲突→答案→行动）；每页要有一个与内容强相关、让人一眼记住的视觉隐喻；数字要大、文字要少；最后一页必须是老板需要拍板的决策项。数据必须与成果一致，不得新增成果中没有的事实；成果中标注“估算”的数据在表格备注里继续标注估算。输出 JSON。`,
    `${ctxOf(b)}\n任务：${clip(b.task, 200)}\n交付物：${clip(b.deliverable, 120)}\n\n【验收标准】\n${lines(b.criteria, 6).map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\n【已验收成果（Markdown）】\n${clip(b.output, 9000)}\n\n输出 JSON：{
"doc":{"title":"Word 文档标题，≤24字","subtitle":"副标题，≤30字","summary":"给老板的 3 句话摘要"},
"sheets":[{"name":"工作表名≤12字","title":"表标题","columns":["列名"],"rows":[["单元格，数值用数字类型"]],"note":"数据口径/来源/估算说明"}],
"slides":[{"layout":"cover|insight|data|plan|risk|close","title":"页标题≤14字","subtitle":"≤22字，可空","points":["页面上展示的要点，最多3条，每条≤14字"],"speaker":"讲稿，≤150字","visual":"画面创意：视觉隐喻/插画/图表类型与内容，≤80字","art":"给图像模型的美术指导：构图、主体位置、配色、光影、风格、文字排版位置，≤120字"}]
}
要求：sheets 2-4 张——必须包含成果中的核心数据表，并有一张「行动计划」表（列：动作/负责岗位/开始/完成/量化目标/状态）；每张表 3-30 行。slides 正好 ${n} 页：第 1 页 cover（部门汇报封面），中间页覆盖核心结论、关键数据、行动计划，最后一页 close（需要老板拍板的事项）；每页 points 必须是成果中的真实数字或结论。`,
    { model: eng(b, c.env), effort: eff(b) })
  const cell = (v: any) => (typeof v === 'number' && isFinite(v)) ? v : clip(v, 200)
  const sheets = (out.sheets || []).slice(0, 4).map((sh: any, i: number) => {
    const cols = lines(sh.columns, 12, 30); const w = Math.max(1, cols.length)
    return { name: clip(sh.name || `表${i + 1}`, 12).replace(/[\\/?*[\]:]/g, ''), title: clip(sh.title, 40), columns: cols, rows: (sh.rows || []).slice(0, 60).map((r: any) => (Array.isArray(r) ? r : [r]).slice(0, w).map(cell)), note: clip(sh.note, 200) }
  }).filter((sh: any) => sh.columns.length && sh.rows.length)
  const slides = (out.slides || []).slice(0, n).map((sl: any) => ({ layout: clip(sl.layout || 'insight', 10), title: clip(sl.title, 20), subtitle: clip(sl.subtitle, 30), points: lines(sl.points, 3, 18), speaker: clip(sl.speaker, 300), visual: clip(sl.visual, 160), art: clip(sl.art, 300) }))
  return c.json({ ok: true, doc: { title: clip(out.doc?.title || b.task, 40), subtitle: clip(out.doc?.subtitle, 50), summary: clip(out.doc?.summary, 300) }, sheets, slides, model: eng(b, c.env) })
})
const SLIDE_MODELS: Record<string, { name: string; credits: number }> = { 'gpt-image-2': { name: 'GPT Image 2', credits: 30 }, 'gpt-image-2.5': { name: 'GPT Image 2.5', credits: 30 }, 'nano-banana-2.1': { name: 'Nano Banana 2.1', credits: 19 } }
const IMG_RE = /^[a-z0-9][a-z0-9.\-/]{1,60}$/i
ai.post('/task/slide', async (c) => {
  const b = await c.req.json<any>()
  const m = typeof b.model === 'string' && IMG_RE.test(b.model) ? b.model : 'gpt-image-2'
  const sl = b.slide || {}
  const pts = lines(sl.points, 3, 18)
  const kind = ({ cover: '封面页：大标题居中或左对齐，强烈的主视觉', insight: '洞察页：一个核心结论 + 视觉隐喻插画', data: '数据页：用大号数字卡片或简洁信息图呈现要点', plan: '计划页：时间轴/路线图样式呈现要点', risk: '风险页：矩阵或盾牌类视觉呈现要点', close: '结尾页：决策事项清单，醒目的行动号召' } as any)[sl.layout] || '内容页'
  const query = `16:9 企业部门汇报幻灯片，第 ${+b.index + 1} 页，${kind}。
品牌：${clip(b.company, 30)} · ${clip(b.dept, 16)}。设计风格：现代、明亮、专业、有创意，浅色背景，主色 ${clip(b.color || '#2563eb', 10)}，大标题醒目，留白充足，信息层级清晰，适合大屏汇报。
页面上只允许出现以下中文文字，必须逐字准确、字形清晰、不得出现其他文字、英文乱码或错别字：
标题：“${clip(sl.title, 20)}”${sl.subtitle ? `\n副标题：“${clip(sl.subtitle, 30)}”` : ''}${pts.length ? `\n要点：${pts.map((x) => `“${x}”`).join('、')}` : ''}
画面创意：${clip(sl.visual, 160)}。${sl.art ? `\n美术指导：${clip(sl.art, 300)}` : ''}
不要水印，不要页码以外的装饰文字，不要人物面部特写。`
  const args: any = { query, model: m, aspect_ratio: '16:9', image_size: b.size === '2k' ? '2k' : '1k' }
  if (m === 'nano-banana-2.1') args.thinking_level = 'medium'
  const d = await tool(c.env, 'image_generation', args)
  const g = d?.generated_images?.[0]; const u = g?.image_urls?.[0]
  if (!u) throw new AiError('幻灯片生成失败', 502)
  return c.json({ ok: true, url: fileUrl(u), model: m, credits: g.estimated_credits ?? SLIDE_MODELS[m]?.credits ?? 30 })
})

// =====================================================================
// 模型配置中心：与 gsk CLI 同源读取可用模型（/api/llm_proxy/v1/models + /api/tool_cli/tools）
// =====================================================================
const IMG_SKIP = /bbox|rmbg|upscale|text-removal|outpaint/i
ai.get('/models', async (c) => {
  const e = c.env; if (!e.GSK_API_KEY) throw new AiError('未配置 AI 授权（GSK_API_KEY）', 503)
  const [m, t] = await Promise.all([
    fetch(`${base(e)}/api/llm_proxy/v1/models`, { headers: { Authorization: `Bearer ${e.GSK_API_KEY}` } }).then((r) => r.json()).catch(() => null),
    fetch(`${base(e)}/api/tool_cli/tools`, { headers: { 'X-Api-Key': e.GSK_API_KEY, 'X-GSK-CLI-Version': 'enterprise-brain/1.0' } }).then((r) => r.json()).catch(() => null),
  ])
  const llms = ((m as any)?.data || []).map((x: any) => ({ id: String(x.id), vendor: String(x.owned_by || '') })).filter((x: any) => MODEL_RE.test(x.id))
  const ig = ((t as any)?.tools || []).find((x: any) => x.name === 'image_generation')
  const images = ((ig?.parameters?.properties?.model?.enum as string[]) || ['gpt-image-2', 'nano-banana-2.1']).filter((x) => !IMG_SKIP.test(x))
  return c.json({ ok: true, llms, images, source: 'gsk tool_cli / llm_proxy', at: Date.now() })
})
ai.post('/models/test', async (c) => {
  const b = await c.req.json<any>(); const t0 = Date.now()
  const out = await llm(c.env, '你是连通性测试助手。输出 JSON。', '用一句话（20字内）介绍你自己擅长什么。输出 JSON：{"hi":"..."}', { model: eng(b, c.env), effort: 'medium' })
  return c.json({ ok: true, model: eng(b, c.env), reply: clip(out.hi || JSON.stringify(out), 80), ms: Date.now() - t0 })
})

// =====================================================================
// 老板指令 → 深度研究 → 发展规划（多创意方案）→ 可行性校验 → 老板决策 → 分发
// =====================================================================
const cmdCtx = (b: any) => `当前日期：${today()}\n企业：${clip(b.company, 60)}（${clip(b.industry, 60)}）\n主营：${clip(b.business, 200)}${b.profile ? `\n企业画像：${clip(b.profile, 700)}` : ''}\n老板指令：${clip(b.text, 300)}${b.idea ? `\n【创意提案（来自${clip(b.ideaBy || '提案人', 20)}）——以此为核心思路做研究验证与优化；提案里的数字未经验证，一律以研究数据为准】\n${clip(b.idea, 1600)}` : ''}${(b.knowledge || []).length ? `\n企业经验库：\n- ${(b.knowledge || []).slice(0, 5).map((k: any) => clip(k, 80)).join('\n- ')}` : ''}`

ai.post('/cmd/research/plan', async (c) => {
  const b = await c.req.json<any>()
  const out = await llm(c.env,
    '你是顶级产业研究员（券商首席分析师 + 咨询合伙人）。拿到老板指令后，先想清楚：要做对这件事，必须先弄清哪些事实？然后设计能拿到真实数据的检索计划。检索词必须具体（行业细分、地区、年份、指标名、政策名、竞品名），优先能找到官方统计、行业协会、上市公司公告、招投标与政策文件的关键词。输出 JSON。',
    `${cmdCtx(b)}\n\n输出 JSON：{"essence":"指令背后真正要解决的问题，40字内","questions":["必须先回答的关键问题，4-5 个，每个≤30字"],"queries":["检索词，6-8 个，每个≤30字"],"dataNeeds":["需要的关键数据指标，4-6 个，如市场规模/增速/价格区间/竞品份额/政策补贴额度"]}`,
    { model: eng(b, c.env), effort: eff(b) })
  return c.json({ ok: true, essence: clip(out.essence, 80), questions: lines(out.questions, 5, 60), queries: lines(out.queries, 8, 60), dataNeeds: lines(out.dataNeeds, 6, 40), model: eng(b, c.env) })
})

ai.post('/cmd/research/synth', async (c) => {
  const b = await c.req.json<any>()
  const ev = (b.evidence || []).slice(0, 18).map((x: any, i: number) => `[${i + 1}] ${clip(x.title, 80)}（${clip(x.url, 200)}）\n${clip(x.text || x.snippet, 1400)}`).join('\n\n')
  const out = await llm(c.env,
    '你是顶级产业研究员。基于证据包写一份给老板看的深度研究简报：只陈述证据能支撑的事实，引用 [n]；推断必须标注「推断」；每个关键数字都要给出来源或口径。特别要划清「真实数据边界」——哪些数字是有据可查的、哪些只是估算、哪些信息缺失——后续规划的目标不得超出这个边界。输出 JSON。',
    `${cmdCtx(b)}\n指令本质：${clip(b.essence, 100)}\n关键问题：${lines(b.questions, 5, 60).join('；')}\n\n【证据包】\n${ev || '（无外部证据）'}\n\n输出 JSON：{"summary":"研究结论，3 句话，含关键数字","findings":[{"text":"关键发现，≤60字","src":[证据序号],"kind":"fact|inference"}],"data":[{"metric":"指标","value":"数值+单位","source":"来源标题或[n]","confidence":"high|mid|low"}],"boundaries":["真实数据边界：规划时必须遵守的约束，如『公开数据显示行业增速约 X%，目标增速不应超过 Y%』，3-5 条"],"opportunities":["机会，3-4 条，≤40字"],"risks":["风险，3-4 条，≤40字"],"gaps":["信息缺口：需要企业内部数据或人工确认的，2-4 条"],"answers":[{"q":"关键问题","a":"基于证据的回答，≤60字"}]}\nfindings 6-10 条，data 4-10 条。`,
    { model: eng(b, c.env), effort: eff(b) })
  const n = (b.evidence || []).length
  return c.json({ ok: true, model: eng(b, c.env),
    summary: clip(out.summary, 400),
    findings: (out.findings || []).slice(0, 10).map((x: any) => ({ text: clip(x.text, 120), src: (Array.isArray(x.src) ? x.src : []).map((v: any) => +v).filter((v: number) => v >= 1 && v <= n).slice(0, 4), kind: x.kind === 'fact' ? 'fact' : 'inference' })),
    data: (out.data || []).slice(0, 10).map((x: any) => ({ metric: clip(x.metric, 40), value: clip(x.value, 60), source: clip(x.source, 80), confidence: ['high', 'mid', 'low'].includes(x.confidence) ? x.confidence : 'mid' })),
    boundaries: lines(out.boundaries, 5, 120), opportunities: lines(out.opportunities, 4, 80), risks: lines(out.risks, 4, 80), gaps: lines(out.gaps, 4, 80),
    answers: (out.answers || []).slice(0, 5).map((x: any) => ({ q: clip(x.q, 60), a: clip(x.a, 120) })),
    sources: (b.evidence || []).slice(0, 18).map((x: any) => ({ title: clip(x.title, 100), url: x.url })) })
})

const resText = (r: any) => r ? `研究结论：${clip(r.summary, 400)}\n关键数据：\n${(r.data || []).slice(0, 10).map((d: any) => `- ${d.metric}：${d.value}（${d.source}，可信度${d.confidence}）`).join('\n')}\n真实数据边界（必须遵守）：\n${lines(r.boundaries, 5, 120).map((x) => '- ' + x).join('\n')}\n机会：${lines(r.opportunities, 4).join('；')}\n风险：${lines(r.risks, 4).join('；')}\n信息缺口：${lines(r.gaps, 4).join('；')}` : '（未做研究）'

ai.post('/cmd/strategy', async (c) => {
  const b = await c.req.json<any>()
  const depts = (b.depts || []).map((d: any) => `${d.id}:${d.name}`).join('，')
  const out = await llm(c.env,
    `你是企业的首席战略官 + 创意总监。基于深度研究，为老板指令制定发展规划：
1. 先给出一句话核心判断（thesis）。
2. 给出 3 个差异化明显、有创意的方案（不是同一思路的大中小三档）：至少 1 个常规稳健方案、1 个借力外部资源/生态的方案、1 个用 AI 或新模式重构打法的创新方案；每个写清投入、预期回报、风险、周期。
3. 推荐其一并说明理由。
4. 目标必须量化，且每个目标都要写出依据（来自研究中的真实数据或明确的估算口径）——不得超出「真实数据边界」。
5. 拆解为 3-6 个部门任务，每个任务对应一个目标或里程碑；按难度定能力级别：std 一般级、master 大师级、leader 超级领袖级；高风险动作（追加预算、群发触达、报价签约、人事、支付、对外发布）needApproval=true。
输出 JSON。`,
    `${cmdCtx(b)}\n\n【深度研究】\n${resText(b.research)}${b.chosen ? `\n\n【老板已选定方案「${clip(b.chosen, 40)}」——必须以此方案为主线重新输出目标、里程碑与部门任务，recommend 填该方案 key】` : ''}${b.feedback ? `\n\n【可行性校验 / 老板提出的问题——本版必须逐条修正】\n${clip(b.feedback, 900)}` : ''}\n\n可用部门（id:名称）：${depts}\n\n输出 JSON：{"goal":"可衡量目标，50字内","thesis":"核心判断，60字内","options":[{"key":"A","name":"方案名≤12字","idea":"创意与打法，≤80字","invest":"投入（金额/人力，写口径）","return":"预期回报（量化）","risk":"主要风险","period":"周期","fit":"与企业资源的匹配度，≤30字"}],"recommend":"A|B|C","why":"推荐理由，≤80字","targets":[{"kpi":"指标","base":"现状/基线（无则写待确认）","target":"目标值","basis":"依据：引用研究数据或估算口径"}],"milestones":[{"when":"如 第2周 / 30天","what":"里程碑，≤30字","owner":"部门名"}],"notdo":["明确不做的事 / 边界，2-3 条"],"tasks":[{"deptId":"必须是上面的id","title":"任务≤24字","deliverable":"交付物≤30字","level":"std|master|leader","sla":60-480,"needApproval":true/false,"link":"对应的目标或里程碑，≤20字"}]}`,
    { model: eng(b, c.env), effort: eff(b) })
  const ids = new Set((b.depts || []).map((d: any) => d.id))
  const options = (out.options || []).slice(0, 3).map((o: any, i: number) => ({ key: clip(o.key || 'ABC'[i], 2), name: clip(o.name, 24), idea: clip(o.idea, 160), invest: clip(o.invest, 80), return: clip(o.return, 80), risk: clip(o.risk, 80), period: clip(o.period, 30), fit: clip(o.fit, 60) }))
  const tasks = (out.tasks || []).filter((t: any) => ids.has(t.deptId)).slice(0, 6).map((t: any) => ({ deptId: t.deptId, title: clip(t.title, 40), deliverable: clip(t.deliverable, 60), sla: Math.max(60, Math.min(480, +t.sla || 180)), needApproval: !!t.needApproval, level: ['std', 'master', 'leader'].includes(t.level) ? t.level : 'master', link: clip(t.link, 40) }))
  return c.json({ ok: true, model: eng(b, c.env), goal: clip(out.goal, 100), thesis: clip(out.thesis, 120), options, recommend: options.some((o: any) => o.key === out.recommend) ? out.recommend : options[0]?.key || 'A', why: clip(out.why, 160),
    targets: (out.targets || []).slice(0, 6).map((x: any) => ({ kpi: clip(x.kpi, 30), base: clip(x.base, 40), target: clip(x.target, 40), basis: clip(x.basis, 120) })),
    milestones: (out.milestones || []).slice(0, 6).map((x: any) => ({ when: clip(x.when, 20), what: clip(x.what, 60), owner: clip(x.owner, 20) })),
    notdo: lines(out.notdo, 3, 80), tasks })
})

const FEAS_DIMS: [string, string, number][] = [['data', '数据支撑', 20], ['resource', '资源匹配', 15], ['finance', '财务可行', 15], ['timeline', '时间可行', 10], ['risk', '风险可控', 15], ['compliance', '合规安全', 10], ['landing', '落地路径', 15]]
ai.post('/cmd/feasibility', async (c) => {
  const b = await c.req.json<any>()
  const st = b.strategy || {}
  const plan = `核心判断：${clip(st.thesis, 120)}\n目标：${clip(st.goal, 100)}\n方案：\n${(st.options || []).map((o: any) => `${o.key}. ${o.name}：${o.idea}｜投入 ${o.invest}｜回报 ${o.return}｜风险 ${o.risk}｜周期 ${o.period}`).join('\n')}\n推荐：${st.recommend}（${clip(st.why, 120)}）\n量化目标：\n${(st.targets || []).map((t: any) => `- ${t.kpi}：${t.base} → ${t.target}（依据：${t.basis}）`).join('\n')}\n里程碑：${(st.milestones || []).map((m: any) => `${m.when} ${m.what}（${m.owner}）`).join('；')}\n部门任务：${(st.tasks || []).map((t: any) => `${t.title}→${t.deliverable}`).join('；')}`
  const out = await llm(c.env,
    '你是独立的投资委员会评审 + 运营落地专家，立场是「挑毛病」，不偏袒方案制定者。逐项检验方案的合理性与可落地性：目标是否超出研究给出的真实数据边界、关键假设是否成立、投入产出是否算得过来、企业资源能否支撑、时间是否现实、风险与合规是否有对冲、每个目标是否有明确的落地路径和责任部门。没有证据支撑的乐观数字必须指出。输出 JSON。',
    `${cmdCtx(b)}\n\n【深度研究（真实数据边界）】\n${resText(b.research)}\n\n【待校验的发展规划（推荐方案 ${st.recommend}）】\n${plan}\n\n按 7 个维度打分（0-100）：data 数据支撑、resource 资源匹配、finance 财务可行、timeline 时间可行、risk 风险可控、compliance 合规安全、landing 落地路径。\n输出 JSON：{"dims":{"data":{"score":0,"note":"≤30字"},"resource":{...},"finance":{...},"timeline":{...},"risk":{...},"compliance":{...},"landing":{...}},"issues":[{"level":"high|mid|low","text":"问题，≤50字","fix":"修改建议，≤50字"}],"assumptions":["必须验证的关键假设，2-4 条"],"optionsView":[{"key":"A","score":0-100,"note":"≤30字"}],"summary":"结论，≤80字"}`,
    { model: eng(b, c.env), effort: eff(b) })
  const dims = FEAS_DIMS.map(([k, name, w]) => { const d = out.dims?.[k] || {}; return { k, name, w, score: Math.max(0, Math.min(100, Math.round(+d.score || 0))), note: clip(d.note, 60) } })
  const total = Math.round(dims.reduce((s, d) => s + d.score * d.w, 0) / 100)
  const issues = (out.issues || []).slice(0, 8).map((x: any) => ({ level: ['high', 'mid', 'low'].includes(x.level) ? x.level : 'mid', text: clip(x.text, 100), fix: clip(x.fix, 100) }))
  const high = issues.filter((x: any) => x.level === 'high').length
  const verdict = total >= 80 && !high ? 'go' : total >= 60 ? 'revise' : 'nogo'
  return c.json({ ok: true, model: eng(b, c.env), dims, total, verdict, issues, assumptions: lines(out.assumptions, 4, 80), optionsView: (out.optionsView || []).slice(0, 3).map((o: any) => ({ key: clip(o.key, 2), score: Math.max(0, Math.min(100, Math.round(+o.score || 0))), note: clip(o.note, 60) })), summary: clip(out.summary, 160) })
})

// =====================================================================
// 智导献策：识别目标企业（画像 + 是否入驻 + 公开邮箱）→ AI 写策划案
// =====================================================================
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const EMAIL_BAD = /example|sentry|wixpress|\.(png|jpe?g|gif|webp|svg)$|noreply|no-reply|donotreply|@2x|xxx@|test@|your(name|email)?@|email@domain/i
ai.post('/idea/target', async (c) => {
  const b = await c.req.json<any>()
  const n = clip(b.name, 60).trim(); if (!n) throw new AiError('请输入企业名称', 400)
  const [s1, s2] = await Promise.all([
    tool(c.env, 'batch_web_search', { queries: [`${n} 公司简介 主营业务 产品`, `${n} 最新动态 2026`, `${n} 用户 吐槽 痛点`] }).catch(() => null),
    tool(c.env, 'batch_web_search', { queries: [`${n} 商务合作 邮箱`, `${n} 联系我们 邮箱`, `${n} 官网 contact email`] }).catch(() => null),
  ])
  const ev1 = String(s1?.result || ''), ev2 = String(s2?.result || '')
  const items = [...parseBatch(ev2), ...parseBatch(ev1)]
  let pageText = '', pageUrl = ''
  const contact = items.find((x) => /contact|lianxi|about|cooperat|business|联系|合作/i.test(x.url + x.title))
  if (contact) { try { const d = await tool(c.env, 'crawler', { url: contact.url }); pageText = clip(String(d?.result || ''), 12000); pageUrl = contact.url } catch { } }
  const pool = `${ev1}\n${ev2}\n${pageText}`
  const found = [...new Set((pool.match(EMAIL_RE) || []).map((e) => e.replace(/[.,;:]+$/, '').toLowerCase()))].filter((e) => !EMAIL_BAD.test(e)).slice(0, 24)
  const srcOf = (e: string) => { if (pageText.toLowerCase().includes(e)) return { title: '官网联系页', url: pageUrl }; const it = items.find((x) => (x.snippet + x.title).toLowerCase().includes(e)); return it ? { title: it.title, url: it.url } : { title: '全网检索结果', url: '' } }
  const out = await llm(c.env,
    '你是商业情报分析师 + 资深策划人。根据检索证据为一家目标企业建立「献策画像」：它是谁、在做什么、最近在关注什么、用户和业务有哪些痛点、外部人士可以从哪些方向给它出好主意。只基于证据，推断要写「推断」。邮箱只能从给定候选中挑选，严禁编造任何邮箱。输出 JSON。',
    `目标企业：${n}\n\n【检索证据】\n${clip(ev1, 6500)}\n\n【联系方式检索】\n${clip(ev2, 3000)}\n${pageText ? `\n【官网联系页节选】\n${clip(pageText, 2500)}` : ''}\n\n【候选邮箱（只能从这里选，可以一个都不选）】\n${found.join(', ') || '（无）'}\n\n输出 JSON：{"name":"企业正式名称","short":"常用简称","aliases":["别名/品牌名，最多4个"],"industry":"所属行业","business":"主营业务，≤50字","products":["代表产品/品牌，最多5个"],"recent":["近期动态，每条≤40字，最多3条"],"audience":"核心用户，≤30字","pains":["用户或业务痛点，每条≤35字，3-4条"],"opportunities":["外部人士可以献策的方向，每条≤30字，3-4条"],"ideaHints":["给普通用户的点子灵感示例，每条≤30字，3条"],"emails":[{"email":"必须是候选中的原文","type":"商务合作|市场品牌|媒体|客服|投资者关系|招聘|其他","why":"≤20字"}],"site":"官网域名（证据中出现的才写，否则空）","found":证据是否确实描述了该企业(true/false)}`,
    { model: eng(b, c.env), effort: eff(b) })
  const rank: Record<string, number> = { 商务合作: 0, 市场品牌: 1, 其他: 2, 媒体: 3, 投资者关系: 4, 客服: 5, 招聘: 9 }
  const emails = (out.emails || []).map((x: any) => ({ email: String(x.email || '').toLowerCase().trim(), type: clip(x.type || '其他', 8), why: clip(x.why, 40) }))
    .filter((x: any) => found.includes(x.email) && x.type !== '招聘')
    .sort((a: any, b2: any) => (rank[a.type] ?? 3) - (rank[b2.type] ?? 3)).slice(0, 4)
    .map((x: any) => ({ ...x, source: srcOf(x.email) }))
  const reg = await matchCompany(c.env.DB, n, out.name, out.short, ...(out.aliases || []))
  return c.json({ ok: true, model: eng(b, c.env), name: clip(out.name || n, 60), short: clip(out.short || n, 20), aliases: lines(out.aliases, 4, 20), industry: clip(out.industry, 40), business: clip(out.business, 100), products: lines(out.products, 5, 20), recent: lines(out.recent, 3, 80), audience: clip(out.audience, 60), pains: lines(out.pains, 4, 70), opportunities: lines(out.opportunities, 4, 60), ideaHints: lines(out.ideaHints, 3, 60), emails, site: clip(out.site, 60), found: !!out.found, registered: reg ? { id: reg.id, name: reg.name } : null, candidates: found.length })
})

ai.post('/idea/write', async (c) => {
  const b = await c.req.json<any>()
  const T = b.target || {}
  const kind = ['suggestion', 'design'].includes(b.kind) ? b.kind : 'proposal'
  const short = clip(T.short || T.name, 12)
  const SPEC: Record<string, { role: string; body: string; extra: string }> = {
    proposal: { role: '顶级策划人', body: `Markdown 策划案，900-1600字，章节固定为：## 一句话提案 / ## 为什么是${short}、为什么是现在 / ## 创意方案 / ## 落地三步走 / ## 预期价值（估算） / ## 风险与应对 / ## 需要企业提供的资源`, extra: '' },
    suggestion: { role: '资深用户体验与经营顾问', body: 'Markdown 改进建议，350-700字，章节固定为：## 我发现的问题 / ## 具体建议（编号列出，每条可执行） / ## 预期效果（估算） / ## 低成本试点办法', extra: '' },
    design: { role: '顶级品牌与产品设计师', body: `Markdown 设计思路，600-1100字，章节固定为：## 设计概念 / ## 视觉方向（配色 HEX、字体气质、图形语言） / ## 关键画面与版式 / ## 应用场景（海报 / 包装 / 界面 / 门店等） / ## 与${short}品牌的契合点 / ## 落地建议`, extra: ',"visualPrompt":"给 AI 出图模型的英文画面描述，60-120 词，具体到构图、主体、配色、光线、风格，不含任何文字"' },
  }
  const sp = SPEC[kind]
  const who = b.self ? `提案对象是提案人自己经营的企业「${clip(T.name, 40)}」，提案人就是老板本人。方案要能直接交给公司的 AI 智脑执行。` : `提案人是一位普通用户（外部人士），要把点子献给「${clip(T.name, 40)}」。语气真诚、专业、尊重，不夸大、不贬低企业、不涉及企业内部机密，也不承诺对方一定会受益。`
  const out = await llm(c.env,
    `你是${sp.role} + ${clip(T.industry || '该行业', 30)}行业专家，擅长把一个粗糙的想法打磨成企业愿意认真看的${kind === 'design' ? '设计提案' : kind === 'suggestion' ? '改进建议' : '策划案'}。
原则：
1. 尊重并保留提案人的核心想法，不偷换主题，只做补全、专业化与落地化。
2. 结合目标企业的真实业务、产品和痛点，讲清「为什么是这家企业、为什么是现在」。
3. 方案要具体：写清玩法/机制、落地三步、需要企业提供的资源。
4. 数字一律标注「估算」并写口径；不得捏造企业数据。
5. ${who}
输出 JSON（proposal 字段为 Markdown 字符串，换行用 \\n）。`,
    `【目标企业画像】\n名称：${clip(T.name, 60)}（${clip(T.industry, 40)}）\n主营：${clip(T.business, 120)}\n代表产品：${lines(T.products, 5, 20).join('、')}\n近期动态：${lines(T.recent, 3, 80).join('；')}\n核心用户：${clip(T.audience, 60)}\n痛点：${lines(T.pains, 4, 70).join('；')}\n\n【点子类型】${clip(b.category, 20) || '不限'}\n【提案人的原始想法】\n${clip(b.idea, 1500)}${b.feedback ? `\n\n【提案人对上一版的修改意见——必须照改】\n${clip(b.feedback, 500)}\n【上一版】\n${clip(b.previous, 3000)}` : ''}\n\n输出 JSON：{"title":"提案标题，≤24字，有记忆点","oneLiner":"一句话说清这个点子，≤50字","tags":["关键词，3-4个"],"proposal":"${sp.body}"${sp.extra},"eval":{"novelty":0-100,"fit":0-100,"feasibility":0-100,"value":0-100,"comment":"客观点评，≤60字","improve":["还能更好的地方，2-3条，每条≤30字"]},"email":{"subject":"邮件标题，≤36字，像真人写的","opening":"邮件开场白，2-3句，≤120字，说明自己是谁、为什么写这封信"}}`,
    { model: eng(b, c.env), effort: eff(b), json: true })
  const sc = (k: string) => Math.max(0, Math.min(100, Math.round(+out.eval?.[k] || 0)))
  const ev = { novelty: sc('novelty'), fit: sc('fit'), feasibility: sc('feasibility'), value: sc('value'), comment: clip(out.eval?.comment, 120), improve: lines(out.eval?.improve, 3, 60) }
  return c.json({ ok: true, model: eng(b, c.env), title: clip(out.title, 40), oneLiner: clip(out.oneLiner, 100), tags: lines(out.tags, 4, 12), proposal: clip(out.proposal, 6000), eval: { ...ev, total: Math.round(ev.novelty * .25 + ev.fit * .25 + ev.feasibility * .25 + ev.value * .25) }, email: { subject: clip(out.email?.subject, 60), opening: clip(out.email?.opening, 240) }, kind, visualPrompt: clip(out.visualPrompt, 900) })
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

export { tool, llm, AiError, clip, fileUrl }
export default ai
