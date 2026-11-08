// 企业智脑 · 指挥中心：调度中枢（结构化流程图）+ 数字孪生（等距视图）+ 指令队列
(function () {
  const TW = 64, TH = 32, Z = 5, STRIDE = 7, COLS = 4, WALL = 30;
  let timer = null, view = 'flow', isoCtx = null, logScope = 'focus', boardSig = '', sideSig = '';
  const deptOf = (id) => S.depts.find((d) => d.id === id);
  const short = (s, n = 16) => esc(String(s || '').slice(0, n)) + (String(s || '').length > n ? '…' : '');
  const ST = { queued: ['待执行', 'p'], exec: ['执行中', ''], rework: ['返工中', 'warn'], verify: ['校验中', 'warn'], pack: ['出汇报材料', ''], approval: ['待审批', 'warn'], review: ['人工复核', 'bad'], done: ['已交付', 'ok'], rejected: ['已取消', 'bad'] };
  window.TASK_ST = ST;
  const CMD_ST = { plan: '拆解中', research: '深度研究中', strategy: '发展规划中', feasibility: '可行性校验中', confirm: '待老板决策', accept: '指令验收中', improve: '复盘提升中', done: '已完成', cancelled: '已取消' };

  // ====================== 主循环（时钟只驱动机制检查点，不制造工作） ======================
  function tick() {
    const sim = S.sim; if (!sim || sim.speed === 0) return;
    for (let s = 0; s < sim.speed; s++) {
      const prev = sim.min; sim.min += 5;
      CHECKPOINTS.forEach((cp) => { if (prev < cp.m && sim.min >= cp.m && !sim.cp[sim.day + cp.k]) { sim.cp[sim.day + cp.k] = 1; Flow.checkpoint(cp); } });
      if (sim.min >= DAY_END) Flow.newDay();
      Flow.step(5);
      sim.contents.forEach((c) => { if (c.status === 'live') { const v = rand(20, 300); c.views += v; sim.metrics.views += v; } });
    }
    renderTick();
    if (Math.random() < .3) saveState();
  }
  function stopSim() { if (timer) clearInterval(timer); timer = null; }
  window.stopSim = stopSim;

  // ====================== 外壳 ======================
  const NAV = [
    { k: 'flow', i: 'fa-diagram-project', n: '调度中枢' },
    { k: 'twin', i: 'fa-cubes-stacked', n: '数字孪生' },
    { k: 'mech', i: 'fa-arrows-spin', n: '工作机制' },
    { k: 'approve', i: 'fa-shield-halved', n: '审批闸门' },
    { k: 'leads', i: 'fa-crosshairs', n: '商机雷达' },
    { k: 'agents', i: 'fa-robot', n: 'Agent集群' },
    { k: 'cockpit', i: 'fa-gauge-high', n: '经营驾驶舱' },
    { k: 'studio', i: 'fa-clapperboard', n: '内容工厂' },
    { k: 'ledger', i: 'fa-sack-dollar', n: '价值账本' },
    { k: 'org', i: 'fa-sitemap', n: '组织人才' },
    { k: 'services', i: 'fa-layer-group', n: '服务中心' },
    { k: 'ideas', i: 'fa-lightbulb', n: '献策网络' },
    { k: 'masters', i: 'fa-user-tie', n: '大师智库' },
    { k: 'models', i: 'fa-sliders', n: '模型配置' },
    { k: 'archive', i: 'fa-box-archive', n: '项目档案' }
  ];
  const QUICK = ['本月全网找一批新订单', '降低主要原料采购成本', '做一波品牌宣传', '催收逾期应收账款', '招聘两名销售骨干'];
  window.renderHQ = function () {
    Flow.init();
    if (!NAV.some((n) => n.k === view)) view = 'flow';
    $('#app').innerHTML = `
    <div class="hq">
      <header class="hq-top">
        <div class="logo" id="hq-logo" style="cursor:pointer" title="返回主页"><div class="orb"><i class="fas fa-brain"></i></div><div style="line-height:1.2">${esc(S.company.name)}<div class="dim" style="font-size:11px;font-weight:400"><i class="fas ${S.industry?.icon}"></i> ${esc(S.industry?.div?.name || '')} · 企业智脑</div></div></div>
        <div class="clock"><i class="fas fa-clock" style="font-size:14px"></i><span id="clk"></span></div>
        <div class="speed" id="speed">${[0, 1, 3, 8].map((v) => `<button data-v="${v}" class="${S.sim.speed === v ? 'on' : ''}">${v === 0 ? '<i class="fas fa-pause"></i>' : v + 'x'}</button>`).join('')}</div>
        <div class="kpis" id="kpis"></div>
      </header>
      <nav class="hq-nav"><button class="nav-btn nav-home" id="nav-home" title="返回主页"><i class="fas fa-house"></i>主页</button>${NAV.map((n) => `<button class="nav-btn ${view === n.k ? 'on' : ''}" data-k="${n.k}"><i class="fas ${n.i}"></i>${n.n}<span class="badge" id="badge-${n.k}" style="display:none"></span></button>`).join('')}
        <div style="flex:1"></div><button class="nav-btn" id="nav-reset" title="重新创建企业"><i class="fas fa-rotate-left"></i>重建</button></nav>
      <main class="hq-main" id="hq-main"></main>
      <aside class="hq-side">
        <div class="side-sec cmd-box">
          <div class="flex between"><span class="h3"><i class="fas fa-crown" style="color:#d97706"></i> 老板指令</span><span class="tag p">一切工作从这里开始</span></div>
          <textarea id="cmd" rows="2" placeholder="例：本月把华东地区的订单做上去"></textarea>
          <div class="flex between"><label class="chk"><input type="checkbox" id="cmd-routine"> 设为每日例行（09:00 自动下发）</label><span class="flex" style="gap:6px"><button class="btn btn-ghost btn-sm" id="cmd-idea" title="把我自己的想法交给 AI 写成提案，再让智脑落地"><i class="fas fa-lightbulb" style="color:#f59e0b"></i>用我的想法</button><button class="btn btn-pri btn-sm" id="cmd-go"><i class="fas fa-paper-plane"></i>下达</button></span></div>
          <div class="flex wrap" style="gap:6px">${QUICK.map((q) => `<button class="tag" data-q="${q}" style="cursor:pointer">${q}</button>`).join('')}</div>
        </div>
        <div class="side-sec side-hd"><span class="h3"><i class="fas fa-list-check" style="color:var(--c1)"></i> 指令队列</span><span class="dim" style="font-size:11px" id="cmdq-count"></span></div>
        <div class="cmdq" id="cmdq"></div>
        <div class="side-sec side-hd"><span class="h3"><i class="fas fa-wave-square" style="color:var(--c1)"></i> 工作流日志</span><div class="seg" id="log-seg"><button data-s="focus">当前指令</button><button data-s="all">全部</button></div></div>
        <div class="feed" id="feed"></div>
      </aside>
      <footer class="hq-bottom">
        <span class="h3" style="white-space:nowrap"><i class="fas fa-calendar-day" style="color:var(--c1)"></i> 第 <span id="day">1</span> 天</span>
        <div class="cadence" id="cadence"></div>
      </footer>
    </div>`;
    $$('.nav-btn[data-k]').forEach((b) => b.onclick = () => gotoView(b.dataset.k));
    $$('#speed button').forEach((b) => b.onclick = () => { S.sim.speed = +b.dataset.v; $$('#speed button').forEach((x) => x.classList.toggle('on', x === b)); saveState(); });
    $('#nav-home').onclick = $('#hq-logo').onclick = () => window.goHome && goHome();
    $('#nav-reset').onclick = () => { if (confirm('确定重新创建企业？当前企业数据将清空。')) { stopSim(); resetState(); renderApp(); } };
    const go = () => { const v = $('#cmd').value.trim(); if (!v) return toast('请输入指令'); const r = $('#cmd-routine').checked; $('#cmd').value = ''; $('#cmd-routine').checked = false; window.bossCommand(v, { routine: r }); };
    $('#cmd-go').onclick = go;
    $('#cmd-idea').onclick = () => { const v = $('#cmd').value.trim(); if (window.openIdeas) { openIdeas('self'); if (v && window.ideaPrefill) ideaPrefill(v); } };
    $('#cmd').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); go(); } };
    $$('[data-q]').forEach((b) => b.onclick = () => window.bossCommand(b.dataset.q));
    $$('#log-seg button').forEach((b) => b.onclick = () => { logScope = b.dataset.s; renderFeed(); });
    $('#cmdq').onclick = (e) => {
      const info = e.target.closest('[data-info]'); if (info) { e.stopPropagation(); return openCmdModal(info.dataset.info); }
      const card = e.target.closest('[data-c]'); if (!card) return;
      Flow.focus = Flow.focus === card.dataset.c ? null : card.dataset.c; logScope = 'focus'; boardSig = ''; sideSig = ''; renderSide(); renderFeed(); renderTick();
    };
    sideSig = ''; boardSig = '';
    mountView(); renderSide(); renderFeed(); renderTick();
    stopSim(); timer = setInterval(tick, 1000);
  };
  window.bossCommand = function (text, opt = {}) { const c = Flow.issue(text, { routine: !!opt.routine }); if (c) toast(`#${c.no} 已下达，智脑开始拆解`, 'fa-paper-plane'); };
  window.gotoView = (k) => { view = k === 'eval' ? 'mech' : k === 'tasks' ? 'flow' : k; $$('.nav-btn').forEach((x) => x.classList.toggle('on', x.dataset.k === view)); mountView(); };
  window.currentView = () => view;
  function mountView() {
    const main = $('#hq-main'); isoCtx = null; boardSig = '';
    if (view === 'flow') renderBoard(main);
    else if (view === 'twin') renderIso(main);
    else window.renderModule(view, main);
  }
  window.onFlowChange = () => { if (!$('#hq-main')) return; renderSide(); if (view === 'flow') updateBoard(); updateBadges(); refreshTaskModal(); };
  window.onFlowLog = (e) => {
    const f = $('#feed'); if (!f) return;
    if (logScope === 'focus' && Flow.focus && e.cmd !== Flow.focus) return;
    f.querySelector('.feed-empty')?.remove();
    f.prepend(feedEl(e)); while (f.children.length > 80) f.lastChild.remove();
  };

  // ====================== 顶部：四大机制指标 ======================
  function renderTick() {
    if (!$('#clk')) return;
    $('#clk').textContent = simTime(); $('#day').textContent = S.sim.day;
    const st = Flow.stats(), M = S.sim.metrics;
    $('#kpis').innerHTML = [
      ['flow', 'fa-bolt', '进行中指令', st.activeCmds, `${st.openTasks} 项任务在办`],
      ['mech', 'fa-arrows-rotate', '循环', `${st.rework}`, `返工中 · 迭代 ${st.iterations} · 例行 ${st.routines}`],
      ['approve', 'fa-shield-halved', '审批', `${st.pending}`, `方案 ${st.pendPlan} · 成果 ${st.pendResult}`],
      ['mech', 'fa-clipboard-check', '校验', `${st.verifyToday}`, `今日 · 一次通过 ${st.passRate}%`],
      ['mech', 'fa-arrow-trend-up', '提升', `${st.knowledge}`, `经验 · ↑${st.promoted} ↓${st.demoted}`]
    ].map(([k, i, l, v, s]) => `<div class="kpi" onclick="gotoView('${k}')"><div class="l"><i class="fas ${i}"></i> ${l}</div><div class="v">${v}<small>${s}</small></div></div>`).join('');
    const pct = (m) => (m - DAY_START) / (DAY_END - DAY_START) * 100;
    $('#cadence').innerHTML = `<div class="track"></div><div class="prog" style="width:${pct(S.sim.min)}%"></div>` + CHECKPOINTS.map((c) => `<div class="cp ${S.sim.min >= c.m ? 'done' : ''} ${Math.abs(S.sim.min - c.m) < 30 ? 'now' : ''}" style="left:${pct(c.m)}%"><span class="nm">${c.name.split(' ')[0]}</span><span class="pt"></span><span class="sn">${c.name.split(' ')[1]}</span></div>`).join('');
    if (view === 'flow') updateBoard();
    else if (isoCtx) isoUpdate();
    else if (window.moduleTick) window.moduleTick(view);
    renderSide();
    updateBadges();
  }
  function updateBadges() {
    if (!S.sim) return;
    const set = (k, n) => { const b = $('#badge-' + k); if (!b) return; b.style.display = n ? 'block' : 'none'; b.textContent = n; };
    set('approve', S.sim.approvals.filter((a) => a.status === 'pending').length);
    set('leads', S.sim.leads.filter((l) => l.status === 'new').length);
    set('flow', Flow.active().length);
  }
  window.updateBadges = updateBadges;

  // ====================== 右侧：指令队列 + 日志 ======================
  function cmdStageLabel(c) {
    if (c.stage === 'done') return `已完成${c.acceptance ? ' · ' + c.acceptance.score + '分' : ''}`;
    if (c.stage !== 'run') return CMD_ST[c.stage];
    const st = Flow.cmdSteps(c); const i = st.lastIndexOf('active');
    return i >= 0 ? `${FLOW_STAGES[i].n}中` : '执行中';
  }
  function stepDots(c, big) {
    const st = Flow.cmdSteps(c);
    return `<div class="dots ${big ? 'big' : ''}">${FLOW_STAGES.map((s, i) => `<span class="dot-s ${st[i]} ${s.gate ? 'gate' : ''}" title="${s.n}"></span>`).join('')}</div>`;
  }
  function renderSide() {
    const box = $('#cmdq'); if (!box) return;
    const list = [...Flow.active(), ...S.sim.commands.filter((c) => ['done', 'cancelled'].includes(c.stage))].slice(0, 14);
    const sig = list.map((c) => c.id + c.stage + Flow.cmdSteps(c).join('') + c.taskIds.length).join() + Flow.focus + S.sim.routines.length;
    if (sig === sideSig) return; sideSig = sig;
    $('#cmdq-count').textContent = `${Flow.active().length} 进行中 · ${S.sim.routines.length} 例行`;
    $$('#log-seg button').forEach((b) => b.classList.toggle('on', b.dataset.s === logScope));
    if (!list.length) { box.innerHTML = `<div class="cmdq-empty"><i class="fas fa-mug-hot"></i><div>暂无指令，全体 Agent 待命</div><div class="dim">下达指令后：深度研究 → 发展规划 → 可行性校验 → 老板决策 → 部门执行 → 验收 → 审批 → 交付汇报 → 复盘归档</div></div>`; return; }
    box.innerHTML = list.map((c) => {
      const ts = c.taskIds.map(Flow.task).filter(Boolean);
      const done = ts.filter((t) => t.status === 'done').length, rw = ts.filter((t) => t.status === 'rework').length, ap = S.sim.approvals.filter((a) => a.cmdId === c.id && a.status === 'pending').length;
      const [sl, sc] = FLOW_SRC[c.source] || FLOW_SRC.boss;
      const routine = S.sim.routines.some((r) => r.text === Flow.baseText(c.text));
      return `<div class="cmd-card ${Flow.focus === c.id ? 'on' : ''} ${['done', 'cancelled'].includes(c.stage) ? 'fin' : ''}" data-c="${c.id}" style="--cc:${c.color}">
        <div class="flex between"><span><b class="no">#${c.no}</b> <span class="src" style="color:${sc};border-color:${sc}55">${sl}${c.iteration > 1 ? ' R' + c.iteration : ''}</span>${routine ? ' <i class="fas fa-rotate dim" title="每日例行"></i>' : ''}</span><span class="stg ${c.stage}">${cmdStageLabel(c)}</span></div>
        <div class="txt">${esc(c.text)}</div>
        ${stepDots(c)}
        <div class="meta"><span>任务 ${done}/${ts.length || c.plan.length || '-'}</span>${rw ? `<span style="color:var(--warn)">返工 ${rw}</span>` : ''}${ap ? `<span style="color:var(--warn)">待批 ${ap}</span>` : ''}${c.real ? '<span style="color:var(--ok)">AI</span>' : '<span>仿真</span>'}<button class="info" data-info="${c.id}" title="指令详情"><i class="fas fa-up-right-from-square"></i></button></div>
      </div>`;
    }).join('');
  }
  function feedEl(e) {
    const el = document.createElement('div'); el.className = 'ev';
    const c = e.cmd ? Flow.cmd(e.cmd) : null;
    el.innerHTML = `<span class="dot" style="background:${e.color}"></span><div><span class="t">${e.t}${c ? ` <b class="cno" style="color:${c.color}">#${c.no}</b>` : ''}</span><div>${e.html}</div></div>`;
    return el;
  }
  function renderFeed() {
    const f = $('#feed'); if (!f) return;
    $$('#log-seg button').forEach((b) => b.classList.toggle('on', b.dataset.s === logScope));
    const list = S.sim.feed.filter((e) => logScope === 'all' || !Flow.focus || e.cmd === Flow.focus).slice(0, 60);
    f.innerHTML = '';
    if (!list.length) { f.innerHTML = '<div class="feed-empty hint">暂无记录</div>'; return; }
    list.forEach((e) => f.appendChild(feedEl(e)));
  }

  // ====================== 调度中枢：老板指令 → 执行表 ======================
  const STEPS6 = [['plan', '规划', 'fa-list-check'], ['tool', '调用工具', 'fa-toolbox'], ['write', '撰写', 'fa-pen-nib'], ['accept', '验收', 'fa-clipboard-check'], ['package', '汇报材料', 'fa-file-powerpoint'], ['approve', '审批', 'fa-stamp'], ['deliver', '交付', 'fa-box-open']];
  const ownerOf = (t) => S.staff.find((s) => s.id === t.ownerId);
  function stepIdx(t) {
    if (t.status === 'done') return 7;
    if (t.status === 'approval') return 5;
    if (t.status === 'review') return 3;
    if (t.status === 'pack') return 4;
    if (t.status === 'verify') return 3;
    if (t.status === 'queued' || t.status === 'rejected') return -1;
    if (t.step) return Math.max(0, STEPS6.findIndex((s) => s[0] === t.step));
    return t.progress < 25 ? 0 : t.progress < 70 ? 1 : 2;
  }
  function stepCells(t) {
    const i = stepIdx(t), hadAppr = S.sim.approvals.some((a) => a.taskId === t.id);
    return STEPS6.map(([k, n], j) => {
      let st = j < i ? 'done' : j === i ? 'active' : 'pending';
      if (k === 'approve' && t.status === 'done' && !hadAppr) st = 'skip';
      if (k === 'accept' && t.status === 'rework' && j === i) st = 'warn';
      return `<span class="s6 ${st}" title="${n}"><i></i><em>${n}</em></span>`;
    }).join('');
  }
  function toolChips(t) {
    const tr = t.trace || [];
    return (t.tools || []).map((k) => {
      const es = tr.filter((e) => e.step === 'tool' && e.tool === k), m = toolMeta(k);
      const st = es.some((e) => e.status === 'run') ? 'run' : es.some((e) => e.status === 'ok') ? 'ok' : es.some((e) => e.status === 'fail') ? 'fail' : '';
      return `<span class="tl ${st}" title="${m.name}（${m.gsk}）${es.length ? ' · 调用 ' + es.length + ' 次' : ' · 未调用'}"><i class="fas ${m.icon}"></i>${es.length > 1 ? `<b>${es.length}</b>` : ''}</span>`;
    }).join('');
  }
  function acceptCell(t) {
    const a = t.accept;
    if (!a) return t.status === 'verify' ? '<span class="acc run"><i class="fas fa-spinner fa-spin"></i> 验收中</span>' : '<span class="dim">—</span>';
    const ok = a.pass ?? (a.total >= (a.threshold || 80));
    return `<span class="acc ${ok ? 'ok' : 'no'}"><b>${a.total}</b><small>/${a.threshold || 80}</small><span class="dots3">${(a.items || []).map((x) => `<i class="${x.status}"></i>`).join('')}</span></span>`;
  }
  // 汇报材料：Word / Excel / PPT 三个按钮（生成中显示进度）
  function docCell(t) {
    const P = t.pack;
    if (!P) return t.status === 'pack' ? '<span class="acc run"><i class="fas fa-spinner fa-spin"></i> 编排中</span>' : '<span class="dim">—</span>';
    const n = (P.slides || []).length, ok = (P.slides || []).filter((s) => s.url).length, pend = (P.slides || []).some((s) => s.pending);
    return `<span class="doc3"><button data-rv="${t.id}" data-tab="doc" class="w" title="Word 文档"><i class="fas fa-file-word"></i></button><button data-rv="${t.id}" data-tab="xls" class="x" title="Excel 表格"><i class="fas fa-file-excel"></i></button><button data-rv="${t.id}" data-tab="ppt" class="p" title="创意 PPT"><i class="fas fa-file-powerpoint"></i></button></span><small class="doc-n">${pend ? `<i class="fas fa-spinner fa-spin"></i> 幻灯片 ${ok}/${n}` : P.sim ? `${n} 页 · 仿真` : `${ok || n} 页${ok ? ' · AI 绘制' : ''}`}</small>`;
  }
  window.briefCmd = function (id) {
    const c = Flow.cmd(id); if (!c) return;
    const g = c.taskIds.map(Flow.task).filter((t) => t && t.pack).map((t) => ({ r: Office.snap(t), slides: t.pack.slides }));
    openBriefing(g);
  };
  function stageCount(k) {
    const T = S.sim.tasks, C = S.sim.commands;
    return { plan: C.filter((c) => c.stage === 'plan').length, confirm: S.sim.approvals.filter((a) => a.kind === 'plan' && a.status === 'pending').length, dispatch: T.filter((t) => t.status === 'queued').length, exec: T.filter((t) => t.status === 'exec' || t.status === 'rework').length, verify: T.filter((t) => t.status === 'verify').length, approve: T.filter((t) => t.status === 'approval' || t.status === 'review').length, deliver: T.filter((t) => t.status === 'done' && t.day === S.sim.day).length, improve: C.filter((c) => c.stage === 'accept' || c.stage === 'improve').length }[k];
  }
  function renderBoard(main) {
    main.innerHTML = `<section class="cc" id="cc"><div class="cc-pipe" id="cc-pipe"></div><div class="cc-body" id="cc-body"></div></section>`;
    $('#cc').onclick = (e) => {
      const pk = e.target.closest('[data-pick]'); if (pk) { e.stopPropagation(); return Flow.pick(pk.dataset.cmdid, pk.dataset.pick); }
      const dc = e.target.closest('[data-decide]'); if (dc) { e.stopPropagation(); const c = Flow.cmd(dc.dataset.decide); const k = c?.pick || c?.strategy?.recommend; toast(`已决策：方案 ${k || ''}，分发到部门执行`, 'fa-crown'); return Flow.decide(dc.dataset.decide, k); }
      const rj = e.target.closest('[data-replan]'); if (rj) { e.stopPropagation(); const v = prompt('请写下您对方案的意见，战略官将据此重新规划：', ''); if (v === null) return; const ap = S.sim.approvals.find((a) => a.cmdId === rj.dataset.replan && a.kind === 'plan' && a.status === 'pending'); if (ap) decideApproval(ap.id, false, v.trim() || '方案不满意，请重新规划'); return; }
      const rv = e.target.closest('[data-rv]'); if (rv) { e.stopPropagation(); return openReport(rv.dataset.rv, rv.dataset.tab); }
      const bf = e.target.closest('[data-brief]'); if (bf) { e.stopPropagation(); return briefCmd(bf.dataset.brief); }
      const r = e.target.closest('[data-t]'); if (r) return openTaskModal(r.dataset.t);
      const o = e.target.closest('[data-owner]'); if (o) { e.stopPropagation(); return openStaffModal(o.dataset.owner); }
      const c = e.target.closest('[data-cmd]'); if (c) return openCmdModal(c.dataset.cmd);
      const f = e.target.closest('[data-fold]'); if (f) { Flow.focus = Flow.focus === f.dataset.fold ? null : f.dataset.fold; boardSig = ''; sideSig = ''; updateBoard(); renderSide(); renderFeed(); return; }
      const g = e.target.closest('[data-gate]'); if (g) return gotoView(g.dataset.gate);
      const d = e.target.closest('[data-dept]'); if (d) return openDeptDrawer(d.dataset.dept);
    };
    updateBoard(true);
  }
  function boardSignature() {
    return [S.sim.commands.map((c) => c.id + c.stage + c.taskIds.length + (c.trace?.length || 0) + (c.trace?.filter((e) => e.status === 'run').length || 0) + (c.pick || '') + (c.strategy?.v || '') + (c.feas?.total || '') + (c.decisionEval?.score || '')).join(), S.sim.tasks.map((t) => t.id + t.status + (t.step || '') + (t.trace?.length || 0) + (t.trace?.filter((e) => e.status === 'run').length || 0) + t.esc + (t.paused ? 'p' : '') + t.rework + (t.accept?.total || '') + (t.pack ? 'k' + (t.pack.slides || []).filter((s) => s.url || !s.pending).length : '')).join(), Object.values(S.masters || {}).map((m) => m.name).join(), S.sim.approvals.filter((a) => a.status === 'pending').length, Flow.focus, S.staff.map((s) => s.tier || '').join(''), S.agents.map((a) => a.status[0]).join('')].join('|');
  }
  function updateBoard(force) {
    const body = $('#cc-body'); if (!body) return;
    const sig = boardSignature();
    if (!force && sig === boardSig) { $$('[data-t]', body).forEach((el) => { const t = Flow.task(el.dataset.t); const b = el.querySelector('.pg i'); if (t && b) b.style.width = t.progress + '%'; }); return; }
    boardSig = sig;
    // 顶部：全局流程管线（每段由谁负责 + 当前数量）
    $('#cc-pipe').innerHTML = `<div class="pipe-node boss"><i class="fas fa-crown"></i><b>老板指令</b><small>${Flow.active().length} 条进行中</small></div>` + FLOW_STAGES.map((s) => { const n = stageCount(s.k); return `<i class="fas fa-chevron-right pipe-ar"></i><div class="pipe-node ${s.gate ? 'gate' : ''} ${n ? 'hot' : ''}" ${s.gate ? `data-gate="approve"` : s.k === 'improve' ? 'data-gate="mech"' : ''}><i class="fas ${s.i}"></i><b>${s.n}</b><small>${s.who}</small>${n ? `<span class="cnt">${n}</span>` : ''}</div>`; }).join('');
    const cmds = [...Flow.active(), ...S.sim.commands.filter((c) => c.stage === 'done' && c.day >= S.sim.day - 1)].slice(0, 8);
    if (!cmds.length) { body.innerHTML = emptyHero(); return; }
    const F = Flow.focus;
    body.innerHTML = cmds.map((c) => cmdPanel(c, !F ? !['done', 'cancelled'].includes(c.stage) || cmds.length === 1 : F === c.id)).join('') + orgStrip();
  }
  function emptyHero() {
    return `<div class="hero">
      <div class="hero-l"><div class="h2"><i class="fas fa-crown" style="color:var(--gold)"></i> 一切工作从老板指令开始</div>
        <p class="muted mt">在右侧输入一句话指令：智脑先做<b>深度研究</b>（全网真实数据 + 数据边界），再由战略官给出 <b>3 套创意方案</b>，经<b>可行性七维校验</b>后由您拍板；各部门大师按选定方案执行，产出 Word / Excel / 创意 PPT，独立验收打分，最后复盘评估<b>您的决策见效</b>。</p>
        <div class="hero-flow mt">${['下达指令', '深度研究', '3 套方案', '可行性校验', '老板决策', '部门执行', '验收评分', '汇报 + 复盘'].map((x, i) => `${i ? '<i class="fas fa-arrow-right"></i>' : ''}<span>${x}</span>`).join('')}</div></div>
      <div class="hero-r">${TIER_ORDER.map((k) => { const T = TIERS[k]; return `<div class="tier-card" style="--tc:${T.color};--tb:${T.bg}"><div class="flex between">${tierBadge(k)}<span class="dim" style="font-size:11px">${T.model} · 门槛 ${T.pass}</span></div><div class="hint" style="margin:6px 0">${T.desc}</div><div class="tl-row">${T.tools.map((x) => `<span class="tl ok" title="${toolMeta(x).name}"><i class="fas ${toolMeta(x).icon}"></i></span><small>${toolMeta(x).name}</small>`).join('')}</div><div class="dim" style="font-size:11px;margin-top:6px">本企业 ${S.staff.filter((s) => tierOf(s) === k).length} 人</div></div>`; }).join('')}</div>
    </div>` + orgStrip();
  }
  // ---------- 决策室：深度研究 → 发展规划（3 方案）→ 可行性校验 → 老板决策 ----------
  const VERD = { go: ['可落地', 'ok'], revise: ['需修订', 'warn'], nogo: ['不可行', 'bad'] };
  function planRoom(c, compact) {
    const R = c.research, ST = c.strategy, FS = c.feas; if (!R && !ST) return '';
    const deciding = c.stage === 'confirm', chosen = c.decision?.key, sel = deciding ? (c.pick || ST?.recommend) : chosen;
    const conf = { high: '高', mid: '中', low: '低' };
    const res = R ? `<section class="pr-col pr-res"><h4><i class="fas fa-magnifying-glass-chart"></i>深度研究${R.sim ? ' <span class="tag p">仿真</span>' : ''}<small>${(R.sources || []).length} 条来源</small></h4>
      <p class="pr-sum">${esc(R.summary)}</p>
      ${(R.data || []).length ? `<div class="pr-data">${R.data.slice(0, compact ? 4 : 10).map((d) => `<span class="cf-${d.confidence}" title="来源：${esc(d.source)} · 可信度${conf[d.confidence]}"><b>${esc(d.value)}</b><small>${esc(d.metric)}</small></span>`).join('')}</div>` : ''}
      ${(R.boundaries || []).length ? `<div class="pr-bd"><b><i class="fas fa-ruler-combined"></i> 真实数据边界</b>${R.boundaries.slice(0, compact ? 3 : 5).map((x) => `<div>▸ ${esc(x)}</div>`).join('')}</div>` : ''}
      ${!compact && (R.findings || []).length ? `<div class="pr-find">${R.findings.map((f) => `<div class="${f.kind}"><span class="tag ${f.kind === 'fact' ? 'ok' : 'p'}">${f.kind === 'fact' ? '事实' : '推断'}</span>${esc(f.text)}${f.src.length ? `<small>${f.src.map((n) => { const s2 = R.sources?.[n - 1]; return s2 ? `<a href="${esc(s2.url)}" target="_blank" rel="noopener">[${n}]</a>` : `[${n}]`; }).join('')}</small>` : ''}</div>`).join('')}</div>` : ''}
      ${!compact && (R.gaps || []).length ? `<div class="hint mt"><b>信息缺口：</b>${esc(R.gaps.join('；'))}</div>` : ''}</section>` : '';
    const opt = ST ? `<section class="pr-col pr-st"><h4><i class="fas fa-chess-queen"></i>发展规划 v${ST.v}${ST.sim ? ' <span class="tag p">仿真</span>' : ''}<small>AI 推荐 ${ST.recommend}</small></h4>
      <p class="pr-thesis">${esc(ST.thesis)}</p>
      <div class="pr-opts">${(ST.options || []).map((o) => { const ov = FS?.optionsView?.find((x) => x.key === o.key); return `<div class="pr-opt ${sel === o.key ? 'on' : ''} ${deciding ? 'pickable' : ''}" ${deciding ? `data-pick="${o.key}" data-cmdid="${c.id}"` : ''}>
        <div class="flex between"><b><span class="ok-key">${o.key}</span>${esc(o.name)}</b>${o.key === ST.recommend ? '<span class="tag ok">AI 推荐</span>' : ''}${chosen === o.key && !deciding ? '<span class="tag warn">老板选定</span>' : ''}</div>
        <p>${esc(o.idea)}</p>
        <div class="pr-kv"><span>投入<b>${esc(o.invest)}</b></span><span>回报<b>${esc(o.return)}</b></span><span>周期<b>${esc(o.period)}</b></span></div>
        <div class="pr-risk"><i class="fas fa-triangle-exclamation"></i>${esc(o.risk)}${ov ? `<em>评审 ${ov.score}</em>` : ''}</div></div>`; }).join('')}</div>
      ${(ST.targets || []).length ? `<table class="pr-tg"><tr><th>量化目标</th><th>基线</th><th>目标</th><th>依据</th></tr>${ST.targets.slice(0, compact ? 3 : 6).map((t) => `<tr><td>${esc(t.kpi)}</td><td>${esc(t.base)}</td><td><b>${esc(t.target)}</b></td><td class="dim">${esc(t.basis)}</td></tr>`).join('')}</table>` : ''}
      ${!compact && (ST.milestones || []).length ? `<div class="pr-ms">${ST.milestones.map((m) => `<span><b>${esc(m.when)}</b>${esc(m.what)}<small>${esc(m.owner)}</small></span>`).join('')}</div>` : ''}
      ${!compact && (ST.notdo || []).length ? `<div class="hint mt"><b>明确不做：</b>${esc(ST.notdo.join('；'))}</div>` : ''}</section>` : '';
    const v = FS ? VERD[FS.verdict] || ['—', 'p'] : null;
    const fea = FS ? `<section class="pr-col pr-fs"><h4><i class="fas fa-scale-balanced"></i>可行性校验${FS.sim ? ' <span class="tag p">仿真</span>' : ''}<small>${(c.feasHist || []).length > 1 ? c.feasHist.map((h) => h.total).join(' → ') : ''}</small></h4>
      <div class="fs-top"><div class="fs-ring ${v[1]}" style="--p:${FS.total}"><b>${FS.total}</b><small>/100</small></div><div><span class="tag ${v[1]}">${v[0]}</span><p>${esc(FS.summary)}</p></div></div>
      <div class="fs-dims">${(FS.dims || []).map((d) => `<div title="${esc(d.note)}"><span>${d.name}</span><i><em style="width:${d.score}%;${d.score < 70 ? 'background:#f59e0b' : ''}"></em></i><b>${d.score}</b></div>`).join('')}</div>
      ${(FS.issues || []).length ? `<div class="fs-iss">${FS.issues.slice(0, compact ? 2 : 8).map((x) => `<div class="lv-${x.level}"><b>${{ high: '高', mid: '中', low: '低' }[x.level]}</b>${esc(x.text)}${!compact ? `<small>→ ${esc(x.fix)}</small>` : ''}</div>`).join('')}</div>` : ''}
      ${!compact && (FS.assumptions || []).length ? `<div class="hint mt"><b>需验证的关键假设：</b>${esc(FS.assumptions.join('；'))}</div>` : ''}</section>` : '';
    const dec = deciding && ST ? `<div class="pr-decide"><i class="fas fa-crown"></i><div><b>老板决策</b><small>点选一个方案（默认 AI 推荐 ${ST.recommend}）。选择与推荐不同的方案时，战略官会以您的选择为主线重排部门任务。</small></div><button class="btn btn-ghost btn-sm" data-replan="${c.id}"><i class="fas fa-rotate-left"></i>提意见重做</button><button class="btn btn-pri" data-decide="${c.id}"><i class="fas fa-check"></i>采用方案 ${sel} 并分发</button></div>`
      : c.decision && ST ? `<div class="pr-done"><i class="fas fa-crown"></i> 老板${c.decision.auto ? '（自动）' : ''}选定方案 <b>${c.decision.key}「${esc(c.decision.name)}」</b>${c.decision.follow ? ' · 采纳 AI 推荐' : ` · AI 推荐 ${c.decision.recommended}`} · 可行性 ${c.decision.feas ?? '-'} 分${c.decisionEval ? ` · <b class="ok">决策见效 ${c.decisionEval.score} 分</b>：${esc(c.decisionEval.effect)}` : ''}<a class="lnk" data-cmd="${c.id}" style="margin-left:auto">完整研究与规划 →</a></div>` : '';
    return `<div class="plan-room ${compact ? 'compact' : ''}">${res}${opt}${fea}</div>${dec}`;
  }
  window.planRoom = planRoom;
  // ---------- 各部门执行结果与完成评分 ----------
  function resultsGrid(c, ts) {
    if (!ts.length) return '';
    const scored = ts.filter((t) => t.accept || t.evals), avg = scored.length ? Math.round(scored.reduce((a, t) => a + (t.accept?.total ?? t.evals?.total ?? 0), 0) / scored.length) : 0;
    const done = ts.filter((t) => t.status === 'done').length, pct = Math.round(done / ts.length * 100);
    const card = (t) => {
      const d = deptOf(t.deptId), P = window.Masters?.get(t.deptId), sc = t.accept?.total ?? t.evals?.total, th = t.accept?.threshold || TIERS[t.tier]?.pass || 80;
      const sl = (t.pack?.slides || []).find((x) => x.url) || (t.pack?.slides || [])[0];
      const sum = t.pack?.doc?.summary || String(t.output || '').replace(/^[\s\S]*?##\s*结论\s*/, '').replace(/[#>*`|]/g, '').replace(/\s+/g, ' ').slice(0, 90);
      return `<article class="rs-card st-${t.status}" data-t="${t.id}" style="--dc:${d?.color}">
        <div class="rs-thumb">${sl ? Office.slideHTML(sl, { color: d?.color }) : `<div class="rs-ph"><i class="fas ${d?.icon}"></i><small>${(TASK_ST[t.status] || ['—'])[0]}</small></div>`}${sc != null ? `<span class="rs-sc ${sc >= th ? 'ok' : 'no'}">${sc}</span>` : ''}</div>
        <div class="rs-bd"><div class="flex between"><span class="dpt" style="--dc:${d?.color}"><i class="fas ${d?.icon}"></i>${esc(d?.name || '')}</span><span class="tag ${(TASK_ST[t.status] || [, 'p'])[1]}">${(TASK_ST[t.status] || ['—'])[0]}</span></div>
          <b class="rs-t">${esc(t.pack?.doc?.title || t.title)}</b>${t.link ? `<small class="rs-link"><i class="fas fa-link"></i>承接：${esc(t.link)}</small>` : ''}
          <p>${esc(sum || (['exec', 'rework'].includes(t.status) ? '执行中…' : t.status === 'queued' ? '已分发，等待执行' : ''))}</p>
          <div class="flex between"><span class="dim" style="font-size:11px">${P ? esc(P.title) : ''}${t.accept ? ` · ${t.accept.met}/${t.accept.items.length} 条达标` : ''}</span>${t.pack ? `<span class="doc3"><button data-rv="${t.id}" data-tab="doc" class="w"><i class="fas fa-file-word"></i></button><button data-rv="${t.id}" data-tab="xls" class="x"><i class="fas fa-file-excel"></i></button><button data-rv="${t.id}" data-tab="ppt" class="p"><i class="fas fa-file-powerpoint"></i></button></span>` : ''}</div></div></article>`;
    };
    return `<div class="rs-wrap"><div class="rs-hd"><span class="h3"><i class="fas fa-ranking-star" style="color:var(--c1)"></i> 各部门执行结果</span>
      <div class="rs-kpi"><span>完成 <b>${done}/${ts.length}</b><i class="bar"><em style="width:${pct}%"></em></i></span><span>平均验收 <b class="${avg >= 85 ? 'ok' : avg ? 'warn' : ''}">${avg || '—'}</b></span>${c.feas ? `<span>方案可行性 <b>${c.feas.total}</b></span>` : ''}${c.acceptance ? `<span>指令验收 <b class="ok">${c.acceptance.score}</b></span>` : ''}${c.decisionEval ? `<span>决策见效 <b class="ok">${c.decisionEval.score}</b></span>` : ''}</div></div>
      <div class="rs-grid">${ts.map(card).join('')}</div></div>`;
  }
  function cmdPanel(c, open) {
    const st = Flow.cmdSteps(c), ts = c.taskIds.map(Flow.task).filter(Boolean);
    const [sl, sc] = FLOW_SRC[c.source] || FLOW_SRC.boss;
    const done = ts.filter((t) => t.status === 'done').length, pend = S.sim.approvals.filter((a) => a.cmdId === c.id && a.status === 'pending');
    const calls = ts.reduce((n, t) => n + (t.trace || []).filter((e) => e.step === 'tool' && e.status === 'ok').length, 0);
    const srcs = ts.reduce((n, t) => n + (t.evidence?.length || 0), 0);
    const steps = `<div class="stepper">${FLOW_STAGES.map((s, i) => `<div class="stp ${st[i]} ${s.gate ? 'gate' : ''}"><span class="dot">${st[i] === 'done' ? '<i class="fas fa-check"></i>' : i + 1}</span><b>${s.n}</b><small>${s.who}</small></div>`).join('')}</div>`;
    const runE = (c.trace || []).filter((e) => e.status === 'run').slice(-1)[0];
    const PREP = { research: '深度研究员正在拆解指令本质、全网检索真实数据…', strategy: '首席战略官正在制定 3 套差异化创意方案…', feasibility: '可行性评审正在七维挑毛病：数据 / 资源 / 财务 / 时间 / 风险 / 合规 / 落地…', plan: '智脑正在拆解指令…' };
    const hint = c.stage === 'confirm' && !c.strategy ? `<div class="cmd-alert"><i class="fas fa-stamp"></i> 方案已拆解为 ${c.plan.length} 项，等待您确认后分发 <button class="btn btn-pri btn-sm" data-decide="${c.id}">确认分发</button></div>` : PREP[c.stage] ? `<div class="cmd-alert info"><i class="fas fa-spinner fa-spin"></i> ${PREP[c.stage]}${runE ? `<span class="dim" style="margin-left:6px">${esc(runE.label || '')}：${esc(String(runE.detail || '').slice(0, 60))}</span>` : ''}</div>` : '';
    const rows = (ts.length ? ts : []).map((t) => {
      const d = deptOf(t.deptId), o = ownerOf(t), stt = ST[t.status] || ['—', 'p'];
      return `<tr class="exec-row rs-${t.status}" data-t="${t.id}" data-row-dept="${t.deptId}">
        <td><span class="dpt" style="--dc:${d?.color}"><i class="fas ${d?.icon}"></i>${esc(d?.name || '')}</span>${window.Masters ? Masters.card(t.deptId, true) : ''}</td>
        <td class="tk"><b>${esc(t.title)}</b><small>${esc(t.deliverable || '')}</small></td>
        <td>${o ? `<span class="own" data-owner="${o.id}"><span class="avatar xs" style="background:${avColor(o.name)}">${esc(o.name[0])}</span><span><b>${esc(o.name)}</b><small>${esc(o.pos || '')}</small></span></span>` : '<span class="dim">未配置人员</span>'}</td>
        <td>${tierBadge(t.tier, true)}${t.gap ? `<span class="gap" title="任务要求${TIERS[t.level].name}，部门无对应人员">需${TIERS[t.level].short}</span>` : ''}</td>
        <td><div class="tl-row">${toolChips(t)}</div></td>
        <td><div class="s6-row">${stepCells(t)}</div>${['exec', 'rework'].includes(t.status) ? `<div class="pg"><i style="width:${t.progress}%"></i></div>` : ''}</td>
        <td>${acceptCell(t)}</td>
        <td>${docCell(t)}</td>
        <td><span class="tag ${stt[1]}">${stt[0]}</span>${t.rework ? `<span class="tag warn">v${t.history.length + (t.status === 'rework' ? 1 : 0)}</span>` : ''}${t.esc ? `<span class="tag bad">督办L${t.esc}</span>` : ''}${t.paused ? '<span class="tag bad">暂停</span>' : ''}</td>
      </tr>`;
    }).join('');
    const planRows = !ts.length && c.plan.length ? c.plan.map((p) => { const d = deptOf(p.deptId), o = Flow.pickOwner(p.deptId, p.level); const tr = o ? tierOf(o) : (p.level || 'master'); return `<tr class="exec-row plan"><td><span class="dpt" style="--dc:${d?.color}"><i class="fas ${d?.icon}"></i>${esc(d?.name || '')}</span></td><td class="tk"><b>${esc(p.title)}</b><small>${esc(p.deliverable || '')}</small></td><td>${o ? `<span class="own"><span class="avatar xs" style="background:${avColor(o.name)}">${esc(o.name[0])}</span><span><b>${esc(o.name)}</b><small>拟定负责人</small></span></span>` : '—'}</td><td>${tierBadge(tr, true)}</td><td><div class="tl-row">${TIERS[tr].tools.map((x) => `<span class="tl" title="${toolMeta(x).name}"><i class="fas ${toolMeta(x).icon}"></i></span>`).join('')}</div></td><td colspan="4" class="dim">${p.needApproval ? '<span class="tag warn">高风险 · 需审批</span> ' : ''}待确认分发</td></tr>`; }).join('') : '';
    return `<article class="cmd-panel ${open ? 'open' : ''} ${c.stage}" style="--cc:${c.color}">
      <header class="cp-hd" data-fold="${c.id}">
        <span class="cno-big">#${c.no}</span>
        <div class="cp-t"><div class="flex" style="gap:8px"><span class="src" style="color:${sc};border-color:${sc}">${sl}${c.iteration > 1 ? ' · 第' + c.iteration + '轮' : ''}</span><b>${esc(c.text)}</b></div>${c.goal && c.goal !== c.text ? `<small><i class="fas fa-bullseye"></i> 目标：${esc(c.goal)}</small>` : ''}</div>
        <div class="cp-m"><span><b>${done}</b>/${ts.length || c.plan.length || '-'} 交付</span><span><b>${calls}</b> 次工具调用</span><span><b>${srcs}</b> 条证据</span>${pend.length ? `<span class="warn"><b>${pend.length}</b> 待审批</span>` : ''}${c.acceptance ? `<span class="ok">验收 <b>${c.acceptance.score}</b></span>` : ''}<span class="${c.real ? 'ok' : 'dim'}">${c.real ? 'AI 真实执行' : '仿真'}</span></div>
        <button class="btn btn-ghost btn-sm" data-cmd="${c.id}"><i class="fas fa-up-right-from-square"></i>指令详情</button>
        <i class="fas fa-chevron-down fold"></i>
      </header>
      ${open ? `${steps}${hint}${planRoom(c, true)}
      ${ts.length || planRows ? `<table class="exec-table"><thead><tr><th>部门</th><th>任务 / 交付物</th><th>负责人</th><th>能力级别</th><th>调用工具组合</th><th>执行步骤</th><th>验收</th><th>汇报材料</th><th>状态</th></tr></thead><tbody>${rows || planRows}</tbody></table>` : ''}
      ${resultsGrid(c, ts)}
      ${ts.some((t) => t.pack) ? `<div class="cp-brief"><i class="fas fa-person-chalkboard"></i> 已有 <b>${ts.filter((t) => t.pack).length}</b> 个部门交出汇报材料（Word + Excel + 创意 PPT）<button class="btn btn-pri btn-sm" data-brief="${c.id}"><i class="fas fa-play"></i>召开部门汇报会</button>${c.archiveId ? `<button class="btn btn-ghost btn-sm" data-gate="archive"><i class="fas fa-box-archive"></i>已归档 · 查看档案</button>` : ''}</div>` : ''}
      ${c.acceptance ? `<div class="cp-acc"><i class="fas fa-clipboard-check"></i> 指令验收 <b>${c.acceptance.score}</b> 分 · ${{ achieved: '目标达成', partial: '部分达成', failed: '未达成' }[c.acceptance.verdict] || ''} · ${esc(c.acceptance.summary || '')}</div>` : ''}` : `<div class="cp-mini">${steps}</div>`}
    </article>`;
  }
  function orgStrip() {
    return `<div class="org-strip"><div class="os-hd"><b><i class="fas fa-people-group"></i> 组织运转</b><span class="dim">员工按能力级别着色；亮起 = 正在执行任务。点击部门查看详情</span></div><div class="os-grid">${S.depts.map((d) => {
      const st = S.staff.filter((s) => s.deptId === d.id), act = S.sim.tasks.filter((t) => t.deptId === d.id && !['done', 'rejected'].includes(t.status));
      const busyIds = new Set(act.map((t) => t.ownerId)), ags = S.agents.filter((a) => a.deptId === d.id), ab = ags.filter((a) => a.status !== 'idle').length;
      return `<div class="os-card ${act.length ? 'act' : ''}" data-dept="${d.id}" style="--dc:${d.color}"><div class="flex between"><span class="dpt" style="--dc:${d.color}"><i class="fas ${d.icon}"></i>${esc(d.name)}</span><span class="dim" style="font-size:11px">${act.length ? `<b style="color:var(--c1)">${act.length}</b> 项在办` : '待命'}</span></div>
        <div class="os-ppl">${st.map((s) => { const T = TIERS[tierOf(s)]; return `<span class="pp ${busyIds.has(s.id) ? 'busy' : ''}" style="--tc:${T.color}" title="${esc(s.name)} · ${esc(s.pos)} · ${T.name}">${esc(s.name[0])}</span>`; }).join('') || '<span class="dim" style="font-size:11px">未配置员工</span>'}</div>
        <div class="os-ag"><span>Agent ${ab}/${ags.length}</span><div class="pg sm"><i style="width:${ags.length ? ab / ags.length * 100 : 0}%"></i></div></div></div>`;
    }).join('')}</div></div>`;
  }
  // 动效：调度中枢中高亮对应的执行行；数字孪生中发数据包
  window.flowFx = function (a, b, label, color) {
    if (view === 'flow') { [a, b].forEach((id) => $$(`[data-row-dept="${id}"]`).forEach((el) => { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); })); }
    else if (isoCtx) packet(a, b, label, color);
  };

  // ====================== 指令详情 ======================
  window.openCmdModal = function (id) {
    const c = Flow.cmd(id); if (!c) return toast('指令已归档');
    const st = Flow.cmdSteps(c), ts = c.taskIds.map(Flow.task).filter(Boolean);
    const [sl, sc] = FLOW_SRC[c.source] || FLOW_SRC.boss;
    const pendPlan = S.sim.approvals.find((a) => a.cmdId === c.id && a.kind === 'plan' && a.status === 'pending');
    const routine = S.sim.routines.some((r) => r.text === Flow.baseText(c.text));
    const parent = c.parentId ? Flow.cmd(c.parentId) : null;
    const m = openModal(`<div class="flex"><div class="cmd-no" style="--cc:${c.color}">#${c.no}</div><div style="min-width:0;flex:1"><div class="h2" style="font-size:17px">${esc(c.text)}</div><div class="hint"><span style="color:${sc}">${sl}指令</span> · 第 ${c.iteration} 轮 · D${c.day} ${c.t} 下达 · ${c.real ? '<span style="color:var(--ok)">AI 真实执行</span>' : '仿真执行'}${parent ? ` · 上一轮 <a class="lnk" onclick="openCmdModal('${parent.id}')">#${parent.no}</a>` : ''}</div></div><button class="close-x" data-close><i class="fas fa-xmark"></i></button></div>
      <div class="cmd-steps mt">${FLOW_STAGES.map((s, i) => `<div class="cs ${st[i]} ${s.gate ? 'gate' : ''}" style="--cc:${c.color}"><i class="fas ${s.i}"></i><b>${s.n}</b><small>${s.who}</small></div>`).join('')}</div>
      ${c.goal ? `<div class="card mt" style="padding:12px"><b>目标：</b>${esc(c.goal)}${c.feedback ? `<div class="hint mt" style="white-space:pre-line">${esc(c.feedback)}</div>` : ''}</div>` : ''}
      ${c.research || c.strategy ? `<div class="card mt cm-room" style="padding:12px">${planRoom(c, false)}</div>` : ''}
      ${(c.trace || []).length ? `<div class="card mt"><div class="h3"><i class="fas fa-route" style="color:var(--c1)"></i> 研究与规划执行记录</div><table class="trace-tb mt"><tbody>${c.trace.map((e) => `<tr class="st-${e.status}"><td class="mono">${esc(e.at)}</td><td><b>${esc(e.label || e.step)}</b></td><td>${e.tool ? `<span class="tl ok"><i class="fas ${toolMeta(e.tool).icon}"></i></span>` : ''} ${esc(e.model || '')}</td><td>${esc(e.detail || '')}${e.sim ? ' <span class="tag p">仿真</span>' : ''}${(e.sources || []).length ? `<div class="tr-src">${e.sources.map((x, i) => `<a href="${esc(x.url)}" target="_blank" rel="noopener"><b>${i + 1}.</b> ${esc(x.title)}</a>`).join('')}</div>` : ''}</td><td class="mono">${e.ms ? (e.ms / 1000).toFixed(1) + 's' : ''}</td><td>${e.status === 'run' ? '<i class="fas fa-spinner fa-spin" style="color:var(--c1)"></i>' : e.status === 'fail' ? '<i class="fas fa-circle-xmark" style="color:var(--bad)"></i>' : '<i class="fas fa-circle-check" style="color:var(--ok)"></i>'}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${pendPlan && !c.strategy ? `<div class="card mt" style="border-color:var(--warn)"><div class="h3" style="color:var(--warn)"><i class="fas fa-stamp"></i> 闸门① 方案确认</div><div class="hint mt">确认后才会分发到部门；驳回会带着你的意见重新拆解。</div><div class="flex mt"><input id="cm-fb" placeholder="驳回意见（可选）" style="flex:1"><button class="btn btn-danger btn-sm" id="cm-rej">驳回重拆</button><button class="btn btn-pri btn-sm" id="cm-ok"><i class="fas fa-check"></i>确认分发</button></div></div>` : ''}
      <div class="card mt"><div class="ct"><span class="h3">拆解方案与执行（${c.plan.length} 项）</span><span class="dim" style="font-size:11px">点击任务查看成果</span></div>
        <table class="table"><tr><th>部门</th><th>任务</th><th>交付物</th><th>状态</th><th>验收</th><th>返工</th></tr>
        ${(ts.length ? ts : c.plan).map((x) => { const t = ts.length ? x : null; const d = deptOf(x.deptId); return `<tr ${t ? `style="cursor:pointer" onclick="openTaskModal('${t.id}')"` : ''}><td><i class="fas ${d?.icon}" style="color:${d?.color}"></i> ${esc(d?.name || '')}</td><td>${esc(x.title)}${x.needApproval ? ' <span class="tag warn" style="font-size:10px">高风险</span>' : ''}</td><td class="dim">${esc((x.deliverable || '').slice(0, 26))}</td><td>${t ? `<span class="tag ${ST[t.status][1]}">${ST[t.status][0]}</span>` : '<span class="tag p">待分发</span>'}</td><td>${t?.evals ? `<b style="color:${t.evals.total >= 80 ? 'var(--ok)' : 'var(--warn)'}">${t.evals.total}</b>` : '-'}</td><td>${t?.rework || 0}</td></tr>`; }).join('')}</table></div>
      ${c.acceptance ? `<div class="grid2 mt"><div class="card"><div class="ct"><span class="h3"><i class="fas fa-clipboard-check" style="color:var(--c1)"></i> 指令验收</span><b class="grad-txt" style="font-size:24px">${c.acceptance.score}</b></div><span class="tag ${c.acceptance.verdict === 'achieved' ? 'ok' : c.acceptance.verdict === 'partial' ? 'warn' : 'bad'}">${{ achieved: '目标达成', partial: '部分达成', failed: '未达成' }[c.acceptance.verdict]}</span><p class="muted mt" style="font-size:13px;line-height:1.7">${esc(c.acceptance.summary)}</p></div>
        <div class="card"><div class="h3"><i class="fas fa-arrow-trend-up" style="color:#7c3aed"></i> 复盘提升</div>
          ${(c.review?.lessons || []).map((l) => `<div style="font-size:12px;margin-top:6px"><i class="fas fa-book" style="color:var(--c2)"></i> ${esc(l)}</div>`).join('') || '<div class="hint mt">无</div>'}
          ${c.review?.promos?.length ? `<div style="font-size:12px;margin-top:8px"><i class="fas fa-ranking-star" style="color:var(--ok)"></i> ${esc(c.review.promos.join('、'))}</div>` : ''}
          ${(c.review?.next || []).length ? `<div class="hint mt">下一轮方向：${esc(c.review.next.join('；'))}</div>` : ''}</div></div>` : ''}
      ${c.decisionEval ? `<div class="card mt dec-eval"><div class="ct"><span class="h3"><i class="fas fa-crown" style="color:#d97706"></i> 老板决策见效评估</span><b class="grad-txt" style="font-size:24px">${c.decisionEval.score}</b></div><div class="grid3 mt"><div><div class="hint">决策带来的结果</div><div style="font-size:13px">${esc(c.decisionEval.effect)}</div></div><div><div class="hint">距离目标还差</div><div style="font-size:13px">${esc(c.decisionEval.gap)}</div></div><div><div class="hint">下一步最该拍板</div><div style="font-size:13px;font-weight:700;color:#b45309">${esc(c.decisionEval.nextDecision)}</div></div></div></div>` : ''}
      <div class="card mt"><div class="h3">指令操作</div><div class="flex wrap mt">
        ${['done'].includes(c.stage) ? `<input id="cm-iter" placeholder="补充要求（可选），带着复盘结论进入下一轮" style="flex:1;min-width:220px"><button class="btn btn-pri btn-sm" id="cm-next"><i class="fas fa-rotate"></i>迭代下一轮</button>` : ''}
        <button class="btn btn-ghost btn-sm" id="cm-routine"><i class="fas fa-calendar-check"></i>${routine ? '取消每日例行' : '设为每日例行'}</button>
        ${!['done', 'cancelled'].includes(c.stage) ? '<button class="btn btn-danger btn-sm" id="cm-cancel"><i class="fas fa-stop"></i>取消指令</button>' : ''}
      </div></div>
      <div class="card mt"><div class="h3">流转记录</div><div class="cmd-log">${[...c.log].reverse().map((l) => `<div><span class="t">${l.t}</span> ${l.html}</div>`).join('')}</div></div>`);
    m.dataset.cmd = id;
    const on = (sel, fn) => { const el = $(sel, m); if (el) el.onclick = fn; };
    on('#cm-ok', () => { decideApproval(pendPlan.id, true); openCmdModal(id); });
    $$('[data-pick]', m).forEach((b) => b.onclick = () => { Flow.pick(id, b.dataset.pick); openCmdModal(id); });
    $$('[data-decide]', m).forEach((b) => b.onclick = () => { Flow.decide(id, c.pick || c.strategy?.recommend); toast('已决策并分发', 'fa-crown'); closeOverlay(); });
    $$('[data-replan]', m).forEach((b) => b.onclick = () => { const v = prompt('请写下您对方案的意见，战略官将据此重新规划：', ''); if (v === null) return; if (pendPlan) decideApproval(pendPlan.id, false, v.trim() || '方案不满意，请重新规划'); closeOverlay(); });
    on('#cm-rej', () => { decideApproval(pendPlan.id, false, $('#cm-fb', m).value.trim() || '方案不满意，请重新拆解'); openCmdModal(id); });
    on('#cm-next', () => { const n = Flow.iterate(id, $('#cm-iter', m).value.trim()); if (n) { toast(`已进入第 ${n.iteration} 轮：#${n.no}`, 'fa-rotate'); openCmdModal(n.id); } });
    on('#cm-routine', () => { Flow.toggleRoutine(Flow.baseText(c.text), !routine); toast(routine ? '已取消每日例行' : '已设为每日例行：每天 09:00 自动迭代下发', 'fa-calendar-check'); openCmdModal(id); });
    on('#cm-cancel', () => { if (confirm(`确定取消 #${c.no}？未完成任务将停止。`)) { Flow.cancel(id); openCmdModal(id); } });
  };

  // ====================== 任务详情：执行表 + 验收 ======================
  function traceRows(t) {
    const tr = t.trace || [];
    if (!tr.length) return '<div class="hint">尚未开始执行</div>';
    return `<table class="trace-tb"><thead><tr><th>时间</th><th>版本</th><th>步骤</th><th>工具 / 模型</th><th>执行记录</th><th>用时</th><th></th></tr></thead><tbody>${tr.map((e) => {
      const m = e.step === 'tool' ? toolMeta(e.tool) : null;
      const who = m ? `<span class="tl ${e.status}"><i class="fas ${m.icon}"></i></span> ${m.name}<small>${m.gsk}</small>` : `<span class="tl ok"><i class="fas ${toolMeta(e.step === 'write' ? 'write' : e.step).icon || 'fa-gear'}"></i></span> ${e.model || TIERS[t.tier]?.model || ''}<small>llm_proxy</small>`;
      const src = (e.sources || []).length ? `<div class="tr-src">${e.sources.map((x, i) => `<a href="${esc(x.url)}" target="_blank" rel="noopener"><b>${i + 1}.</b> ${esc(x.title)}</a>${x.snippet ? `<small>${esc(x.snippet)}</small>` : ''}`).join('')}</div>` : '';
      const img = (e.images || []).length ? `<div class="tr-img">${e.images.map((x) => `<a href="${esc(x.link || x.url)}" target="_blank"><img src="${esc(x.url)}" loading="lazy"></a>`).join('')}</div>` : '';
      const crit = e.extra?.criteria ? `<ol class="tr-crit">${e.extra.criteria.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : '';
      const items = e.extra?.items ? `<div class="tr-items">${e.extra.items.map((x) => `<div class="ai-${x.status}"><i class="fas ${x.status === 'met' ? 'fa-circle-check' : x.status === 'partial' ? 'fa-circle-half-stroke' : 'fa-circle-xmark'}"></i>${esc(x.text)}${x.evidence ? `<small>「${esc(x.evidence)}」${esc(x.note || '')}</small>` : ''}</div>`).join('')}</div>` : '';
      return `<tr class="st-${e.status}"><td class="mono">${esc(e.at)}</td><td>v${e.v}</td><td><b>${TRACE_STEP[e.step] || e.step}</b></td><td class="who">${who}</td><td>${esc(e.detail || '')}${e.sim ? ' <span class="tag p">仿真</span>' : ''}${crit}${items}${src}${img}</td><td class="mono">${e.ms ? (e.ms / 1000).toFixed(1) + 's' : ''}</td><td>${e.status === 'run' ? '<i class="fas fa-spinner fa-spin" style="color:var(--c1)"></i>' : e.status === 'fail' ? '<i class="fas fa-circle-xmark" style="color:var(--bad)"></i>' : '<i class="fas fa-circle-check" style="color:var(--ok)"></i>'}</td></tr>`;
    }).join('')}</tbody></table>`;
  }
  function taskModalHtml(t) {
    const d = deptOf(t.deptId), a = agentOf(t.agentId), c = Flow.cmd(t.cmdId), o = ownerOf(t), ac = t.accept, ev = t.evals?.ev, T = TIERS[t.tier] || TIERS.std;
    const ai = window.AI && AI.on;
    const crit = (t.criteria || []).map((x, i) => { const it = ac?.items?.[i]; return `<li class="${it ? 'ai-' + it.status : ''}"><i class="fas ${!it ? 'fa-circle dim' : it.status === 'met' ? 'fa-circle-check' : it.status === 'partial' ? 'fa-circle-half-stroke' : 'fa-circle-xmark'}"></i><span>${esc(x)}${it?.evidence ? `<small>验收证据：「${esc(it.evidence)}」${esc(it.note || '')}</small>` : ''}</span></li>`; }).join('');
    const MP = window.Masters?.get(t.deptId), pk = t.pack;
    const masterCard = MP ? `<div class="card mt ms-mini" style="--dc:${d?.color}"><div class="ms-id"><div class="ms-av">${esc(MP.name[0])}</div><div><b>${esc(MP.title)}「${esc(MP.name)}」</b><div class="dim" style="font-size:12px">${esc(MP.motto || '')} · 以 ${esc((ENGINE_LIST.find((x) => x[0] === officeCfg().engine) || [, 'Ultra'])[1])} 深度推理</div></div><button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="closeOverlay();gotoView('masters')"><i class="fas fa-sliders"></i>调整思维与边界</button></div><div class="ms-row"><div><h5>思维方式</h5><ol>${(MP.thinking || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div><div><h5>边界</h5><ul class="bd">${(MP.boundaries || []).concat(window.Masters.cfg().rules || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></div></div>` : '';
    const packCard = pk ? `<div class="card mt pack-card"><div class="ct"><span class="h3"><i class="fas fa-folder-open" style="color:#ea580c"></i> 部门汇报材料</span><span class="dim" style="font-size:12px">${pk.sim ? '仿真 · 文字版' : `${esc((SLIDE_MODELS.find((x) => x[0] === pk.slideModel) || [, ''])[1])} 绘制幻灯片${pk.credits ? ` · 约 ${pk.credits} 积分` : ''}`}</span></div><div class="pack-row"><button class="pk w" data-rv="${t.id}" data-tab="doc"><i class="fas fa-file-word"></i><b>Word 文档</b><small>${esc(pk.doc?.title || t.title)}</small></button><button class="pk x" data-rv="${t.id}" data-tab="xls"><i class="fas fa-file-excel"></i><b>Excel 表格</b><small>${(pk.sheets || []).length + 1} 张工作表</small></button><button class="pk p" data-rv="${t.id}" data-tab="ppt"><i class="fas fa-file-powerpoint"></i><b>创意 PPT</b><small>${(pk.slides || []).length} 页${(pk.slides || []).some((s) => s.pending) ? ' · 生成中' : ''}</small></button><div class="pk-thumbs">${(pk.slides || []).slice(0, 4).map((s) => `<span>${Office.slideHTML(s, { color: d?.color })}</span>`).join('')}</div></div></div>` : (t.status === 'pack' ? '<div class="card mt"><i class="fas fa-spinner fa-spin" style="color:#ea580c"></i> 验收已通过，首席大师正在编排 Word / Excel / 创意 PPT…</div>' : '');
    return `<div class="flex"><div class="bot-ic"><i class="fas fa-file-signature"></i></div><div style="min-width:0;flex:1"><div class="h2" style="font-size:17px">${esc(t.title)}</div><div class="hint">${esc(d?.name || '')} · <span class="tag ${ST[t.status][1]}" style="font-size:10px">${ST[t.status][0]}</span> ${t.real ? '<span style="color:var(--ok)">AI 真实执行</span>' : '仿真任务'}${c ? ` · 所属指令 <a class="lnk" onclick="openCmdModal('${c.id}')">#${c.no}</a>` : ''}</div></div><button class="close-x" data-close><i class="fas fa-xmark"></i></button></div>
      <div class="tm-grid mt">
        <div class="card"><div class="h4">负责人</div>${o ? `<div class="own big mt" onclick="openStaffModal('${o.id}')"><span class="avatar" style="background:${avColor(o.name)}">${esc(o.name[0])}</span><span><b>${esc(o.name)}</b><small>${esc(o.pos)} · 价值 ${o.value}</small></span></div>` : '<div class="hint mt">部门未配置员工</div>'}<div class="mt">${tierBadge(t.tier)} ${t.gap ? `<span class="gap">任务要求${TIERS[t.level].name}</span>` : ''}</div><div class="hint mt">搭档 Agent：${esc(a?.name || '')}</div></div>
        <div class="card"><div class="h4">能力级别 → 决策调用库</div><div class="hint mt">${T.desc}</div><div class="tl-row mt">${(t.tools || []).map((k) => `<span class="tl ok"><i class="fas ${toolMeta(k).icon}"></i></span><small>${toolMeta(k).name}</small>`).join('')}</div><div class="hint mt">推理引擎 <b>${esc((ENGINE_LIST.find((x) => x[0] === officeCfg().engine) || [, 'Ultra'])[1])}</b> · 验收门槛 <b>${T.pass}</b> 分且无未达项</div></div>
        <div class="card"><div class="h4">交付物</div><div class="mt" style="font-size:13px"><b>${esc(t.deliverable || '—')}</b></div>${t.plan?.framework ? `<div class="hint mt"><b>方法框架：</b>${esc(t.plan.framework)}</div>` : ''}${t.plan?.understanding ? `<div class="hint"><b>成功标志：</b>${esc(t.plan.understanding)}</div>` : ''}</div>
      </div>
      ${masterCard}${packCard}
      <div class="card mt"><div class="ct"><span class="h3"><i class="fas fa-bullseye" style="color:var(--c1)"></i> 验收标准</span>${ac ? `<span class="acc ${ac.pass ?? ac.total >= ac.threshold ? 'ok' : 'no'}" style="font-size:13px"><b>${ac.total}</b><small>/${ac.threshold}</small> · ${ac.met}/${(ac.items || []).length} 条达标</span>` : '<span class="dim" style="font-size:12px">待验收</span>'}</div><ul class="crit">${crit || '<li class="dim">规划阶段生成</li>'}</ul>${ac?.feedback || t.feedback ? `<div class="fb-box ${ac?.pass ? 'ok' : ''}"><b>${ac?.pass ? '验收亮点' : '验收意见'}：</b>${esc(ac?.feedback || t.feedback)}</div>` : ''}</div>
      <div class="card mt"><div class="ct"><span class="h3"><i class="fas fa-table-list" style="color:var(--c1)"></i> 执行表</span><span class="dim" style="font-size:12px">每一步调用都留痕：工具、关键词、来源、模型、用时</span></div>${traceRows(t)}</div>
      ${t.output ? `<div class="card mt"><div class="ct"><span class="h3"><i class="fas fa-file-lines" style="color:var(--c1)"></i> 成果 ${t.history.length > 1 ? `<span class="tag p">第 ${t.history.length} 版</span>` : ''}</span><button class="btn btn-ghost btn-sm" id="tm-copy"><i class="fas fa-copy"></i>复制</button></div><div class="md out">${mdRender(t.output)}</div></div>` : `<div class="card mt"><div class="flex">${['exec', 'rework', 'verify'].includes(t.status) ? '<i class="fas fa-spinner fa-spin" style="color:var(--c1)"></i>' : '<i class="fas fa-hourglass-half dim"></i>'}<span>${t.error ? `执行失败：${esc(t.error)}` : t.status === 'queued' ? '已分发，等待执行' : '执行中，执行表实时更新…'}</span><div class="bar" style="flex:1"><i style="width:${t.progress}%"></i></div></div>${t.paused ? '<button class="btn btn-ghost btn-sm mt" id="tm-retry"><i class="fas fa-rotate"></i>重试</button>' : ''}${!t.real && ai && !['done', 'rejected'].includes(t.status) ? '<button class="btn btn-pri btn-sm mt" id="tm-real"><i class="fas fa-bolt"></i>改为 AI 真实执行</button>' : ''}</div>`}
      ${ev ? `<div class="grid2 mt"><div class="card"><div class="h4">五维评分</div>${EVAL_DIMS.map((dm) => `<div class="flex" style="margin:6px 0"><span style="width:60px;font-size:12px">${dm.name}</span><div class="bar" style="flex:1"><i style="width:${ev[dm.k]}%;${ev[dm.k] < 70 ? 'background:linear-gradient(90deg,#dc2626,#d97706)' : ''}"></i></div><b style="width:26px;text-align:right;font-size:12px">${ev[dm.k]}</b></div>`).join('')}</div>
        <div class="card"><div class="h4">版本与循环</div>${t.history.map((h) => `<div class="flex between" style="font-size:12px;margin-top:8px"><span>v${h.v} · ${h.at}</span><b style="color:${h.total >= (TIERS[t.tier]?.pass || 80) ? 'var(--ok)' : 'var(--warn)'}">${h.total} 分</b></div><div class="hint">${esc(h.feedback || '')}</div>`).join('')}${t.humanPassed ? '<div class="hint mt">👤 老板人工通过</div>' : ''}</div></div>` : ''}
      ${t.deep ? `<div class="card mt"><div class="ct"><span class="h3"><i class="fas fa-brain" style="color:var(--c2)"></i> 智导超级智能体</span><span class="tag ${t.deep.state === 'succeeded' ? 'ok' : 'p'}">${esc(t.deep.state)}</span></div>${t.deep.result ? `<div class="md" style="max-height:40vh;overflow:auto">${mdRender(t.deep.result.text || '（无文本成果）')}</div>` : '<div class="hint"><i class="fas fa-spinner fa-spin"></i> 深度执行中，每 15 秒自动刷新…</div>'}</div>` : ''}
      ${t.output && t.status !== 'rejected' ? `<div class="card mt"><div class="h3">老板操作</div><div class="flex mt wrap">
        ${t.status !== 'done' ? `<button class="btn btn-pri btn-sm" id="tm-pass"><i class="fas fa-check"></i>${t.status === 'approval' ? '批准执行' : '人工通过'}</button>` : ''}
        <input id="tm-fb" placeholder="写下修改意见，打回进入返工循环" style="flex:1;min-width:200px;font-size:13px"><button class="btn btn-ghost btn-sm" id="tm-redo"><i class="fas fa-rotate-left"></i>打回返工</button>
        ${ai && !t.deep ? '<button class="btn btn-ghost btn-sm" id="tm-deep"><i class="fas fa-brain"></i>超级智能体深度执行</button>' : ''}
      </div></div>` : ''}`;
  }
  const taskSig = (t) => [t.status, t.step, t.trace?.length, t.trace?.filter((e) => e.status === 'run').length, t.accept?.total, t.history.length, t.deep?.state, t.pack ? (t.pack.slides || []).map((s) => s.url ? 1 : s.pending ? 0 : 2).join('') : ''].join('|');
  window.openTaskModal = function (id) {
    const t = Flow.task(id); if (!t) return toast('任务已归档');
    const m = openModal(taskModalHtml(t));
    m.classList.add('wide'); m.dataset.task = id; m.dataset.sig = taskSig(t);
    bindTaskModal(m, t);
  };
  function bindTaskModal(m, t) {
    const id = t.id, on = (sel, fn) => { const el = $(sel, m); if (el) el.onclick = fn; };
    $$('[data-close]', m).forEach((b) => (b.onclick = closeOverlay));
    $$('[data-rv]', m).forEach((b) => (b.onclick = () => openReport(id, b.dataset.tab)));
    on('#tm-real', () => { t.real = true; t.status = 'queued'; t.progress = 0; t.age = 0; t.trace = []; t.plan = null; t.evidence = null; saveState(); Flow.refresh(); toast('已交给 AI 真实执行'); openTaskModal(id); });
    on('#tm-retry', () => { Flow.retryTask(t); toast('已重新排队'); closeOverlay(); });
    on('#tm-copy', () => { navigator.clipboard?.writeText(t.output || ''); toast('已复制成果'); });
    on('#tm-pass', () => { Flow.passTask(t); openTaskModal(id); });
    on('#tm-redo', () => { const fb = $('#tm-fb', m).value.trim(); if (!fb) return toast('请写下修改意见'); if (Flow.reworkTask(t, fb)) { toast('已打回，按意见返工'); closeOverlay(); } });
    on('#tm-deep', () => window.AI && AI.deepAgent(t));
  }
  // 执行中实时刷新打开的任务详情（输入时不打扰）
  function refreshTaskModal() {
    const m = $('.modal[data-task]'); if (!m) return;
    const t = Flow.task(m.dataset.task); if (!t) return;
    const sig = taskSig(t); if (sig === m.dataset.sig) return;
    if (m.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const sc = m.scrollTop; m.innerHTML = taskModalHtml(t); m.dataset.sig = sig; m.scrollTop = sc; bindTaskModal(m, t);
  }

  // ====================== 数字孪生（等距视图，按流程排布） ======================
  const iso = (gx, gy) => ({ x: isoCtx.OX + (gx - gy) * TW / 2, y: isoCtx.OY + (gx + gy) * TH / 2 });
  function poly(pts, fill, stroke, extra = '') { return `<polygon points="${pts.map((p) => p.x + ',' + p.y).join(' ')}" fill="${fill}" stroke="${stroke || 'none'}" ${extra}/>`; }
  function box(gx, gy, w, d, h, top, side1, side2) {
    const A = iso(gx, gy), B = iso(gx + w, gy), C = iso(gx + w, gy + d), D = iso(gx, gy + d);
    const up = (p) => ({ x: p.x, y: p.y - h });
    return poly([D, C, up(C), up(D)], side1) + poly([C, B, up(B), up(C)], side2) + poly([up(A), up(B), up(C), up(D)], top);
  }
  function zoneList() {
    const specials = [
      { id: 'boss', name: '① 老板办公室', icon: 'fa-crown', color: '#d97706', special: true },
      { id: 'brain', name: '② 研究规划中枢', icon: 'fa-brain', color: '#2563eb', special: true },
      { id: 'qa', name: '③ 质检中心', icon: 'fa-clipboard-check', color: '#d97706', special: true },
      { id: 'kb', name: '④ 知识库', icon: 'fa-book', color: '#7c3aed', special: true }
    ];
    return [...specials, ...S.depts].map((z, i) => ({ ...z, col: i % COLS, row: Math.floor(i / COLS) }));
  }
  function renderIso(main) {
    const zones = zoneList();
    const rows = Math.ceil(zones.length / COLS);
    const gxMax = COLS * STRIDE, gyMax = rows * STRIDE;
    const W = (gxMax + gyMax) * TW / 2 + 160, H = (gxMax + gyMax) * TH / 2 + 200;
    isoCtx = { OX: gyMax * TW / 2 + 80, OY: 110, zones, W, H, actors: {}, scale: 1, tx: 0, ty: 0 };
    zones.forEach((z) => { z.gx = z.col * STRIDE; z.gy = z.row * STRIDE; const c = iso(z.gx + Z / 2, z.gy + Z / 2); z.cx = c.x; z.cy = c.y; });
    let svg = '';
    const g0 = iso(-1, -1), g1 = iso(gxMax, -1), g2 = iso(gxMax, gyMax), g3 = iso(-1, gyMax);
    svg += poly([g0, g1, g2, g3], 'rgba(30,50,100,.25)', 'rgba(120,170,255,.25)');
    // 指挥链：老板 → 智脑 → 质检 → 知识库（顶排），智脑 → 各部门
    const zb = (id) => zones.find((z) => z.id === id);
    [['boss', 'brain'], ['brain', 'qa'], ['qa', 'kb']].forEach(([a, b]) => { const A = zb(a), B = zb(b); svg += `<path d="M${A.cx} ${A.cy} L${B.cx} ${B.cy}" stroke="#d97706" stroke-opacity=".55" stroke-width="2.5" fill="none" class="flow"/>`; });
    const brain = zb('brain');
    zones.filter((z) => !z.special).forEach((z) => { svg += `<path d="M${brain.cx} ${brain.cy} Q${(brain.cx + z.cx) / 2} ${Math.min(brain.cy, z.cy) - 60} ${z.cx} ${z.cy}" stroke="${z.color}" stroke-opacity=".25" stroke-width="1.3" fill="none" id="lk-${z.id}"/>`; });
    zones.forEach((z) => {
      const A = iso(z.gx, z.gy), B = iso(z.gx + Z, z.gy), C = iso(z.gx + Z, z.gy + Z), D = iso(z.gx, z.gy + Z);
      const up = (p) => ({ x: p.x, y: p.y - WALL });
      svg += poly([A, B, C, D], z.color + '22', z.color, `class="zone-poly" data-z="${z.id}" stroke-width="1.5"`);
      svg += poly([D, A, up(A), up(D)], z.color + '18', z.color + '66');
      svg += poly([A, B, up(B), up(A)], z.color + '10', z.color + '66');
      if (z.id === 'boss') svg += box(z.gx + 1.5, z.gy + 1.2, 2.2, 1, 14, '#6d4c41', '#4e342e', '#3e2723') + box(z.gx + 0.3, z.gy + 0.3, .6, .6, 22, '#2e7d32', '#1b5e20', '#1b5e20');
      else if (z.id === 'brain') svg += box(z.gx + 1.6, z.gy + 1.6, 1.8, 1.8, 10, '#1b2c5e', '#0e1838', '#0a1430');
      else if (z.id === 'qa') svg += box(z.gx + .8, z.gy + 1.4, 3.4, .8, 12, '#5d4a2a', '#3e3220', '#2e2618') + box(z.gx + .8, z.gy + 3, 3.4, .8, 12, '#5d4a2a', '#3e3220', '#2e2618');
      else if (z.id === 'kb') [0, 1, 2].forEach((i) => { svg += box(z.gx + .6 + i * 1.4, z.gy + .4, 1, .5, 30, '#4a3a80', '#302460', '#241a4a'); });
      else deskSpots().forEach((p) => { svg += box(z.gx + p[0], z.gy + p[1], 1.4, .6, 11, '#3a4f86', '#24335e', '#1c2850'); const mm = iso(z.gx + p[0] + .7, z.gy + p[1] + .1); svg += `<rect x="${mm.x - 6}" y="${mm.y - 24}" width="12" height="9" rx="1" fill="${z.color}" opacity=".85"/>`; });
    });
    main.innerHTML = `<div class="iso-wrap" id="iso-wrap"><div class="iso-world" id="iso-world" style="width:${W}px;height:${H}px"><svg width="${W}" height="${H}">${svg}</svg></div>
      <div class="iso-hud"><button class="btn btn-ghost btn-sm glass" id="fit"><i class="fas fa-expand"></i>全景</button><button class="btn btn-ghost btn-sm glass" id="zin"><i class="fas fa-plus"></i></button><button class="btn btn-ghost btn-sm glass" id="zout"><i class="fas fa-minus"></i></button></div>
      <div class="iso-lane glass" id="iso-lane"></div>
      <div class="boss-brief glass" id="brief"></div>
      <div class="iso-legend glass"><span><i class="fas fa-crown" style="color:#d97706"></i>老板</span><span><span class="st-dot" style="background:#ff7043"></span>员工</span><span><i class="fas fa-robot" style="color:var(--c1)"></i>Agent（亮起=处理中）</span><span><span class="st-dot" style="background:#d97706"></span>指挥链</span><span><i class="fas fa-image" style="color:#ea580c"></i>部门上方 = 本指令成果卡（点击查看汇报）</span><span class="dim">只有收到指令的部门才会运转</span></div></div>`;
    const world = $('#iso-world');
    zones.forEach((z) => { const top = iso(z.gx, z.gy); const el = document.createElement('div'); el.className = 'zone-label'; el.style.left = top.x + 'px'; el.style.top = (top.y - WALL - 6) + 'px'; el.style.setProperty('--zc', z.color); el.id = 'zl-' + z.id; world.appendChild(el); });
    // 每个部门上方悬浮「本指令成果卡」：执行步骤 → 验收分 → 幻灯片封面
    zones.filter((z) => !z.special).forEach((z) => { const p = iso(z.gx + Z, z.gy + Z / 2); const el = document.createElement('div'); el.className = 'zone-card'; el.id = 'zc-' + z.id; el.style.left = (p.x + 6) + 'px'; el.style.top = (p.y - 70) + 'px'; el.style.setProperty('--zc', z.color); el.onclick = (e) => { e.stopPropagation(); const t = el.dataset.t && Flow.task(el.dataset.t); if (t?.pack) openReport(t.id, 'ppt'); else if (t) openTaskModal(t.id); }; world.appendChild(el); });
    const add = (id, cls, html, gx, gy, title) => { const p = iso(gx, gy); const el = document.createElement('div'); el.className = 'actor ' + cls; el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.style.zIndex = Math.round(p.y); el.innerHTML = `<div class="body">${html}</div>`; el.title = title || ''; world.appendChild(el); isoCtx.actors[id] = { el, gx, gy, home: [gx, gy] }; return el; };
    const bz = zb('boss'), qz = zb('qa'), kz = zb('kb');
    add('boss', 'boss', `<i class="fas fa-crown crown"></i><div class="hd"><i class="fas fa-user-tie"></i></div><div class="tor"></div><div class="sh"></div>`, bz.gx + 2.6, bz.gy + 2.7, '老板');
    const orb = iso(brain.gx + 2.5, brain.gy + 2.5);
    const o = document.createElement('div'); o.className = 'brain-orb'; o.style.left = orb.x + 'px'; o.style.top = (orb.y - 40) + 'px'; o.innerHTML = '<i class="fas fa-brain"></i>'; world.appendChild(o);
    add('qa-bot', 'bot', `<div class="hd"><i class="fas fa-clipboard-check"></i></div><div class="sh"></div>`, qz.gx + 2.5, qz.gy + 2.6, 'AI 质检官');
    add('kb-bot', 'bot', `<div class="hd"><i class="fas fa-book"></i></div><div class="sh"></div>`, kz.gx + 2.5, kz.gy + 3, '知识管理官');
    zones.filter((z) => !z.special).forEach((z) => {
      const staff = S.staff.filter((s) => s.deptId === z.id).slice(0, 6);
      deskSpots().slice(0, staff.length).forEach((p, i) => { const s = staff[i]; add(s.id, 'staff', `<div class="hd" style="background:${avColor(s.name)}">${esc(s.name[0])}</div><div class="tor" style="background:${z.color}"></div><div class="sh"></div>`, z.gx + p[0] + .7, z.gy + p[1] + 1.05, `${s.name} · ${s.pos}`); });
      S.agents.filter((a) => a.deptId === z.id && !a.sub).slice(0, 4).forEach((a, i) => add(a.id, 'bot idle', `<div class="hd"><i class="fas fa-robot"></i></div><div class="sh"></div>`, z.gx + .7 + i * 1.1, z.gy + 4.5, a.name));
    });
    $$('.zone-poly', world).forEach((p) => p.onclick = () => { if (isoCtx.moved) return; zoneClick(p.dataset.z); });
    $$('.actor', world).forEach((a) => a.onclick = (e) => { e.stopPropagation(); const id = Object.keys(isoCtx.actors).find((k) => isoCtx.actors[k].el === a); actorClick(id); });
    setupPanZoom(); fit();
    $('#fit').onclick = fit; $('#zin').onclick = () => zoom(1.2); $('#zout').onclick = () => zoom(1 / 1.2);
    isoUpdate();
  }
  function deskSpots() { return [[.5, .5], [2.9, .5], [.5, 2.1], [2.9, 2.1], [.5, 3.6], [2.9, 3.6]]; }
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
  function isoUpdate() {
    if (!isoCtx) return;
    const T = S.sim.tasks;
    isoCtx.zones.forEach((z) => {
      const el = $('#zl-' + z.id); if (!el) return;
      if (z.special) {
        const sub = { boss: `待审批 ${S.sim.approvals.filter((a) => a.status === 'pending').length} · 进行中指令 ${Flow.active().length}`, brain: `研究规划中 ${S.sim.commands.filter((c) => ['plan', 'research', 'strategy', 'feasibility'].includes(c.stage)).length} · 验收中 ${S.sim.commands.filter((c) => c.stage === 'accept').length}`, qa: `校验中 ${T.filter((t) => t.status === 'verify').length} · 今日 ${S.sim.today.verify} 次`, kb: `经验 ${S.sim.knowledge.length} 条` }[z.id];
        el.innerHTML = `<div class="zl"><i class="fas ${z.icon}" style="color:${z.color}"></i>${z.name}</div><div class="zs">${sub}</div>`; return;
      }
      const open = T.filter((t) => t.deptId === z.id && !['done', 'rejected'].includes(t.status));
      const mine = T.filter((t) => t.deptId === z.id && t.status !== 'rejected' && Flow.cmd(t.cmdId) && !['done', 'cancelled'].includes(Flow.cmd(t.cmdId).stage));
      const done = mine.filter((t) => t.status === 'done').length;
      const warn = open.some((t) => t.esc >= 2 || t.paused);
      const cols = [...new Set(open.map((t) => Flow.cmd(t.cmdId)?.no).filter(Boolean))];
      const MP = window.Masters?.get(z.id);
      el.innerHTML = `<div class="zl ${open.length ? '' : 'idle'}">${warn ? '<i class="fas fa-triangle-exclamation" style="color:var(--warn)"></i>' : `<i class="fas ${z.icon}" style="color:${z.color}"></i>`}${esc(z.name)}</div><div class="zs">${MP ? `<i class="fas fa-user-tie"></i> ${esc(MP.title)} · ` : ''}${open.length ? `在办 ${open.length} · 指令 ${cols.map((n) => '#' + n).join(' ')}` : '待命'}</div>${mine.length ? `<div class="zp"><i style="width:${done / mine.length * 100}%"></i></div>` : ''}`;
      const lk = $('#lk-' + z.id); if (lk) { lk.setAttribute('stroke-opacity', open.length ? '.7' : '.12'); lk.classList.toggle('flow', !!open.length); }
    });
    S.agents.forEach((a) => {
      const act = isoCtx.actors[a.id]; if (!act) return;
      const working = a.status === 'busy' || a.status === 'verify';
      act.el.classList.toggle('busy', working); act.el.classList.toggle('idle', !working);
      if (working && Math.random() < .08) { const z = isoCtx.zones.find((x) => x.id === a.deptId); moveActor(a.id, z.gx + .6 + Math.random() * 3.8, z.gy + .6 + Math.random() * 3.8); }
      else if (!working && (act.gx !== act.home[0] || act.gy !== act.home[1])) moveActor(a.id, act.home[0], act.home[1]);
    });
    const qa = isoCtx.actors['qa-bot']; if (qa) qa.el.classList.toggle('busy', T.some((t) => t.status === 'verify'));
    const c = Flow.cmd(Flow.focus) || Flow.active()[0] || S.sim.commands[0];
    // 部门成果卡
    const STEPN = { plan: '规划', tool: '调用工具', write: '撰写', accept: '验收', package: '编排汇报' };
    isoCtx.zones.filter((z) => !z.special).forEach((z) => {
      const el = $('#zc-' + z.id); if (!el) return;
      const t = c ? c.taskIds.map(Flow.task).filter((x) => x && x.deptId === z.id && x.status !== 'rejected').slice(-1)[0] : null;
      if (!t) { el.classList.remove('on'); el.dataset.t = ''; el.innerHTML = ''; return; }
      const sc = t.accept?.total ?? t.evals?.total, sl = (t.pack?.slides || []).find((x) => x.url);
      const sig = [t.id, t.status, t.step, sc, sl?.url, t.progress].join('|'); if (el.dataset.sig === sig) return; el.dataset.sig = sig; el.dataset.t = t.id;
      el.className = `zone-card on st-${t.status}`;
      el.innerHTML = sl ? `<img src="${esc(sl.url)}" alt=""><div class="zc-ft"><b>${sc ?? ''}</b><span>${esc((t.pack?.doc?.title || t.title).slice(0, 12))}</span></div>`
        : `<div class="zc-st">${t.status === 'done' || t.status === 'approval' ? `<i class="fas fa-circle-check" style="color:var(--ok)"></i>` : t.status === 'pack' ? '<i class="fas fa-file-powerpoint fa-beat" style="color:#ea580c"></i>' : ['exec', 'rework', 'verify'].includes(t.status) ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-hourglass-half"></i>'}<b>${esc(t.status === 'pack' ? '出汇报材料' : t.status === 'verify' ? '独立验收' : STEPN[t.step] || TASK_ST[t.status]?.[0] || '')}</b>${sc != null ? `<em>${sc}</em>` : ''}</div><div class="zc-t">${esc(t.title.slice(0, 14))}</div>${['exec', 'rework'].includes(t.status) ? `<i class="zc-pg"><em style="width:${t.progress}%"></em></i>` : ''}`;
    });
    // 流程带：当前指令在 9 段流程中的位置
    const lane = $('#iso-lane');
    if (lane) {
      if (!c) lane.innerHTML = '<span class="dim">下达指令后，这里显示：深度研究 → 发展规划 → 可行性校验 → 老板决策 → 部门执行 → 验收 → 审批 → 交付汇报 → 复盘归档</span>';
      else { const st = Flow.cmdSteps(c); lane.innerHTML = `<b style="color:${c.color}">#${c.no}</b>` + FLOW_STAGES.map((s2, i) => `<span class="ln ${st[i]} ${s2.gate ? 'gate' : ''}"><i class="fas ${s2.i}"></i>${s2.n}</span>`).join('<i class="fas fa-chevron-right ln-ar"></i>'); }
    }
    const brief = $('#brief'); if (!brief) return;
    const pend = S.sim.approvals.filter((x) => x.status === 'pending');
    brief.innerHTML = `<div class="flex between"><span class="h3"><i class="fas fa-crown" style="color:#d97706"></i> 老板视角</span><span class="dim" style="font-size:11px">D${S.sim.day} ${simTime()}</span></div>
      ${c ? `<div class="mt" style="font-size:12px"><b style="color:${c.color}">#${c.no}</b> ${esc(c.text)}</div>${stepDots(c, true)}<div class="hint">${cmdStageLabel(c)}</div>
        ${c.strategy ? `<div class="bb-dec"><span>方案</span><b>${c.decision ? `${c.decision.key}「${esc(c.decision.name)}」` : `待决策 · 推荐 ${c.strategy.recommend}`}</b>${c.feas ? `<em>可行性 ${c.feas.total}</em>` : ''}</div>` : ''}
        ${c.stage === 'confirm' && c.strategy ? `<button class="btn btn-pri btn-sm mt" style="width:100%;justify-content:center" onclick="gotoView('flow')"><i class="fas fa-crown"></i>去决策室选定方案</button>` : ''}
        ${c.taskIds.length ? `<div class="bb-res">${c.taskIds.map(Flow.task).filter(Boolean).map((t) => { const d = deptOf(t.deptId), sc = t.accept?.total ?? t.evals?.total; return `<div onclick="${t.pack ? `openReport('${t.id}','ppt')` : `openTaskModal('${t.id}')`}"><i class="fas ${d?.icon}" style="color:${d?.color}"></i><span>${esc(d?.name || '')}</span><small>${TASK_ST[t.status]?.[0] || ''}</small><b class="${sc >= (t.accept?.threshold || 80) ? 'ok' : ''}">${sc ?? '—'}</b>${t.pack ? '<i class="fas fa-file-powerpoint" style="color:#ea580c"></i>' : ''}</div>`; }).join('')}</div>` : ''}
        ${c.acceptance ? `<div class="bb-acc">指令验收 <b>${c.acceptance.score}</b>${c.decisionEval ? ` · 决策见效 <b>${c.decisionEval.score}</b>` : ''}</div>` : ''}` : '<div class="hint mt">暂无指令，全体待命。在右侧下达指令后，可在这里看到它沿指挥链流转。</div>'}
      ${pend.length ? `<button class="btn btn-sm mt" style="width:100%;justify-content:center;background:rgba(255,181,71,.15);border:1px solid var(--warn);color:var(--warn)" onclick="gotoView('approve')"><i class="fas fa-shield-halved"></i>${pend.length} 项待您审批</button>` : ''}`;
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
    el.innerHTML = `<span>${esc(label)}</span>`; el.style.transition = 'left 1.4s cubic-bezier(.5,0,.5,1), top 1.4s cubic-bezier(.5,0,.5,1)';
    $('#iso-world').appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.left = b.x + 'px'; el.style.top = b.y + 'px'; }));
    setTimeout(() => el.remove(), 1600);
  }
  window.packet = packet;
  function zoneClick(id) {
    if (id === 'boss') return gotoView('approve');
    if (id === 'brain') return gotoView('flow');
    if (id === 'qa' || id === 'kb') return gotoView('mech');
    window.openDeptDrawer(id);
  }
  function actorClick(id) {
    if (id === 'boss') return gotoView('approve');
    if (id === 'qa-bot' || id === 'kb-bot') return gotoView('mech');
    const s = S.staff.find((x) => x.id === id); if (s) return window.openStaffModal(s.id);
    const a = agentOf(id); if (a) return window.openAgentModal(a.id);
  }
})();
