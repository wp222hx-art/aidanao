// 企业智脑 · 指挥中心：调度中枢（结构化流程图）+ 数字孪生（等距视图）+ 指令队列
(function () {
  const TW = 64, TH = 32, Z = 5, STRIDE = 7, COLS = 4, WALL = 30;
  let timer = null, view = 'flow', isoCtx = null, logScope = 'focus', boardSig = '', sideSig = '';
  const deptOf = (id) => S.depts.find((d) => d.id === id);
  const short = (s, n = 16) => esc(String(s || '').slice(0, n)) + (String(s || '').length > n ? '…' : '');
  const ST = { queued: ['待执行', 'p'], exec: ['执行中', ''], rework: ['返工中', 'warn'], verify: ['校验中', 'warn'], approval: ['待审批', 'warn'], review: ['人工复核', 'bad'], done: ['已交付', 'ok'], rejected: ['已取消', 'bad'] };
  window.TASK_ST = ST;
  const CMD_ST = { plan: '拆解中', confirm: '待老板确认方案', accept: '指令验收中', improve: '复盘提升中', done: '已完成', cancelled: '已取消' };

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
    { k: 'org', i: 'fa-sitemap', n: '组织人才' }
  ];
  const QUICK = ['本月全网找一批新订单', '降低主要原料采购成本', '做一波品牌宣传', '催收逾期应收账款', '招聘两名销售骨干'];
  window.renderHQ = function () {
    Flow.init();
    if (!NAV.some((n) => n.k === view)) view = 'flow';
    $('#app').innerHTML = `
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
        <div class="side-sec cmd-box">
          <div class="flex between"><span class="h3"><i class="fas fa-crown" style="color:#ffd54f"></i> 老板指令</span><span class="tag p">一切工作从这里开始</span></div>
          <textarea id="cmd" rows="2" placeholder="例：本月把华东地区的订单做上去"></textarea>
          <div class="flex between"><label class="chk"><input type="checkbox" id="cmd-routine"> 设为每日例行（09:00 自动下发）</label><button class="btn btn-pri btn-sm" id="cmd-go"><i class="fas fa-paper-plane"></i>下达</button></div>
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
    $('#nav-reset').onclick = () => { if (confirm('确定重新创建企业？当前企业数据将清空。')) { stopSim(); resetState(); renderApp(); } };
    const go = () => { const v = $('#cmd').value.trim(); if (!v) return toast('请输入指令'); const r = $('#cmd-routine').checked; $('#cmd').value = ''; $('#cmd-routine').checked = false; window.bossCommand(v, { routine: r }); };
    $('#cmd-go').onclick = go;
    $('#cmd').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } };
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
  window.onFlowChange = () => { if (!$('#hq-main')) return; renderSide(); if (view === 'flow') updateBoard(); updateBadges(); };
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
    if (!list.length) { box.innerHTML = `<div class="cmdq-empty"><i class="fas fa-mug-hot"></i><div>暂无指令，全体 Agent 待命</div><div class="dim">下达指令后：拆解 → 方案确认 → 分发 → 执行 → 校验 → 审批 → 交付 → 复盘提升</div></div>`; return; }
    box.innerHTML = list.map((c) => {
      const ts = c.taskIds.map(Flow.task).filter(Boolean);
      const done = ts.filter((t) => t.status === 'done').length, rw = ts.filter((t) => t.status === 'rework').length, ap = S.sim.approvals.filter((a) => a.cmdId === c.id && a.status === 'pending').length;
      const [sl, sc] = FLOW_SRC[c.source] || FLOW_SRC.boss;
      const routine = S.sim.routines.some((r) => r.text === Flow.baseText(c.text));
      return `<div class="cmd-card ${Flow.focus === c.id ? 'on' : ''} ${['done', 'cancelled'].includes(c.stage) ? 'fin' : ''}" data-c="${c.id}" style="--cc:${c.color}">
        <div class="flex between"><span><b class="no">#${c.no}</b> <span class="src" style="color:${sc};border-color:${sc}55">${sl}${c.iteration > 1 ? ' R' + c.iteration : ''}</span>${routine ? ' <i class="fas fa-rotate dim" title="每日例行"></i>' : ''}</span><span class="stg ${c.stage}">${cmdStageLabel(c)}</span></div>
        <div class="txt">${esc(c.text)}</div>
        ${stepDots(c)}
        <div class="meta"><span>任务 ${done}/${ts.length || c.plan.length || '-'}</span>${rw ? `<span style="color:var(--warn)">返工 ${rw}</span>` : ''}${ap ? `<span style="color:var(--warn)">待批 ${ap}</span>` : ''}${c.real ? '<span style="color:var(--ok)">Genspark</span>' : '<span>仿真</span>'}<button class="info" data-info="${c.id}" title="指令详情"><i class="fas fa-up-right-from-square"></i></button></div>
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

  // ====================== 调度中枢（结构化流程图） ======================
  function renderBoard(main) {
    main.innerHTML = `<section class="flow-board"><div class="fb-scroll" id="fb-scroll"><div class="fb-grid" id="fb-grid"></div><svg class="fb-loops" id="fb-loops"></svg><div class="fb-fx" id="fb-fx"></div></div></section>`;
    const grid = $('#fb-grid');
    grid.onclick = (e) => {
      const chip = e.target.closest('[data-t]'); if (chip) return openTaskModal(chip.dataset.t);
      const tr = e.target.closest('[data-track]'); if (tr) { Flow.focus = Flow.focus === tr.dataset.track ? null : tr.dataset.track; logScope = 'focus'; boardSig = ''; sideSig = ''; updateBoard(); renderSide(); renderFeed(); return; }
      const ln = e.target.closest('[data-lane]'); if (ln) return openDeptDrawer(ln.dataset.lane);
      const nd = e.target.closest('[data-node]'); if (nd) { const k = nd.dataset.node; if (k === 'boss' || k === 'confirm' || k === 'approve') gotoView('approve'); else if (k === 'improve') gotoView('mech'); }
    };
    $('#fb-scroll').onscroll = () => { };
    updateBoard(true);
    window.onresize = () => { if (view === 'flow') drawLoops(); };
  }
  function boardSignature() {
    return [S.sim.commands.map((c) => c.id + c.stage + c.taskIds.length).join(), S.sim.tasks.map((t) => t.id + t.status + t.esc + (t.paused ? 'p' : '') + t.rework).join(), S.sim.approvals.filter((a) => a.status === 'pending').length, Flow.focus, S.sim.knowledge.length, S.agents.map((a) => a.status[0] + a.level).join('')].join('|');
  }
  function stageCount(k) {
    const T = S.sim.tasks, C = S.sim.commands;
    return {
      plan: C.filter((c) => c.stage === 'plan').length,
      confirm: S.sim.approvals.filter((a) => a.kind === 'plan' && a.status === 'pending').length,
      dispatch: T.filter((t) => t.status === 'queued').length,
      exec: T.filter((t) => t.status === 'exec' || t.status === 'rework').length,
      verify: T.filter((t) => t.status === 'verify').length,
      approve: T.filter((t) => t.status === 'approval' || t.status === 'review').length,
      deliver: T.filter((t) => t.status === 'done' && t.day === S.sim.day).length,
      improve: C.filter((c) => c.stage === 'accept' || c.stage === 'improve').length
    }[k];
  }
  function updateBoard(force) {
    const grid = $('#fb-grid'); if (!grid) return;
    const sig = boardSignature();
    if (!force && sig === boardSig) { // 只更新进度条
      $$('[data-t]', grid).forEach((el) => { const t = Flow.task(el.dataset.t); const b = el.querySelector('.cp-bar i'); if (t && b) b.style.width = t.progress + '%'; });
      return;
    }
    boardSig = sig;
    const F = Flow.focus, T = S.sim.tasks;
    const extra = { rework: T.filter((t) => t.status === 'rework').length, review: T.filter((t) => t.status === 'review').length };
    let h = '';
    // 行1：阶段节点
    h += `<div class="fb-node boss" data-node="boss"><i class="fas fa-crown"></i><b>老板</b><small>下达指令 · 两道闸门</small></div>`;
    FLOW_STAGES.forEach((s) => {
      const n = stageCount(s.k);
      const sub = s.k === 'exec' && extra.rework ? `<em class="warn">返工 ${extra.rework}</em>` : s.k === 'approve' && extra.review ? `<em class="bad">复核 ${extra.review}</em>` : s.k === 'improve' ? `<em>经验 ${S.sim.knowledge.length}</em>` : '';
      h += `<div class="fb-node ${s.gate ? 'gate' : ''} ${n ? 'hot' : ''}" data-node="${s.k}"><i class="fas ${s.i}"></i><b>${s.n}</b><small>${s.who}</small>${n ? `<span class="cnt">${n}</span>` : ''}${sub}</div>`;
    });
    h += `<div class="fb-gap"></div>`;
    // 指令轨道
    const cmds = [...Flow.active(), ...S.sim.commands.filter((c) => c.stage === 'done' && c.day === S.sim.day)].slice(0, 6);
    h += `<div class="fb-sec"><i class="fas fa-route"></i> 指令轨道 <span class="dim">每条指令按阶段推进，点击聚焦</span></div>`;
    if (!cmds.length) h += `<div class="fb-empty"><i class="fas fa-crown" style="color:#ffd54f"></i> 暂无指令 —— 在右侧下达第一条指令，智脑将拆解并沿流程向下分发；没有指令时所有 Agent 保持待命。</div>`;
    cmds.forEach((c) => {
      const st = Flow.cmdSteps(c), ts = c.taskIds.map(Flow.task).filter(Boolean);
      const cntAt = (k) => ts.filter((t) => Flow.col(t) === k).length;
      h += `<div class="fb-track-label ${F && F !== c.id ? 'dim2' : ''} ${F === c.id ? 'on' : ''}" data-track="${c.id}" style="--cc:${c.color}"><b>#${c.no}</b><span>${esc(c.text)}</span></div>`;
      FLOW_STAGES.forEach((s, i) => {
        const n = ['dispatch', 'exec', 'verify', 'approve', 'deliver'].includes(s.k) ? cntAt(s.k) : 0;
        const tip = s.k === 'plan' && c.goal ? c.goal : s.k === 'improve' && c.acceptance ? `验收 ${c.acceptance.score}分` : '';
        h += `<div class="fb-seg ${st[i]} ${F && F !== c.id ? 'dim2' : ''}" data-track="${c.id}" style="--cc:${c.color}" title="${esc(tip)}">${st[i] === 'active' && n ? n : st[i] === 'done' && s.k === 'improve' && c.acceptance ? c.acceptance.score : ''}</div>`;
      });
    });
    // 部门 Agent 集群泳道
    h += `<div class="fb-sec"><i class="fas fa-people-group"></i> 部门 Agent 集群 <span class="dim">任务按阶段落在各部门泳道；颜色 = 所属指令</span></div>`;
    const act = (d) => T.some((t) => t.deptId === d.id && !['done', 'rejected'].includes(t.status));
    S.depts.forEach((d) => {
      const tasks = T.filter((t) => t.deptId === d.id && t.status !== 'rejected' && (t.status !== 'done' || t.day === S.sim.day || Flow.cmd(t.cmdId)?.stage !== 'done'));
      const idle = !tasks.length;
      const ags = S.agents.filter((a) => a.deptId === d.id);
      const kn = S.sim.knowledge.filter((k) => k.deptId === d.id).length, l3 = ags.filter((a) => a.level === 'L3').length, l1 = ags.filter((a) => a.level === 'L1').length;
      h += `<div class="fb-lane-label ${idle ? 'idle' : ''} ${act(d) ? 'act' : ''}" data-lane="${d.id}" style="--dc:${d.color}"><i class="fas ${d.icon}"></i><span><b>${esc(d.name)}</b><small>${S.staff.filter((s) => s.deptId === d.id).length} 人 · ${ags.length} Agent</small></span></div>`;
      h += `<div class="fb-cluster ${idle ? 'idle' : ''}" title="Agent 集群：亮起 = 正在处理">${ags.slice(0, 18).map((a) => `<i class="ag ${a.sub ? 'sub' : ''} ${a.status}" title="${esc(a.name)} · ${a.level}"></i>`).join('')}${ags.length > 18 ? `<small>+${ags.length - 18}</small>` : ''}</div>`;
      ['dispatch', 'exec', 'verify', 'approve', 'deliver'].forEach((k) => {
        const list = tasks.filter((t) => Flow.col(t) === k);
        h += `<div class="fb-cell ${idle ? 'idle' : ''}">${list.slice(0, 3).map(chip).join('')}${list.length > 3 ? `<span class="more">+${list.length - 3}</span>` : ''}</div>`;
      });
      h += `<div class="fb-cell imp ${idle ? 'idle' : ''}">${kn ? `<span class="kb-b" title="该部门经验条数"><i class="fas fa-book"></i>${kn}</span>` : ''}${l3 ? `<span class="lv3" title="自主级 Agent">L3×${l3}</span>` : ''}${l1 ? `<span class="lv1" title="建议级 Agent（成果需老板确认）">L1×${l1}</span>` : ''}</div>`;
    });
    grid.innerHTML = h;
    requestAnimationFrame(drawLoops);
  }
  function chip(t) {
    const c = Flow.cmd(t.cmdId), F = Flow.focus;
    const icon = t.status === 'rework' ? '<i class="fas fa-rotate-left" title="返工"></i>' : t.status === 'review' ? '<i class="fas fa-user-check" title="人工复核"></i>' : t.status === 'approval' ? '<i class="fas fa-stamp" title="待审批"></i>' : t.status === 'done' ? '<i class="fas fa-check"></i>' : '';
    return `<div class="chip ${t.status} ${F && F !== t.cmdId ? 'dim2' : ''} ${t.paused ? 'paused' : ''}" data-t="${t.id}" style="--cc:${c?.color || '#8fa3c8'}" title="${esc(t.title)}">
      <span class="cn">#${c?.no || ''}</span>${icon}<span class="tt">${esc(t.title)}</span>${t.esc ? `<span class="esc">⏰${t.esc}</span>` : ''}${t.evals && ['approval', 'review', 'done'].includes(t.status) ? `<span class="sc">${t.evals.total}</span>` : ''}
      ${['exec', 'rework'].includes(t.status) ? `<span class="cp-bar"><i style="width:${t.progress}%"></i></span>` : ''}</div>`;
  }
  // 循环箭头（返工 / 驳回 / 重新拆解 / 迭代 / 知识注入）
  const LOOPS = [
    { k: 'iterate', from: 'improve', to: 'plan', up: true, h: 44, label: '迭代循环 · 下一轮', color: '#b69bff' },
    { k: 'kb', from: 'improve', to: 'exec', up: true, h: 22, label: '经验注入', color: '#8b5cff' },
    { k: 'replan', from: 'confirm', to: 'plan', up: false, h: 20, label: '驳回重拆', color: '#ff5d6c' },
    { k: 'rework', from: 'verify', to: 'exec', up: false, h: 20, label: '返工循环', color: '#ff8a65' },
    { k: 'reject', from: 'approve', to: 'exec', up: false, h: 36, label: '驳回返工', color: '#ff5d6c' }
  ];
  function nodePos(k) {
    const sc = $('#fb-scroll'), el = $(`#fb-grid [data-node="${k}"]`); if (!sc || !el) return null;
    const r = el.getBoundingClientRect(), s = sc.getBoundingClientRect();
    return { x: r.left - s.left + sc.scrollLeft + r.width / 2, top: r.top - s.top + sc.scrollTop, bottom: r.bottom - s.top + sc.scrollTop, w: r.width };
  }
  function drawLoops() {
    const svg = $('#fb-loops'), sc = $('#fb-scroll'); if (!svg || !sc) return;
    const W = sc.scrollWidth, H = sc.scrollHeight;
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    let s = `<defs>${LOOPS.map((l) => `<marker id="ar-${l.k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${l.color}"/></marker>`).join('')}</defs>`;
    // 主流向箭头
    const ks = ['boss', ...FLOW_STAGES.map((x) => x.k)];
    for (let i = 0; i < ks.length - 1; i++) { const a = nodePos(ks[i]), b = nodePos(ks[i + 1]); if (!a || !b) continue; const y = (a.top + a.bottom) / 2; s += `<line x1="${a.x + a.w / 2 - 2}" y1="${y}" x2="${b.x - b.w / 2 + 2}" y2="${y}" stroke="#3ee0ff" stroke-width="2" stroke-opacity=".7" class="flow"/>`; }
    LOOPS.forEach((l) => {
      const a = nodePos(l.from), b = nodePos(l.to); if (!a || !b) return;
      const ax = a.x + (l.up ? -6 : -10), bx = b.x + (l.k === 'kb' ? 10 : 6);
      const y0 = l.up ? a.top : a.bottom, y1 = l.up ? b.top : b.bottom, yy = l.up ? Math.min(y0, y1) - l.h : Math.max(y0, y1) + l.h;
      const d = `M${ax} ${y0} C ${ax} ${yy}, ${bx} ${yy}, ${bx} ${y1}`;
      s += `<path id="loop-${l.k}" class="loop" d="${d}" stroke="${l.color}" fill="none" stroke-width="1.6" stroke-dasharray="5 4" marker-end="url(#ar-${l.k})"/>`;
      s += `<text x="${(ax + bx) / 2}" y="${yy + (l.up ? -4 : 12)}" fill="${l.color}" font-size="11" text-anchor="middle" class="loop-t" id="loopt-${l.k}">${l.label}</text>`;
    });
    svg.innerHTML = s;
  }
  function pulseLoop(k) { [$('#loop-' + k), $('#loopt-' + k)].forEach((el) => { if (!el) return; el.classList.remove('pulse'); void el.getBBox?.(); el.classList.add('pulse'); setTimeout(() => el.classList.remove('pulse'), 2400); }); }
  function boardAnchor(id) {
    const map = { boss: '[data-node="boss"]', brain: '[data-node="plan"]', qa: '[data-node="verify"]', kb: '[data-node="improve"]' };
    const sel = map[id] || `[data-lane="${id}"]`;
    const sc = $('#fb-scroll'), el = $('#fb-grid ' + sel); if (!sc || !el) return null;
    const r = el.getBoundingClientRect(), s = sc.getBoundingClientRect();
    return { x: r.left - s.left + sc.scrollLeft + r.width / 2, y: r.top - s.top + sc.scrollTop + r.height / 2 };
  }
  // 统一动效入口：调度中枢 = 火花 + 循环脉冲；数字孪生 = 数据包
  window.flowFx = function (a, b, label, color) {
    if (/返工/.test(label)) pulseLoop(/驳回|打回/.test(label) ? 'reject' : 'rework');
    if (/驳回|打回/.test(label)) pulseLoop('reject');
    if (/重新拆解/.test(label)) pulseLoop('replan');
    if (/经验|知识/.test(label)) pulseLoop('kb');
    if (view === 'flow') {
      const p = boardAnchor(a), q = boardAnchor(b), fx = $('#fb-fx'); if (!p || !q || !fx) return;
      const el = document.createElement('div'); el.className = 'spark'; el.style.color = color; el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.innerHTML = `<span>${esc(label)}</span>`;
      fx.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => { el.style.left = q.x + 'px'; el.style.top = q.y + 'px'; }));
      setTimeout(() => el.remove(), 1500);
    } else if (isoCtx) packet(a, b, label, color);
  };

  // ====================== 指令详情 ======================
  window.openCmdModal = function (id) {
    const c = Flow.cmd(id); if (!c) return toast('指令已归档');
    const st = Flow.cmdSteps(c), ts = c.taskIds.map(Flow.task).filter(Boolean);
    const [sl, sc] = FLOW_SRC[c.source] || FLOW_SRC.boss;
    const pendPlan = S.sim.approvals.find((a) => a.cmdId === c.id && a.kind === 'plan' && a.status === 'pending');
    const routine = S.sim.routines.some((r) => r.text === Flow.baseText(c.text));
    const parent = c.parentId ? Flow.cmd(c.parentId) : null;
    const m = openModal(`<div class="flex"><div class="cmd-no" style="--cc:${c.color}">#${c.no}</div><div style="min-width:0;flex:1"><div class="h2" style="font-size:17px">${esc(c.text)}</div><div class="hint"><span style="color:${sc}">${sl}指令</span> · 第 ${c.iteration} 轮 · D${c.day} ${c.t} 下达 · ${c.real ? '<span style="color:var(--ok)">Genspark 真实执行</span>' : '仿真执行'}${parent ? ` · 上一轮 <a class="lnk" onclick="openCmdModal('${parent.id}')">#${parent.no}</a>` : ''}</div></div><button class="close-x" data-close><i class="fas fa-xmark"></i></button></div>
      <div class="cmd-steps mt">${FLOW_STAGES.map((s, i) => `<div class="cs ${st[i]} ${s.gate ? 'gate' : ''}" style="--cc:${c.color}"><i class="fas ${s.i}"></i><b>${s.n}</b><small>${s.who}</small></div>`).join('')}</div>
      ${c.goal ? `<div class="card mt" style="padding:12px"><b>目标：</b>${esc(c.goal)}${c.feedback ? `<div class="hint mt" style="white-space:pre-line">${esc(c.feedback)}</div>` : ''}</div>` : ''}
      ${pendPlan ? `<div class="card mt" style="border-color:var(--warn)"><div class="h3" style="color:var(--warn)"><i class="fas fa-stamp"></i> 闸门① 方案确认</div><div class="hint mt">确认后才会分发到部门；驳回会带着你的意见重新拆解。</div><div class="flex mt"><input id="cm-fb" placeholder="驳回意见（可选）" style="flex:1"><button class="btn btn-danger btn-sm" id="cm-rej">驳回重拆</button><button class="btn btn-pri btn-sm" id="cm-ok"><i class="fas fa-check"></i>确认分发</button></div></div>` : ''}
      <div class="card mt"><div class="ct"><span class="h3">拆解方案与执行（${c.plan.length} 项）</span><span class="dim" style="font-size:11px">点击任务查看成果</span></div>
        <table class="table"><tr><th>部门</th><th>任务</th><th>交付物</th><th>状态</th><th>校验</th><th>返工</th></tr>
        ${(ts.length ? ts : c.plan).map((x) => { const t = ts.length ? x : null; const d = deptOf(x.deptId); return `<tr ${t ? `style="cursor:pointer" onclick="openTaskModal('${t.id}')"` : ''}><td><i class="fas ${d?.icon}" style="color:${d?.color}"></i> ${esc(d?.name || '')}</td><td>${esc(x.title)}${x.needApproval ? ' <span class="tag warn" style="font-size:10px">高风险</span>' : ''}</td><td class="dim">${esc((x.deliverable || '').slice(0, 26))}</td><td>${t ? `<span class="tag ${ST[t.status][1]}">${ST[t.status][0]}</span>` : '<span class="tag p">待分发</span>'}</td><td>${t?.evals ? `<b style="color:${t.evals.total >= 80 ? 'var(--ok)' : 'var(--warn)'}">${t.evals.total}</b>` : '-'}</td><td>${t?.rework || 0}</td></tr>`; }).join('')}</table></div>
      ${c.acceptance ? `<div class="grid2 mt"><div class="card"><div class="ct"><span class="h3"><i class="fas fa-clipboard-check" style="color:var(--c1)"></i> 指令验收</span><b class="grad-txt" style="font-size:24px">${c.acceptance.score}</b></div><span class="tag ${c.acceptance.verdict === 'achieved' ? 'ok' : c.acceptance.verdict === 'partial' ? 'warn' : 'bad'}">${{ achieved: '目标达成', partial: '部分达成', failed: '未达成' }[c.acceptance.verdict]}</span><p class="muted mt" style="font-size:13px;line-height:1.7">${esc(c.acceptance.summary)}</p></div>
        <div class="card"><div class="h3"><i class="fas fa-arrow-trend-up" style="color:#b69bff"></i> 复盘提升</div>
          ${(c.review?.lessons || []).map((l) => `<div style="font-size:12px;margin-top:6px"><i class="fas fa-book" style="color:var(--c2)"></i> ${esc(l)}</div>`).join('') || '<div class="hint mt">无</div>'}
          ${c.review?.promos?.length ? `<div style="font-size:12px;margin-top:8px"><i class="fas fa-ranking-star" style="color:var(--ok)"></i> ${esc(c.review.promos.join('、'))}</div>` : ''}
          ${(c.review?.next || []).length ? `<div class="hint mt">下一轮方向：${esc(c.review.next.join('；'))}</div>` : ''}</div></div>` : ''}
      <div class="card mt"><div class="h3">指令操作</div><div class="flex wrap mt">
        ${['done'].includes(c.stage) ? `<input id="cm-iter" placeholder="补充要求（可选），带着复盘结论进入下一轮" style="flex:1;min-width:220px"><button class="btn btn-pri btn-sm" id="cm-next"><i class="fas fa-rotate"></i>迭代下一轮</button>` : ''}
        <button class="btn btn-ghost btn-sm" id="cm-routine"><i class="fas fa-calendar-check"></i>${routine ? '取消每日例行' : '设为每日例行'}</button>
        ${!['done', 'cancelled'].includes(c.stage) ? '<button class="btn btn-danger btn-sm" id="cm-cancel"><i class="fas fa-stop"></i>取消指令</button>' : ''}
      </div></div>
      <div class="card mt"><div class="h3">流转记录</div><div class="cmd-log">${[...c.log].reverse().map((l) => `<div><span class="t">${l.t}</span> ${l.html}</div>`).join('')}</div></div>`);
    m.dataset.cmd = id;
    const on = (sel, fn) => { const el = $(sel, m); if (el) el.onclick = fn; };
    on('#cm-ok', () => { decideApproval(pendPlan.id, true); openCmdModal(id); });
    on('#cm-rej', () => { decideApproval(pendPlan.id, false, $('#cm-fb', m).value.trim() || '方案不满意，请重新拆解'); openCmdModal(id); });
    on('#cm-next', () => { const n = Flow.iterate(id, $('#cm-iter', m).value.trim()); if (n) { toast(`已进入第 ${n.iteration} 轮：#${n.no}`, 'fa-rotate'); openCmdModal(n.id); } });
    on('#cm-routine', () => { Flow.toggleRoutine(Flow.baseText(c.text), !routine); toast(routine ? '已取消每日例行' : '已设为每日例行：每天 09:00 自动迭代下发', 'fa-calendar-check'); openCmdModal(id); });
    on('#cm-cancel', () => { if (confirm(`确定取消 #${c.no}？未完成任务将停止。`)) { Flow.cancel(id); openCmdModal(id); } });
  };

  // ====================== 任务详情 ======================
  window.openTaskModal = function (id) {
    const t = Flow.task(id); if (!t) return toast('任务已归档');
    const d = deptOf(t.deptId), a = agentOf(t.agentId), c = Flow.cmd(t.cmdId), ev = t.evals?.ev;
    const ai = window.AI && AI.on;
    const m = openModal(`<div class="flex"><div class="bot-ic"><i class="fas fa-robot"></i></div><div style="min-width:0;flex:1"><div class="h2" style="font-size:17px">${esc(t.title)}</div><div class="hint">${esc(d?.name || '')} · ${esc(a?.name || '')}（${a?.level || ''}） · <span class="tag ${ST[t.status][1]}" style="font-size:10px">${ST[t.status][0]}</span> ${t.real ? '<span style="color:var(--ok)">Genspark 真实执行</span>' : '仿真任务'}${c ? ` · 所属指令 <a class="lnk" onclick="openCmdModal('${c.id}')">#${c.no}</a>` : ''}</div></div><button class="close-x" data-close><i class="fas fa-xmark"></i></button></div>
      ${t.deliverable ? `<div class="hint mt"><b>交付物要求：</b>${esc(t.deliverable)}</div>` : ''}
      ${!t.output ? `<div class="card mt"><div class="flex">${['exec', 'rework'].includes(t.status) ? '<i class="fas fa-spinner fa-spin" style="color:var(--c1)"></i>' : '<i class="fas fa-hourglass-half dim"></i>'}<span>${t.error ? `执行失败：${esc(t.error)}` : t.status === 'queued' ? '已分发，等待 Agent 接单' : 'Agent 正在执行…'}</span><div class="bar" style="flex:1"><i style="width:${t.progress}%"></i></div></div>${t.paused ? '<button class="btn btn-ghost btn-sm mt" id="tm-retry"><i class="fas fa-rotate"></i>重试</button>' : ''}${!t.real && ai && !['done', 'rejected'].includes(t.status) ? '<button class="btn btn-pri btn-sm mt" id="tm-real"><i class="fas fa-bolt"></i>改为 Genspark 真实执行</button>' : ''}</div>` : ''}
      ${ev ? `<div class="grid2 mt" style="grid-template-columns:1.6fr 1fr">
        <div class="card"><div class="ct"><span class="h3">成果 ${t.history.length > 1 ? `<span class="tag p">第 ${t.history.length} 版</span>` : ''}</span><button class="btn btn-ghost btn-sm" id="tm-copy"><i class="fas fa-copy"></i>复制</button></div><div class="md" style="max-height:44vh;overflow:auto">${mdRender(t.output)}</div></div>
        <div class="col"><div class="card"><div class="ct"><span class="h3">校验 · 五维评测</span><b class="grad-txt" style="font-size:24px">${t.evals.total}</b></div>${EVAL_DIMS.map((dm) => `<div class="flex" style="margin:6px 0"><span style="width:60px;font-size:12px">${dm.name}</span><div class="bar" style="flex:1"><i style="width:${ev[dm.k]}%;${ev[dm.k] < 70 ? 'background:linear-gradient(90deg,#ff5d6c,#ffb547)' : ''}"></i></div><b style="width:26px;text-align:right;font-size:12px">${ev[dm.k]}</b></div>`).join('')}
          <div class="hint mt" style="line-height:1.6"><b>${t.evals.total >= 80 ? '亮点' : '评审意见'}：</b>${esc(t.feedback || '—')}</div></div>
          <div class="card"><div class="h3">循环记录</div>${t.history.map((h) => `<div class="flex between" style="font-size:12px;margin-top:6px"><span>v${h.v} · ${h.at}${h.researched ? ' · 含检索' : ''}</span><b style="color:${h.total >= 80 ? 'var(--ok)' : 'var(--warn)'}">${h.total}分</b></div>`).join('')}${t.humanPassed ? '<div class="hint mt">👤 老板人工通过</div>' : ''}</div>
        </div></div>` : ''}
      ${t.deep ? `<div class="card mt"><div class="ct"><span class="h3"><i class="fas fa-brain" style="color:var(--c2)"></i> Genspark 超级智能体</span><span class="tag ${t.deep.state === 'succeeded' ? 'ok' : 'p'}">${esc(t.deep.state)}</span></div>${t.deep.result ? `<div class="md" style="max-height:40vh;overflow:auto">${mdRender(t.deep.result.text || '（无文本成果）')}</div>` : '<div class="hint"><i class="fas fa-spinner fa-spin"></i> 深度执行中，每 15 秒自动刷新…</div>'}${t.deep.taskUrl ? `<a class="btn btn-ghost btn-sm mt" href="${esc(t.deep.taskUrl)}" target="_blank"><i class="fas fa-up-right-from-square"></i>在 Genspark 中查看完整过程</a>` : ''}</div>` : ''}
      ${t.output && t.status !== 'rejected' ? `<div class="card mt"><div class="h3">老板操作</div><div class="flex mt wrap">
        ${t.status !== 'done' ? `<button class="btn btn-pri btn-sm" id="tm-pass"><i class="fas fa-check"></i>${t.status === 'approval' ? '批准执行' : '人工通过'}</button>` : ''}
        <input id="tm-fb" placeholder="写下修改意见，打回进入返工循环" style="flex:1;min-width:200px;font-size:13px"><button class="btn btn-ghost btn-sm" id="tm-redo"><i class="fas fa-rotate-left"></i>打回返工</button>
        ${ai && !t.deep ? '<button class="btn btn-ghost btn-sm" id="tm-deep" style="border-color:var(--c2);color:#b69bff"><i class="fas fa-brain"></i>超级智能体深度执行</button>' : ''}
      </div></div>` : ''}`);
    m.dataset.task = id;
    const on = (sel, fn) => { const el = $(sel, m); if (el) el.onclick = fn; };
    on('#tm-real', () => { t.real = true; t.status = 'queued'; t.progress = 0; t.age = 0; saveState(); Flow.refresh(); toast('已交给 Genspark 真实执行'); openTaskModal(id); });
    on('#tm-retry', () => { Flow.retryTask(t); toast('已重新排队'); closeOverlay(); });
    on('#tm-copy', () => { navigator.clipboard?.writeText(t.output || ''); toast('已复制成果'); });
    on('#tm-pass', () => { Flow.passTask(t); openTaskModal(id); });
    on('#tm-redo', () => { const fb = $('#tm-fb', m).value.trim(); if (!fb) return toast('请写下修改意见'); if (Flow.reworkTask(t, fb)) { toast('已打回，Agent 将按意见返工'); closeOverlay(); } });
    on('#tm-deep', () => window.AI && AI.deepAgent(t));
  };

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
      { id: 'boss', name: '① 老板办公室', icon: 'fa-crown', color: '#ffd54f', special: true },
      { id: 'brain', name: '② 智脑中枢', icon: 'fa-brain', color: '#3ee0ff', special: true },
      { id: 'qa', name: '③ 质检中心', icon: 'fa-clipboard-check', color: '#ffb547', special: true },
      { id: 'kb', name: '④ 知识库', icon: 'fa-book', color: '#b69bff', special: true }
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
    [['boss', 'brain'], ['brain', 'qa'], ['qa', 'kb']].forEach(([a, b]) => { const A = zb(a), B = zb(b); svg += `<path d="M${A.cx} ${A.cy} L${B.cx} ${B.cy}" stroke="#ffd54f" stroke-opacity=".55" stroke-width="2.5" fill="none" class="flow"/>`; });
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
      <div class="boss-brief glass" id="brief"></div>
      <div class="iso-legend glass"><span><i class="fas fa-crown" style="color:#ffd54f"></i>老板</span><span><span class="st-dot" style="background:#ff7043"></span>员工</span><span><i class="fas fa-robot" style="color:var(--c1)"></i>Agent（亮起=处理中）</span><span><span class="st-dot" style="background:#ffd54f"></span>指挥链</span><span class="dim">顶排按流程：老板 → 智脑 → 质检 → 知识库；只有收到指令的部门才会运转</span></div></div>`;
    const world = $('#iso-world');
    zones.forEach((z) => { const top = iso(z.gx, z.gy); const el = document.createElement('div'); el.className = 'zone-label'; el.style.left = top.x + 'px'; el.style.top = (top.y - WALL - 6) + 'px'; el.style.setProperty('--zc', z.color); el.id = 'zl-' + z.id; world.appendChild(el); });
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
        const sub = { boss: `待审批 ${S.sim.approvals.filter((a) => a.status === 'pending').length} · 进行中指令 ${Flow.active().length}`, brain: `拆解中 ${S.sim.commands.filter((c) => c.stage === 'plan').length} · 验收中 ${S.sim.commands.filter((c) => c.stage === 'accept').length}`, qa: `校验中 ${T.filter((t) => t.status === 'verify').length} · 今日 ${S.sim.today.verify} 次`, kb: `经验 ${S.sim.knowledge.length} 条` }[z.id];
        el.innerHTML = `<div class="zl"><i class="fas ${z.icon}" style="color:${z.color}"></i>${z.name}</div><div class="zs">${sub}</div>`; return;
      }
      const open = T.filter((t) => t.deptId === z.id && !['done', 'rejected'].includes(t.status));
      const mine = T.filter((t) => t.deptId === z.id && t.status !== 'rejected' && Flow.cmd(t.cmdId) && !['done', 'cancelled'].includes(Flow.cmd(t.cmdId).stage));
      const done = mine.filter((t) => t.status === 'done').length;
      const warn = open.some((t) => t.esc >= 2 || t.paused);
      const cols = [...new Set(open.map((t) => Flow.cmd(t.cmdId)?.no).filter(Boolean))];
      el.innerHTML = `<div class="zl ${open.length ? '' : 'idle'}">${warn ? '<i class="fas fa-triangle-exclamation" style="color:var(--warn)"></i>' : `<i class="fas ${z.icon}" style="color:${z.color}"></i>`}${esc(z.name)}</div><div class="zs">${open.length ? `在办 ${open.length} · 指令 ${cols.map((n) => '#' + n).join(' ')}` : '待命'}</div>${mine.length ? `<div class="zp"><i style="width:${done / mine.length * 100}%"></i></div>` : ''}`;
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
    const brief = $('#brief'); if (!brief) return;
    const c = Flow.cmd(Flow.focus) || Flow.active()[0];
    const pend = S.sim.approvals.filter((x) => x.status === 'pending');
    brief.innerHTML = `<div class="flex between"><span class="h3"><i class="fas fa-crown" style="color:#ffd54f"></i> 老板视角</span><span class="dim" style="font-size:11px">D${S.sim.day} ${simTime()}</span></div>
      ${c ? `<div class="mt" style="font-size:12px"><b style="color:${c.color}">#${c.no}</b> ${esc(c.text)}</div>${stepDots(c, true)}<div class="hint">${cmdStageLabel(c)}</div>` : '<div class="hint mt">暂无指令，全体待命。在右侧下达指令后，可在这里看到它沿指挥链流转。</div>'}
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
