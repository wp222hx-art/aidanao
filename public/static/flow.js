// 企业智脑 · 指令驱动工作流引擎
// 原则：没有老板指令就没有工作。每条指令沿「拆解→方案确认→分发→执行→校验→审批→交付→复盘提升」逐段推进，
// 每一段只由对应的角色处理；四大机制：循环（返工/驳回/迭代/例行）、审批（方案闸门+成果闸门）、校验（五维+指令验收）、提升（经验注入+Agent升降级）。
(function () {
  const DAY_START = 510, DAY_END = 1170;
  window.DAY_START = DAY_START; window.DAY_END = DAY_END;
  const CHECKPOINTS = [
    { m: 540, k: 'routine', name: '09:00 例行指令' },
    { m: 720, k: 'check', name: '12:00 进度校验' },
    { m: 900, k: 'patrol', name: '15:00 督办巡检' },
    { m: 1080, k: 'report', name: '18:00 日终验收' },
    { m: 1140, k: 'learn', name: '19:00 复盘提升' }
  ];
  window.CHECKPOINTS = CHECKPOINTS;
  // 流水线阶段（「下达」为每条指令的行首）
  const STAGES = [
    { k: 'research', n: '深度研究', who: '研究员', i: 'fa-magnifying-glass-chart' },
    { k: 'strategy', n: '发展规划', who: '战略官', i: 'fa-chess-queen' },
    { k: 'feasibility', n: '可行性校验', who: '评审', i: 'fa-scale-balanced' },
    { k: 'confirm', n: '老板决策', who: '老板', i: 'fa-crown', gate: true },
    { k: 'exec', n: '部门执行', who: '大师 Agent', i: 'fa-robot' },
    { k: 'verify', n: '独立验收', who: '验收官', i: 'fa-clipboard-check' },
    { k: 'approve', n: '审批', who: '老板', i: 'fa-shield-halved', gate: true },
    { k: 'deliver', n: '交付汇报', who: '部门', i: 'fa-file-powerpoint' },
    { k: 'improve', n: '复盘归档', who: 'COO', i: 'fa-box-archive' }
  ];
  window.FLOW_STAGES = STAGES;
  const CMD_COLORS = ['#2563eb', '#d97706', '#db2777', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#be185d'];
  const SRC = { boss: ['老板', '#d97706'], routine: ['例行', '#059669'], iterate: ['迭代', '#7c3aed'], lead: ['商机', '#2563eb'] };
  window.FLOW_SRC = SRC;
  const LEAD_RE = /线索|商机|采购需求|找订单|招标/;
  const RESEARCH_RE = /线索|商机|竞品|竞争|市场|比价|行业|情报|法规|政策|招聘|供应商|价格|对标|客户画像|专利|标准/;
  const CONCURRENCY = 2;

  const F = window.Flow = { focus: null, running: new Set() };
  const isReal = () => !!(window.AI && AI.on);
  const deptOf = (id) => S.depts.find((d) => d.id === id);
  const deptByLib = (lib) => S.depts.find((d) => d.lib === lib);
  const agentOf = (id) => S.agents.find((a) => a.id === id);
  const taskOf = (id) => S.sim.tasks.find((t) => t.id === id);
  const cmdOf = (id) => S.sim.commands.find((c) => c.id === id);
  window.deptByLib = deptByLib; window.agentOf = agentOf;
  F.task = taskOf; F.cmd = cmdOf; F.cmdOfTask = (t) => cmdOf(t?.cmdId);
  const short = (s, n = 18) => esc(String(s || '').slice(0, n)) + (String(s || '').length > n ? '…' : '');
  const fx = (a, b, label, color) => { try { window.flowFx && window.flowFx(a, b, label, color); } catch { } };
  const say = (id, text, cls) => { try { window.bubble && window.bubble(id, text, cls); } catch { } };
  let pending = false;
  const refresh = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; window.onFlowChange && window.onFlowChange(); }); };
  F.refresh = refresh;

  // ====================== 状态 ======================
  window.simTime = () => { const m = S.sim.min; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const stamp = () => `D${S.sim.day} ${simTime()}`;
  F.init = function () {
    if (window.Masters) { Masters.ensureLocal(); setTimeout(() => Masters.generate(), 800); }
    if (S.sim && S.sim.ver === 3) return;
    const old = S.sim || {};
    S.sim = {
      ver: 3, day: old.day || 1, min: DAY_START, speed: old.speed ?? 1, seq: 0,
      commands: [], tasks: [], approvals: [], leads: old.leads || [], contents: old.contents || [], feed: [], knowledge: (old.knowledge || []).filter((k) => k.cmdId), cp: {}, routines: [],
      settings: { planConfirm: true },
      metrics: { done: 0, rework: 0, verify: 0, first: 0, pass1: 0, leads: old.metrics?.leads || 0, pipeline: old.metrics?.pipeline || 0, revenue: 0, hours: 0, saved: 0, esc: 0, contents: old.metrics?.contents || 0, views: old.metrics?.views || 0, promoted: 0, demoted: 0, iterations: 0, approvals: 0, rejects: 0, accepted: 0 },
      history: [], today: { done: 0, leads: 0, pipeline: 0, hours: 0, verify: 0 }, brief: old.brief || null, real: { done: 0, rework: 0, review: 0, leads: 0 }
    };
    S.agents.forEach((a) => { if (!a.sub) a.level = 'L2'; a.status = 'idle'; a.streak = 0; });
    log(null, 'sys', `企业智脑上线 · ${S.agents.length} 个 Agent 待命 —— 所有工作从老板指令开始`, '#2563eb');
  };

  function log(cmdId, type, html, color = '#64748b') {
    const c = cmdId ? cmdOf(cmdId) : null;
    const e = { t: stamp(), type, html, color, cmd: cmdId || null, no: c?.no || null };
    S.sim.feed.unshift(e); if (S.sim.feed.length > 200) S.sim.feed.length = 200;
    if (c) { c.log.push({ t: e.t, type, html }); if (c.log.length > 80) c.log.shift(); }
    window.onFlowLog && window.onFlowLog(e);
  }
  window.simLog = (type, html, color, cmdId) => log(cmdId || null, type, html, color);
  F.log = log;

  const ctxBase = () => ({ company: S.company.name, industry: `${S.industry?.name || ''} › ${S.industry?.div?.name || ''}`, business: S.company.profile?.business || S.company.profile?.positioning || '' });
  function knowledgeFor(deptId) {
    const ks = S.sim.knowledge.filter((k) => !deptId || !k.deptId || k.deptId === deptId).slice(0, 5);
    ks.forEach((k) => k.used = (k.used || 0) + 1);
    return ks.map((k) => k.title);
  }

  // ====================== ① 下达 ======================
  F.issue = function (text, opt = {}) {
    text = String(text || '').trim(); if (!text || !S.sim) return null;
    const no = ++S.sim.seq;
    const c = {
      id: uid('c'), no, text, goal: '', source: opt.source || 'boss', parentId: opt.parentId || null, iteration: opt.iteration || 1,
      color: CMD_COLORS[(no - 1) % CMD_COLORS.length], stage: 'plan', plan: [], taskIds: [], day: S.sim.day, t: simTime(),
      log: [], review: null, acceptance: null, real: isReal(), feedback: opt.feedback || '', presetPlan: opt.plan || null, confirm: null, replans: 0, ref: opt.ref || null,
      skipPrep: !!opt.plan, trace: [], research: null, strategy: null, feas: null, feasHist: [], decision: null, decisionEval: null,
      idea: opt.idea || '', ideaBy: opt.ideaBy || '', ideaRef: opt.ideaRef || null
    };
    S.sim.commands.unshift(c);
    if (S.sim.commands.length > 40) { const drop = S.sim.commands.slice(40).filter((x) => ['done', 'cancelled'].includes(x.stage)).map((x) => x.id); S.sim.commands = S.sim.commands.filter((x) => !drop.includes(x.id)); S.sim.tasks = S.sim.tasks.filter((t) => !drop.includes(t.cmdId)); }
    if (opt.routine && !S.sim.routines.some((r) => r.text === text)) S.sim.routines.push({ id: uid('r'), text, since: S.sim.day, lastDay: S.sim.day });
    const [sl] = SRC[c.source] || SRC.boss;
    log(c.id, 'issue', `👑 <b>#${no}</b> ${sl}指令下达「${esc(text)}」${c.iteration > 1 ? ` · 第 ${c.iteration} 轮` : ''}${opt.routine ? ' · 已设为每日例行' : ''}`, '#d97706');
    F.focus = c.id;
    say('boss', text.slice(0, 14));
    fx('boss', 'brain', '指令', '#d97706');
    plan(c);
    saveState(); refresh();
    return c;
  };

  // ====================== ② 拆解 ======================
  const CMD_MAP = [
    { re: /订单|销售|业绩|客户|市场|营收|收入|商机/, libs: ['sales', 'marketing', 'product', 'strategy'], titles: { sales: '全网匹配采购需求线索', marketing: '设计获客投放实验方案', product: '分析竞品与客户需求差距', strategy: '输出90天增长计划草案' }, appr: ['marketing'] },
    { re: /成本|采购|省钱|降本/, libs: ['procurement', 'finance', 'production'], titles: { procurement: '全网比价主要原料', finance: '核对预算偏差与降本空间', production: '核算单件工时与损耗' }, appr: [] },
    { re: /宣传|品牌|海报|视频|推广|营销/, libs: ['brand', 'marketing'], titles: { brand: '制作宣传海报与短视频脚本', marketing: '生成本月营销日历' }, appr: ['brand'] },
    { re: /应收|回款|催收|现金/, libs: ['finance', 'sales', 'legal'], titles: { finance: '梳理逾期应收与账龄', sales: '制定重点客户回款跟进话术', legal: '审查合同违约与催收条款' }, appr: ['legal'] },
    { re: /招聘|人才|培训|团队/, libs: ['hr', 'admin'], titles: { hr: '制定岗位画像并筛选简历', admin: '安排面试与入职流程' }, appr: [] },
    { re: /质量|客诉|良率/, libs: ['quality', 'production', 'service'], titles: { quality: '汇总质检异常并归因', production: '分析良率波动原因', service: '回访客诉并给出补救方案' }, appr: [] }
  ];
  const DELIV = { sales: '商机清单与跟进优先级表', marketing: '投放实验方案与预算测算表', product: '竞品对比表与需求差距清单', strategy: '90天增长计划（含ROI测算）', procurement: '供应商比价表与降本建议', finance: '预算偏差分析表', production: '工时损耗核算表', brand: '海报文案与短视频脚本', hr: '岗位画像与筛选标准', legal: '条款风险审查清单', quality: '异常归因分析表', service: '客诉补救方案' };
  function localPlan(c) {
    let hit = CMD_MAP.filter((m) => m.re.test(c.text));
    if (!hit.length) hit = [{ libs: ['strategy', 'operation', 'sales'], titles: {}, appr: [] }];
    const plan = [];
    hit.forEach((h) => h.libs.forEach((lib) => { const d = deptByLib(lib); if (!d || plan.some((p) => p.deptId === d.id)) return; const title = h.titles[lib] || `落实：${c.text.slice(0, 16)}`; plan.push({ deptId: d.id, title, deliverable: DELIV[lib] || '可直接使用的工作成果', sla: 240, needApproval: h.appr.includes(lib), level: /计划|战略|策略|布局/.test(title) || lib === 'strategy' ? 'leader' : /安排|整理|汇总|梳理/.test(title) ? 'std' : 'master', kind: lib === 'sales' && LEAD_RE.test(title) ? 'leads' : null }); }));
    if (!plan.length) plan.push({ deptId: S.depts[0].id, title: c.text.slice(0, 24), deliverable: '工作成果', sla: 240, needApproval: false });
    c.plan = plan.slice(0, 6); c.goal = c.goal || c.text;
  }
  async function plan(c) {
    if (c.presetPlan) { c.stage = 'plan'; c.plan = c.presetPlan; c.goal = c.goal || c.text; return afterPlan(c, true); }
    if (c.real && isReal()) return deepPlan(c);
    // 仿真：结构与真实一致，按节拍推进 研究 → 规划 → 校验
    c.stage = c.research ? 'strategy' : 'research'; c.planDue = S.sim.min + rand(8, 14);
  }

  // ====================== ①½ 深度研究 → 发展规划 → 可行性校验 ======================
  const mName = (k) => modelName(roleModel(k));
  function ctrace(c, step, o = {}) { c.trace = c.trace || []; const e = { id: uid('y'), step, at: stamp(), ts: Date.now(), status: 'run', ...o }; c.trace.push(e); if (c.trace.length > 40) c.trace.shift(); refresh(); return e; }
  function cok(c, e, o = {}) { Object.assign(e, { status: 'ok', ms: Date.now() - e.ts }, o); refresh(); }
  function cfail(c, e, msg) { e.status = 'fail'; e.detail = msg; e.ms = Date.now() - e.ts; refresh(); }
  const cmdBody = (c) => ({ ...ctxBase(), text: c.text, profile: S.company.profile ? [S.company.profile.positioning, (S.company.profile.opportunities || []).join('；'), (S.company.profile.risks || []).join('；')].filter(Boolean).join('\n') : '', knowledge: knowledgeFor(null), idea: c.idea || '', ideaBy: c.ideaBy || '' });
  const alive = (c, st) => c.stage === st;
  async function deepPlan(c) {
    const body = cmdBody(c), depts = S.depts.map((d) => ({ id: d.id, name: d.name }));
    let e = null;
    try {
      // ① 深度研究（重新拆解时复用已有研究）
      if (!c.research) {
        c.stage = 'research'; fx('boss', 'brain', '深度研究', '#2563eb'); refresh();
        e = ctrace(c, 'research', { label: '研究设计', detail: `${mName('research')} 拆解指令本质与关键问题` });
        const rp = await AI.call('/cmd/research/plan', { ...body, engine: roleModel('research') });
        if (!alive(c, 'research')) return;
        cok(c, e, { detail: `本质：${rp.essence} · ${rp.questions.length} 个关键问题 · ${rp.queries.length} 个检索词`, model: mName('research'), extra: { questions: rp.questions, dataNeeds: rp.dataNeeds } });
        log(c.id, 'research', `🔬 #${c.no} 研究设计：${esc(rp.essence)}`, '#2563eb');
        const ev = [], seen = new Set(); const add = (x) => { if (x?.url && !seen.has(x.url)) { seen.add(x.url); ev.push(x); } };
        const qs = rp.queries.length ? rp.queries : [c.text];
        await Promise.all([qs.slice(0, 4), qs.slice(4, 8)].filter((g) => g.length).map(async (g) => {
          const t = ctrace(c, 'search', { label: '全网检索', tool: 'batch', detail: g.join(' / ') });
          try { const r = await AI.call('/task/tool', { tier: 'leader', tools: ['batch', 'crawl'], tool: 'batch', queries: g }); r.sources.forEach(add); cok(c, t, { detail: `${r.summary}`, sources: r.sources.slice(0, 6) }); fx('brain', 'kb', '检索', '#0284c7'); }
          catch (er) { cfail(c, t, er.message); }
        }));
        if (!alive(c, 'research')) return;
        const reads = ev.filter((x) => !/\.pdf($|\?)/i.test(x.url)).slice(0, 3);
        await Promise.all(reads.map(async (x) => {
          const t = ctrace(c, 'search', { label: '深读网页', tool: 'crawl', detail: x.title });
          try { const r = await AI.call('/task/tool', { tier: 'leader', tools: ['batch', 'crawl'], tool: 'crawl', url: x.url, title: x.title }); x.text = String(r.text || '').slice(0, 2400); cok(c, t, { detail: `${r.summary}：${x.title}` }); }
          catch (er) { cfail(c, t, er.message); }
        }));
        if (!alive(c, 'research')) return;
        const evidence = [...ev.filter((x) => x.text), ...ev.filter((x) => !x.text)].slice(0, 16);
        e = ctrace(c, 'research', { label: '研究综合', detail: `${mName('research')} 综合 ${evidence.length} 条证据，划定真实数据边界` });
        const rs = await AI.call('/cmd/research/synth', { ...body, engine: roleModel('research'), essence: rp.essence, questions: rp.questions, evidence });
        if (!alive(c, 'research')) return;
        c.research = { ...rs, essence: rp.essence, questions: rp.questions, dataNeeds: rp.dataNeeds, at: stamp() };
        cok(c, e, { detail: `${rs.findings.length} 条发现 · ${rs.data.length} 项关键数据 · ${rs.boundaries.length} 条数据边界`, model: mName('research') });
        log(c.id, 'research', `📚 #${c.no} 深度研究完成：${esc(rs.summary.slice(0, 60))}… · ${evidence.length} 条证据`, '#2563eb');
      }
      // ② 发展规划 + ③ 可行性校验（未通过自动修订一次）
      await strategize(c, { feedback: c.feedback });
      if (!c.strategy) return;
      if (modelCfg().autoRevise && c.feas && c.feas.verdict !== 'go' && (c.revisions || 0) < 1) {
        c.revisions = (c.revisions || 0) + 1;
        const fb = [`可行性校验 ${c.feas.total} 分（${c.feas.verdict === 'nogo' ? '不可行' : '需修订'}）：${c.feas.summary}`, ...c.feas.issues.map((x) => `[${x.level}] ${x.text} → ${x.fix}`)].join('\n');
        log(c.id, 'feas', `🔁 #${c.no} 可行性 ${c.feas.total} 分未达 80，战略官按评审意见自动修订方案`, '#d97706');
        await strategize(c, { feedback: fb });
        if (!c.strategy) return;
      }
      if (!['strategy', 'feasibility'].includes(c.stage)) return;
      c.goal = c.strategy.goal || c.text;
      c.plan = c.strategy.tasks.map((x) => ({ ...x, kind: deptOf(x.deptId)?.lib === 'sales' && LEAD_RE.test(x.title) ? 'leads' : null }));
      if (!c.plan.length) throw new Error('规划未产出部门任务');
      afterPlan(c);
    } catch (er) {
      if (e && e.status === 'run') cfail(c, e, er.message);
      if (['cancelled', 'done'].includes(c.stage)) return;
      log(c.id, 'plan', `⚠️ 深度规划中断（${esc(er.message)}），改用快速拆解`, '#dc2626');
      c.stage = 'plan';
      try {
        const r = await AI.call('/command', { ...ctxBase(), engine: roleModel('strategy'), text: c.text, feedback: c.feedback, knowledge: knowledgeFor(null), depts, idea: c.idea || '', ideaBy: c.ideaBy || '' });
        if (!r.tasks?.length) throw new Error('未拆解出任务');
        c.goal = r.goal || c.text; c.plan = r.tasks.map((x) => ({ ...x, kind: deptOf(x.deptId)?.lib === 'sales' && LEAD_RE.test(x.title) ? 'leads' : null }));
      } catch (e2) { localPlan(c); }
      if (c.stage !== 'plan') return;
      afterPlan(c);
    }
  }
  async function strategize(c, o = {}) {
    const body = cmdBody(c), depts = S.depts.map((d) => ({ id: d.id, name: d.name }));
    c.stage = 'strategy'; fx('brain', 'boss', '规划', '#7c3aed');
    let e = ctrace(c, 'strategy', { label: o.chosen ? '按老板选择重排' : (o.feedback ? '修订规划' : '发展规划'), detail: `${mName('strategy')} ${o.chosen ? '以方案「' + o.chosen + '」为主线' : '制定 3 套差异化创意方案'}` });
    const st = await AI.call('/cmd/strategy', { ...body, engine: roleModel('strategy'), research: c.research, depts, feedback: o.feedback || '', chosen: o.chosen || '' });
    if (c.stage !== 'strategy') return;
    c.strategy = { ...st, v: (c.strategy?.v || 0) + 1, at: stamp() };
    const rec = st.options.find((x) => x.key === st.recommend);
    cok(c, e, { detail: `核心判断：${st.thesis} · 推荐 ${st.recommend}「${rec?.name || ''}」· ${st.tasks.length} 项部门任务`, model: mName('strategy') });
    log(c.id, 'strategy', `♟️ #${c.no} 发展规划 v${c.strategy.v}：${st.options.map((x) => `${x.key}「${esc(x.name)}」`).join(' / ')} → 推荐 <b>${st.recommend}</b>`, '#7c3aed');
    c.stage = 'feasibility'; fx('brain', 'qa', '可行性校验', '#d97706');
    e = ctrace(c, 'feasibility', { label: '可行性校验', detail: `${mName('feasibility')} 七维挑毛病：数据/资源/财务/时间/风险/合规/落地` });
    const fs = await AI.call('/cmd/feasibility', { ...body, engine: roleModel('feasibility'), research: c.research, strategy: c.strategy });
    if (c.stage !== 'feasibility') return;
    c.feas = { ...fs, v: c.strategy.v, at: stamp() }; c.feasHist = [...(c.feasHist || []), { v: c.strategy.v, total: fs.total, verdict: fs.verdict }];
    cok(c, e, { detail: `${fs.total} 分 · ${{ go: '可落地', revise: '需修订', nogo: '不可行' }[fs.verdict]} · ${fs.issues.length} 个问题`, model: mName('feasibility') });
    log(c.id, 'feas', `⚖️ #${c.no} 可行性校验 <b>${fs.total}</b> 分（${{ go: '可落地', revise: '需修订', nogo: '不可行' }[fs.verdict]}）：${esc(fs.summary.slice(0, 50))}`, fs.verdict === 'go' ? '#059669' : '#d97706');
  }
  // 公司级规划摘要：注入到每个部门任务，保证部门成果与老板选定的方案一致
  F.stratText = function (c, t) {
    const st = c?.strategy; if (!st) return '';
    const k = c.decision?.key || st.recommend, o = st.options.find((x) => x.key === k);
    return [`核心判断：${st.thesis}`, o ? `老板选定方案 ${o.key}「${o.name}」：${o.idea}（投入 ${o.invest}；回报 ${o.return}；周期 ${o.period}）` : '', st.targets?.length ? `量化目标：${st.targets.map((x) => `${x.kpi} ${x.base}→${x.target}`).join('；')}` : '', st.milestones?.length ? `里程碑：${st.milestones.map((m) => `${m.when} ${m.what}`).join('；')}` : '', st.notdo?.length ? `不做：${st.notdo.join('；')}` : '', c.research?.boundaries?.length ? `真实数据边界：${c.research.boundaries.join('；')}` : '', t?.link ? `本任务承接：${t.link}` : ''].filter(Boolean).join('\n');
  };
  // 仿真版研究 / 规划 / 校验（明确标注仿真）
  function simPrep(c) {
    if (c.stage === 'research') {
      c.research = { sim: true, essence: c.text.slice(0, 30), summary: '仿真模式：AI 未连接，未进行真实检索。连接后将基于全网证据输出研究结论与真实数据边界。', findings: [{ text: '（仿真）行业公开数据待检索', src: [], kind: 'inference' }], data: [{ metric: '市场规模', value: '待真实检索', source: '仿真', confidence: 'low' }, { metric: '行业增速', value: '待真实检索', source: '仿真', confidence: 'low' }], boundaries: ['（仿真）连接 AI 后按真实数据划定目标上限'], opportunities: ['（仿真）机会待研究'], risks: ['（仿真）风险待研究'], gaps: ['企业内部经营数据'], answers: [], sources: [], at: stamp() };
      ctrace(c, 'research', { label: '深度研究', detail: '（仿真）研究设计 + 检索 + 综合', status: 'ok', sim: true });
      log(c.id, 'research', `🔬 #${c.no} 深度研究（仿真）`, '#2563eb');
      c.stage = 'strategy'; c.planDue = S.sim.min + rand(8, 14); return;
    }
    if (c.stage === 'strategy') {
      localPlan(c);
      c.strategy = { sim: true, v: (c.strategy?.v || 0) + 1, goal: c.goal, thesis: `（仿真）围绕「${c.text.slice(0, 16)}」集中资源打透一个突破口`, options: [{ key: 'A', name: '稳健推进', idea: '在现有渠道和团队基础上分阶段推进', invest: '低', return: '中', risk: '见效慢', period: '90 天', fit: '高' }, { key: 'B', name: '生态借力', idea: '联合上下游伙伴与平台资源共同打开市场', invest: '中', return: '中高', risk: '依赖合作方', period: '60 天', fit: '中' }, { key: 'C', name: 'AI 重构', idea: '用 AI 智能体重构获客与交付流程，人效翻倍', invest: '中', return: '高', risk: '组织适应', period: '45 天', fit: '中' }], recommend: 'A', why: '（仿真）资源匹配度最高', targets: [{ kpi: '核心指标', base: '待确认', target: '待真实数据测算', basis: '仿真' }], milestones: [{ when: '第 2 周', what: '方案落地启动', owner: '各部门' }, { when: '30 天', what: '首轮复盘', owner: '战略' }], notdo: ['（仿真）不做超出预算的投入'], tasks: c.plan, at: stamp() };
      ctrace(c, 'strategy', { label: '发展规划', detail: '（仿真）3 套方案 + 部门任务', status: 'ok', sim: true });
      log(c.id, 'strategy', `♟️ #${c.no} 发展规划（仿真）：A 稳健推进 / B 生态借力 / C AI 重构 → 推荐 A`, '#7c3aed');
      c.stage = 'feasibility'; c.planDue = S.sim.min + rand(6, 10); return;
    }
    if (c.stage === 'feasibility') {
      const dims = [['data', '数据支撑', 20], ['resource', '资源匹配', 15], ['finance', '财务可行', 15], ['timeline', '时间可行', 10], ['risk', '风险可控', 15], ['compliance', '合规安全', 10], ['landing', '落地路径', 15]].map(([k, name, w]) => ({ k, name, w, score: rand(72, 92), note: '（仿真）' }));
      const total = Math.round(dims.reduce((a, d) => a + d.score * d.w, 0) / 100);
      c.feas = { sim: true, v: c.strategy.v, dims, total, verdict: total >= 80 ? 'go' : 'revise', issues: [{ level: 'mid', text: '（仿真）关键目标缺少真实数据支撑', fix: '连接 AI 后基于检索数据校准' }], assumptions: ['（仿真）关键假设待验证'], optionsView: [], summary: `（仿真）可行性 ${total} 分`, at: stamp() };
      c.feasHist = [...(c.feasHist || []), { v: c.feas.v, total, verdict: c.feas.verdict }];
      ctrace(c, 'feasibility', { label: '可行性校验', detail: `（仿真）${total} 分`, status: 'ok', sim: true });
      log(c.id, 'feas', `⚖️ #${c.no} 可行性校验 <b>${total}</b> 分（仿真）`, '#059669');
      afterPlan(c);
    }
  }
  // 老板决策：选定方案（与 AI 推荐不同则按所选方案重排任务）→ 分发
  F.decide = async function (id, key, note) {
    const c = cmdOf(id); if (!c || c.stage !== 'confirm') return;
    const st = c.strategy, rec = st?.recommend;
    key = key || rec;
    S.sim.approvals.filter((a) => a.cmdId === c.id && a.kind === 'plan' && a.status === 'pending').forEach((a) => { a.status = 'approved'; a.reason = key ? `选定方案 ${key}` : ''; S.sim.metrics.approvals++; });
    const o = st?.options?.find((x) => x.key === key);
    c.decision = { key, name: o?.name || '', recommended: rec, follow: !rec || key === rec, feas: c.feas?.total ?? null, note: note || '', at: stamp() };
    c.confirm = 'approved';
    log(c.id, 'confirm', `👑 老板决策 #${c.no}：${o ? `选定方案 <b>${key}「${esc(o.name)}」</b>${c.decision.follow ? '（采纳 AI 推荐）' : `（AI 推荐 ${rec}）`}` : '确认方案'}${note ? ' · ' + esc(note) : ''}`, '#d97706');
    fx('boss', 'brain', '决策', '#d97706');
    if (o && !c.decision.follow && c.real && isReal() && st && !st.sim) {
      try { await strategize(c, { chosen: `${o.key} ${o.name}` }); } catch (er) { log(c.id, 'plan', `⚠️ 按所选方案重排失败（${esc(er.message)}），沿用原任务`, '#dc2626'); }
      if (c.strategy?.tasks?.length) { c.goal = c.strategy.goal || c.goal; c.plan = c.strategy.tasks.map((x) => ({ ...x, kind: deptOf(x.deptId)?.lib === 'sales' && LEAD_RE.test(x.title) ? 'leads' : null })); }
      if (['cancelled', 'done'].includes(c.stage)) return;
    }
    dispatch(c); saveState(); refresh(); window.updateBadges && updateBadges();
  };
  F.pick = function (id, key) { const c = cmdOf(id); if (c) { c.pick = key; saveState(); refresh(); } };
  function afterPlan(c, direct) {
    c.planDue = null;
    const names = [...new Set(c.plan.map((p) => deptOf(p.deptId)?.name).filter(Boolean))];
    log(c.id, 'plan', `🧠 智脑拆解 #${c.no}：目标「${esc(c.goal)}」→ ${c.plan.length} 项任务（${esc(names.join('、'))}）${c.plan.some((p) => p.needApproval) ? '，含高风险动作' : ''}`, '#2563eb');
    if (!direct && S.sim.settings.planConfirm && c.source !== 'routine') {
      c.stage = 'confirm';
      const st = c.strategy, rec = st?.options?.find((x) => x.key === st.recommend);
      addApproval({ kind: 'plan', cmdId: c.id, action: st ? '老板决策' : '方案确认', desc: `#${c.no}「${c.text.slice(0, 30)}」${st ? `AI 推荐方案 ${st.recommend}「${rec?.name || ''}」· 可行性 ${c.feas?.total ?? '-'} 分 · ` : ''}${c.plan.length} 项部门任务：${c.plan.map((p) => `${deptOf(p.deptId)?.name}·${p.title}${p.needApproval ? '(高风险)' : ''}`).join('；')}` });
      fx('brain', 'boss', '待老板决策', '#d97706');
    } else { c.confirm = direct ? 'direct' : 'skip'; if (c.strategy) c.decision = { key: c.strategy.recommend, name: (c.strategy.options.find((x) => x.key === c.strategy.recommend) || {}).name || '', recommended: c.strategy.recommend, follow: true, feas: c.feas?.total ?? null, auto: true, at: stamp() }; dispatch(c); }
    saveState(); refresh();
  }

  // ====================== ④ 分发 ======================
  function dispatch(c) {
    c.stage = 'run';
    c.plan.forEach((p, i) => {
      const t = createTask(p.deptId, p.title, { cmdId: c.id, deliverable: p.deliverable, sla: p.sla, needApproval: p.needApproval, kind: p.kind, ref: p.ref, kws: p.kws, level: p.level, link: p.link });
      if (t) { c.taskIds.push(t.id); setTimeout(() => fx('brain', p.deptId, '分发', c.color), i * 220); }
    });
    log(c.id, 'dispatch', `📤 #${c.no} 分发至 ${new Set(c.plan.map((p) => p.deptId)).size} 个部门 Agent 集群，共 ${c.taskIds.length} 项任务`, c.color);
  }
  function createTask(deptId, title, opt = {}) {
    const d = deptOf(deptId); if (!d) return null;
    const lvl = { L3: 3, L2: 2, L1: 1 };
    const core = S.agents.filter((a) => a.deptId === deptId && !a.sub);
    const pool = (core.length ? core : S.agents.filter((a) => a.deptId === deptId));
    const load = (a) => S.sim.tasks.filter((t) => t.agentId === a.id && !['done', 'rejected'].includes(t.status)).length;
    const ag = [...pool].sort((a, b) => load(a) - load(b) || (lvl[b.level] || 0) - (lvl[a.level] || 0))[0];
    const staff = S.staff.filter((s) => s.deptId === deptId);
    const c = cmdOf(opt.cmdId);
    const level = TIERS[opt.level] ? opt.level : 'master', need = TIER_ORDER.indexOf(level);
    const rk = (s) => TIER_ORDER.indexOf(tierOf(s));
    const owner = F.pickOwner(deptId, level);
    const tier = owner ? tierOf(owner) : level;
    const t = {
      id: uid('t'), cmdId: opt.cmdId || null, deptId, title, agentId: ag?.id, ownerId: owner?.id || null,
      status: 'queued', progress: 0, sla: opt.sla || 240, age: 0, day: S.sim.day, esc: 0, stuck: false, evals: null, rework: 0,
      real: !!(c ? c.real && isReal() : isReal()), deliverable: opt.deliverable || '', needApproval: !!opt.needApproval, kind: opt.kind || null, ref: opt.ref || null, kws: opt.kws || null, link: opt.link || '',
      output: null, history: [], feedback: '',
      level, tier, gap: !!owner && rk(owner) < need, tools: owner ? staffTools(owner) : TIERS[tier].tools.slice(), trace: [], criteria: [], accept: null, step: null, evidence: null, images: []
    };
    S.sim.tasks.unshift(t);
    return t;
  }
  window.createTask = createTask;
  // 按能力级别匹配负责人：优先「刚好达标且最空闲」的人，避免领袖级被琐事占满；无人达标时选部门最高级别并标记能力缺口
  F.pickOwner = function (deptId, level) {
    const staff = S.staff.filter((s) => s.deptId === deptId); if (!staff.length) return null;
    const need = TIER_ORDER.indexOf(TIERS[level] ? level : 'master'), rk = (s) => TIER_ORDER.indexOf(tierOf(s));
    const busyOf = (s) => S.sim.tasks.filter((t) => t.ownerId === s.id && !['done', 'rejected'].includes(t.status)).length;
    const fit = staff.filter((s) => rk(s) >= need);
    return (fit.length ? fit : staff).slice().sort((a, b) => busyOf(a) - busyOf(b) || (fit.length ? rk(a) - rk(b) : rk(b) - rk(a)) || b.value - a.value)[0];
  };

  // ====================== 执行表（痕迹） ======================
  const STEP_N = { plan: '规划', tool: '调用工具', write: '撰写成果', accept: '独立验收', package: '汇报材料', slide: '创意幻灯片', approve: '审批', deliver: '交付' };
  window.TRACE_STEP = STEP_N;
  const ownerOf = (t) => S.staff.find((x) => x.id === t.ownerId);
  function trace(t, step, o = {}) {
    t.trace = t.trace || [];
    const e = { id: uid('x'), step, v: (t.history?.length || 0) + 1, at: stamp(), ts: Date.now(), status: 'ok', ...o };
    t.trace.push(e); if (t.trace.length > 40) t.trace.shift();
    if (e.status !== 'run') logTrace(t, e);
    refresh(); return e;
  }
  function traceOk(t, e, o = {}) { Object.assign(e, { status: 'ok' }, o); logTrace(t, e); refresh(); }
  function traceFail(t, e, msg) { e.status = 'fail'; e.detail = msg; refresh(); }
  function logTrace(t, e) {
    if (!['tool', 'accept', 'plan', 'package'].includes(e.step)) return;
    const o = ownerOf(t), who = `${esc(o?.name || deptOf(t.deptId)?.name || '')}<span class="tz">${TIERS[t.tier]?.short || ''}</span>`;
    const what = e.step === 'tool' ? `调用「${toolMeta(e.tool).name}」` : e.step === 'plan' ? '完成执行规划' : e.step === 'package' ? '编排汇报材料' : '独立验收';
    log(t.cmdId, 'trace', `🔧 ${who} ${what}：${esc(String(e.detail || '').slice(0, 60))}`, e.step === 'accept' ? (t.accept?.pass ? '#059669' : '#d97706') : '#0284c7');
  }
  F.trace = trace;
  // 仿真模式下的执行痕迹（结构与真实一致，明确标注仿真）
  const FRAME = { std: '清单式执行：动作/负责人/时间/产出', master: '销售漏斗 + 4P 分析 + 双方案测算对比', leader: 'SCQA + 三方案对比 + ROI 测算 + 风险矩阵 + 30/60/90 里程碑' };
  function simCriteria(t) {
    const n = { std: 3, master: 4, leader: 5 }[t.tier] || 3;
    const pool = [`交付「${t.deliverable || t.title}」1 份，结构完整`, '每条行动写明负责岗位与完成时间', '关键数据注明来源或估算口径', '包含 1 张数据测算/对比表', '给出 2 个以上可选方案并说明取舍', '列出风险与对冲动作至少 3 条', '30/60/90 天里程碑含量化目标'];
    return pool.slice(0, n);
  }
  function simTrace(t) {
    const T = TIERS[t.tier] || TIERS.std, v = (t.history?.length || 0) + 1, has = (st, x) => t.trace.some((e) => e.step === st && e.v === v && (!x || e.tool === x));
    if (!t.trace.length) { t.criteria = simCriteria(t); trace(t, 'plan', { title: `${T.name}规划`, detail: `框架：${FRAME[t.tier]}`, extra: { criteria: t.criteria }, sim: true }); }
    if (v === 1 && t.progress >= 25 && !has('tool')) t.tools.filter((x) => !['crawl', 'image', 'doc'].includes(x)).slice(0, T.calls).forEach((x) => trace(t, 'tool', { tool: x, detail: `（仿真）${toolMeta(x).name}「${t.title.slice(0, 12)}」→ ${rand(4, 10)} 条结果`, sim: true }));
    if (v === 1 && t.progress >= 45 && t.tools.includes('crawl') && !has('tool', 'crawl')) trace(t, 'tool', { tool: 'crawl', detail: `（仿真）深读 ${Math.min(2, T.calls)} 个网页`, sim: true });
    if (t.progress >= 70 && !has('write')) trace(t, 'write', { detail: `（仿真）${T.model} 撰写${v > 1 ? '修订版' : '成果'}`, sim: true });
  }

  // ====================== ⑤ 执行 ======================
  // 仿真推进（未连接 Genspark 时）
  F.step = function (step) {
    S.sim.commands.forEach((c) => {
      if (['research', 'strategy', 'feasibility'].includes(c.stage) && !c.real && c.planDue && S.sim.min >= c.planDue) simPrep(c);
      if (c.stage === 'plan' && c.planDue && S.sim.min >= c.planDue) afterPlan(c);
      if (c.stage === 'accept' && c.acceptDue && S.sim.min >= c.acceptDue) improve(c, localReview(c));
    });
    S.sim.tasks.forEach((t) => {
      if (['done', 'approval', 'review', 'rejected', 'pack'].includes(t.status)) return;
      t.age += step;
      if (t.real) return;
      const a = agentOf(t.agentId);
      if (t.status === 'queued') { if (Math.random() < .5) { t.status = 'exec'; if (a) a.status = 'busy'; say(t.agentId, `接单：${t.title.slice(0, 8)}…`, 'ai'); } }
      else if (t.status === 'exec' || t.status === 'rework') {
        if (t.status === 'rework') t.status = 'exec';
        if (!t.stuck && Math.random() < .01) { t.stuck = true; say(t.agentId, '缺数据，卡住了', 'warn'); }
        if (!t.stuck) t.progress = Math.min(100, t.progress + rand(5, 12));
        simTrace(t);
        if (t.progress >= 100) { t.status = 'verify'; t.verifyDue = S.sim.min + 10; if (a) a.status = 'verify'; fx(t.deptId, 'qa', '提交校验', '#d97706'); }
      } else if (t.status === 'verify' && S.sim.min >= t.verifyDue) {
        const ev = simEval(t);
        t.output = `> 仿真模式：AI 未连接，以下为流程演示，不含真实内容。\n\n## 结论\n「${t.title}」按${TIERS[t.tier].name}标准完成（仿真）。\n\n## 验收对照\n${(t.criteria || []).map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
        t.accept = ev; trace(t, 'accept', { detail: `（仿真）${ev.met}/${ev.items.length} 条达标 · ${ev.total} 分（门槛 ${ev.threshold}）`, extra: { items: ev.items }, sim: true });
        applyVerdict(t, ev);
      }
    });
  };
  function simEval(t) {
    const a = agentOf(t.agentId) || { evals: { acc: 85, evi: 80, time: 85, comp: 90, val: 75 } };
    const bonus = { std: -3, master: 3, leader: 6 }[t.tier] || 0, gap = t.gap ? -9 : 0;
    const ev = {}; EVAL_DIMS.forEach((d) => { ev[d.k] = Math.max(40, Math.min(100, a.evals[d.k] + rand(-12, 8) + bonus + gap + (t.rework ? 8 : 0))); });
    if (t.age > t.sla) ev.time = Math.max(40, ev.time - 15);
    const total = Math.round(EVAL_DIMS.reduce((s, d) => s + ev[d.k] * d.w, 0) / 100);
    const th = TIERS[t.tier]?.pass || 80, ok = total >= th;
    const items = (t.criteria || []).map((text, i) => ({ text, status: ok ? (i === 1 && total < th + 4 ? 'partial' : 'met') : (i === 0 ? 'miss' : i === 1 ? 'partial' : 'met'), evidence: '（仿真）', note: '' }));
    const met = items.filter((x) => x.status === 'met').length, partial = items.filter((x) => x.status === 'partial').length;
    return { ev, total, pass: ok, threshold: th, items, met, partial, miss: items.length - met - partial, feedback: ok ? pick(['结论清晰、步骤可执行', '数据完整、责任到人', '方案务实、风险提示到位']) : pick(['补充数据来源与测算依据', '明确责任人与时间节点', '细化执行步骤并量化目标', '补充风险与合规提示']) + (t.gap ? `（该任务需${TIERS[t.level].name}能力，当前执行人为${TIERS[t.tier].name}）` : '') };
  }
  // 真实执行（Genspark）
  async function runReal(t) {
    F.running.add(t.id);
    const c = cmdOf(t.cmdId), d = deptOf(t.deptId), a = agentOf(t.agentId), o = ownerOf(t), T = TIERS[t.tier] || TIERS.std;
    const wasRework = t.status === 'rework';
    t.status = 'exec'; t.stuck = false; t.error = ''; t.trace = t.trace || [];
    if (a) a.status = 'busy';
    say(t.agentId, wasRework ? '按验收意见返工…' : `${T.short}级执行中…`, 'ai');
    const base = { ...ctxBase(), ...masterOf(t), strategy: F.stratText(c, t), goal: c?.goal || '', dept: d?.name, pos: o?.pos || '', owner: o?.name || '', agent: a?.name, task: t.title, deliverable: t.deliverable, tier: t.tier, tools: t.tools, knowledge: knowledgeFor(t.deptId) };
    const P = window.Masters?.get(t.deptId); if (P && !wasRework && !t.trace.length) say(t.agentId, `${P.title}「${P.name}」接手`, 'ai');
    let cur = null;
    try {
      // ① 规划：验收标准 + 工具组合
      if (!t.plan) {
        t.step = 'plan'; t.progress = 6;
        cur = trace(t, 'plan', { status: 'run', title: `${T.name}规划`, detail: `${P ? P.title + '「' + P.name + '」' : ''}以 ${engName()} 拆解验收标准与工具调用` });
        const p = await AI.call('/task/plan', base);
        if (t.status === 'rejected') return;
        t.plan = p; t.criteria = p.criteria;
        traceOk(t, cur, { detail: `框架：${p.framework}`, model: p.model, extra: { understanding: p.understanding, criteria: p.criteria, calls: p.calls, outline: p.outline }, ms: Date.now() - cur.ts });
      }
      // ② 调用决策调用库（Genspark 工具）
      if (!t.evidence) {
        t.step = 'tool'; const ev = [], imgs = [], seen = new Set();
        const add = (x) => { if (x?.url && !seen.has(x.url)) { seen.add(x.url); ev.push(x); } };
        const calls = t.plan.calls || [];
        for (let i = 0; i < calls.length; i++) {
          const k = calls[i];
          cur = trace(t, 'tool', { status: 'run', tool: k.tool, detail: k.query || (k.queries || []).join(' / ') });
          try {
            const r = await AI.call('/task/tool', { tier: t.tier, tools: t.tools, ...k });
            r.sources.forEach(add); imgs.push(...(r.images || []));
            traceOk(t, cur, { detail: `${r.summary}${k.why ? ' · ' + k.why : ''}`, sources: r.sources.slice(0, 6).map((x) => ({ title: x.title, url: x.url, snippet: String(x.snippet || '').slice(0, 140) })), images: r.images, ms: r.ms });
          } catch (e) { traceFail(t, cur, e.message); }
          t.progress = 10 + Math.round((i + 1) / Math.max(1, calls.length) * 30);
          if (t.status === 'rejected') return;
        }
        const reads = ev.filter((x) => !/\.pdf($|\?)/i.test(x.url) && !x.text).slice(0, t.plan.read || 0);
        for (const x of reads) {
          cur = trace(t, 'tool', { status: 'run', tool: 'crawl', detail: x.title });
          try { const r = await AI.call('/task/tool', { tier: t.tier, tools: t.tools, tool: 'crawl', url: x.url, title: x.title }); x.text = String(r.text || '').slice(0, 2500); traceOk(t, cur, { detail: `${r.summary}：${x.title}`, sources: [{ title: x.title, url: x.url, snippet: String(r.text || '').replace(/\s+/g, ' ').slice(0, 140) }], ms: r.ms }); }
          catch (e) { traceFail(t, cur, e.message); }
          if (t.status === 'rejected') return;
        }
        t.evidence = [...ev.filter((x) => x.text), ...ev.filter((x) => !x.text)].slice(0, 14); t.images = imgs.slice(0, 3);
        t.progress = 50;
      }
      // ③ 撰写成果
      t.step = 'write'; t.progress = Math.max(t.progress, 55);
      cur = trace(t, 'write', { status: 'run', detail: `${engName()} 基于 ${t.evidence.length} 条证据${wasRework ? '按验收意见修订' : '撰写'}` });
      const anim = setInterval(() => { if (t.step === 'write' && t.progress < 85) t.progress++; }, 2500);
      let r; try { r = await AI.call('/task/produce', { ...base, framework: t.plan.framework, outline: t.plan.outline, criteria: t.criteria, evidence: t.evidence, images: t.images, feedback: wasRework ? t.feedback : '', previous: wasRework ? t.output : '' }); } finally { clearInterval(anim); }
      if (t.status === 'rejected') return;
      t.output = r.output; t.progress = 88;
      traceOk(t, cur, { chars: r.chars, detail: `成果 ${r.chars} 字 · 引用 ${new Set((r.output.match(/\[(\d+)\]/g) || [])).size} 处来源`, model: r.model, ms: Date.now() - cur.ts });
      // ④ 独立验收（逐条核对验收标准）
      t.step = 'accept'; t.status = 'verify'; if (a) a.status = 'verify';
      fx(t.deptId, 'qa', '提交验收', '#d97706'); say(t.agentId, '提交独立验收…', 'ai');
      cur = trace(t, 'accept', { status: 'run', detail: `逐条核对 ${t.criteria.length} 条验收标准` });
      const ac = await AI.call('/task/accept', { ...base, engine: roleModel('accept'), criteria: t.criteria, output: t.output, sources: t.evidence.length });
      if (t.status === 'rejected') return;
      t.accept = ac;
      traceOk(t, cur, { detail: `${ac.met}/${ac.items.length} 条达标${ac.partial ? `、${ac.partial} 条部分` : ''}${ac.miss ? `、${ac.miss} 条未达` : ''} · ${ac.total} 分（门槛 ${ac.threshold}）`, extra: { items: ac.items }, ms: Date.now() - cur.ts });
      applyVerdict(t, { ev: ac.evals, total: ac.total, feedback: ac.feedback, pass: ac.pass, threshold: ac.threshold, researched: t.evidence.length > 0 });
    } catch (e) {
      if (cur && cur.status === 'run') traceFail(t, cur, e.message);
      t.status = wasRework ? 'rework' : 'queued'; t.progress = 0; t.stuck = true; t.error = e.message; t.retries = (t.retries || 0) + 1;
      if (a) a.status = 'idle';
      log(t.cmdId, 'esc', `⚠️ 「${short(t.title)}」执行失败：${esc(e.message)}${t.retries >= 2 ? '（已暂停，可在任务详情重试）' : '，稍后自动重试'}`, '#dc2626');
      if (t.retries >= 2) t.paused = true;
    } finally { t.step = ['exec', 'rework'].includes(t.status) ? t.step : null; F.running.delete(t.id); saveState(); refresh(); }
  }
  setInterval(() => {
    if (!isReal() || !S.launched || !S.sim || S.sim.speed === 0) return;
    const q = S.sim.tasks.filter((t) => t.real && !t.paused && !F.running.has(t.id) && (t.status === 'queued' || t.status === 'rework')).reverse();
    while (F.running.size < CONCURRENCY && q.length) runReal(q.shift());
  }, 1500);

  // 商机任务：真实检索
  async function leadTask(t) {
    const leads = await AI.scanLeads(t.kws, t.cmdId);
    t.foundLeads = leads.filter((l) => l.grade === 'A').slice(0, 2).map((l) => l.id);
    const md = leads.length
      ? `本轮 AI 全网检索后，AI 筛出 **${leads.length}** 条有效商机：\n` + leads.map((l) => `- **${l.grade}级** ${l.title}（采购方：${l.buyer || '未知'}，匹配 ${l.match}%）：${l.reason || ''}；下一步：${l.next || '待定'}。来源：${l.link}`).join('\n') + (t.foundLeads.length ? `\n\n其中 ${t.foundLeads.length} 条 A 级商机将在交付后追加跟进任务。` : '')
      : '本轮检索未发现与企业主营匹配的商机，建议调整检索关键词或扩大区域范围（需人工确认）。';
    return { output: md };
  }

  // ====================== ⑥ 校验 → 循环 / ⑦ 审批 / ⑧ 交付 ======================
  function applyVerdict(t, r) {
    const c = cmdOf(t.cmdId), a = agentOf(t.agentId);
    t.evals = { ev: r.ev, total: r.total }; t.feedback = r.feedback || '';
    t.history.push({ v: t.history.length + 1, output: t.output, evals: r.ev, total: r.total, feedback: t.feedback, at: stamp(), researched: !!r.researched });
    S.sim.metrics.verify++; S.sim.today.verify++;
    if (t.history.length === 1) { S.sim.metrics.first++; if (r.pass ?? r.total >= 80) S.sim.metrics.pass1++; }
    if (a) { EVAL_DIMS.forEach((k) => a.evals[k.k] = Math.round(a.evals[k.k] * .8 + r.ev[k.k] * .2)); a.status = 'idle'; }
    const limit = a?.level === 'L3' ? 2 : 1; // L3 Agent 拥有更多自我修正机会
    const pass = r.pass ?? r.total >= (r.threshold || TIERS[t.tier]?.pass || 80);
    if (pass) {
      log(t.cmdId, 'verify', `✅ 校验通过「${short(t.title)}」${r.total} 分 · ${esc(t.feedback.slice(0, 40))}`, '#059669');
      fx('qa', t.deptId, `通过 ${r.total}`, '#059669');
      const route = () => { if (t.status === 'rejected') return; if (t.needApproval) toApproval(t, 'risk'); else if (a?.level === 'L1') toApproval(t, 'l1'); else deliver(t); saveState(); refresh(); };
      makePack(t, route);
    } else if (t.rework < limit) {
      t.rework++; t.status = 'rework'; t.progress = 30; S.sim.metrics.rework++; if (a) a.fail++;
      if (t.real) S.sim.real.rework++;
      log(t.cmdId, 'rework', `↩️ 校验未通过「${short(t.title)}」${r.total} 分 → 返工循环：${esc(t.feedback)}`, '#ea580c');
      fx('qa', t.deptId, '返工', '#ea580c'); say(t.agentId, `${r.total}分，返工`, 'warn');
    } else {
      t.status = 'review'; if (t.real) S.sim.real.review++;
      addApproval({ kind: 'review', taskId: t.id, cmdId: t.cmdId, deptId: t.deptId, action: '人工复核', desc: `「${t.title}」返工后仍 ${r.total} 分：${t.feedback}` });
      log(t.cmdId, 'review', `👤 「${short(t.title)}」返工后仍 ${r.total} 分，升级为老板人工复核`, '#d97706');
      fx('qa', 'boss', '人工复核', '#d97706');
    }
    saveState(); refresh();
  }
  // ====================== ⑥½ 汇报材料：Word + Excel + 创意 PPT ======================
  const engName = () => modelName(roleModel('exec'));
  const slmName = (k) => (SLIDE_MODELS.find((x) => x[0] === k) || [, modelName(k)])[1];
  function masterOf(t) { return window.Masters ? Masters.payload(t.deptId) : { engine: officeCfg().engine }; }
  function fallbackPack(t, why) {
    const d = deptOf(t.deptId), its = t.accept?.items || [];
    const plain = String(t.output || '').replace(/[#>*`|\[\]]/g, '').replace(/\s+/g, ' ').trim();
    return { fallback: true, at: stamp(), slideModel: officeCfg().slideModel, why,
      doc: { title: t.title, subtitle: `${d?.name || ''} · 部门汇报`, summary: plain.slice(0, 160) },
      sheets: its.length ? [{ name: '验收对照', title: '验收标准达成情况', columns: ['序号', '验收标准', '结果', '验收证据'], rows: its.map((x, i) => [i + 1, x.text, { met: '达标', partial: '部分达标', miss: '未达标' }[x.status] || x.status, x.evidence || '']), note: '来自独立验收' }] : [],
      slides: [{ layout: 'cover', title: t.title.slice(0, 14), subtitle: `${d?.name || ''} · 部门汇报`, points: [], speaker: plain.slice(0, 150) }, { layout: 'close', title: '验收结论', points: its.slice(0, 3).map((x) => x.text.slice(0, 14)), speaker: t.accept?.feedback || '' }] };
  }
  // 验收通过后：首席大师把成果编排成三件套，再用 GPT Image 2 / Nano Banana 2.1 逐页生成创意幻灯片
  async function makePack(t, then, keep) {
    if (!keep) { t.status = 'pack'; t.step = 'package'; }
    const d = deptOf(t.deptId), cfg = officeCfg(), P = window.Masters?.get(t.deptId);
    if (!t.real || !isReal()) {
      t.pack = Office.simPack(t);
      trace(t, 'package', { detail: `（仿真）Word 1 份 · Excel ${t.pack.sheets.length} 张表 · PPT ${t.pack.slides.length} 页（文字版）`, sim: true });
      fx(t.deptId, 'brain', '汇报材料', '#ea580c');
      return then && then();
    }
    let cur = trace(t, 'package', { status: 'run', detail: `${P ? P.title + '「' + P.name + '」' : ''}联合幻灯片设计师（${mName('slideDesign')}）编排 Word / Excel / ${cfg.slides} 页 PPT` });
    say(t.agentId, '整理汇报材料…', 'ai');
    try {
      const r = await AI.call('/task/package', { ...ctxBase(), ...masterOf(t), engine: roleModel('slideDesign'), strategy: F.stratText(cmdOf(t.cmdId), t), dept: d?.name, task: t.title, deliverable: t.deliverable, criteria: t.criteria, output: t.output, slides: cfg.slides });
      t.pack = { doc: r.doc, sheets: r.sheets || [], slides: (r.slides || []).map((s) => ({ ...s, pending: true })), slideModel: cfg.slideModel, engine: r.model, at: stamp() };
      traceOk(t, cur, { detail: `Word「${r.doc?.title || t.title}」· Excel ${t.pack.sheets.length} 张表 · PPT ${t.pack.slides.length} 页设计`, model: mName('slideDesign'), ms: Date.now() - cur.ts });
    } catch (e) { traceFail(t, cur, e.message); t.pack = fallbackPack(t, e.message); log(t.cmdId, 'esc', `⚠️ 「${short(t.title)}」汇报材料编排失败（${esc(e.message)}），使用基础版`, '#dc2626'); }
    if (t.status === 'rejected') return;
    refresh();
    // 并行生成幻灯片（失败的页自动回退为文字版式）
    let credits = 0;
    await Promise.all(t.pack.slides.map(async (s, i) => {
      const e = trace(t, 'slide', { status: 'run', tool: 'slide', detail: `${slmName(cfg.slideModel)} 生成第 ${i + 1} 页「${s.title}」` });
      try { const r = await AI.call('/task/slide', { model: cfg.slideModel, slide: s, index: i, company: S.company.name, dept: d?.name, color: d?.color }); s.url = r.url; credits += +r.credits || 0; traceOk(t, e, { detail: `第 ${i + 1} 页「${s.title}」已生成`, model: slmName(r.model), images: [{ url: r.url }], ms: Date.now() - e.ts }); }
      catch (err) { traceFail(t, e, err.message); }
      finally { s.pending = false; refresh(); }
    }));
    t.pack.credits = credits;
    const ok = t.pack.slides.filter((s) => s.url).length;
    log(t.cmdId, 'trace', `🎞️ ${esc(d?.name || '')} 汇报材料就绪：Word + Excel ${t.pack.sheets.length} 表 + PPT ${ok}/${t.pack.slides.length} 页（${slmName(cfg.slideModel)}）· <a class="lnk" onclick="openReport('${t.id}')">查看汇报</a>`, '#ea580c');
    fx(t.deptId, 'brain', '汇报材料', '#ea580c');
    saveState();
    then && then();
  }
  F.makePack = makePack;
  // 页面刷新时中断的「出汇报材料」任务：自动续跑
  setTimeout(() => { (S.sim?.tasks || []).filter((t) => t.status === 'pack').forEach((t) => { const a = agentOf(t.agentId); makePack(t, () => { if (t.status === 'rejected') return; if (t.needApproval) toApproval(t, 'risk'); else if (a?.level === 'L1') toApproval(t, 'l1'); else deliver(t); saveState(); refresh(); }); }); }, 2500);
  function toApproval(t, why) {
    t.status = 'approval';
    const action = why === 'l1' ? '建议级 Agent 成果确认' : (/报价|签约|合同/.test(t.title) ? '报价/签约' : /投放|预算|广告/.test(t.title) ? '追加预算/投放' : /发布|宣传|海报|视频|群发/.test(t.title) ? '对外发布' : '高风险动作执行');
    addApproval({ kind: 'result', taskId: t.id, cmdId: t.cmdId, deptId: t.deptId, action, desc: `「${t.title}」已通过校验（${t.evals.total} 分），执行前需老板确认` });
    fx('qa', 'boss', '待审批', '#d97706');
  }
  function deliver(t) {
    if (t.status === 'done') return;
    const c = cmdOf(t.cmdId), a = agentOf(t.agentId), d = deptOf(t.deptId);
    t.status = 'done'; t.doneAt = stamp(); t.progress = 100;
    S.sim.metrics.done++; S.sim.today.done++;
    // 人工通过/复核通过的任务也补齐汇报材料（后台生成，完成后刷新档案）
    if (!t.pack && t.output) makePack(t, () => { const cc = cmdOf(t.cmdId); if (cc?.archiveId && window.Archive) Archive.add(cc); saveState(); refresh(); }, true);
    const hrs = rand(1, 4); S.sim.metrics.hours += hrs; S.sim.today.hours += hrs;
    if (t.real) S.sim.real.done++;
    if (a) { a.done++; a.status = 'idle'; }
    log(t.cmdId, 'deliver', `📦 交付「${short(t.title, 24)}」· ${esc(d?.name || '')} · <a class="lnk" onclick="openTaskModal('${t.id}')">查看成果</a>`, '#059669');
    fx(t.deptId, 'brain', '交付', c?.color || '#059669'); say(t.agentId, '交付 ✓', 'ai');
    // 阶段联动（仍归属本指令）
    if (d?.lib === 'sales' && t.kind === 'leads' && !t.real) simLeads(t);
    (t.foundLeads || []).forEach((id) => { const L = S.sim.leads.find((x) => x.id === id); if (L && c && L.status === 'new') appendFollowups(c, L); });
    if (d?.lib === 'brand' && /海报|视频|推文|宣传/.test(t.title)) makeContent(t);
    if (d?.lib === 'procurement' && /比价/.test(t.title) && !t.real) { const v = rand(5000, 30000); S.sim.metrics.saved += v; log(t.cmdId, 'value', `💰 比价测算可节省成本约 ¥${fmtMoney(v)}（仿真）`, '#ca8a04'); }
    checkCommand(c);
  }

  // 商机 → 跟进任务方案
  function leadPlan(L) {
    const sales = deptByLib('sales');
    const td = ['product', 'production', 'rnd', 'project', 'design', 'service'].map(deptByLib).filter(Boolean)[0];
    const items = [];
    if (sales) items.push({ deptId: sales.id, title: `制定跟进方案与报价依据（${L.title.slice(0, 12)}…）`, deliverable: `跟进话术、报价依据与下一步。商机：${L.title}；${L.desc || ''}；来源 ${L.link || ''}`, needApproval: true, ref: L.id, sla: 240 });
    if (td) { const tt = { product: '评估订单定制需求', production: '评估产能与交期', rnd: '评审技术可行性', project: '评估实施方案', design: '出具初版设计方案', service: '制定交付服务计划' }[td.lib]; items.push({ deptId: td.id, title: `${tt}（${L.title.slice(0, 12)}…）`, deliverable: `针对该商机的评估结论。商机：${L.title}；${L.desc || ''}`, needApproval: false, ref: L.id, sla: 240 }); }
    return items;
  }
  // 老板在商机雷达点「下达跟进」：作为一条新指令进入流程（方案已确定，直接分发）
  F.followLead = function (L) {
    if (!L || L.status !== 'new') return null;
    const c = F.issue(`跟进商机：${L.title.slice(0, 28)}`, { source: 'lead', plan: leadPlan(L), ref: L.id });
    if (c) { L.status = 'synced'; L.cmdId = c.id; S.sim.metrics.pipeline += L.value || 0; S.sim.today.pipeline += L.value || 0; }
    return c;
  };
  // 指令执行中发现的 A 级商机 → 追加跟进任务（留在原指令内继续流转）
  function appendFollowups(c, L) {
    const sales = deptByLib('sales');
    const td = ['product', 'production', 'rnd', 'project', 'design', 'service'].map(deptByLib).filter(Boolean)[0];
    L.status = 'synced'; L.cmdId = c.id; S.sim.metrics.pipeline += L.value || 0; S.sim.today.pipeline += L.value || 0;
    const items = leadPlan(L);
    if (c.stage !== 'run') c.stage = 'run';
    items.forEach((p) => { c.plan.push(p); const t = createTask(p.deptId, p.title, { cmdId: c.id, deliverable: p.deliverable, needApproval: p.needApproval, ref: p.ref }); if (t) c.taskIds.push(t.id); });
    if (sales && td) fx(sales.id, td.id, '订单同步', '#059669');
    log(c.id, 'dispatch', `🔗 A级商机「${short(L.title, 26)}」→ 在 #${c.no} 内追加 ${items.length} 项跟进任务`, '#7c3aed');
  }
  function simLeads(t) {
    const kw = (t.kws?.length ? t.kws : (S.industry?.div?.kw || '').split(' ')).filter(Boolean);
    const n = rand(1, 2), ids = [];
    for (let i = 0; i < n; i++) {
      const g = Math.random(), grade = g < .4 ? 'A' : g < .8 ? 'B' : 'C';
      const L = { id: uid('l'), title: `${pick(['华东', '华南', '西南', '华北', '华中'])}${pick(['某集团', '某国企', '某连锁品牌', '某产业园'])}${pick(['采购', '招标', '询价'])}：${pick(kw) || S.industry?.div?.name}${pick(['项目', '年度框架', '批量采购'])}`, link: '', source: '仿真线索', desc: '', real: false, grade, value: grade === 'A' ? rand(30, 300) * 10000 : rand(5, 60) * 10000, match: grade === 'A' ? rand(85, 96) : rand(55, 84), status: 'new', day: S.sim.day, cmdId: t.cmdId };
      S.sim.leads.unshift(L); S.sim.metrics.leads++; S.sim.today.leads++; if (grade === 'A') ids.push(L.id);
      log(t.cmdId, 'lead', `🎯 发现 <b>${grade}级</b> 商机（仿真）：${short(L.title, 30)}`, grade === 'A' ? '#059669' : '#2563eb');
    }
    t.foundLeads = ids.slice(0, 1);
  }
  function makeContent(t) {
    const C = { id: uid('ct'), type: /视频/.test(t.title) ? 'video' : 'poster', title: `${S.company.name.replace(/(股份有限公司|有限责任公司|有限公司)$/, '')}·${t.title.slice(0, 12)}`, status: 'pending', channels: ['抖音', '视频号', '小红书', '公众号'], views: 0, leads: 0, day: S.sim.day, cmdId: t.cmdId };
    S.sim.contents.unshift(C); if (S.sim.contents.length > 40) S.sim.contents.length = 40; S.sim.metrics.contents++;
    addApproval({ kind: 'content', contentId: C.id, cmdId: t.cmdId, deptId: t.deptId, action: '对外发布', desc: `内容「${C.title}」待分发至 ${C.channels.join('/')}（可在内容工厂生成真实海报/视频）` });
  }

  // ====================== 审批（两道闸门） ======================
  function addApproval(o, deptId, desc, amount, ref) {
    if (typeof o === 'string') o = { kind: 'content', action: o, deptId, desc, amount, contentId: ref };
    const ap = { id: uid('ap'), status: 'pending', day: S.sim.day, t: simTime(), ...o };
    S.sim.approvals.unshift(ap); if (S.sim.approvals.length > 80) S.sim.approvals.length = 80;
    const c = cmdOf(ap.cmdId);
    log(ap.cmdId, 'approval', `🛡️ ${ap.kind === 'plan' ? '闸门①' : '闸门②'}「${esc(ap.action)}」等待老板审批${c ? ` · #${c.no}` : ''}`, '#d97706');
    say('boss', '有新的审批 📝', 'warn');
    window.updateBadges && updateBadges();
    return ap;
  }
  window.addApproval = addApproval;
  window.decideApproval = function (id, ok, reasonIn) {
    const ap = S.sim.approvals.find((a) => a.id === id); if (!ap || ap.status !== 'pending') return;
    let reason = reasonIn || '';
    if (!ok && reasonIn === undefined && ['plan', 'result', 'review'].includes(ap.kind)) { const v = prompt('驳回原因 / 修改意见（将作为下一轮的依据）：', ''); if (v === null) return; reason = v.trim(); }
    ap.status = ok ? 'approved' : 'rejected'; ap.reason = reason;
    S.sim.metrics.approvals++; if (!ok) S.sim.metrics.rejects++;
    const c = cmdOf(ap.cmdId), t = taskOf(ap.taskId);
    if (ap.kind === 'plan' && c && c.stage === 'confirm') {
      if (ok) { ap.status = 'pending'; S.sim.metrics.approvals--; F.decide(c.id, c.pick || c.strategy?.recommend, reason); return; }
      else { c.replans++; c.revisions = 0; c.feedback = `老板驳回上一版方案：${reason || '方案不满意，请重新规划'}`; log(c.id, 'confirm', `✖ 老板驳回 #${c.no} 方案${reason ? '：' + esc(reason) : ''} → 重新拆解（第 ${c.replans + 1} 版）`, '#dc2626'); fx('boss', 'brain', '重新拆解', '#dc2626'); plan(c); }
    }
    if (ap.kind === 'result' && t && t.status === 'approval') {
      if (ok) { log(t.cmdId, 'approval', `✔ 老板批准「${short(t.title)}」执行`, '#059669'); fx('boss', t.deptId, '批准', '#059669'); deliver(t); }
      else { backToRework(t, `老板驳回：${reason || '不同意执行，请调整方案'}`); log(t.cmdId, 'rework', `✖ 老板驳回「${short(t.title)}」${reason ? '：' + esc(reason) : ''} → 返工循环`, '#dc2626'); fx('boss', t.deptId, '驳回', '#dc2626'); }
    }
    if (ap.kind === 'review' && t && t.status === 'review') {
      if (ok) { t.humanPassed = true; t.evals.total = Math.max(t.evals.total, 80); log(t.cmdId, 'approval', `👤 老板人工复核通过「${short(t.title)}」`, '#059669'); fx('boss', t.deptId, '复核通过', '#059669'); deliver(t); }
      else { t.rework = 0; backToRework(t, `老板复核意见：${reason || '质量不达标，请重做'}`); log(t.cmdId, 'rework', `👤 老板复核打回「${short(t.title)}」→ 返工循环`, '#dc2626'); fx('boss', t.deptId, '打回', '#dc2626'); }
    }
    if (ap.kind === 'content') { const C = S.sim.contents.find((x) => x.id === ap.contentId || x.id === ap.ref); if (C) { C.status = ok ? 'live' : 'rejected'; log(ap.cmdId, 'approval', ok ? `📣 批准发布「${short(C.title)}」` : `✖ 驳回发布「${short(C.title)}」`, ok ? '#059669' : '#dc2626'); } }
    saveState(); refresh(); window.updateBadges && updateBadges();
  };
  function backToRework(t, fb) {
    if (t.status === 'done') { S.sim.metrics.done = Math.max(0, S.sim.metrics.done - 1); }
    t.feedback = fb; t.status = 'rework'; t.progress = 30; t.paused = false; t.stuck = false; S.sim.metrics.rework++;
    const a = agentOf(t.agentId); if (a) { a.fail++; a.streak = 0; }
  }
  function resolveTaskApprovals(t, ok) { S.sim.approvals.filter((a) => a.taskId === t.id && a.status === 'pending').forEach((a) => { a.status = ok ? 'approved' : 'rejected'; a.reason = '老板在任务详情中处理'; }); }
  // 老板在任务详情中直接处理
  F.passTask = function (t) {
    if (!t || t.status === 'done') return;
    if (!t.evals) t.evals = { ev: { acc: 80, evi: 80, time: 80, comp: 80, val: 80 }, total: 80 };
    t.evals.total = Math.max(t.evals.total, 80); t.humanPassed = true;
    resolveTaskApprovals(t, true);
    log(t.cmdId, 'approval', `👑 老板直接通过「${short(t.title)}」`, '#059669');
    deliver(t); saveState(); refresh();
  };
  F.reworkTask = function (t, fb) {
    const c = cmdOf(t.cmdId);
    if (c && ['accept', 'improve', 'done'].includes(c.stage)) { toast('该指令已进入复盘，请在指令详情中「迭代下一轮」'); return false; }
    resolveTaskApprovals(t, false);
    backToRework(t, `老板意见：${fb}`);
    log(t.cmdId, 'rework', `👑 老板打回「${short(t.title)}」：${esc(fb)} → 返工循环`, '#d97706');
    fx('boss', t.deptId, '打回', '#dc2626'); saveState(); refresh(); return true;
  };
  F.retryTask = function (t) { t.paused = false; t.retries = 0; t.stuck = false; t.error = ''; saveState(); refresh(); };

  // ====================== ⑨ 指令验收 → 复盘提升 ======================
  function checkCommand(c) {
    if (!c || c.stage !== 'run') return;
    const ts = c.taskIds.map(taskOf).filter(Boolean);
    if (ts.length && ts.every((t) => ['done', 'rejected'].includes(t.status))) accept(c);
  }
  async function accept(c) {
    c.stage = 'accept';
    log(c.id, 'accept', `🧾 #${c.no} 全部任务交付，智脑进行指令级验收…`, '#2563eb');
    fx('brain', 'qa', '指令验收', '#2563eb');
    const ts = c.taskIds.map(taskOf).filter((t) => t && t.status === 'done');
    if (c.real && isReal()) {
      let rv = null;
      try {
        rv = await AI.call('/review', { ...ctxBase(), engine: roleModel('review'), decision: c.decision ? { key: c.decision.key, option: `${c.decision.key} ${c.decision.name}`, recommended: c.decision.recommended, feasibility: c.decision.feas } : null, targets: c.strategy?.targets || [], text: c.text, goal: c.goal, depts: S.depts.map((d) => d.name), results: ts.map((t) => ({ dept: deptOf(t.deptId)?.name, title: t.title, score: t.evals?.total || 0, rework: t.rework, human: !!t.humanPassed, output: String(t.output || '').slice(0, 700) })) });
      } catch (e) { log(c.id, 'accept', `⚠️ AI 验收失败（${esc(e.message)}），使用规则验收`, '#dc2626'); }
      if (c.stage !== 'accept') return;
      improve(c, rv || localReview(c));
    } else c.acceptDue = S.sim.min + 15;
  }
  function localReview(c) {
    const ts = c.taskIds.map(taskOf).filter((t) => t && t.status === 'done');
    const avg = ts.length ? ts.reduce((s, t) => s + (t.evals?.total || 80), 0) / ts.length : 0;
    const rw = ts.reduce((s, t) => s + t.rework, 0);
    const score = Math.max(0, Math.round(avg - rw * 3));
    const fbs = ts.filter((t) => t.rework || t.humanPassed).map((t) => `${deptOf(t.deptId)?.name}：${t.history[0]?.feedback || ''}`).filter((x) => x.length > 4);
    return {
      score, verdict: score >= 85 ? 'achieved' : score >= 70 ? 'partial' : 'failed',
      summary: `${ts.length} 项任务交付，平均 ${Math.round(avg)} 分，返工 ${rw} 次。`,
      lessons: (fbs.length ? fbs.slice(0, 2).map((f) => ({ dept: f.split('：')[0], text: `避免返工：${f.split('：')[1]}` })) : []).concat([{ dept: '全局', text: `「${c.text.slice(0, 16)}」类指令：${pick(['先对齐目标数字再分发', '高风险动作提前准备审批材料', '跨部门任务明确交付接口', '先检索数据再下结论'])}` }]),
      next: [pick(['扩大检索范围寻找更多机会', '跟进已产出方案的落地数据', '针对返工环节补充数据', '把通过的方案复制到其他区域'])],
      decision: c.decision ? { score: Math.max(50, Math.min(98, score + (c.decision.follow ? 2 : -2))), effect: `（仿真）方案 ${c.decision.key} 已由 ${ts.length} 个部门承接并交付`, gap: '（仿真）需真实经营数据验证目标达成', nextDecision: '是否追加资源进入第二轮' } : null
    };
  }
  function improve(c, rv) {
    c.stage = 'improve';
    c.acceptance = { score: Math.round(+rv.score || 0), verdict: rv.verdict || 'partial', summary: rv.summary || '' };
    c.decisionEval = rv.decision || null;
    if (c.decision && c.decisionEval) { (S.sim.decisions = S.sim.decisions || []).unshift({ cmdId: c.id, no: c.no, text: c.text, key: c.decision.key, name: c.decision.name, follow: c.decision.follow, feas: c.decision.feas, score: c.decisionEval.score, effect: c.decisionEval.effect, accept: c.acceptance.score, at: stamp() }); if (S.sim.decisions.length > 50) S.sim.decisions.length = 50; }
    S.sim.metrics.accepted++;
    // 经验沉淀（下一次执行时注入）
    const ls = (rv.lessons || []).slice(0, 3).map((l) => typeof l === 'string' ? { dept: '全局', text: l } : l).filter((l) => l?.text);
    ls.forEach((l) => { const d = S.depts.find((x) => x.name === l.dept); S.sim.knowledge.unshift({ id: uid('k'), day: S.sim.day, title: String(l.text).slice(0, 80), dept: d ? d.name : '全局', deptId: d?.id || null, cmdId: c.id, cmdNo: c.no, used: 0 }); });
    if (S.sim.knowledge.length > 60) S.sim.knowledge.length = 60;
    // Agent 升降级
    const order = ['L1', 'L2', 'L3'], promos = [];
    c.taskIds.map(taskOf).filter((t) => t && t.evals).forEach((t) => {
      const a = agentOf(t.agentId); if (!a || a.sub) return;
      if (t.humanPassed || (t.rework && t.evals.total < 80)) { a.streak = 0; const i = order.indexOf(a.level); if (i > 0) { a.level = order[i - 1]; promos.push(`${a.name} ↓${a.level}`); S.sim.metrics.demoted++; } return; }
      if (t.evals.total >= 88 && !t.rework) { a.streak = (a.streak || 0) + 1; if (a.streak >= 2) { const i = order.indexOf(a.level); if (i >= 0 && i < 2) { a.level = order[i + 1]; promos.push(`${a.name} ↑${a.level}`); S.sim.metrics.promoted++; } a.streak = 0; } }
      else if (t.rework) a.streak = 0;
    });
    c.review = { lessons: ls.map((l) => `${l.dept !== '全局' ? '[' + l.dept + '] ' : ''}${l.text}`), next: (rv.next || []).slice(0, 3), promos };
    const vl = { achieved: '目标达成', partial: '部分达成', failed: '未达成' }[c.acceptance.verdict] || c.acceptance.verdict;
    log(c.id, 'improve', `📈 #${c.no} 复盘提升：验收 <b>${c.acceptance.score}</b> 分（${vl}）${c.decisionEval ? ` · 老板决策见效 <b>${c.decisionEval.score}</b> 分` : ''}· 沉淀经验 ${ls.length} 条${promos.length ? ' · ' + esc(promos.join('、')) : ''} · <a class="lnk" onclick="openCmdModal('${c.id}')">查看复盘</a>`, '#7c3aed');
    fx('brain', 'kb', '经验沉淀', '#7c3aed'); setTimeout(() => fx('kb', 'brain', '知识注入', '#7c3aed'), 1500);
    c.stage = 'done'; c.doneAt = stamp();
    // 及时归档：各部门 Word / Excel / PPT + 执行表 + 验收 + 复盘
    if (window.Archive) { const rec = Archive.add(c); log(c.id, 'archive', `🗂️ #${c.no} 已归档：${rec.stats.depts} 个部门 · ${rec.stats.docs} 份文档 · ${rec.stats.slides} 页幻灯片 · <a class="lnk" onclick="gotoView('archive')">查看项目档案</a> · <a class="lnk" onclick="Market.shareFromArchive(Archive.get('${rec.id}'))">共享给同行赚智点</a>`, '#0f766e'); }
    if (c.idea && window.ideaCmdDone) { try { ideaCmdDone(c); } catch (e) { console.warn(e); } }
    saveState(); refresh();
  }

  // ====================== 循环：迭代 / 例行 ======================
  F.iterate = function (id, extra) {
    const c = cmdOf(id); if (!c) return null;
    const base = c.text.replace(/（第\d+轮）$/, '');
    const fb = [c.review?.next?.length ? `上一轮复盘建议：${c.review.next.join('；')}` : '', c.acceptance ? `上一轮验收：${c.acceptance.score}分，${c.acceptance.summary}` : '', extra ? `老板补充：${extra}` : ''].filter(Boolean).join('\n');
    S.sim.metrics.iterations++;
    return F.issue(`${base}（第${c.iteration + 1}轮）`, { source: c.source === 'routine' ? 'routine' : 'iterate', parentId: c.id, iteration: c.iteration + 1, feedback: fb });
  };
  F.cancel = function (id) {
    const c = cmdOf(id); if (!c || ['done', 'cancelled'].includes(c.stage)) return;
    c.stage = 'cancelled';
    c.taskIds.map(taskOf).forEach((t) => { if (t && t.status !== 'done') { t.status = 'rejected'; const a = agentOf(t.agentId); if (a) a.status = 'idle'; } });
    S.sim.approvals.filter((a) => a.cmdId === id && a.status === 'pending').forEach((a) => { a.status = 'rejected'; a.reason = '指令已取消'; });
    log(c.id, 'cancel', `⏹ 老板取消 #${c.no}`, '#dc2626'); saveState(); refresh();
  };
  F.toggleRoutine = function (text, on) {
    if (on) { if (!S.sim.routines.some((r) => r.text === text)) S.sim.routines.push({ id: uid('r'), text, since: S.sim.day, lastDay: S.sim.day }); }
    else S.sim.routines = S.sim.routines.filter((r) => r.text !== text);
    saveState(); refresh();
  };
  F.baseText = (t) => String(t || '').replace(/（第\d+轮）$/, '');

  // ====================== 每日机制检查点 ======================
  F.checkpoint = function (cp) {
    const T = S.sim.tasks, active = T.filter((t) => ['queued', 'exec', 'rework'].includes(t.status));
    if (cp.k === 'routine') {
      S.sim.routines.forEach((r) => {
        if (r.lastDay >= S.sim.day) return; r.lastDay = S.sim.day;
        const last = S.sim.commands.find((c) => F.baseText(c.text) === r.text);
        if (last && !['done', 'cancelled'].includes(last.stage)) { log(last.id, 'routine', `🔁 例行「${short(r.text)}」上一轮仍在进行，今日不重复下发`, '#059669'); return; }
        if (last) F.iterate(last.id); else F.issue(r.text, { source: 'routine' });
      });
    }
    if ((cp.k === 'check' || cp.k === 'patrol') && active.length) {
      const over = active.filter((t) => t.age > t.sla || t.stuck || t.paused);
      over.forEach(escalate);
      log(null, 'cp', `🔎 ${cp.name}：在办 ${active.length} 项，逾期/卡点 ${over.length} 项${over.length ? '，已启动督办' : ''}`, over.length ? '#d97706' : '#64748b');
    }
    if (cp.k === 'report') {
      S.agents.forEach((a) => a.score = agentTotal(a));
      if (S.sim.today.verify || S.sim.today.done) log(null, 'cp', `📊 日终：交付 ${S.sim.today.done} 项 · 校验 ${S.sim.today.verify} 次 · 一次通过率 ${F.passRate()}% · 待审批 ${S.sim.approvals.filter((a) => a.status === 'pending').length} 项`, '#2563eb');
    }
    if (cp.k === 'learn') {
      const n = S.sim.knowledge.filter((k) => k.day === S.sim.day).length;
      if (n) log(null, 'cp', `🧠 今日沉淀经验 ${n} 条，已注入后续指令的拆解与执行`, '#7c3aed');
    }
    refresh();
  };
  function escalate(t) {
    t.esc = Math.min(3, t.esc + 1); S.sim.metrics.esc++;
    const owner = S.staff.find((s) => s.id === t.ownerId);
    const lv = ['', '提醒执行 Agent', `通知负责人 ${owner?.name || ''}`, '上报老板'][t.esc];
    log(t.cmdId, 'esc', `⏰ 督办 L${t.esc}：「${short(t.title)}」${t.stuck || t.paused ? '卡点' : '逾期'} → ${lv}`, t.esc >= 3 ? '#dc2626' : '#d97706');
    if (t.esc === 1) say(t.agentId, '收到督办，加速', 'warn');
    if (t.esc === 2) say(t.ownerId, '我来跟进！', 'warn');
    if (t.esc >= 3) { fx(t.deptId, 'boss', '督办升级', '#dc2626'); say('boss', '这个怎么卡住了？', 'warn'); }
    if (t.stuck && !t.real) t.stuck = false;
    if (t.paused && t.esc >= 2) { t.paused = false; t.retries = 0; }
    t.sla += 120;
  }
  F.newDay = function () {
    const sim = S.sim;
    sim.history.push({ day: sim.day, ...sim.today }); if (sim.history.length > 30) sim.history.shift();
    if (sim.today.done || sim.today.verify) log(null, 'day', `🌙 第 ${sim.day} 天结束 · 交付 ${sim.today.done} 项 · 校验 ${sim.today.verify} 次`, '#7c3aed');
    sim.day++; sim.min = DAY_START; sim.today = { done: 0, leads: 0, pipeline: 0, hours: 0, verify: 0 };
  };

  // ====================== 统计 ======================
  F.passRate = () => S.sim.metrics.first ? Math.round(S.sim.metrics.pass1 / S.sim.metrics.first * 100) : 100;
  F.col = (t) => ({ queued: 'exec', exec: 'exec', rework: 'exec', verify: 'verify', pack: 'deliver', approval: 'approve', review: 'approve', done: 'deliver' }[t.status] || null);
  F.active = () => S.sim.commands.filter((c) => !['done', 'cancelled'].includes(c.stage));
  F.stats = function () {
    const T = S.sim.tasks, A = S.sim.approvals.filter((a) => a.status === 'pending');
    return {
      activeCmds: F.active().length,
      openTasks: T.filter((t) => !['done', 'rejected'].includes(t.status)).length,
      rework: T.filter((t) => t.status === 'rework').length,
      routines: S.sim.routines.length, iterations: S.sim.metrics.iterations,
      pending: A.length, pendPlan: A.filter((a) => a.kind === 'plan').length, pendResult: A.filter((a) => a.kind !== 'plan').length,
      verifyToday: S.sim.today.verify, passRate: F.passRate(),
      knowledge: S.sim.knowledge.length, promoted: S.sim.metrics.promoted, demoted: S.sim.metrics.demoted
    };
  };
  F.cmdSteps = function (c) {
    // 返回 9 个阶段的状态：done / active / pending / skip
    const st = STAGES.map(() => 'pending');
    if (c.stage === 'cancelled') return st.map(() => 'skip');
    const pre = { plan: 0, research: 0, strategy: 1, feasibility: 2, confirm: 3 }[c.stage];
    if (pre !== undefined) { for (let i = 0; i < pre; i++) st[i] = c.skipPrep ? 'skip' : 'done'; st[pre] = 'active'; return st; }
    for (let i = 0; i < 3; i++) st[i] = c.skipPrep || !c.strategy ? (c.research || c.strategy ? 'done' : 'skip') : 'done';
    st[3] = c.confirm === 'approved' ? 'done' : 'skip';
    if (['accept', 'improve', 'done'].includes(c.stage)) { for (let i = 4; i < 8; i++) st[i] = 'done'; st[8] = c.stage === 'done' ? 'done' : 'active'; return st; }
    const ts = c.taskIds.map(taskOf).filter((t) => t && t.status !== 'rejected');
    const pos = ts.map((t) => STAGES.findIndex((s) => s.k === F.col(t)));
    for (let i = 4; i < 8; i++) st[i] = pos.some((p) => p === i) ? 'active' : pos.length && pos.every((p) => p > i) ? 'done' : 'pending';
    if (ts.length && ts.every((t) => t.status === 'done')) st[7] = 'done';
    return st;
  };

})();
