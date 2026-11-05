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
    { k: 'plan', n: '拆解', who: '智脑中枢', i: 'fa-brain' },
    { k: 'confirm', n: '方案确认', who: '老板', i: 'fa-stamp', gate: true },
    { k: 'dispatch', n: '分发', who: '部门集群', i: 'fa-share-nodes' },
    { k: 'exec', n: '执行', who: 'Agent', i: 'fa-robot' },
    { k: 'verify', n: '校验', who: 'AI 质检官', i: 'fa-clipboard-check' },
    { k: 'approve', n: '审批', who: '老板', i: 'fa-shield-halved', gate: true },
    { k: 'deliver', n: '交付', who: '部门', i: 'fa-box-open' },
    { k: 'improve', n: '复盘提升', who: '知识库', i: 'fa-arrow-trend-up' }
  ];
  window.FLOW_STAGES = STAGES;
  const CMD_COLORS = ['#3ee0ff', '#ffd54f', '#ff4fa3', '#3ddc97', '#b69bff', '#ff9f43', '#4fc3f7', '#f06292'];
  const SRC = { boss: ['老板', '#ffd54f'], routine: ['例行', '#3ddc97'], iterate: ['迭代', '#b69bff'], lead: ['商机', '#3ee0ff'] };
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
    if (S.sim && S.sim.ver === 2) return;
    const old = S.sim || {};
    S.sim = {
      ver: 2, day: old.day || 1, min: DAY_START, speed: old.speed ?? 1, seq: 0,
      commands: [], tasks: [], approvals: [], leads: old.leads || [], contents: old.contents || [], feed: [], knowledge: (old.knowledge || []).filter((k) => k.cmdId), cp: {}, routines: [],
      settings: { planConfirm: true },
      metrics: { done: 0, rework: 0, verify: 0, first: 0, pass1: 0, leads: old.metrics?.leads || 0, pipeline: old.metrics?.pipeline || 0, revenue: 0, hours: 0, saved: 0, esc: 0, contents: old.metrics?.contents || 0, views: old.metrics?.views || 0, promoted: 0, demoted: 0, iterations: 0, approvals: 0, rejects: 0, accepted: 0 },
      history: [], today: { done: 0, leads: 0, pipeline: 0, hours: 0, verify: 0 }, brief: old.brief || null, real: { done: 0, rework: 0, review: 0, leads: 0 }
    };
    S.agents.forEach((a) => { if (!a.sub) a.level = 'L2'; a.status = 'idle'; a.streak = 0; });
    log(null, 'sys', `企业智脑上线 · ${S.agents.length} 个 Agent 待命 —— 所有工作从老板指令开始`, '#3ee0ff');
  };

  function log(cmdId, type, html, color = '#8fa3c8') {
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
      log: [], review: null, acceptance: null, real: isReal(), feedback: opt.feedback || '', presetPlan: opt.plan || null, confirm: null, replans: 0, ref: opt.ref || null
    };
    S.sim.commands.unshift(c);
    if (S.sim.commands.length > 40) { const drop = S.sim.commands.slice(40).filter((x) => ['done', 'cancelled'].includes(x.stage)).map((x) => x.id); S.sim.commands = S.sim.commands.filter((x) => !drop.includes(x.id)); S.sim.tasks = S.sim.tasks.filter((t) => !drop.includes(t.cmdId)); }
    if (opt.routine && !S.sim.routines.some((r) => r.text === text)) S.sim.routines.push({ id: uid('r'), text, since: S.sim.day, lastDay: S.sim.day });
    const [sl] = SRC[c.source] || SRC.boss;
    log(c.id, 'issue', `👑 <b>#${no}</b> ${sl}指令下达「${esc(text)}」${c.iteration > 1 ? ` · 第 ${c.iteration} 轮` : ''}${opt.routine ? ' · 已设为每日例行' : ''}`, '#ffd54f');
    F.focus = c.id;
    say('boss', text.slice(0, 14));
    fx('boss', 'brain', '指令', '#ffd54f');
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
  function localPlan(c) {
    let hit = CMD_MAP.filter((m) => m.re.test(c.text));
    if (!hit.length) hit = [{ libs: ['strategy', 'operation', 'sales'], titles: {}, appr: [] }];
    const plan = [];
    hit.forEach((h) => h.libs.forEach((lib) => { const d = deptByLib(lib); if (!d || plan.some((p) => p.deptId === d.id)) return; const title = h.titles[lib] || `落实：${c.text.slice(0, 16)}`; plan.push({ deptId: d.id, title, deliverable: '可直接使用的工作成果', sla: 240, needApproval: h.appr.includes(lib), kind: lib === 'sales' && LEAD_RE.test(title) ? 'leads' : null }); }));
    if (!plan.length) plan.push({ deptId: S.depts[0].id, title: c.text.slice(0, 24), deliverable: '工作成果', sla: 240, needApproval: false });
    c.plan = plan.slice(0, 6); c.goal = c.goal || c.text;
  }
  async function plan(c) {
    c.stage = 'plan';
    if (c.presetPlan) { c.plan = c.presetPlan; c.goal = c.goal || c.text; return afterPlan(c, true); }
    if (c.real && isReal()) {
      try {
        const r = await AI.call('/command', { ...ctxBase(), text: c.text, feedback: c.feedback, knowledge: knowledgeFor(null), depts: S.depts.map((d) => ({ id: d.id, name: d.name })) });
        if (!r.tasks?.length) throw new Error('未拆解出任务');
        c.goal = r.goal || c.text;
        c.plan = r.tasks.map((x) => ({ ...x, kind: deptOf(x.deptId)?.lib === 'sales' && LEAD_RE.test(x.title) ? 'leads' : null }));
      } catch (e) { log(c.id, 'plan', `⚠️ AI 拆解失败（${esc(e.message)}），改用本地规则`, '#ff5d6c'); localPlan(c); }
      if (c.stage !== 'plan') return; // 期间被取消
      afterPlan(c);
    } else { localPlan(c); c.planDue = S.sim.min + rand(15, 25); }
  }
  function afterPlan(c, direct) {
    c.planDue = null;
    const names = [...new Set(c.plan.map((p) => deptOf(p.deptId)?.name).filter(Boolean))];
    log(c.id, 'plan', `🧠 智脑拆解 #${c.no}：目标「${esc(c.goal)}」→ ${c.plan.length} 项任务（${esc(names.join('、'))}）${c.plan.some((p) => p.needApproval) ? '，含高风险动作' : ''}`, '#3ee0ff');
    if (!direct && S.sim.settings.planConfirm && c.source !== 'routine') {
      c.stage = 'confirm';
      addApproval({ kind: 'plan', cmdId: c.id, action: '方案确认', desc: `#${c.no}「${c.text.slice(0, 30)}」拆解为 ${c.plan.length} 项：${c.plan.map((p) => `${deptOf(p.deptId)?.name}·${p.title}${p.needApproval ? '(高风险)' : ''}`).join('；')}` });
      fx('brain', 'boss', '方案待确认', '#ffb547');
    } else { c.confirm = direct ? 'direct' : 'skip'; dispatch(c); }
    saveState(); refresh();
  }

  // ====================== ④ 分发 ======================
  function dispatch(c) {
    c.stage = 'run';
    c.plan.forEach((p, i) => {
      const t = createTask(p.deptId, p.title, { cmdId: c.id, deliverable: p.deliverable, sla: p.sla, needApproval: p.needApproval, kind: p.kind, ref: p.ref, kws: p.kws });
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
    const t = {
      id: uid('t'), cmdId: opt.cmdId || null, deptId, title, agentId: ag?.id, ownerId: staff.length ? [...staff].sort((a, b) => b.value - a.value)[0].id : null,
      status: 'queued', progress: 0, sla: opt.sla || 240, age: 0, day: S.sim.day, esc: 0, stuck: false, evals: null, rework: 0,
      real: !!(c ? c.real && isReal() : isReal()), deliverable: opt.deliverable || '', needApproval: !!opt.needApproval, kind: opt.kind || null, ref: opt.ref || null, kws: opt.kws || null,
      output: null, history: [], feedback: ''
    };
    S.sim.tasks.unshift(t);
    return t;
  }
  window.createTask = createTask;

  // ====================== ⑤ 执行 ======================
  // 仿真推进（未连接 Genspark 时）
  F.step = function (step) {
    S.sim.commands.forEach((c) => {
      if (c.stage === 'plan' && c.planDue && S.sim.min >= c.planDue) afterPlan(c);
      if (c.stage === 'accept' && c.acceptDue && S.sim.min >= c.acceptDue) improve(c, localReview(c));
    });
    S.sim.tasks.forEach((t) => {
      if (['done', 'approval', 'review', 'rejected'].includes(t.status)) return;
      t.age += step;
      if (t.real) return;
      const a = agentOf(t.agentId);
      if (t.status === 'queued') { if (Math.random() < .5) { t.status = 'exec'; if (a) a.status = 'busy'; say(t.agentId, `接单：${t.title.slice(0, 8)}…`, 'ai'); } }
      else if (t.status === 'exec' || t.status === 'rework') {
        if (t.status === 'rework') t.status = 'exec';
        if (!t.stuck && Math.random() < .01) { t.stuck = true; say(t.agentId, '缺数据，卡住了', 'warn'); }
        if (!t.stuck) t.progress = Math.min(100, t.progress + rand(5, 12));
        if (t.progress >= 100) { t.status = 'verify'; t.verifyDue = S.sim.min + 10; if (a) a.status = 'verify'; fx(t.deptId, 'qa', '提交校验', '#ffb547'); }
      } else if (t.status === 'verify' && S.sim.min >= t.verifyDue) {
        const ev = simEval(t);
        t.output = t.output || `【仿真成果】${t.title}：已按交付物要求完成（仿真模式，无真实内容）。`;
        applyVerdict(t, ev);
      }
    });
  };
  function simEval(t) {
    const a = agentOf(t.agentId) || { evals: { acc: 85, evi: 80, time: 85, comp: 90, val: 75 } };
    const ev = {}; EVAL_DIMS.forEach((d) => { ev[d.k] = Math.max(40, Math.min(100, a.evals[d.k] + rand(-14, 8) + (t.rework ? 7 : 0))); });
    if (t.age > t.sla) ev.time = Math.max(40, ev.time - 15);
    const total = Math.round(EVAL_DIMS.reduce((s, d) => s + ev[d.k] * d.w, 0) / 100);
    return { ev, total, feedback: total >= 80 ? pick(['结论清晰、步骤可执行', '数据完整、责任到人', '方案务实、风险提示到位']) : pick(['补充数据来源与测算依据', '明确责任人与时间节点', '细化执行步骤并量化目标', '补充风险与合规提示']) };
  }
  // 真实执行（Genspark）
  async function runReal(t) {
    F.running.add(t.id);
    const c = cmdOf(t.cmdId), d = deptOf(t.deptId), a = agentOf(t.agentId);
    const wasRework = t.status === 'rework';
    t.status = 'exec'; t.stuck = false; t.error = '';
    if (a) a.status = 'busy';
    say(t.agentId, wasRework ? '按意见返工中…' : '调用 Genspark 执行…', 'ai');
    const anim = setInterval(() => { if (t.status === 'exec' && t.progress < 90) t.progress = Math.min(90, t.progress + rand(3, 8)); }, 900);
    try {
      let output, researched = false;
      if (t.kind === 'leads') { const r = await leadTask(t); output = r.output; researched = true; }
      else {
        const r = await AI.call('/execute', { ...ctxBase(), goal: c?.goal || '', dept: d?.name, agent: a?.name, task: t.title, deliverable: t.deliverable, research: RESEARCH_RE.test(t.title), feedback: wasRework ? t.feedback : '', previous: wasRework ? t.output : '', knowledge: knowledgeFor(t.deptId), evaluate: false });
        output = r.output; researched = r.researched;
      }
      if (t.status === 'rejected') return;
      t.output = output; t.progress = 100;
      // ⑥ 校验（独立调用：AI 质检官）
      t.status = 'verify'; if (a) a.status = 'verify';
      fx(t.deptId, 'qa', '提交校验', '#ffb547'); say(t.agentId, '提交质检…', 'ai');
      const ev = await AI.call('/evaluate', { ...ctxBase(), dept: d?.name, agent: a?.name, task: t.title, output });
      if (t.status === 'rejected') return;
      applyVerdict(t, { ev: ev.evals, total: ev.total, feedback: ev.feedback, researched });
    } catch (e) {
      t.status = wasRework ? 'rework' : 'queued'; t.progress = 0; t.stuck = true; t.error = e.message; t.retries = (t.retries || 0) + 1;
      if (a) a.status = 'idle';
      log(t.cmdId, 'esc', `⚠️ 「${short(t.title)}」执行失败：${esc(e.message)}${t.retries >= 2 ? '（已暂停，可在任务详情重试）' : '，稍后自动重试'}`, '#ff5d6c');
      if (t.retries >= 2) t.paused = true;
    } finally { clearInterval(anim); F.running.delete(t.id); saveState(); refresh(); }
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
      ? `本轮 Genspark 全网检索后，AI 筛出 **${leads.length}** 条有效商机：\n` + leads.map((l) => `- **${l.grade}级** ${l.title}（采购方：${l.buyer || '未知'}，匹配 ${l.match}%）：${l.reason || ''}；下一步：${l.next || '待定'}。来源：${l.link}`).join('\n') + (t.foundLeads.length ? `\n\n其中 ${t.foundLeads.length} 条 A 级商机将在交付后追加跟进任务。` : '')
      : '本轮检索未发现与企业主营匹配的商机，建议调整检索关键词或扩大区域范围（需人工确认）。';
    return { output: md };
  }

  // ====================== ⑥ 校验 → 循环 / ⑦ 审批 / ⑧ 交付 ======================
  function applyVerdict(t, r) {
    const c = cmdOf(t.cmdId), a = agentOf(t.agentId);
    t.evals = { ev: r.ev, total: r.total }; t.feedback = r.feedback || '';
    t.history.push({ v: t.history.length + 1, output: t.output, evals: r.ev, total: r.total, feedback: t.feedback, at: stamp(), researched: !!r.researched });
    S.sim.metrics.verify++; S.sim.today.verify++;
    if (t.history.length === 1) { S.sim.metrics.first++; if (r.total >= 80) S.sim.metrics.pass1++; }
    if (a) { EVAL_DIMS.forEach((k) => a.evals[k.k] = Math.round(a.evals[k.k] * .8 + r.ev[k.k] * .2)); a.status = 'idle'; }
    const limit = a?.level === 'L3' ? 2 : 1; // L3 Agent 拥有更多自我修正机会
    if (r.total >= 80) {
      log(t.cmdId, 'verify', `✅ 校验通过「${short(t.title)}」${r.total} 分 · ${esc(t.feedback.slice(0, 40))}`, '#3ddc97');
      fx('qa', t.deptId, `通过 ${r.total}`, '#3ddc97');
      if (t.needApproval) toApproval(t, 'risk');
      else if (a?.level === 'L1') toApproval(t, 'l1');
      else deliver(t);
    } else if (t.rework < limit) {
      t.rework++; t.status = 'rework'; t.progress = 30; S.sim.metrics.rework++; if (a) a.fail++;
      if (t.real) S.sim.real.rework++;
      log(t.cmdId, 'rework', `↩️ 校验未通过「${short(t.title)}」${r.total} 分 → 返工循环：${esc(t.feedback)}`, '#ff8a65');
      fx('qa', t.deptId, '返工', '#ff8a65'); say(t.agentId, `${r.total}分，返工`, 'warn');
    } else {
      t.status = 'review'; if (t.real) S.sim.real.review++;
      addApproval({ kind: 'review', taskId: t.id, cmdId: t.cmdId, deptId: t.deptId, action: '人工复核', desc: `「${t.title}」返工后仍 ${r.total} 分：${t.feedback}` });
      log(t.cmdId, 'review', `👤 「${short(t.title)}」返工后仍 ${r.total} 分，升级为老板人工复核`, '#ffb547');
      fx('qa', 'boss', '人工复核', '#ffb547');
    }
    saveState(); refresh();
  }
  function toApproval(t, why) {
    t.status = 'approval';
    const action = why === 'l1' ? '建议级 Agent 成果确认' : (/报价|签约|合同/.test(t.title) ? '报价/签约' : /投放|预算|广告/.test(t.title) ? '追加预算/投放' : /发布|宣传|海报|视频|群发/.test(t.title) ? '对外发布' : '高风险动作执行');
    addApproval({ kind: 'result', taskId: t.id, cmdId: t.cmdId, deptId: t.deptId, action, desc: `「${t.title}」已通过校验（${t.evals.total} 分），执行前需老板确认` });
    fx('qa', 'boss', '待审批', '#ffb547');
  }
  function deliver(t) {
    if (t.status === 'done') return;
    const c = cmdOf(t.cmdId), a = agentOf(t.agentId), d = deptOf(t.deptId);
    t.status = 'done'; t.doneAt = stamp(); t.progress = 100;
    S.sim.metrics.done++; S.sim.today.done++;
    const hrs = rand(1, 4); S.sim.metrics.hours += hrs; S.sim.today.hours += hrs;
    if (t.real) S.sim.real.done++;
    if (a) { a.done++; a.status = 'idle'; }
    log(t.cmdId, 'deliver', `📦 交付「${short(t.title, 24)}」· ${esc(d?.name || '')} · <a class="lnk" onclick="openTaskModal('${t.id}')">查看成果</a>`, '#3ddc97');
    fx(t.deptId, 'brain', '交付', c?.color || '#3ddc97'); say(t.agentId, '交付 ✓', 'ai');
    // 阶段联动（仍归属本指令）
    if (d?.lib === 'sales' && t.kind === 'leads' && !t.real) simLeads(t);
    (t.foundLeads || []).forEach((id) => { const L = S.sim.leads.find((x) => x.id === id); if (L && c && L.status === 'new') appendFollowups(c, L); });
    if (d?.lib === 'brand' && /海报|视频|推文|宣传/.test(t.title)) makeContent(t);
    if (d?.lib === 'procurement' && /比价/.test(t.title) && !t.real) { const v = rand(5000, 30000); S.sim.metrics.saved += v; log(t.cmdId, 'value', `💰 比价测算可节省成本约 ¥${fmtMoney(v)}（仿真）`, '#ffca28'); }
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
    if (sales && td) fx(sales.id, td.id, '订单同步', '#3ddc97');
    log(c.id, 'dispatch', `🔗 A级商机「${short(L.title, 26)}」→ 在 #${c.no} 内追加 ${items.length} 项跟进任务`, '#8b5cff');
  }
  function simLeads(t) {
    const kw = (t.kws?.length ? t.kws : (S.industry?.div?.kw || '').split(' ')).filter(Boolean);
    const n = rand(1, 2), ids = [];
    for (let i = 0; i < n; i++) {
      const g = Math.random(), grade = g < .4 ? 'A' : g < .8 ? 'B' : 'C';
      const L = { id: uid('l'), title: `${pick(['华东', '华南', '西南', '华北', '华中'])}${pick(['某集团', '某国企', '某连锁品牌', '某产业园'])}${pick(['采购', '招标', '询价'])}：${pick(kw) || S.industry?.div?.name}${pick(['项目', '年度框架', '批量采购'])}`, link: '', source: '仿真线索', desc: '', real: false, grade, value: grade === 'A' ? rand(30, 300) * 10000 : rand(5, 60) * 10000, match: grade === 'A' ? rand(85, 96) : rand(55, 84), status: 'new', day: S.sim.day, cmdId: t.cmdId };
      S.sim.leads.unshift(L); S.sim.metrics.leads++; S.sim.today.leads++; if (grade === 'A') ids.push(L.id);
      log(t.cmdId, 'lead', `🎯 发现 <b>${grade}级</b> 商机（仿真）：${short(L.title, 30)}`, grade === 'A' ? '#3ddc97' : '#3ee0ff');
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
    log(ap.cmdId, 'approval', `🛡️ ${ap.kind === 'plan' ? '闸门①' : '闸门②'}「${esc(ap.action)}」等待老板审批${c ? ` · #${c.no}` : ''}`, '#ffb547');
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
      if (ok) { c.confirm = 'approved'; log(c.id, 'confirm', `✔ 老板确认 #${c.no} 拆解方案`, '#3ddc97'); fx('boss', 'brain', '方案确认', '#3ddc97'); dispatch(c); }
      else { c.replans++; c.feedback = `老板驳回上一版方案：${reason || '方案不满意，请重新拆解'}`; log(c.id, 'confirm', `✖ 老板驳回 #${c.no} 方案${reason ? '：' + esc(reason) : ''} → 重新拆解（第 ${c.replans + 1} 版）`, '#ff5d6c'); fx('boss', 'brain', '重新拆解', '#ff5d6c'); plan(c); }
    }
    if (ap.kind === 'result' && t && t.status === 'approval') {
      if (ok) { log(t.cmdId, 'approval', `✔ 老板批准「${short(t.title)}」执行`, '#3ddc97'); fx('boss', t.deptId, '批准', '#3ddc97'); deliver(t); }
      else { backToRework(t, `老板驳回：${reason || '不同意执行，请调整方案'}`); log(t.cmdId, 'rework', `✖ 老板驳回「${short(t.title)}」${reason ? '：' + esc(reason) : ''} → 返工循环`, '#ff5d6c'); fx('boss', t.deptId, '驳回', '#ff5d6c'); }
    }
    if (ap.kind === 'review' && t && t.status === 'review') {
      if (ok) { t.humanPassed = true; t.evals.total = Math.max(t.evals.total, 80); log(t.cmdId, 'approval', `👤 老板人工复核通过「${short(t.title)}」`, '#3ddc97'); fx('boss', t.deptId, '复核通过', '#3ddc97'); deliver(t); }
      else { t.rework = 0; backToRework(t, `老板复核意见：${reason || '质量不达标，请重做'}`); log(t.cmdId, 'rework', `👤 老板复核打回「${short(t.title)}」→ 返工循环`, '#ff5d6c'); fx('boss', t.deptId, '打回', '#ff5d6c'); }
    }
    if (ap.kind === 'content') { const C = S.sim.contents.find((x) => x.id === ap.contentId || x.id === ap.ref); if (C) { C.status = ok ? 'live' : 'rejected'; log(ap.cmdId, 'approval', ok ? `📣 批准发布「${short(C.title)}」` : `✖ 驳回发布「${short(C.title)}」`, ok ? '#3ddc97' : '#ff5d6c'); } }
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
    log(t.cmdId, 'approval', `👑 老板直接通过「${short(t.title)}」`, '#3ddc97');
    deliver(t); saveState(); refresh();
  };
  F.reworkTask = function (t, fb) {
    const c = cmdOf(t.cmdId);
    if (c && ['accept', 'improve', 'done'].includes(c.stage)) { toast('该指令已进入复盘，请在指令详情中「迭代下一轮」'); return false; }
    resolveTaskApprovals(t, false);
    backToRework(t, `老板意见：${fb}`);
    log(t.cmdId, 'rework', `👑 老板打回「${short(t.title)}」：${esc(fb)} → 返工循环`, '#ffd54f');
    fx('boss', t.deptId, '打回', '#ff5d6c'); saveState(); refresh(); return true;
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
    log(c.id, 'accept', `🧾 #${c.no} 全部任务交付，智脑进行指令级验收…`, '#3ee0ff');
    fx('brain', 'qa', '指令验收', '#3ee0ff');
    const ts = c.taskIds.map(taskOf).filter((t) => t && t.status === 'done');
    if (c.real && isReal()) {
      let rv = null;
      try {
        rv = await AI.call('/review', { ...ctxBase(), text: c.text, goal: c.goal, depts: S.depts.map((d) => d.name), results: ts.map((t) => ({ dept: deptOf(t.deptId)?.name, title: t.title, score: t.evals?.total || 0, rework: t.rework, human: !!t.humanPassed, output: String(t.output || '').slice(0, 700) })) });
      } catch (e) { log(c.id, 'accept', `⚠️ AI 验收失败（${esc(e.message)}），使用规则验收`, '#ff5d6c'); }
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
      next: [pick(['扩大检索范围寻找更多机会', '跟进已产出方案的落地数据', '针对返工环节补充数据', '把通过的方案复制到其他区域'])]
    };
  }
  function improve(c, rv) {
    c.stage = 'improve';
    c.acceptance = { score: Math.round(+rv.score || 0), verdict: rv.verdict || 'partial', summary: rv.summary || '' };
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
    log(c.id, 'improve', `📈 #${c.no} 复盘提升：验收 <b>${c.acceptance.score}</b> 分（${vl}）· 沉淀经验 ${ls.length} 条${promos.length ? ' · ' + esc(promos.join('、')) : ''} · <a class="lnk" onclick="openCmdModal('${c.id}')">查看复盘</a>`, '#b69bff');
    fx('brain', 'kb', '经验沉淀', '#b69bff'); setTimeout(() => fx('kb', 'brain', '知识注入', '#b69bff'), 1500);
    c.stage = 'done'; c.doneAt = stamp();
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
    log(c.id, 'cancel', `⏹ 老板取消 #${c.no}`, '#ff5d6c'); saveState(); refresh();
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
        if (last && !['done', 'cancelled'].includes(last.stage)) { log(last.id, 'routine', `🔁 例行「${short(r.text)}」上一轮仍在进行，今日不重复下发`, '#3ddc97'); return; }
        if (last) F.iterate(last.id); else F.issue(r.text, { source: 'routine' });
      });
    }
    if ((cp.k === 'check' || cp.k === 'patrol') && active.length) {
      const over = active.filter((t) => t.age > t.sla || t.stuck || t.paused);
      over.forEach(escalate);
      log(null, 'cp', `🔎 ${cp.name}：在办 ${active.length} 项，逾期/卡点 ${over.length} 项${over.length ? '，已启动督办' : ''}`, over.length ? '#ffb547' : '#8fa3c8');
    }
    if (cp.k === 'report') {
      S.agents.forEach((a) => a.score = agentTotal(a));
      if (S.sim.today.verify || S.sim.today.done) log(null, 'cp', `📊 日终：交付 ${S.sim.today.done} 项 · 校验 ${S.sim.today.verify} 次 · 一次通过率 ${F.passRate()}% · 待审批 ${S.sim.approvals.filter((a) => a.status === 'pending').length} 项`, '#3ee0ff');
    }
    if (cp.k === 'learn') {
      const n = S.sim.knowledge.filter((k) => k.day === S.sim.day).length;
      if (n) log(null, 'cp', `🧠 今日沉淀经验 ${n} 条，已注入后续指令的拆解与执行`, '#b69bff');
    }
    refresh();
  };
  function escalate(t) {
    t.esc = Math.min(3, t.esc + 1); S.sim.metrics.esc++;
    const owner = S.staff.find((s) => s.id === t.ownerId);
    const lv = ['', '提醒执行 Agent', `通知负责人 ${owner?.name || ''}`, '上报老板'][t.esc];
    log(t.cmdId, 'esc', `⏰ 督办 L${t.esc}：「${short(t.title)}」${t.stuck || t.paused ? '卡点' : '逾期'} → ${lv}`, t.esc >= 3 ? '#ff5d6c' : '#ffb547');
    if (t.esc === 1) say(t.agentId, '收到督办，加速', 'warn');
    if (t.esc === 2) say(t.ownerId, '我来跟进！', 'warn');
    if (t.esc >= 3) { fx(t.deptId, 'boss', '督办升级', '#ff5d6c'); say('boss', '这个怎么卡住了？', 'warn'); }
    if (t.stuck && !t.real) t.stuck = false;
    if (t.paused && t.esc >= 2) { t.paused = false; t.retries = 0; }
    t.sla += 120;
  }
  F.newDay = function () {
    const sim = S.sim;
    sim.history.push({ day: sim.day, ...sim.today }); if (sim.history.length > 30) sim.history.shift();
    if (sim.today.done || sim.today.verify) log(null, 'day', `🌙 第 ${sim.day} 天结束 · 交付 ${sim.today.done} 项 · 校验 ${sim.today.verify} 次`, '#8b5cff');
    sim.day++; sim.min = DAY_START; sim.today = { done: 0, leads: 0, pipeline: 0, hours: 0, verify: 0 };
  };

  // ====================== 统计 ======================
  F.passRate = () => S.sim.metrics.first ? Math.round(S.sim.metrics.pass1 / S.sim.metrics.first * 100) : 100;
  F.col = (t) => ({ queued: 'dispatch', exec: 'exec', rework: 'exec', verify: 'verify', approval: 'approve', review: 'approve', done: 'deliver' }[t.status] || null);
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
    // 返回 8 个阶段的状态：done / active / pending / skip
    const st = STAGES.map(() => 'pending');
    const idx = { plan: 0, confirm: 1, run: 3, accept: 7, improve: 7, done: 8, cancelled: -1 }[c.stage];
    if (c.stage === 'cancelled') return st.map(() => 'skip');
    if (c.stage === 'plan') { st[0] = 'active'; return st; }
    if (c.stage === 'confirm') { st[0] = 'done'; st[1] = 'active'; return st; }
    st[0] = 'done'; st[1] = c.confirm === 'approved' ? 'done' : 'skip'; st[2] = 'done';
    if (idx >= 7) { for (let i = 3; i < 7; i++) st[i] = 'done'; st[7] = c.stage === 'done' ? 'done' : 'active'; return st; }
    const ts = c.taskIds.map(taskOf).filter((t) => t && t.status !== 'rejected');
    const pos = ts.map((t) => STAGES.findIndex((s) => s.k === F.col(t)));
    for (let i = 3; i < 7; i++) st[i] = pos.some((p) => p === i) ? 'active' : pos.length && pos.every((p) => p > i) ? 'done' : 'pending';
    if (st[2] === 'done' && pos.some((p) => p === 2)) st[2] = 'active';
    return st;
  };
})();
