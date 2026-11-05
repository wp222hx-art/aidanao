// 企业智脑 · 数字孪生总部（等距视角）+ 运行仿真引擎
(function () {
  const TW = 64, TH = 32, Z = 5, STRIDE = 7, COLS = 4, WALL = 30;
  const CHECKPOINTS = [
    { m: 540, k: 'brief', name: '09:00 晨会·每日重点' },
    { m: 720, k: 'mid', name: '12:00 午间进度校验' },
    { m: 900, k: 'patrol', name: '15:00 督办巡检' },
    { m: 1080, k: 'eval', name: '18:00 日报与评测' },
    { m: 1140, k: 'learn', name: '19:00 知识沉淀' }
  ];
  window.CHECKPOINTS = CHECKPOINTS;
  const DAY_START = 510, DAY_END = 1170;
  let timer = null, view = 'twin', isoCtx = null;

  // ====================== 仿真状态 ======================
  function initSim() {
    if (S.sim) return;
    S.sim = { day: 1, min: DAY_START, speed: 1, tasks: [], approvals: [], leads: [], contents: [], feed: [], knowledge: [], cp: {}, realLeads: [],
      metrics: { done: 0, rework: 0, leads: 0, pipeline: 0, revenue: 0, hours: 0, saved: 0, esc: 0, contents: 0, views: 0 },
      history: [], today: { done: 0, leads: 0, pipeline: 0, hours: 0 } };
    S.depts.forEach((d) => { const l = deptLib(d.lib); (l ? l.tasks : ['整理部门周计划', '跟进本周重点事项']).slice(0, 2).forEach((t) => createTask(d.id, t, { silent: true })); });
    log('sys', `企业智脑上线 · ${S.agents.length} 个 Agent 接管 ${S.depts.length} 个部门的日常执行`, '#3ee0ff');
  }
  window.simTime = () => { const m = S.sim.min; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  function log(type, html, color = '#8fa3c8') {
    S.sim.feed.unshift({ t: `D${S.sim.day} ${simTime()}`, type, html, color });
    if (S.sim.feed.length > 120) S.sim.feed.length = 120;
    renderFeedItem(S.sim.feed[0]);
  }
  window.simLog = log;
  const deptOf = (id) => S.depts.find((d) => d.id === id);
  const deptByLib = (lib) => S.depts.find((d) => d.lib === lib);
  window.deptByLib = deptByLib;
  const agentOf = (id) => S.agents.find((a) => a.id === id);
  window.agentOf = agentOf;

  window.createTask = function (deptId, title, opt = {}) {
    const d = deptOf(deptId); if (!d) return null;
    const pool = S.agents.filter((a) => a.deptId === deptId);
    const core = pool.filter((a) => !a.sub);
    const ag = (opt.core ? pick(core.length ? core : pool) : pick(pool.filter((a) => a.status !== 'busy').length ? pool.filter((a) => a.status !== 'busy') : pool));
    const staff = S.staff.filter((s) => s.deptId === deptId);
    const t = { id: uid('t'), deptId, title, agentId: ag?.id, ownerId: staff.length ? pick(staff).id : null, status: 'todo', progress: 0, sla: rand(90, 300), age: 0,
      from: opt.from || null, kind: opt.kind || null, ref: opt.ref || null, day: S.sim.day, esc: 0, stuck: false, evals: null, rework: 0 };
    S.sim.tasks.unshift(t);
    if (S.sim.tasks.length > 220) S.sim.tasks = S.sim.tasks.filter((x, i) => i < 160 || x.status !== 'done');
    if (!opt.silent) log('task', `<b>${esc(d.name)}</b> 新任务「${esc(title)}」→ ${esc(ag?.name || '')}`, d.color);
    return t;
  };

  function evalTask(t) {
    const a = agentOf(t.agentId) || { evals: { acc: 85, evi: 80, time: 85, comp: 90, val: 75 } };
    const ev = {}; EVAL_DIMS.forEach((d) => { ev[d.k] = Math.max(40, Math.min(100, a.evals[d.k] + rand(-14, 8) + (t.rework ? 6 : 0))); });
    if (t.age > t.sla) ev.time = Math.max(40, ev.time - 20);
    const total = Math.round(EVAL_DIMS.reduce((s, d) => s + ev[d.k] * d.w, 0) / 100);
    return { ev, total };
  }

  function completeTask(t) {
    const d = deptOf(t.deptId), a = agentOf(t.agentId), lib = d?.lib;
    t.status = 'done'; S.sim.metrics.done++; S.sim.today.done++;
    const hrs = rand(1, 4); S.sim.metrics.hours += hrs; S.sim.today.hours += hrs;
    if (a) { a.done++; a.status = 'idle'; EVAL_DIMS.forEach((k) => a.evals[k.k] = Math.round(a.evals[k.k] * .9 + t.evals.ev[k.k] * .1)); }
    log('done', `✅ <b>${esc(a?.name || '')}</b> 完成「${esc(t.title)}」· 评测 ${t.evals.total} 分 · 节省 ${hrs}h`, '#3ddc97');
    bubble(t.agentId, `完成 ✓ ${t.evals.total}分`, 'ai');
    // 跨部门联动
    if (lib === 'sales' && /线索|订单/.test(t.title)) findLead(true);
    if (lib === 'brand' && /海报|视频|推文/.test(t.title)) makeContent(t);
    if (lib === 'finance') { const v = rand(2000, 12000); S.sim.metrics.saved += v; }
    if (lib === 'procurement' && /比价/.test(t.title)) { const v = rand(5000, 30000); S.sim.metrics.saved += v; log('value', `💰 采购比价节省成本 ¥${fmtMoney(v)}`, '#ffca28'); }
    if (lib === 'marketing' && Math.random() < .35) addApproval('追加广告预算', d.id, `投放实验 ROAS 达标，申请追加预算 ¥${rand(1, 5)}万`, rand(10000, 50000));
    if (lib === 'strategy' && /90天|计划/.test(t.title)) { S.sim.knowledge.unshift({ day: S.sim.day, title: `90天增长计划 v${S.sim.day}`, dept: d.name }); }
  }

  function findLead(fromTask) {
    const sales = deptByLib('sales'); if (!sales) return;
    let L;
    const real = S.sim.realLeads.shift();
    const kw = (S.industry?.div?.kw || '').split(' ');
    if (real) L = { title: real.title, link: real.link, source: real.source || '公开网络', desc: real.desc, real: true };
    else L = { title: `${pick(['华东', '华南', '西南', '华北', '华中'])}${pick(['某集团', '某国企', '某连锁品牌', '某上市公司', '某产业园'])}${pick(['采购', '招标', '询价', '合作需求'])}：${pick(kw) || S.industry?.div?.name}${pick(['项目', '年度框架', '定制订单', '批量采购'])}`, link: '', source: pick(['招投标公示', '行业平台', '社媒询盘', '展会名录', '老客户转介绍']), desc: '', real: false };
    const g = Math.random(); L.grade = g < .28 ? 'A' : g < .7 ? 'B' : 'C';
    L.value = L.grade === 'A' ? rand(30, 300) * 10000 : L.grade === 'B' ? rand(8, 60) * 10000 : rand(1, 10) * 10000;
    L.id = uid('l'); L.status = 'new'; L.day = S.sim.day; L.match = L.grade === 'A' ? rand(85, 97) : L.grade === 'B' ? rand(68, 85) : rand(40, 68);
    S.sim.leads.unshift(L); if (S.sim.leads.length > 80) S.sim.leads.length = 80;
    S.sim.metrics.leads++; S.sim.today.leads++;
    log('lead', `🎯 商机雷达发现 <b>${L.grade}级</b> 线索：${esc(L.title.slice(0, 34))} · 预估 ¥${fmtMoney(L.value)}`, L.grade === 'A' ? '#3ddc97' : '#3ee0ff');
    const salesAg = S.agents.find((a) => a.deptId === sales.id && !a.sub);
    bubble(salesAg?.id, `${L.grade}级商机！`, 'ai');
    if (L.grade === 'A') syncLead(L, true);
    updateBadges();
  }
  window.findLead = findLead;

  window.syncLead = function (L, auto) {
    if (L.status !== 'new') return;
    L.status = 'synced'; S.sim.metrics.pipeline += L.value; S.sim.today.pipeline += L.value;
    const sales = deptByLib('sales');
    const targets = ['product', 'production', 'rnd', 'project', 'design', 'service'].map(deptByLib).filter(Boolean).slice(0, 2);
    targets.forEach((td) => {
      const title = { product: '评估订单的定制需求', production: '根据新订单重排产计划', rnd: '评审技术可行性', project: '评估项目实施方案', design: '生成初版设计方案', service: '制定客户交付服务计划' }[td.lib];
      createTask(td.id, `${title}（${L.title.slice(0, 12)}…）`, { from: sales?.id, kind: 'lead', ref: L.id, core: true });
      if (sales) packet(sales.id, td.id, '订单同步', '#3ddc97');
    });
    if (sales) createTask(sales.id, `生成报价依据单（${L.title.slice(0, 10)}…）`, { kind: 'lead', ref: L.id, core: true });
    addApproval('调整报价/签约', sales?.id, `${L.grade}级商机「${L.title.slice(0, 22)}」报价方案待老板确认`, L.value, L.id);
    log('sync', `🔗 ${auto ? '自动' : '手动'}同步商机到 ${targets.map((t) => t.name).join('、') || '相关部门'}，已生成报价审批`, '#8b5cff');
  };

  function addApproval(action, deptId, desc, amount, ref) {
    const ap = { id: uid('ap'), action, deptId, desc, amount, ref, status: 'pending', day: S.sim.day, t: simTime() };
    S.sim.approvals.unshift(ap); if (S.sim.approvals.length > 60) S.sim.approvals.length = 60;
    log('approval', `🛡️ L4 高风险动作「${action}」等待老板审批`, '#ffb547');
    if (deptId) packet(deptId, 'boss', '待审批', '#ffb547');
    bubble('boss', '有新的审批 📝', 'warn');
    updateBadges();
  }
  window.addApproval = addApproval;
  window.decideApproval = function (id, ok) {
    const ap = S.sim.approvals.find((a) => a.id === id); if (!ap || ap.status !== 'pending') return;
    ap.status = ok ? 'approved' : 'rejected';
    log('approval', `${ok ? '✔ 老板批准' : '✖ 老板驳回'}「${ap.action}」${esc(ap.desc.slice(0, 26))}`, ok ? '#3ddc97' : '#ff5d6c');
    if (ap.deptId) packet('boss', ap.deptId, ok ? '已批准' : '已驳回', ok ? '#3ddc97' : '#ff5d6c');
    if (ok && ap.ref) {
      const L = S.sim.leads.find((l) => l.id === ap.ref); if (L) { L.status = 'quoted'; setTimeout(() => { if (Math.random() < .55) { L.status = 'won'; S.sim.metrics.revenue += L.value; log('value', `🏆 赢单！「${esc(L.title.slice(0, 24))}」成交 ¥${fmtMoney(L.value)}`, '#ffca28'); } }, rand(8000, 20000)); }
      const C = S.sim.contents.find((c) => c.id === ap.ref); if (C) { C.status = 'live'; log('content', `📣 「${esc(C.title)}」开始多渠道分发`, '#ff4fa3'); }
    }
    if (ok && ap.action === '追加广告预算') S.sim.metrics.pipeline += Math.round(ap.amount * rand(2, 5));
    saveState(); updateBadges();
  };

  function makeContent(t) {
    const type = /视频/.test(t.title) ? 'video' : 'poster';
    const themes = ['新品发布', '客户案例', '品牌故事', '限时活动', '行业洞察', '招商合作'];
    const C = { id: uid('c'), type, title: `${S.company.name.replace(/(有限公司|股份有限公司|有限责任公司)$/, '')}·${pick(themes)}${type === 'video' ? '短视频' : '海报'}`, status: 'pending', channels: ['抖音', '视频号', '小红书', '公众号'].slice(0, rand(2, 4)), views: 0, leads: 0, day: S.sim.day, theme: pick(themes) };
    S.sim.contents.unshift(C); if (S.sim.contents.length > 40) S.sim.contents.length = 40;
    S.sim.metrics.contents++;
    log('content', `🎬 内容工厂产出${type === 'video' ? '宣传视频' : '海报'}「${esc(C.title)}」，合规审校通过，待分发审批`, '#ff4fa3');
    addApproval('对外发布声明', t.deptId, `对外分发「${C.title}」至 ${C.channels.join('/')}`, 0, C.id);
  }
  window.makeContent = makeContent;

  // ---------- 管理机制：检查点 ----------
  function checkpoint(cp) {
    const T = S.sim.tasks;
    if (cp.k === 'brief') {
      const focus = S.depts.slice(0, 3).map((d) => d.name).join('、');
      log('cp', `☀️ <b>晨会</b>：智脑生成今日重点 —— ${esc(focus)} 等 ${S.depts.length} 个部门共 ${T.filter((t) => t.status !== 'done').length} 项在办任务`, '#ffd54f');
      bubble('boss', '今天重点：抢订单、控成本！');
      S.depts.forEach((d) => { const l = deptLib(d.lib); createTask(d.id, l ? pick(l.tasks) : '更新部门日计划', { silent: true }); });
      packetsFromBoss('今日目标');
    }
    if (cp.k === 'mid' || cp.k === 'patrol') {
      const overdue = T.filter((t) => t.status !== 'done' && (t.age > t.sla || t.stuck));
      overdue.forEach((t) => escalate(t));
      log('cp', `🔎 <b>${cp.k === 'mid' ? '午间校验' : '督办巡检'}</b>：检查在办 ${T.filter((t) => t.status !== 'done').length} 项，发现逾期/卡点 ${overdue.length} 项，已启动督办`, '#ffb547');
      if (cp.k === 'patrol') bossPatrol();
    }
    if (cp.k === 'eval') {
      S.agents.forEach((a) => a.score = agentTotal(a));
      const top = [...S.agents].sort((a, b) => b.score - a.score)[0];
      const low = S.agents.filter((a) => a.score < 78);
      low.forEach((a) => { if (a.level === 'L3') { a.level = 'L2'; } });
      log('cp', `📊 <b>日报与评测</b>：今日完成 ${S.sim.today.done} 项，新增商机 ${S.sim.today.leads} 条，管道 ¥${fmtMoney(S.sim.today.pipeline)}。最佳 Agent：${esc(top?.name || '')}（${top?.score}分）；${low.length} 个 Agent 低于阈值已降级为 L2 草稿模式`, '#3ee0ff');
    }
    if (cp.k === 'learn') {
      const k = { day: S.sim.day, title: `D${S.sim.day} 经营复盘：${pick(['线索响应提速打法', '报价模板优化', '交付卡点SOP', '内容选题公式', '应收催收话术'])}`, dept: pick(S.depts).name };
      S.sim.knowledge.unshift(k); if (S.sim.knowledge.length > 50) S.sim.knowledge.length = 50;
      log('cp', `🧠 <b>知识沉淀</b>：${esc(k.title)} 已写入企业专属知识库`, '#8b5cff');
    }
  }
  function escalate(t) {
    t.esc = Math.min(3, t.esc + 1); S.sim.metrics.esc++;
    const d = deptOf(t.deptId), owner = S.staff.find((s) => s.id === t.ownerId);
    const lv = ['', '提醒执行Agent', `通知负责人 ${owner?.name || ''}`, '上报老板'][t.esc];
    log('esc', `⏰ 督办 L${t.esc}：「${esc(t.title.slice(0, 20))}」${t.stuck ? '卡点' : '逾期'} → ${lv}`, t.esc >= 3 ? '#ff5d6c' : '#ffb547');
    if (t.esc === 1) bubble(t.agentId, '收到督办，加速中', 'warn');
    if (t.esc === 2) bubble(t.ownerId, '我来跟进！', 'warn');
    if (t.esc >= 3) { packet(t.deptId, 'boss', '升级', '#ff5d6c'); bubble('boss', `${d?.name}卡住了？`, 'warn'); }
    t.stuck = false; t.sla += 120;
  }

  // ---------- 主循环 ----------
  function tick() {
    const sim = S.sim; if (!sim || sim.speed === 0) return;
    const step = 5;
    for (let s = 0; s < sim.speed; s++) {
      const prev = sim.min; sim.min += step;
      CHECKPOINTS.forEach((cp) => { if (prev < cp.m && sim.min >= cp.m && !sim.cp[sim.day + cp.k]) { sim.cp[sim.day + cp.k] = 1; checkpoint(cp); } });
      if (sim.min >= DAY_END) newDay();
      sim.tasks.forEach((t) => {
        if (t.status === 'done') return;
        t.age += step;
        if (t.status === 'todo' && Math.random() < .35) { t.status = 'doing'; const a = agentOf(t.agentId); if (a) a.status = 'busy'; }
        else if (t.status === 'doing' || t.status === 'rework') {
          if (!t.stuck && Math.random() < .012) { t.stuck = true; bubble(t.agentId, '缺数据，卡住了…', 'warn'); }
          if (!t.stuck) t.progress = Math.min(100, t.progress + rand(3, 11));
          if (t.progress >= 100) {
            t.evals = evalTask(t);
            if (t.evals.total >= 80) completeTask(t);
            else if (t.rework < 1) { t.status = 'rework'; t.rework++; t.progress = 55; S.sim.metrics.rework++; const a = agentOf(t.agentId); if (a) a.fail++; log('rework', `↩️ 评测未达标（${t.evals.total}分）：「${esc(t.title.slice(0, 20))}」打回重做`, '#ff8a65'); bubble(t.agentId, '返工中…', 'warn'); }
            else { t.status = 'review'; log('review', `👤 「${esc(t.title.slice(0, 20))}」二次评测 ${t.evals.total} 分，转人工复核`, '#ffb547'); bubble(t.ownerId, '我来人工复核'); setTimeout(() => { if (t.status === 'review') { t.evals.total = 82; completeTask(t); } }, 6000); }
          }
        }
      });
      // 随机产生新任务
      if (Math.random() < .25) { const d = pick(S.depts); const l = deptLib(d.lib); createTask(d.id, l ? pick(l.tasks) : pick(['整理部门周报', '跟进客户反馈', '优化工作流程'])); }
      if (Math.random() < .07) findLead();
      if (Math.random() < .03 && S.sim.realLeads.length < 3) fetchRealLeads();
      // 已分发内容增长
      sim.contents.forEach((c) => { if (c.status === 'live') { const v = rand(20, 400); c.views += v; sim.metrics.views += v; if (Math.random() < .04) { c.leads++; findLead(); } } });
    }
    renderTick();
    if (Math.random() < .3) saveState();
  }
  function newDay() {
    const sim = S.sim;
    sim.history.push({ day: sim.day, ...sim.today });
    if (sim.history.length > 30) sim.history.shift();
    log('day', `🌙 第 ${sim.day} 天结束 · 完成 ${sim.today.done} 项 · 商机 ${sim.today.leads} 条 · 管道 ¥${fmtMoney(sim.today.pipeline)}`, '#8b5cff');
    sim.day++; sim.min = DAY_START; sim.today = { done: 0, leads: 0, pipeline: 0, hours: 0 };
    sim.tasks = sim.tasks.filter((t) => t.status !== 'done' || t.day >= sim.day - 2);
  }
  let fetching = false;
  async function fetchRealLeads() {
    if (fetching) return; fetching = true;
    try {
      const kw = (S.industry?.div?.kw || S.industry?.div?.name || '').split(' ').filter(Boolean);
      const q = pick(kw.length ? kw : [S.industry?.div?.name || '采购']);
      const r = await fetch(`/api/leads?q=${encodeURIComponent(q)}`).then((x) => x.json());
      (r.items || []).slice(0, 6).forEach((it) => { if (!S.sim.leads.some((l) => l.link === it.link)) S.sim.realLeads.push(it); });
    } catch { } fetching = false;
  }
  window.fetchRealLeads = fetchRealLeads;

  // ====================== 外壳 ======================
  const NAV = [
    { k: 'twin', i: 'fa-cubes-stacked', n: '数字孪生' },
    { k: 'cockpit', i: 'fa-gauge-high', n: '经营驾驶舱' },
    { k: 'leads', i: 'fa-crosshairs', n: '商机雷达' },
    { k: 'agents', i: 'fa-robot', n: 'Agent军团' },
    { k: 'tasks', i: 'fa-diagram-project', n: '行动编排' },
    { k: 'eval', i: 'fa-clipboard-check', n: '评测督办' },
    { k: 'studio', i: 'fa-clapperboard', n: '内容工厂' },
    { k: 'approve', i: 'fa-shield-halved', n: '审批护栏' },
    { k: 'ledger', i: 'fa-sack-dollar', n: '价值账本' },
    { k: 'org', i: 'fa-sitemap', n: '组织人才' }
  ];
  window.renderHQ = function () {
    initSim();
    const app = $('#app');
    app.innerHTML = `
    <div class="hq">
      <header class="hq-top">
        <div class="logo"><div class="orb"><i class="fas fa-brain"></i></div><div style="line-height:1.2">${esc(S.company.name)}<div class="dim" style="font-size:11px;font-weight:400"><i class="fas ${S.industry?.icon}"></i> ${esc(S.industry?.div?.name || '')} · 企业智脑</div></div></div>
        <div class="clock"><i class="fas fa-clock" style="font-size:14px"></i><span id="clk"></span></div>
        <div class="speed" id="speed">${[0, 1, 3, 8].map((v) => `<button data-v="${v}" class="${S.sim.speed === v ? 'on' : ''}">${v === 0 ? '<i class="fas fa-pause"></i>' : v + 'x'}</button>`).join('')}</div>
        <div class="kpis" id="kpis"></div>
      </header>
      <nav class="hq-nav">${NAV.map((n) => `<button class="nav-btn ${view === n.k ? 'on' : ''}" data-k="${n.k}"><i class="fas ${n.i}"></i>${n.n}<span class="badge" id="badge-${n.k}" style="display:none"></span></button>`).join('')}
        <div style="flex:1"></div><button class="nav-btn" id="nav-reset" title="重新创建企业"><i class="fas fa-rotate-left"></i>重建</button></nav>
      <main class="hq-main" id="hq-main"></main>
      <aside class="hq-side">
        <div class="side-sec">
          <div class="flex between"><span class="h3"><i class="fas fa-crown" style="color:#ffd54f"></i> 老板指令</span><span class="tag p">智脑自动拆解</span></div>
          <div class="flex mt"><input id="cmd" placeholder="如：下个月把华东市场订单做上去" style="flex:1;min-width:0;font-size:13px"><button class="btn btn-pri btn-sm" id="cmd-go"><i class="fas fa-paper-plane"></i></button></div>
          <div class="flex wrap mt" style="gap:6px">${['抢更多订单', '降低采购成本', '做一波品牌宣传', '催收应收账款', '招聘销售骨干'].map((q) => `<button class="tag" data-q="${q}" style="cursor:pointer">${q}</button>`).join('')}</div>
        </div>
        <div class="side-sec" style="padding-bottom:8px"><div class="flex between"><span class="h3"><i class="fas fa-wave-square" style="color:var(--c1)"></i> 实时运作流</span><span class="dim" style="font-size:11px" id="agent-online"></span></div></div>
        <div class="feed" id="feed"></div>
      </aside>
      <footer class="hq-bottom">
        <span class="h3" style="white-space:nowrap"><i class="fas fa-calendar-day" style="color:var(--c1)"></i> 第 <span id="day">1</span> 天</span>
        <div class="cadence" id="cadence"></div>
      </footer>
    </div>`;
    $$('.nav-btn[data-k]').forEach((b) => b.onclick = () => { view = b.dataset.k; $$('.nav-btn').forEach((x) => x.classList.toggle('on', x === b)); mountView(); });
    $$('#speed button').forEach((b) => b.onclick = () => { S.sim.speed = +b.dataset.v; $$('#speed button').forEach((x) => x.classList.toggle('on', x === b)); saveState(); });
    $('#nav-reset').onclick = () => { if (confirm('确定重新创建企业？当前企业数据将清空。')) { stopSim(); resetState(); renderApp(); } };
    $('#cmd-go').onclick = () => bossCommand($('#cmd').value);
    $('#cmd').onkeydown = (e) => e.key === 'Enter' && bossCommand($('#cmd').value);
    $$('[data-q]').forEach((b) => b.onclick = () => bossCommand(b.dataset.q));
    S.sim.feed.slice(0, 40).reverse().forEach(renderFeedItem);
    mountView(); renderTick(); updateBadges();
    stopSim(); timer = setInterval(tick, 1000);
    fetchRealLeads();
  };
  function stopSim() { if (timer) clearInterval(timer); timer = null; }
  window.stopSim = stopSim;
  window.gotoView = (k) => { view = k; $$('.nav-btn').forEach((x) => x.classList.toggle('on', x.dataset.k === k)); mountView(); };

  function mountView() {
    const main = $('#hq-main'); isoCtx = null;
    if (view === 'twin') renderIso(main);
    else window.renderModule(view, main);
  }

  function renderFeedItem(e) {
    const f = $('#feed'); if (!f || !e) return;
    const el = document.createElement('div'); el.className = 'ev';
    el.innerHTML = `<span class="dot" style="background:${e.color}"></span><div><span class="t">${e.t}</span><div>${e.html}</div></div>`;
    f.prepend(el); while (f.children.length > 60) f.lastChild.remove();
  }

  function renderTick() {
    if (!$('#clk')) return;
    $('#clk').textContent = simTime(); $('#day').textContent = S.sim.day;
    const M = S.sim.metrics, busy = S.agents.filter((a) => a.status === 'busy').length;
    $('#kpis').innerHTML = [
      ['在岗 Agent', `${S.agents.length}`, `<span style="color:var(--ok)">${busy} 忙碌</span>`],
      ['今日完成', S.sim.today.done, ''],
      ['商机管道', '¥' + fmtMoney(M.pipeline), ''],
      ['已成交', '¥' + fmtMoney(M.revenue), ''],
      ['节省工时', M.hours + 'h', '']
    ].map(([l, v, s]) => `<div class="kpi"><div class="l">${l} ${s}</div><div class="v">${v}</div></div>`).join('');
    $('#agent-online').textContent = `${busy}/${S.agents.length} Agent 运转中`;
    // 节奏条
    const pct = (m) => (m - DAY_START) / (DAY_END - DAY_START) * 100;
    $('#cadence').innerHTML = `<div class="track"></div><div class="prog" style="width:${pct(S.sim.min)}%"></div>` + CHECKPOINTS.map((c) => `<div class="cp ${S.sim.min >= c.m ? 'done' : ''} ${Math.abs(S.sim.min - c.m) < 30 ? 'now' : ''}" style="left:${pct(c.m)}%"><span class="nm">${c.name.split(' ')[0]}</span><span class="pt"></span><span class="sn">${c.name.split(' ')[1].split('·')[0]}</span></div>`).join('');
    if (isoCtx) isoUpdate();
    else if (window.moduleTick) window.moduleTick(view);
    updateBadges();
  }
  function updateBadges() {
    if (!S.sim) return;
    const set = (k, n) => { const b = $('#badge-' + k); if (!b) return; b.style.display = n ? 'block' : 'none'; b.textContent = n; };
    set('approve', S.sim.approvals.filter((a) => a.status === 'pending').length);
    set('leads', S.sim.leads.filter((l) => l.status === 'new').length);
    set('eval', S.sim.tasks.filter((t) => t.esc >= 2 && t.status !== 'done').length);
  }
  window.updateBadges = updateBadges;

  // 老板指令 → 智脑拆解为跨部门任务
  const CMD_MAP = [
    { re: /订单|销售|业绩|客户|市场|营收|收入/, libs: ['sales', 'marketing', 'product', 'strategy'], titles: { sales: '全网匹配采购需求线索', marketing: '设计A/B投放实验', product: '分析竞品功能差距', strategy: '输出90天增长计划草案' } },
    { re: /成本|采购|省钱|降本/, libs: ['procurement', 'finance', 'production'], titles: { procurement: '全网比价主要原料', finance: '核对预算偏差', production: '核算单件工时' } },
    { re: /宣传|品牌|海报|视频|推广|营销/, libs: ['brand', 'marketing'], titles: { brand: '制作30秒宣传短视频', marketing: '生成本月营销日历' } },
    { re: /应收|回款|催收|现金/, libs: ['finance', 'sales', 'legal'], titles: { finance: '预警逾期应收', sales: '为A级线索生成跟进话术', legal: '审查新签合同风险条款' } },
    { re: /招聘|人才|培训|团队/, libs: ['hr', 'admin'], titles: { hr: '筛选岗位简历', admin: '整理周会行动项' } },
    { re: /质量|客诉|良率/, libs: ['quality', 'production', 'service'], titles: { quality: '汇总本周质检异常', production: '分析良率波动原因', service: '归因服务问题' } }
  ];
  function bossCommand(text) {
    text = (text || '').trim(); if (!text) return;
    $('#cmd').value = '';
    let hit = CMD_MAP.filter((c) => c.re.test(text));
    if (!hit.length) hit = [{ libs: ['strategy', 'operation', 'sales'], titles: {} }];
    const made = [];
    hit.forEach((h) => h.libs.forEach((lib) => { const d = deptByLib(lib); if (!d || made.some((m) => m.d === d)) return; const t = createTask(d.id, `【老板指令】${h.titles[lib] || '落实：' + text.slice(0, 14)}`, { core: true, kind: 'cmd' }); made.push({ d, t }); }));
    if (!made.length) { const d = S.depts[0]; made.push({ d, t: createTask(d.id, `【老板指令】${text.slice(0, 20)}`, { core: true }) }); }
    log('cmd', `👑 老板指令「${esc(text)}」→ 智脑拆解为 ${made.length} 个部门任务：${made.map((m) => esc(m.d.name)).join('、')}`, '#ffd54f');
    bubble('boss', text.slice(0, 14));
    made.forEach((m, i) => setTimeout(() => packet('boss', m.d.id, '指令', '#ffd54f'), i * 250));
    toast(`智脑已将指令拆解给 ${made.length} 个部门`, 'fa-diagram-project');
    if (/订单|销售|商机/.test(text)) { fetchRealLeads(); setTimeout(findLead, 2500); }
    if (/宣传|海报|视频/.test(text)) { const b = deptByLib('brand'); if (b) setTimeout(() => makeContent({ title: '宣传视频', deptId: b.id }), 3000); }
    saveState();
  }
  window.bossCommand = bossCommand;

  // ====================== 等距视图 ======================
  const iso = (gx, gy) => ({ x: isoCtx.OX + (gx - gy) * TW / 2, y: isoCtx.OY + (gx + gy) * TH / 2 });
  function poly(pts, fill, stroke, extra = '') { return `<polygon points="${pts.map((p) => p.x + ',' + p.y).join(' ')}" fill="${fill}" stroke="${stroke || 'none'}" ${extra}/>`; }
  function box(gx, gy, w, d, h, top, side1, side2) {
    const A = iso(gx, gy), B = iso(gx + w, gy), C = iso(gx + w, gy + d), D = iso(gx, gy + d);
    const up = (p) => ({ x: p.x, y: p.y - h });
    return poly([D, C, up(C), up(D)], side1) + poly([C, B, up(B), up(C)], side2) + poly([up(A), up(B), up(C), up(D)], top);
  }
  function zoneList() {
    const specials = [{ id: 'meet', name: '会议室', icon: 'fa-people-roof', color: '#90a4ae', special: true }, { id: 'boss', name: '老板办公室', icon: 'fa-crown', color: '#ffd54f', special: true }, { id: 'brain', name: '智脑中枢', icon: 'fa-brain', color: '#3ee0ff', special: true }, { id: 'studio', name: 'AI 内容工厂', icon: 'fa-clapperboard', color: '#ff4fa3', special: true }];
    return [...specials, ...S.depts].map((z, i) => ({ ...z, col: i % COLS, row: Math.floor(i / COLS) }));
  }
  function renderIso(main) {
    const zones = zoneList();
    const rows = Math.ceil(zones.length / COLS);
    const gxMax = COLS * STRIDE, gyMax = rows * STRIDE;
    const W = (gxMax + gyMax) * TW / 2 + 160, H = (gxMax + gyMax) * TH / 2 + 200;
    isoCtx = { OX: gyMax * TW / 2 + 80, OY: 110, zones, W, H, actors: {}, scale: 1, tx: 0, ty: 0 };
    zones.forEach((z) => { z.gx = z.col * STRIDE; z.gy = z.row * STRIDE; const c = iso(z.gx + Z / 2, z.gy + Z / 2); z.cx = c.x; z.cy = c.y; });
    let svg = `<defs><radialGradient id="orbG"><stop offset="0" stop-color="#bff6ff"/><stop offset=".5" stop-color="#3ee0ff"/><stop offset="1" stop-color="#8b5cff" stop-opacity="0"/></radialGradient></defs>`;
    // 地面
    const g0 = iso(-1, -1), g1 = iso(gxMax, -1), g2 = iso(gxMax, gyMax), g3 = iso(-1, gyMax);
    svg += poly([g0, g1, g2, g3], 'rgba(30,50,100,.25)', 'rgba(120,170,255,.25)');
    for (let i = -1; i <= gxMax; i += 1) { const a = iso(i, -1), b = iso(i, gyMax); svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="rgba(120,170,255,.05)"/>`; }
    for (let j = -1; j <= gyMax; j += 1) { const a = iso(-1, j), b = iso(gxMax, j); svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="rgba(120,170,255,.05)"/>`; }
    // 神经连线
    const brain = zones.find((z) => z.id === 'brain');
    zones.forEach((z) => { if (z.id === 'brain') return; svg += `<path d="M${brain.cx} ${brain.cy - 30} Q${(brain.cx + z.cx) / 2} ${Math.min(brain.cy, z.cy) - 80} ${z.cx} ${z.cy}" stroke="${z.color}" stroke-opacity=".35" stroke-width="1.5" fill="none" class="flow"/>`; });
    zones.forEach((z) => {
      const A = iso(z.gx, z.gy), B = iso(z.gx + Z, z.gy), C = iso(z.gx + Z, z.gy + Z), D = iso(z.gx, z.gy + Z);
      const up = (p) => ({ x: p.x, y: p.y - WALL });
      svg += poly([A, B, C, D], z.color + '22', z.color, `class="zone-poly" data-z="${z.id}" stroke-width="1.5"`);
      svg += poly([D, A, up(A), up(D)], z.color + '18', z.color + '66');
      svg += poly([A, B, up(B), up(A)], z.color + '10', z.color + '66');
      // 家具
      if (z.id === 'boss') { svg += box(z.gx + 1.5, z.gy + 1.2, 2.2, 1, 14, '#6d4c41', '#4e342e', '#3e2723') + box(z.gx + 0.3, z.gy + 0.3, .6, .6, 22, '#2e7d32', '#1b5e20', '#1b5e20') + box(z.gx + 3.8, z.gy + 3.6, .9, .9, 6, '#ffd54f55', '#ffd54f33', '#ffd54f22'); }
      else if (z.id === 'meet') { svg += box(z.gx + 1.3, z.gy + 1.6, 2.4, 1.6, 10, '#546e7a', '#37474f', '#263238'); }
      else if (z.id === 'brain') { svg += box(z.gx + 1.6, z.gy + 1.6, 1.8, 1.8, 10, '#1b2c5e', '#0e1838', '#0a1430'); }
      else if (z.id === 'studio') { svg += box(z.gx + .5, z.gy + .4, 1.6, .3, 26, '#ff4fa3', '#7a1f4e', '#5a1238') + box(z.gx + 2.7, z.gy + .4, 1.6, .3, 26, '#8b5cff', '#3c2580', '#2c1a60') + box(z.gx + 1.5, z.gy + 2.8, 2, .8, 9, '#37474f', '#263238', '#1c262b'); }
      else deskSpots(z).forEach((p) => { svg += box(z.gx + p[0], z.gy + p[1], 1.4, .6, 11, '#3a4f86', '#24335e', '#1c2850'); const m = iso(z.gx + p[0] + .7, z.gy + p[1] + .1); svg += `<rect x="${m.x - 6}" y="${m.y - 24}" width="12" height="9" rx="1" fill="${z.color}" opacity=".85"/>`; });
    });
    main.innerHTML = `<div class="iso-wrap" id="iso-wrap"><div class="iso-world" id="iso-world" style="width:${W}px;height:${H}px"><svg width="${W}" height="${H}">${svg}</svg></div>
      <div class="iso-hud"><button class="btn btn-ghost btn-sm glass" id="fit"><i class="fas fa-expand"></i>全景</button><button class="btn btn-ghost btn-sm glass" id="zin"><i class="fas fa-plus"></i></button><button class="btn btn-ghost btn-sm glass" id="zout"><i class="fas fa-minus"></i></button><button class="btn btn-ghost btn-sm glass" id="patrol"><i class="fas fa-person-walking"></i>老板巡视</button></div>
      <div class="boss-brief glass" id="brief"></div>
      <div class="iso-legend glass"><span><i class="fas fa-crown" style="color:#ffd54f"></i>老板</span><span><span class="st-dot" style="background:#ff7043"></span>员工</span><span><i class="fas fa-robot" style="color:var(--c1)"></i>AI Agent</span><span><span class="st-dot" style="background:#3ddc97"></span>数据/订单流</span><span class="dim">拖拽平移 · 滚轮缩放 · 点击部门查看详情</span></div></div>`;
    const world = $('#iso-world');
    // 标签
    zones.forEach((z) => {
      const top = iso(z.gx, z.gy);
      const el = document.createElement('div'); el.className = 'zone-label'; el.style.left = top.x + 'px'; el.style.top = (top.y - WALL - 6) + 'px'; el.style.setProperty('--zc', z.color); el.id = 'zl-' + z.id;
      world.appendChild(el);
    });
    // 角色
    const add = (id, cls, html, gx, gy, title) => { const p = iso(gx, gy); const el = document.createElement('div'); el.className = 'actor ' + cls; el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.style.zIndex = Math.round(p.y); el.innerHTML = `<div class="body">${html}</div>`; el.title = title || ''; world.appendChild(el); isoCtx.actors[id] = { el, gx, gy }; return el; };
    const bz = zones.find((z) => z.id === 'boss');
    add('boss', 'boss', `<i class="fas fa-crown crown"></i><div class="hd"><i class="fas fa-user-tie"></i></div><div class="tor"></div><div class="sh"></div>`, bz.gx + 2.6, bz.gy + 2.7, '老板');
    const orb = iso(brain.gx + 2.5, brain.gy + 2.5);
    const o = document.createElement('div'); o.style.cssText = `position:absolute;left:${orb.x}px;top:${orb.y - 40}px;transform:translate(-50%,-50%);width:70px;height:70px;border-radius:50%;background:radial-gradient(circle,#bff6ff,#3ee0ff 40%,#8b5cff 70%,transparent 72%);box-shadow:0 0 50px #3ee0ff;animation:float 2s ease-in-out infinite;z-index:3;display:grid;place-items:center;color:#04122a;font-size:24px`; o.innerHTML = '<i class="fas fa-brain"></i>'; world.appendChild(o);
    const mz = zones.find((z) => z.id === 'meet'), sz = zones.find((z) => z.id === 'studio');
    add('meet-bot', 'bot', `<div class="hd"><i class="fas fa-microphone"></i></div><div class="sh"></div>`, mz.gx + 2.5, mz.gy + 3.8, '会议纪要官');
    ['海报设计官', '视频剪辑官', '分发运营官'].forEach((n, i) => add('studio-' + i, 'bot', `<div class="hd"><i class="fas ${['fa-image', 'fa-film', 'fa-share-nodes'][i]}"></i></div><div class="sh"></div>`, sz.gx + 1 + i * 1.4, sz.gy + 2.2 + (i % 2) * 1.6, n));
    zones.filter((z) => !z.special).forEach((z) => {
      const staff = S.staff.filter((s) => s.deptId === z.id).slice(0, 6);
      deskSpots(z).slice(0, staff.length).forEach((p, i) => { const s = staff[i]; add(s.id, 'staff', `<div class="hd" style="background:${avColor(s.name)}">${esc(s.name[0])}</div><div class="tor" style="background:${z.color}"></div><div class="sh"></div>`, z.gx + p[0] + .7, z.gy + p[1] + 1.05, `${s.name} · ${s.pos}`); });
      S.agents.filter((a) => a.deptId === z.id && !a.sub).slice(0, 4).forEach((a, i) => add(a.id, 'bot', `<div class="hd"><i class="fas fa-robot"></i></div><div class="sh"></div>`, z.gx + .6 + Math.random() * 3.8, z.gy + 4.3 + (i % 2) * .3, a.name));
    });
    // 交互
    $$('.zone-poly', world).forEach((p) => p.onclick = (e) => { if (isoCtx.moved) return; const id = p.dataset.z; zoneClick(id); });
    $$('.actor', world).forEach((a) => a.onclick = (e) => { e.stopPropagation(); const id = Object.keys(isoCtx.actors).find((k) => isoCtx.actors[k].el === a); actorClick(id); });
    setupPanZoom(); fit();
    $('#fit').onclick = fit; $('#zin').onclick = () => zoom(1.2); $('#zout').onclick = () => zoom(1 / 1.2); $('#patrol').onclick = bossPatrol;
    isoUpdate(true);
  }
  function deskSpots() { return [[.5, .5], [2.9, .5], [.5, 2.1], [2.9, 2.1], [.5, 3.6], [2.9, 3.6]].map((p) => [p[0], p[1]]); }
  function setupPanZoom() {
    const wrap = $('#iso-wrap');
    wrap.onpointerdown = (e) => { if (e.target.closest('.iso-hud,.boss-brief,.iso-legend,.actor')) return; isoCtx.drag = { x: e.clientX, y: e.clientY, tx: isoCtx.tx, ty: isoCtx.ty }; isoCtx.moved = false; wrap.classList.add('drag'); };
    window.onpointermove = (e) => { if (!isoCtx?.drag) return; const dx = e.clientX - isoCtx.drag.x, dy = e.clientY - isoCtx.drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) isoCtx.moved = true; isoCtx.tx = isoCtx.drag.tx + dx; isoCtx.ty = isoCtx.drag.ty + dy; applyT(); };
    window.onpointerup = () => { if (!isoCtx) return; isoCtx.drag = null; $('#iso-wrap')?.classList.remove('drag'); setTimeout(() => { if (isoCtx) isoCtx.moved = false; }, 50); };
    wrap.onwheel = (e) => { e.preventDefault(); const r = wrap.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top); };
  }
  function applyT() { const w = $('#iso-world'); if (w) w.style.transform = `translate(${isoCtx.tx}px,${isoCtx.ty}px) scale(${isoCtx.scale})`; }
  function fit() { const wrap = $('#iso-wrap'); const s = Math.min(wrap.clientWidth / isoCtx.W, wrap.clientHeight / isoCtx.H) * 1.02; isoCtx.scale = Math.max(.35, Math.min(1.4, s)); isoCtx.tx = (wrap.clientWidth - isoCtx.W * isoCtx.scale) / 2; isoCtx.ty = (wrap.clientHeight - isoCtx.H * isoCtx.scale) / 2 + 20; applyT(); }
  function zoom(f, cx, cy) { const wrap = $('#iso-wrap'); cx = cx ?? wrap.clientWidth / 2; cy = cy ?? wrap.clientHeight / 2; const ns = Math.max(.3, Math.min(2.5, isoCtx.scale * f)); isoCtx.tx = cx - (cx - isoCtx.tx) * ns / isoCtx.scale; isoCtx.ty = cy - (cy - isoCtx.ty) * ns / isoCtx.scale; isoCtx.scale = ns; applyT(); }

  function moveActor(id, gx, gy) { const a = isoCtx?.actors[id]; if (!a) return; const p = iso(gx, gy); a.gx = gx; a.gy = gy; a.el.style.left = p.x + 'px'; a.el.style.top = p.y + 'px'; a.el.style.zIndex = Math.round(p.y); }
  function isoUpdate(first) {
    if (!isoCtx) return;
    const T = S.sim.tasks;
    isoCtx.zones.forEach((z) => {
      const el = $('#zl-' + z.id); if (!el) return;
      if (z.special) {
        const sub = z.id === 'boss' ? `待审批 ${S.sim.approvals.filter((a) => a.status === 'pending').length}` : z.id === 'brain' ? `${S.agents.filter((a) => a.status === 'busy').length} Agent 推理中` : z.id === 'studio' ? `已产出 ${S.sim.metrics.contents} 件内容` : `知识 ${S.sim.knowledge.length} 条`;
        el.innerHTML = `<div class="zl"><i class="fas ${z.icon}" style="color:${z.color}"></i>${z.name}</div><div class="zs">${sub}</div>`; return;
      }
      const mine = T.filter((t) => t.deptId === z.id && t.day === S.sim.day);
      const done = mine.filter((t) => t.status === 'done').length, open = T.filter((t) => t.deptId === z.id && t.status !== 'done');
      const warn = open.some((t) => t.esc >= 2 || t.stuck);
      const nAg = S.agents.filter((a) => a.deptId === z.id).length, nSt = S.staff.filter((s) => s.deptId === z.id).length;
      el.innerHTML = `<div class="zl">${warn ? '<i class="fas fa-triangle-exclamation" style="color:var(--warn)"></i>' : `<i class="fas ${z.icon}" style="color:${z.color}"></i>`}${esc(z.name)}</div><div class="zs"><i class="fas fa-user"></i> ${nSt} · <i class="fas fa-robot"></i> ${nAg} · 在办 ${open.length}</div><div class="zp"><i style="width:${mine.length ? done / mine.length * 100 : 0}%"></i></div>`;
    });
    // Agent 走动 / 忙碌
    S.agents.forEach((a) => { const act = isoCtx.actors[a.id]; if (!act) return; act.el.classList.toggle('busy', a.status === 'busy'); if (Math.random() < .12) { const z = isoCtx.zones.find((x) => x.id === a.deptId); moveActor(a.id, z.gx + .5 + Math.random() * 4, z.gy + .5 + Math.random() * 4.2); } });
    ['studio-0', 'studio-1', 'studio-2', 'meet-bot'].forEach((id) => { if (Math.random() < .1) { const act = isoCtx.actors[id]; const z = isoCtx.zones.find((x) => x.id === (id === 'meet-bot' ? 'meet' : 'studio')); moveActor(id, z.gx + .6 + Math.random() * 3.8, z.gy + 1.8 + Math.random() * 2.8); } });
    // 员工随机对话
    if (Math.random() < .25) { const t = pick(T.filter((x) => x.status === 'doing' && x.ownerId)); if (t) bubble(t.ownerId, pick(['和AI对一下方案', '这个线索不错', '数据我来补', '审核一下草稿', '客户刚回复了', '进度OK', '今天能交付'])); }
    if (Math.random() < .2) { const t = pick(T.filter((x) => x.status === 'doing')); if (t) bubble(t.agentId, `${t.progress}% ${t.title.slice(0, 8)}…`, 'ai'); }
    const P = S.company.profile;
    const pend = S.sim.approvals.filter((a) => a.status === 'pending');
    const brief = $('#brief');
    if (brief) brief.innerHTML = `<div class="flex between"><span class="h3"><i class="fas fa-crown" style="color:#ffd54f"></i> 老板简报</span><span class="dim" style="font-size:11px">D${S.sim.day} ${simTime()}</span></div>
      <div class="grid2 mt" style="gap:8px">
        <div class="stat" style="padding:8px"><div class="l">今日完成</div><div class="v" style="font-size:18px">${S.sim.today.done}</div></div>
        <div class="stat" style="padding:8px"><div class="l">今日商机</div><div class="v" style="font-size:18px;color:var(--ok)">${S.sim.today.leads}</div></div></div>
      <div class="mt" style="font-size:12px;line-height:1.7">
        <div>🎯 短板聚焦：<b>${P?.weakest.map((w) => w.name).join('、')}</b></div>
        <div>⏰ 督办中：<b style="color:var(--warn)">${T.filter((t) => t.esc > 0 && t.status !== 'done').length}</b> 项 · 返工 ${S.sim.metrics.rework} 次</div>
      </div>
      ${pend.length ? `<button class="btn btn-sm mt" style="width:100%;justify-content:center;background:rgba(255,181,71,.15);border:1px solid var(--warn);color:var(--warn)" onclick="gotoView('approve')"><i class="fas fa-shield-halved"></i>${pend.length} 项高风险动作待您审批</button>` : '<div class="hint mt">✓ 暂无待审批事项</div>'}`;
  }
  function bubble(id, text, cls = '') {
    const a = isoCtx?.actors[id]; if (!a) return;
    a.el.querySelector('.bubble')?.remove();
    const b = document.createElement('div'); b.className = 'bubble ' + cls; b.textContent = text;
    a.el.appendChild(b); setTimeout(() => b.remove(), 3200);
  }
  window.bubble = bubble;
  function zoneCenter(id) { const z = isoCtx?.zones.find((x) => x.id === id); return z ? { x: z.cx, y: z.cy } : null; }
  function packet(from, to, label, color) {
    if (!isoCtx) return;
    const a = zoneCenter(from), b = zoneCenter(to); if (!a || !b) return;
    const el = document.createElement('div'); el.className = 'packet'; el.style.color = color; el.style.left = a.x + 'px'; el.style.top = a.y + 'px';
    el.innerHTML = `<span>${label}</span>`; el.style.transition = 'left 1.5s cubic-bezier(.5,0,.5,1), top 1.5s cubic-bezier(.5,0,.5,1)';
    $('#iso-world').appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.left = b.x + 'px'; el.style.top = b.y + 'px'; }));
    setTimeout(() => el.remove(), 1700);
  }
  window.packet = packet;
  function packetsFromBoss(label) { S.depts.forEach((d, i) => setTimeout(() => packet('boss', d.id, label, '#ffd54f'), i * 120)); }
  function bossPatrol() {
    if (!isoCtx) return;
    const route = [...S.depts].sort(() => Math.random() - .5).slice(0, 3);
    const bz = isoCtx.zones.find((z) => z.id === 'boss');
    route.forEach((d, i) => setTimeout(() => {
      const z = isoCtx?.zones.find((x) => x.id === d.id); if (!z) return;
      moveActor('boss', z.gx + 2.5, z.gy + 4.6); setTimeout(() => bubble('boss', pick(['进度怎么样？', '有卡点吗？', '这个订单要抓紧', '辛苦了！', '数据给我看看'])), 1700);
      const st = S.staff.find((s) => s.deptId === d.id); if (st) setTimeout(() => bubble(st.id, pick(['老板好！', '正在推进', '今天能完成', 'AI帮了大忙'])), 2600);
    }, i * 3500));
    setTimeout(() => moveActor('boss', bz.gx + 2.6, bz.gy + 2.7), route.length * 3500 + 500);
  }
  function zoneClick(id) {
    if (id === 'boss') return gotoView('approve');
    if (id === 'studio') return gotoView('studio');
    if (id === 'brain') return gotoView('cockpit');
    if (id === 'meet') return gotoView('eval');
    window.openDeptDrawer(id);
  }
  function actorClick(id) {
    if (id === 'boss') return gotoView('approve');
    const s = S.staff.find((x) => x.id === id);
    if (s) return window.openStaffModal(s.id);
    const a = agentOf(id); if (a) return window.openAgentModal(a.id);
    if (id?.startsWith('studio')) return gotoView('studio');
  }
})();
