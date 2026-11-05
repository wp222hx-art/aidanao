// 企业智脑 · 业务模块页面
(function () {
  let tickN = 0;
  const hd = (icon, title, sub, right = '') => `<div class="page-hd"><div class="ic"><i class="fas ${icon}"></i></div><div><div class="h2">${title}</div><div class="hint">${sub}</div></div><div style="margin-left:auto" class="flex">${right}</div></div>`;
  const deptName = (id) => (S.depts.find((d) => d.id === id) || {}).name || '—';
  const deptColor = (id) => (S.depts.find((d) => d.id === id) || {}).color || '#888';
  const lvColor = (lv) => (AUTONOMY.find((a) => a.lv === lv) || {}).color;
  const stMap = new Proxy({}, { get: (_, k) => (window.TASK_ST || {})[k] || ['—', 'p'] });

  window.renderModule = function (k, main) {
    const fn = { cockpit, leads, agents, mech, studio, approve, ledger, org }[k] || cockpit;
    main.innerHTML = `<section class="page" id="page"></section>`;
    fn($('#page'), true);
  };
  window.moduleTick = function (k) {
    tickN++;
    const page = $('#page'); if (!page) return;
    const live = { cockpit: 4, mech: 3, ledger: 4, approve: 3, agents: 4 };
    if (live[k] && tickN % live[k] === 0) { if (document.activeElement?.closest?.('#page') && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return; const st = page.scrollTop; ({ cockpit, mech, ledger, approve, agents })[k](page); page.scrollTop = st; }
    if (k === 'leads' && tickN % 2 === 0) renderLeadList();
  };

  // ---------------- 经营驾驶舱 ----------------
  function cockpit(p) {
    const P = S.company.profile, M = S.sim.metrics, H = S.sim.history;
    const activeEng = Math.floor(Date.now() / 1500) % 6;
    p.innerHTML = hd('fa-gauge-high', '经营驾驶舱', '一脑 · 双域 · 六引擎：诊断 → 情报对标 → 策略 → 行动 → 实验验证 → 知识沉淀')
      + `<div class="card"><div class="engine-flow">${ENGINES.map((e, i) => `<div class="eng ${i === activeEng ? 'active' : ''}"><i class="fas ${e.icon} m"></i><b style="font-size:13px">${e.name}</b><div class="dim" style="font-size:11px;margin-top:4px;line-height:1.5">${e.desc}</div></div>`).join('')}</div></div>
      <div class="grid4 mt">
        ${[['累计完成任务', M.done, 'fa-check-double', 'var(--ok)'], ['商机线索', M.leads, 'fa-crosshairs', 'var(--c1)'], ['管道金额', '¥' + fmtMoney(M.pipeline), 'fa-filter-circle-dollar', 'var(--c2)'], ['已成交', '¥' + fmtMoney(M.revenue), 'fa-trophy', '#ffca28']].map(([l, v, i, c]) => `<div class="stat"><div class="l"><i class="fas ${i}" style="color:${c}"></i> ${l}</div><div class="v">${v}</div></div>`).join('')}
      </div>
      <div class="grid2 mt">
        <div class="card"><div class="ct"><span class="h3">七域经营健康度</span><span class="tag">雷达</span></div>${radarSvg(P.domains)}</div>
        <div class="card"><div class="ct"><span class="h3">每日产出趋势</span><span class="dim" style="font-size:11px">完成任务 / 新增商机</span></div>${trendSvg(H)}
          <div class="mt hint">AI 经营建议：</div>
          ${P.opportunities.slice(0, 3).map((o) => `<div style="font-size:12px;margin-top:6px"><i class="fas fa-lightbulb" style="color:var(--warn)"></i> ${esc(o)}</div>`).join('')}
        </div>
      </div>
      <div class="card mt" id="brief-card"><div class="ct"><span class="h3"><i class="fas fa-file-lines" style="color:var(--c1)"></i> AI 经营日报</span><button class="btn btn-ghost btn-sm" onclick="AI.brief()" ${window.AI && AI.on ? '' : 'disabled title="需连接 Genspark"'}><i class="fas fa-wand-magic-sparkles"></i>${AI && AI.briefing ? '生成中…' : '生成今日日报'}</button></div>
        ${S.sim.brief ? `<div class="md">${mdRender(S.sim.brief.text)}</div><div class="hint mt">第 ${S.sim.brief.day} 天 ${S.sim.brief.t} 生成 · Genspark AI · 基于平台运行数据</div>` : '<div class="hint">点击生成：AI 汇总今日任务、商机、评测、督办与审批数据，写成老板简报。</div>'}</div>
      <div class="card mt"><div class="ct"><span class="h3">部门运转矩阵</span><span class="dim" style="font-size:11px">点击部门查看详情</span></div>
        <div class="grid4">${S.depts.map((d) => { const open = S.sim.tasks.filter((t) => t.deptId === d.id && !['done', 'rejected'].includes(t.status)); const done = S.sim.tasks.filter((t) => t.deptId === d.id && t.status === 'done').length; const warn = open.filter((t) => t.esc > 0).length; return `<div class="stat" style="cursor:pointer;border-left:3px solid ${d.color}" onclick="openDeptDrawer('${d.id}')"><div class="flex between"><b style="font-size:13px"><i class="fas ${d.icon}" style="color:${d.color}"></i> ${esc(d.name)}</b>${warn ? `<span class="tag warn">督办${warn}</span>` : open.length ? '<span class="tag">运转中</span>' : '<span class="tag p">待命</span>'}</div><div class="flex between mt" style="font-size:12px"><span class="muted">在办 ${open.length}</span><span class="muted">完成 ${done}</span><span class="muted">${S.agents.filter((a) => a.deptId === d.id).length} AI</span></div></div>`; }).join('')}</div></div>`;
  }
  function radarSvg(domains) {
    const n = domains.length, R = 110, cx = 150, cy = 135;
    const pt = (i, r) => [cx + Math.cos(i / n * Math.PI * 2 - Math.PI / 2) * r, cy + Math.sin(i / n * Math.PI * 2 - Math.PI / 2) * r];
    let s = '';
    [.25, .5, .75, 1].forEach((k) => s += `<polygon points="${domains.map((_, i) => pt(i, R * k).join(',')).join(' ')}" fill="none" stroke="rgba(120,170,255,.15)"/>`);
    domains.forEach((d, i) => { const [x, y] = pt(i, R + 18); s += `<line x1="${cx}" y1="${cy}" x2="${pt(i, R)[0]}" y2="${pt(i, R)[1]}" stroke="rgba(120,170,255,.12)"/><text x="${x}" y="${y}" fill="#8fa3c8" font-size="11" text-anchor="middle" dominant-baseline="middle">${d.name} ${d.score}</text>`; });
    s += `<polygon points="${domains.map((d, i) => pt(i, R * d.score / 100).join(',')).join(' ')}" fill="rgba(62,224,255,.22)" stroke="#3ee0ff" stroke-width="2"/>`;
    return `<svg viewBox="0 0 300 270" style="width:100%;max-height:280px">${s}</svg>`;
  }
  function trendSvg(H) {
    const data = [...H.slice(-9), { day: S.sim.day, ...S.sim.today }];
    const W = 420, Hh = 150, max = Math.max(5, ...data.map((d) => Math.max(d.done, d.leads)));
    const x = (i) => 20 + i * (W - 40) / Math.max(1, data.length - 1), y = (v) => Hh - 20 - v / max * (Hh - 40);
    const line = (k, c) => `<polyline points="${data.map((d, i) => x(i) + ',' + y(d[k])).join(' ')}" fill="none" stroke="${c}" stroke-width="2.5"/>` + data.map((d, i) => `<circle cx="${x(i)}" cy="${y(d[k])}" r="3" fill="${c}"/>`).join('');
    return `<svg viewBox="0 0 ${W} ${Hh}" style="width:100%">${data.map((d, i) => `<text x="${x(i)}" y="${Hh - 4}" fill="#5b6d93" font-size="10" text-anchor="middle">D${d.day}</text>`).join('')}${line('done', '#3ddc97')}${line('leads', '#3ee0ff')}</svg>`;
  }

  // ---------------- 商机雷达 ----------------
  function leads(p) {
    const kw = (S.industry?.div?.kw || '').split(' ').filter(Boolean);
    p.innerHTML = hd('fa-crosshairs', '商机雷达', '商机检索也是一条指令：下达后由销售 Agent 全网检索并分级；A 级商机在该指令内追加跟进任务，报价走审批闸门', `<button class="btn btn-pri btn-sm" id="scan-now"><i class="fas fa-paper-plane"></i>下达找订单指令</button>`)
      + `<div class="grid2" style="grid-template-columns:420px 1fr">
        <div class="col">
          <div class="card"><div class="radar-big" id="lead-radar"><div class="sweep"></div>${[25, 50, 75].map((r) => `<div style="position:absolute;left:50%;top:50%;width:${r}%;height:${r}%;transform:translate(-50%,-50%);border:1px dashed rgba(62,224,255,.2);border-radius:50%"></div>`).join('')}<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:11px;text-align:center" class="muted"><i class="fas fa-building" style="color:var(--c1);font-size:18px"></i><br>${esc(S.company.name.slice(0, 8))}</div></div>
          <div class="flex between mt" style="font-size:12px"><span><span class="st-dot" style="background:var(--ok)"></span> A级 高匹配</span><span><span class="st-dot" style="background:var(--c1)"></span> B级</span><span><span class="st-dot" style="background:var(--sub)"></span> C级</span></div></div>
          <div class="card"><div class="h3">监测关键词</div><div class="flex wrap mt" style="gap:6px">${kw.map((k) => `<button class="tag" data-kw="${esc(k)}" style="cursor:pointer">${esc(k)}</button>`).join('')}</div>
            <div class="flex mt"><input id="kw-in" placeholder="自定义关键词" style="flex:1;min-width:0"><button class="btn btn-ghost btn-sm" id="kw-go">检索</button></div>
            <p class="hint mt">点击关键词 = 下达一条「检索该关键词商机」的指令。${window.AI && AI.on ? '已连接 Genspark：全网检索 + AI 分级。' : '仿真模式：线索为模拟数据。'}分级规则：行业匹配度 × 金额 × 时效 × 可触达性。</p></div>
        </div>
        <div class="col" id="lead-list"></div>
      </div>`;
    $('#scan-now').onclick = () => { window.bossCommand('全网检索一批与主营匹配的采购/招标商机'); gotoView('flow'); };
    $$('[data-kw]').forEach((b) => b.onclick = () => searchKw(b.dataset.kw));
    $('#kw-go').onclick = () => searchKw($('#kw-in').value.trim());
    renderLeadList();
  }
  function searchKw(q) {
    if (!q) return;
    const sales = deptByLib('sales'); if (!sales) return toast('请先在组织中添加销售部');
    Flow.issue(`检索「${q}」相关采购/招标商机`, { plan: [{ deptId: sales.id, title: `全网检索「${q}」采购需求线索`, deliverable: '分级商机清单与跟进建议', sla: 180, needApproval: false, kind: 'leads', kws: [q] }] });
    toast(`已下达指令：检索「${q}」商机`, 'fa-paper-plane'); gotoView('flow');
  }
  function renderLeadList() {
    const box = $('#lead-list'); if (!box) return;
    const L = S.sim.leads;
    const radar = $('#lead-radar');
    if (radar) { $$('.blip', radar).forEach((b) => b.remove()); L.slice(0, 18).forEach((l) => { const r = seeded(l.id); const ang = r() * Math.PI * 2, dist = l.grade === 'A' ? 15 + r() * 12 : l.grade === 'B' ? 25 + r() * 12 : 35 + r() * 10; const b = document.createElement('div'); b.className = 'blip'; const c = l.grade === 'A' ? '#3ddc97' : l.grade === 'B' ? '#3ee0ff' : '#8fa3c8'; b.style.cssText = `left:${50 + Math.cos(ang) * dist}%;top:${50 + Math.sin(ang) * dist}%;background:${c};color:${c}`; b.title = l.title; radar.appendChild(b); }); }
    const stl = { new: ['待跟进', 'p'], synced: ['跟进中', ''], quoted: ['已报价', 'warn'], won: ['已成交', 'ok'] };
    box.innerHTML = `<div class="flex between"><span class="h3">线索池（${L.length}）</span><span class="dim" style="font-size:12px">A 级在来源指令内自动跟进 · 其余可「下达跟进」</span></div>` + (L.length ? L.slice(0, 30).map((l) => `<div class="lead"><div class="grade g-${l.grade}">${l.grade}</div><div style="flex:1;min-width:0">
      <div style="font-weight:600;font-size:13px">${l.link ? `<a href="${esc(l.link)}" target="_blank" style="color:inherit;text-decoration:none">${esc(l.title)} <i class="fas fa-up-right-from-square" style="font-size:10px;color:var(--c1)"></i></a>` : esc(l.title)}</div>
      ${l.desc ? `<div class="dim" style="font-size:11px;margin-top:3px;line-height:1.5">${esc(l.desc.slice(0, 110))}</div>` : ''}
      ${l.reason ? `<div style="font-size:12px;margin-top:5px;color:var(--c1)"><i class="fas fa-brain"></i> ${esc(l.reason)}${l.next ? ` <span class="muted">→ 下一步：${esc(l.next)}</span>` : ''}${l.buyer && l.buyer !== '未知' ? ` <span class="tag p">采购方：${esc(l.buyer)}</span>` : ''}</div>` : ''}
      <div class="flex wrap" style="gap:6px;margin-top:6px"><span class="tag ${stl[l.status][1]}">${stl[l.status][0]}</span><span class="tag p">匹配 ${l.match}%</span>${l.value ? `<span class="tag">预估 ¥${fmtMoney(l.value)}</span>` : '<span class="tag">金额待确认</span>'}<span class="dim" style="font-size:11px">${esc(l.source)} · D${l.day}</span>${l.cmdId && Flow.cmd(l.cmdId) ? `<a class="lnk" style="font-size:11px" onclick="openCmdModal('${l.cmdId}')">#${Flow.cmd(l.cmdId).no}</a>` : ''}${l.ai ? '<span class="tag ok">Genspark全网·AI分级</span>' : l.real ? '<span class="tag ok">公开网页</span>' : '<span class="tag warn">仿真线索</span>'}</div></div>
      ${l.status === 'new' ? `<button class="btn btn-ghost btn-sm" onclick="syncLeadUI('${l.id}')"><i class="fas fa-paper-plane"></i>下达跟进</button>` : ''}</div>`).join('') : '<div class="empty-state" style="height:200px">暂无商机 —— 下达「找订单」指令后，销售 Agent 才会开始检索</div>');
  }
  window.syncLeadUI = (id) => { const l = S.sim.leads.find((x) => x.id === id); if (!l) return; const c = Flow.followLead(l); if (c) { toast(`已下达跟进指令 #${c.no}`, 'fa-paper-plane'); renderLeadList(); } };

  // ---------------- Agent 军团 ----------------
  function agents(p) {
    const A = S.agents;
    const by = {}; A.forEach((a) => (by[a.deptId] = by[a.deptId] || []).push(a));
    p.innerHTML = hd('fa-robot', `Agent 集群 · ${A.length} 个智能体`, '只接收指令分发的任务；等级随校验成绩自动升降：连续高分 ↑ 晋升自主，返工 / 人工复核 ↓ 降为建议', `<button class="btn btn-ghost btn-sm" id="hire"><i class="fas fa-plus"></i>扩编执行体</button>`)
      + `<div class="grid4">${AUTONOMY.map((a) => `<div class="stat" style="border-top:3px solid ${a.color}"><div class="flex between"><span class="lvl" style="background:${a.color}33;color:${a.color}">${a.lv}</span><b>${A.filter((x) => x.level === a.lv).length}</b></div><div style="font-size:13px;font-weight:700;margin-top:6px">${a.name}</div><div class="dim" style="font-size:11px;margin-top:3px;line-height:1.5">${a.desc}</div></div>`).join('')}</div>`
      + S.depts.map((d) => `<div class="card mt"><div class="ct"><span class="h3"><i class="fas ${d.icon}" style="color:${d.color}"></i> ${esc(d.name)} <span class="dim" style="font-size:12px;font-weight:400">· ${(by[d.id] || []).length} 个</span></span></div>
        <div class="grid4">${(by[d.id] || []).filter((a) => !a.sub).map(agentCard).join('')}</div>
        <div class="flex wrap mt" style="gap:6px">${(by[d.id] || []).filter((a) => a.sub).map((a) => `<span class="tag ${a.status === 'busy' ? '' : 'p'}" style="cursor:pointer" onclick="openAgentModal('${a.id}')"><span class="st-dot" style="background:${a.status === 'busy' ? 'var(--ok)' : a.status === 'verify' ? 'var(--warn)' : 'var(--dim)'}"></span>${esc(a.name.split('-')[1] || a.name)} · ${agentTotal(a)}</span>`).join('')}</div></div>`).join('');
    $('#hire').onclick = () => { S.depts.forEach((d) => { for (let k = 0; k < 3; k++) S.agents.push({ id: uid('ag'), deptId: d.id, name: `${d.name.replace(/部$/, '')}执行体-${String(S.agents.filter((a) => a.deptId === d.id).length + 1).padStart(2, '0')}`, level: 'L3', score: rand(75, 92), done: 0, fail: 0, status: 'idle', sub: true, evals: { acc: rand(78, 95), evi: rand(70, 92), time: rand(75, 99), comp: rand(85, 99), val: rand(60, 88) } }); }); saveState(); agents(p); toast(`已扩编 ${S.depts.length * 3} 个执行体，当前共 ${S.agents.length} 个 Agent`, 'fa-robot'); };
  }
  function agentCard(a) {
    const t = S.sim.tasks.find((x) => x.agentId === a.id && !['done', 'rejected'].includes(x.status));
    return `<div class="agent-card" onclick="openAgentModal('${a.id}')" style="cursor:pointer"><div class="ah"><div class="bot-ic"><i class="fas fa-robot"></i></div><div style="min-width:0"><b style="font-size:13px">${esc(a.name)}</b><div style="font-size:11px" class="dim"><span class="st-dot" style="background:${a.status === 'busy' ? 'var(--ok)' : a.status === 'verify' ? 'var(--warn)' : 'var(--dim)'}"></span> ${a.status === 'busy' ? '执行中' : a.status === 'verify' ? '待校验' : '待命'}</div></div><span class="lvl" style="margin-left:auto;background:${lvColor(a.level)}33;color:${lvColor(a.level)}">${a.level}</span></div>
      <div class="dim" style="font-size:11px;min-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t ? `▸ #${Flow.cmd(t.cmdId)?.no || ''} ${esc(t.title)}` : '待命，等待指令分发'}</div>
      <div class="flex between" style="font-size:11px"><span>评测 <b style="color:var(--c1)">${agentTotal(a)}</b></span><span class="muted">完成 ${a.done}</span><span class="muted">返工 ${a.fail}</span></div></div>`;
  }

  // ---------------- 工作机制：循环 · 审批 · 校验 · 提升 ----------------
  function mech(p) {
    const st = Flow.stats(), M = S.sim.metrics, T = S.sim.tasks;
    const verified = T.filter((t) => t.evals).sort((x, y) => (y.vt || 0) - (x.vt || 0));
    const avg = verified.length ? Math.round(verified.reduce((s, t) => s + t.evals.total, 0) / verified.length) : 0;
    const open = T.filter((t) => ['queued', 'exec', 'rework'].includes(t.status));
    const escs = open.filter((t) => t.esc > 0 || t.stuck || t.paused).sort((x, y) => y.esc - x.esc);
    const reworks = T.filter((t) => t.status === 'rework' || (t.rework && t.status !== 'done'));
    const rank = S.agents.filter((x) => !x.sub).sort((x, y) => agentTotal(y) - agentTotal(x));
    const lvCount = ['L1', 'L2', 'L3'].map((lv) => [lv, S.agents.filter((x) => !x.sub && x.level === lv).length]);
    const cno = (id) => { const c = Flow.cmd(id); return c ? `<span class="cno" onclick="openCmdModal('${c.id}')">#${c.no}</span>` : ''; };
    p.innerHTML = hd('fa-gears', '工作机制', '指令驱动的闭环：每一项工作都从老板指令出发，经「循环 · 审批 · 校验 · 提升」四个机制收口')
      + `<div class="mech-flow">
        ${[['fa-crown', '老板指令', '#ffd54f'], ['fa-brain', '智脑拆解', '#3ee0ff'], ['fa-user-shield', '闸门①方案确认', '#ffb547'], ['fa-share-nodes', '分发到部门 Agent', '#8b5cff'], ['fa-gear', '执行', '#4fc3f7'], ['fa-clipboard-check', '五维校验', '#3ddc97'], ['fa-shield-halved', '闸门②成果审批', '#ffb547'], ['fa-box-open', '交付', '#3ddc97'], ['fa-seedling', '复盘提升', '#b69bff']].map(([i, n, c], k) => `${k ? '<i class="fas fa-chevron-right arr"></i>' : ''}<span class="mf" style="--c:${c}"><i class="fas ${i}"></i>${n}</span>`).join('')}
        <div class="mf-loops"><span><i class="fas fa-rotate-left" style="color:#ffb547"></i> 校验不过 → 返工</span><span><i class="fas fa-rotate-left" style="color:#ff5d6c"></i> 方案驳回 → 重拆</span><span><i class="fas fa-repeat" style="color:#3ddc97"></i> 例行/迭代 → 下一轮</span><span><i class="fas fa-book" style="color:#b69bff"></i> 经验 → 注入下次拆解与执行</span></div>
      </div>
      <div class="grid4 mt">
        <div class="mech-card" style="--c:#3ddc97"><div class="mc-hd"><i class="fas fa-repeat"></i><b>循环</b><span class="dim">让工作持续转起来</span></div>
          <div class="grid3"><div class="stat sm"><div class="l">返工中</div><div class="v">${st.rework}</div></div><div class="stat sm"><div class="l">迭代轮次</div><div class="v">${st.iterations}</div></div><div class="stat sm"><div class="l">例行指令</div><div class="v">${st.routines}</div></div></div>
          <ul class="mech-ul"><li>校验 &lt;80 分 → 带评语返工，最多 1 次</li><li>老板驳回方案 → 带意见重新拆解</li><li>指令验收“部分达成” → 一键下一轮迭代</li><li>例行指令每天 09:00 自动续跑</li></ul></div>
        <div class="mech-card" style="--c:#ffb547"><div class="mc-hd"><i class="fas fa-user-shield"></i><b>审批</b><span class="dim">两道闸门 · 老板拍板</span></div>
          <div class="grid3"><div class="stat sm"><div class="l">待确认方案</div><div class="v">${st.pendPlan}</div></div><div class="stat sm"><div class="l">待审成果</div><div class="v">${st.pendResult}</div></div><div class="stat sm"><div class="l">驳回率</div><div class="v">${M.approvals ? Math.round(M.rejects / M.approvals * 100) : 0}%</div></div></div>
          <ul class="mech-ul"><li><b>闸门①</b> 方案确认：拆解后先给老板过目</li><li><b>闸门②</b> 成果审批：高风险(${HIGH_RISK_ACTIONS.slice(0, 3).join('/')}…)与 L1 Agent 成果</li><li>人工复核：返工后仍不达标</li></ul>
          <label class="chk mt"><input type="checkbox" id="opt-plan" ${S.sim.settings.planConfirm ? 'checked' : ''}> 新指令拆解后需我确认（闸门①）</label></div>
        <div class="mech-card" style="--c:#3ee0ff"><div class="mc-hd"><i class="fas fa-clipboard-check"></i><b>校验</b><span class="dim">任务级 + 指令级</span></div>
          <div class="grid3"><div class="stat sm"><div class="l">今日校验</div><div class="v">${st.verifyToday}</div></div><div class="stat sm"><div class="l">一次通过率</div><div class="v">${st.passRate}%</div></div><div class="stat sm"><div class="l">平均分</div><div class="v">${avg}</div></div></div>
          <div class="dims">${EVAL_DIMS.map((d) => `<span>${d.name}<b>${d.w}</b></span>`).join('')}</div>
          <ul class="mech-ul"><li>每项成果由质检 Agent 五维打分，≥80 通过</li><li>全部任务交付后，对指令做整体验收：达成 / 部分 / 未达成</li><li>督办：逾期→L1 提醒 Agent→L2 负责人→L3 老板</li></ul></div>
        <div class="mech-card" style="--c:#b69bff"><div class="mc-hd"><i class="fas fa-seedling"></i><b>提升</b><span class="dim">越用越懂你的企业</span></div>
          <div class="grid3"><div class="stat sm"><div class="l">经验库</div><div class="v">${st.knowledge}</div></div><div class="stat sm"><div class="l">晋级</div><div class="v" style="color:var(--ok)">${st.promoted}</div></div><div class="stat sm"><div class="l">降级</div><div class="v" style="color:var(--bad)">${st.demoted}</div></div></div>
          <ul class="mech-ul"><li>每条指令验收后复盘，提炼经验写入企业经验库</li><li>经验自动注入同部门后续拆解与执行</li><li>连续 2 次 ≥88 分 → 晋级；返工/人工兜底 → 降级</li></ul>
          <div class="dims">${lvCount.map(([lv, n]) => `<span style="color:${lvColor(lv)}">${lv}<b>${n}</b></span>`).join('')}</div></div>
      </div>
      <div class="card mt"><div class="ct"><span class="h3"><i class="fas fa-clock" style="color:var(--c1)"></i> 每日机制节拍</span><span class="dim" style="font-size:11px">时钟只驱动检查，不凭空制造工作</span></div>
        <div class="cadence">${CHECKPOINTS.map((c) => `<span class="cp ${S.sim.cp[S.sim.day + c.k] ? 'on' : ''}"><b>${esc(c.name.split(" ")[0])}</b>${esc(c.name.split(" ")[1] || "")}</span>`).join('<i class="fas fa-chevron-right dim"></i>')}</div></div>
      <div class="grid2 mt">
        <div class="card"><div class="ct"><span class="h3"><i class="fas fa-repeat" style="color:#3ddc97"></i> 例行指令 / 返工循环</span></div>
          ${S.sim.routines.length ? S.sim.routines.map((r) => `<div class="rt"><i class="fas fa-repeat" style="color:#3ddc97"></i><span style="flex:1">${esc(r.text)}</span><span class="dim">自第${r.since}天</span><button class="btn btn-ghost btn-sm" data-unr="${esc(r.text)}">停止</button></div>`).join('') : '<div class="hint">暂无例行指令。下指令时勾选「每日例行」即可让 Agent 每天自动续跑。</div>'}
          <div class="h4 mt">返工中（${reworks.length}）</div>
          ${reworks.slice(0, 6).map((t) => `<div class="rt" style="cursor:pointer" onclick="openTaskModal('${t.id}')">${cno(t.cmdId)}<span style="flex:1">${esc(t.title.slice(0, 26))}</span><span class="dim" style="max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.feedback || '')}</span></div>`).join('') || '<div class="hint">✓ 当前没有返工任务</div>'}</div>
        <div class="card"><div class="ct"><span class="h3"><i class="fas fa-bell" style="color:var(--warn)"></i> 督办清单</span><span class="dim" style="font-size:11px">累计督办 ${M.esc}</span></div>
          ${escs.length ? `<table class="table"><tr><th>指令</th><th>任务</th><th>状态</th><th>级别</th><th></th></tr>${escs.slice(0, 10).map((t) => `<tr><td>${cno(t.cmdId)}</td><td>${esc(t.title.slice(0, 20))}</td><td>${t.stuck || t.paused ? '<span class="tag bad">卡点</span>' : '<span class="tag warn">逾期</span>'}</td><td>${t.esc ? `<span class="lvl" style="background:rgba(255,181,71,.2);color:var(--warn)">L${t.esc}</span>` : '-'}</td><td><button class="btn btn-ghost btn-sm" onclick="unblock('${t.id}')">协助解除</button></td></tr>`).join('')}</table>` : '<div class="hint">✓ 暂无逾期或卡点任务</div>'}</div>
      </div>
      <div class="grid2 mt">
        <div class="card"><div class="ct"><span class="h3"><i class="fas fa-clipboard-check" style="color:var(--c1)"></i> 最近校验记录</span></div>
          ${verified.length ? `<table class="table"><tr><th>指令</th><th>任务</th>${EVAL_DIMS.map((d) => `<th>${d.name.slice(0, 2)}</th>`).join('')}<th>总分</th><th>结论</th></tr>${verified.slice(0, 10).map((t) => `<tr style="cursor:pointer" onclick="openTaskModal('${t.id}')"><td>${cno(t.cmdId)}</td><td>${t.real ? '<span class="tag ok" style="font-size:10px;padding:0 4px">AI</span> ' : ''}${esc(t.title.slice(0, 16))}</td>${EVAL_DIMS.map((d) => `<td>${t.evals.ev[d.k]}</td>`).join('')}<td><b style="color:${t.evals.total >= 80 ? 'var(--ok)' : 'var(--warn)'}">${t.evals.total}</b></td><td><span class="tag ${stMap[t.status][1]}">${stMap[t.status][0]}</span></td></tr>`).join('')}</table>` : '<div class="hint">下达指令后，每项成果的五维校验结果会出现在这里</div>'}</div>
        <div class="card"><div class="ct"><span class="h3"><i class="fas fa-book" style="color:#b69bff"></i> 企业经验库</span><span class="dim" style="font-size:11px">自动注入后续指令</span></div>
          ${S.sim.knowledge.slice(0, 8).map((k) => `<div class="rt"><i class="fas fa-lightbulb" style="color:#b69bff"></i><span style="flex:1">${esc(k.title)}</span><span class="dim">${esc(k.dept)} · ${k.cmdNo ? '#' + k.cmdNo : ''} · 引用${k.used || 0}</span></div>`).join('') || '<div class="hint">指令验收复盘后，经验会沉淀到这里</div>'}
          <div class="h4 mt">Agent 评测排行（核心 Agent）</div>
          <table class="table"><tr><th>#</th><th>Agent</th><th>部门</th><th>等级</th><th>完成</th><th>返工</th><th>总分</th></tr>${rank.slice(0, 6).map((x, i) => `<tr style="cursor:pointer" onclick="openAgentModal('${x.id}')"><td>${i + 1}</td><td>${esc(x.name)}</td><td>${esc(deptName(x.deptId))}</td><td><span class="lvl" style="background:${lvColor(x.level)}33;color:${lvColor(x.level)}">${x.level}</span></td><td>${x.done}</td><td>${x.fail}</td><td><b>${agentTotal(x)}</b></td></tr>`).join('')}</table></div>
      </div>`;
    $('#opt-plan').onchange = (e) => { S.sim.settings.planConfirm = e.target.checked; saveState(); toast(e.target.checked ? '已开启：新指令需老板确认方案' : '已关闭：拆解后直接分发'); };
    $$('[data-unr]', p).forEach((b) => b.onclick = () => { Flow.toggleRoutine(b.dataset.unr, false); toast('已停止该例行指令'); mech(p); });
  }
  window.unblock = (id) => { const t = Flow.task(id); if (!t) return; t.stuck = false; t.paused = false; t.retries = 0; t.esc = 0; t.sla = t.age + 120; simLog('esc', `🤝 老板协助解除「${esc(t.title.slice(0, 18))}」卡点`, '#3ddc97', t.cmdId); toast('已解除卡点，任务恢复执行'); saveState(); Flow.refresh(); };

  // ---------------- 内容工厂 ----------------
  const THEMES = [['#0b1430', '#3ee0ff', '#8b5cff'], ['#1a0b20', '#ff4fa3', '#ffb547'], ['#06201a', '#3ddc97', '#3ee0ff'], ['#1f1406', '#ffd54f', '#ff7043']];
  let studioState = { type: 'poster', theme: 0, title: '', sub: '', cta: '立即咨询', channels: ['抖音', '视频号', '小红书', '公众号'] };
  function studio(p) {
    const short = S.company.name.replace(/(有限公司|股份有限公司|有限责任公司|集团)$/, '');
    if (!studioState.title) { studioState.title = `${short}`; studioState.sub = `${S.industry?.div?.name || ''} · 更快交付 · 更稳品质`; }
    const C = S.sim.contents;
    p.innerHTML = hd('fa-clapperboard', 'AI 内容工厂', '任务完成 → 自动生成宣传海报 / 短视频 → 合规审校 → 老板审批 → 多渠道分发 → 回流线索')
      + `<div class="poster-stage"><div class="canvas-box">${studioState.type === 'video' && studioState.videoUrl ? `<video src="${studioState.videoUrl}" controls autoplay loop playsinline style="max-height:520px;max-width:100%;border-radius:8px"></video>` : '<canvas id="pc" width="720" height="960"></canvas>'}</div>
        <div class="col">
          <div class="card col">
            <div class="flex"><button class="btn btn-sm ${studioState.type === 'poster' ? 'btn-pri' : 'btn-ghost'}" data-t="poster"><i class="fas fa-image"></i>海报</button><button class="btn btn-sm ${studioState.type === 'video' ? 'btn-pri' : 'btn-ghost'}" data-t="video"><i class="fas fa-film"></i>短视频</button></div>
            <label class="hint">主标题</label><input id="s-title" value="${esc(studioState.title)}">
            <label class="hint">副标题 / 卖点</label><input id="s-sub" value="${esc(studioState.sub)}">
            <label class="hint">行动号召</label><input id="s-cta" value="${esc(studioState.cta)}">
            <div class="flex">${THEMES.map((t, i) => `<button data-th="${i}" style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,${t[1]},${t[2]});border:2px solid ${studioState.theme === i ? '#fff' : 'transparent'}"></button>`).join('')}<button class="btn btn-ghost btn-sm" id="ai-copy" style="margin-left:auto"><i class="fas fa-wand-magic-sparkles"></i>AI 文案</button></div>
            ${window.AI && AI.on ? `<div class="flex"><button class="btn btn-ghost btn-sm" style="flex:1;justify-content:center" onclick="AI.posterBg()" ${AI.busy.img ? 'disabled' : ''}><i class="fas ${AI.busy.img ? 'fa-spinner fa-spin' : 'fa-image'}"></i>${AI.busy.img ? '生成中…' : 'AI 生成海报画面'}</button><button class="btn btn-ghost btn-sm" style="flex:1;justify-content:center" onclick="AI.promoVideo()" ${AI.busy.video ? 'disabled' : ''}><i class="fas ${AI.busy.video ? 'fa-spinner fa-spin' : 'fa-video'}"></i>${AI.busy.video ? '视频生成中…' : 'AI 生成宣传视频'}</button></div><div class="hint">Genspark 生成：海报画面约 19 积分 · 5秒视频约 110 积分</div>` : ''}
            ${studioState.post ? `<div class="hint" style="line-height:1.6;color:var(--sub)"><b style="color:var(--txt)">推广文案：</b>${esc(studioState.post)}</div>` : ''}
            <div class="flex"><button class="btn btn-pri btn-sm" id="play" style="flex:1;justify-content:center"><i class="fas ${studioState.type === 'video' ? 'fa-play' : 'fa-rotate'}"></i>${studioState.type === 'video' ? '预览视频' : '重新生成'}</button><button class="btn btn-ghost btn-sm" id="dl"><i class="fas fa-download"></i>${studioState.type === 'video' ? '导出视频' : '下载PNG'}</button></div>
          </div>
          <div class="card col"><div class="h3">分发渠道</div>${['抖音', '视频号', '小红书', '公众号', 'B站', '微博', '企业官网', '私域社群'].map((c) => `<div class="chan ${studioState.channels.includes(c) ? 'on' : ''}" data-c="${c}"><i class="fas ${studioState.channels.includes(c) ? 'fa-square-check' : 'fa-square'}" style="color:var(--c1)"></i><span class="pb">${c}</span></div>`).join('')}
            <button class="btn btn-pri" id="publish"><i class="fas fa-paper-plane"></i>提交审批并分发</button><div class="hint">对外发布属 L4 高风险动作，须老板审批；广告法敏感词已自动审校。</div></div>
        </div></div>
      <div class="card mt"><div class="ct"><span class="h3">内容资产（${C.length}）</span><span class="dim" style="font-size:12px">累计曝光 ${fmtMoney(S.sim.metrics.views)}</span></div>
        <table class="table"><tr><th>内容</th><th>类型</th><th>渠道</th><th>状态</th><th>曝光</th><th>回流线索</th></tr>${C.slice(0, 12).map((c) => `<tr><td>${esc(c.title)}</td><td>${c.type === 'video' ? '<i class="fas fa-film"></i> 视频' : '<i class="fas fa-image"></i> 海报'}</td><td>${c.channels.join(' / ')}</td><td>${c.status === 'live' ? '<span class="tag ok">分发中</span>' : '<span class="tag warn">待审批</span>'}</td><td>${fmtMoney(c.views)}</td><td>${c.leads}</td></tr>`).join('') || '<tr><td colspan="6" class="dim">品牌内容部完成任务后将自动产出内容</td></tr>'}</table></div>`;
    $$('[data-t]', p).forEach((b) => b.onclick = () => { studioState.type = b.dataset.t; studio(p); });
    $$('[data-th]', p).forEach((b) => b.onclick = () => { studioState.theme = +b.dataset.th; studio(p); });
    $$('.chan', p).forEach((b) => b.onclick = () => { const c = b.dataset.c; studioState.channels = studioState.channels.includes(c) ? studioState.channels.filter((x) => x !== c) : [...studioState.channels, c]; studio(p); });
    ['title', 'sub', 'cta'].forEach((k) => $('#s-' + k).oninput = (e) => { studioState[k] = e.target.value; drawPoster(1); });
    $('#ai-copy').onclick = () => { if (window.AI && AI.on) return AI.copy(p); const P = S.company.profile; studioState.title = pick([`${short} · 让${(S.industry?.div?.kw || '').split(' ')[0] || '生意'}更简单`, `选${short}，交付更安心`, `${short} 2026 全新升级`]); studioState.sub = P.canvas.价值主张.slice(0, 24); studioState.cta = pick(['立即咨询', '扫码领取方案', '预约免费诊断', '限时合作优惠']); studio(p); toast('AI 已生成合规文案（已过广告法审校）', 'fa-wand-magic-sparkles'); };
    $('#play').onclick = () => studioState.type === 'video' ? (studioState.videoUrl ? (studioState.videoUrl = '', studio(p)) : playVideo()) : drawPoster(1);
    $('#dl').onclick = () => studioState.type === 'video' ? (studioState.videoUrl ? (() => { const a = document.createElement('a'); a.href = studioState.videoUrl; a.download = `${short}_AI宣传视频.mp4`; a.click(); })() : exportVideo()) : (() => { const a = document.createElement('a'); a.download = `${short}_海报.png`; a.href = $('#pc').toDataURL('image/png'); a.click(); })();
    $('#publish').onclick = () => { const b = deptByLib('brand') || deptByLib('marketing') || S.depts[0]; const c = { id: uid('c'), type: studioState.type, ai: !!(studioState.videoUrl || studioState.bgUrl), title: studioState.title + (studioState.type === 'video' ? '·短视频' : '·海报'), status: 'pending', channels: [...studioState.channels], views: 0, leads: 0, day: S.sim.day }; S.sim.contents.unshift(c); S.sim.metrics.contents++; addApproval('对外发布声明', b.id, `对外分发「${c.title}」至 ${c.channels.join('/')}`, 0, c.id); toast('已提交老板审批，审批通过后自动分发', 'fa-paper-plane'); studio(p); };
    drawPoster(1);
  }
  window.drawPosterNow = () => drawPoster(1);
  window.studioState = () => studioState;
  function drawPoster(t, ctx) {
    const cv = $('#pc'); if (!cv) return; ctx = ctx || cv.getContext('2d');
    const W = 720, H = 960, [bg, c1, c2] = THEMES[studioState.theme];
    const e = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const im = window._posterBg; if (im && im.complete && im.naturalWidth) { const r = Math.max(W / im.naturalWidth, H / im.naturalHeight); const iw = im.naturalWidth * r, ih = im.naturalHeight * r; ctx.drawImage(im, (W - iw) / 2, (H - ih) / 2, iw, ih); const ov = ctx.createLinearGradient(0, 0, 0, H); ov.addColorStop(0, 'rgba(0,0,0,.25)'); ov.addColorStop(.55, 'rgba(0,0,0,.35)'); ov.addColorStop(1, 'rgba(0,0,0,.85)'); ctx.fillStyle = ov; ctx.fillRect(0, 0, W, H); }
    const g = ctx.createRadialGradient(W * .8, H * .2, 10, W * .8, H * .2, 600); g.addColorStop(0, c1 + '88'); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createRadialGradient(W * .1, H * .9, 10, W * .1, H * .9, 500); g2.addColorStop(0, c2 + '77'); g2.addColorStop(1, 'transparent'); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = c1 + '22'; ctx.lineWidth = 1; for (let i = 0; i < W; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); } for (let j = 0; j < H; j += 40) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(W, j); ctx.stroke(); }
    // 中心图形（有 AI 画面时不绘制）
    const a1 = e(t * 1.5);
    if (!(window._posterBg && window._posterBg.naturalWidth)) {
    ctx.save(); ctx.translate(W / 2, 400); ctx.rotate((1 - a1) * -1.2);
    for (let r = 0; r < 4; r++) { ctx.beginPath(); ctx.strokeStyle = (r % 2 ? c2 : c1) + 'cc'; ctx.lineWidth = 3; ctx.arc(0, 0, (70 + r * 42) * a1, r * .8, r * .8 + Math.PI * 1.4); ctx.stroke(); }
    ctx.restore();
    ctx.beginPath(); ctx.fillStyle = c1; ctx.shadowColor = c1; ctx.shadowBlur = 40; ctx.arc(W / 2, 400, 54 * a1, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = bg; ctx.font = `900 ${46 * a1 || 1}px "PingFang SC","Microsoft YaHei",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((S.company.name || '企')[0], W / 2, 402);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // 文字
    const a2 = e((t - .25) * 2), a3 = e((t - .45) * 2), a4 = e((t - .65) * 2.5);
    ctx.globalAlpha = a2; ctx.fillStyle = '#fff'; ctx.font = '900 62px "PingFang SC","Microsoft YaHei",sans-serif';
    wrapText(ctx, studioState.title, W / 2, 640 + (1 - a2) * 40, W - 100, 74);
    ctx.globalAlpha = a3; ctx.fillStyle = c1; ctx.font = '500 28px "PingFang SC","Microsoft YaHei",sans-serif'; ctx.fillText(studioState.sub.slice(0, 26), W / 2, 760 + (1 - a3) * 30);
    ctx.globalAlpha = a4; const bw = 280; const grd = ctx.createLinearGradient(W / 2 - bw / 2, 0, W / 2 + bw / 2, 0); grd.addColorStop(0, c1); grd.addColorStop(1, c2); ctx.fillStyle = grd; roundRect(ctx, W / 2 - bw / 2, 820, bw, 64, 32); ctx.fill();
    ctx.fillStyle = bg; ctx.font = '800 28px "PingFang SC","Microsoft YaHei",sans-serif'; ctx.fillText(studioState.cta, W / 2, 853);
    ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff88'; ctx.font = '20px "PingFang SC",sans-serif'; ctx.textAlign = 'left'; ctx.fillText(S.company.name, 40, 60); ctx.textAlign = 'right'; ctx.fillText('AI 内容工厂 · 企业智脑', W - 40, 60); ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff55'; ctx.font = '16px sans-serif'; ctx.fillText('* AI 生成内容 · 已通过合规审校', W / 2, H - 30);
  }
  function wrapText(ctx, text, x, y, maxW, lh) { const chars = [...text]; let line = '', lines = []; chars.forEach((c) => { if (ctx.measureText(line + c).width > maxW) { lines.push(line); line = c; } else line += c; }); lines.push(line); lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, x, y + i * lh - (lines.length > 1 ? lh / 2 : 0))); }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  let raf = null;
  function playVideo(dur = 4000, onEnd) { cancelAnimationFrame(raf); const st = performance.now(); const f = (now) => { const t = (now - st) / dur; drawPoster(Math.min(1, t * 1.3)); if (t < 1 && $('#pc')) raf = requestAnimationFrame(f); else onEnd && onEnd(); }; raf = requestAnimationFrame(f); }
  function exportVideo() {
    const cv = $('#pc'); if (!cv.captureStream || !window.MediaRecorder) return toast('当前浏览器不支持视频导出');
    const stream = cv.captureStream(30); const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime }); const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data); rec.onstop = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })); a.download = `${S.company.name}_宣传视频.webm`; a.click(); toast('宣传视频已导出', 'fa-film'); };
    rec.start(); toast('正在录制 5 秒宣传视频…', 'fa-film'); playVideo(4500, () => setTimeout(() => rec.stop(), 500));
  }

  // ---------------- 审批闸门 ----------------
  function approve(p) {
    const A = S.sim.approvals, pend = A.filter((a) => a.status === 'pending');
    const G = [['plan', '闸门① 方案确认', 'fa-diagram-project', '智脑拆解后的任务方案，确认后才分发到部门'], ['result', '闸门② 成果审批', 'fa-shield-halved', '已通过校验、但属于高风险或 L1 Agent 的成果'], ['review', '人工复核', 'fa-user-check', '返工后仍未达标，需要老板判断'], ['content', '对外发布', 'fa-bullhorn', '内容工厂产出的海报/视频分发']];
    const row = (a) => { const c = Flow.cmd(a.cmdId); return `<div class="approval ${a.status === 'approved' ? 'done' : a.status === 'rejected' ? 'rej' : ''}">${c ? `<span class="cmd-no sm" onclick="openCmdModal('${c.id}')">#${c.no}</span>` : ''}<div style="flex:1;min-width:0"><b>${esc(a.action)}</b> <span class="dim" style="font-size:12px">· ${a.deptId ? esc(deptName(a.deptId)) + ' · ' : ''}D${a.day} ${a.t}</span><div class="muted" style="font-size:13px;margin-top:3px">${esc(a.desc)}</div>${a.reason ? `<div style="font-size:12px;margin-top:3px;color:var(--warn)">意见：${esc(a.reason)}</div>` : ''}</div>
      ${a.taskId ? `<button class="btn btn-ghost btn-sm" onclick="openTaskModal('${a.taskId}')"><i class="fas fa-file-lines"></i>成果</button>` : ''}
      ${a.status === 'pending' ? `<button class="btn btn-sm btn-danger" onclick="decideApproval('${a.id}',false);gotoView('approve')">驳回</button><button class="btn btn-pri btn-sm" onclick="decideApproval('${a.id}',true);gotoView('approve')"><i class="fas fa-check"></i>${a.kind === 'plan' ? '确认分发' : '批准'}</button>` : `<span class="tag ${a.status === 'approved' ? 'ok' : 'bad'}">${a.status === 'approved' ? '已批准' : '已驳回'}</span>`}</div>`; };
    p.innerHTML = hd('fa-user-shield', '审批闸门', '老板只在关键节点拍板：方案确认 → 成果审批；驳回意见会自动成为下一轮循环的依据', pend.length > 1 ? `<button class="btn btn-ghost btn-sm" id="approve-all"><i class="fas fa-check-double"></i>全部批准（${pend.length}）</button>` : '')
      + (A.length ? G.map(([k, n, i, d]) => { const L = A.filter((a) => a.kind === k || (k === 'content' && !['plan', 'result', 'review'].includes(a.kind))); if (!L.length) return ''; const pn = L.filter((a) => a.status === 'pending'); return `<div class="card mt"><div class="ct"><span class="h3"><i class="fas ${i}" style="color:var(--warn)"></i> ${n} <span class="tag ${pn.length ? 'warn' : 'ok'}">${pn.length ? pn.length + ' 待处理' : '已清空'}</span></span><span class="dim" style="font-size:11px">${d}</span></div><div class="col">${[...pn, ...L.filter((a) => a.status !== 'pending').slice(0, 5)].map(row).join('')}</div></div>`; }).join('')
        : '<div class="empty-state" style="height:300px"><div><i class="fas fa-user-shield" style="font-size:36px"></i><p class="mt">暂无审批事项</p><p class="hint">下达指令后，拆解方案和高风险成果会在这里等待您拍板</p></div></div>');
    const b = $('#approve-all'); if (b) b.onclick = () => { pend.forEach((a) => decideApproval(a.id, true)); approve(p); toast(`已批准 ${pend.length} 项`); };
  }

  // ---------------- 价值账本 ----------------
  function ledger(p) {
    const M = S.sim.metrics, wage = 120;
    const labor = M.hours * wage, total = labor + M.saved + M.revenue * .2;
    const cost = S.agents.length * 30 * S.sim.day;
    p.innerHTML = hd('fa-sack-dollar', '价值账本', '从“看起来更聪明”到经营收益：每一笔价值都可追溯到任务、线索与审批记录')
      + `<div class="grid4">
        <div class="stat"><div class="l">节省工时</div><div class="v">${M.hours}h</div><div class="d muted">≈ ¥${fmtMoney(labor)}（按 ¥${wage}/h）</div></div>
        <div class="stat"><div class="l">降本金额</div><div class="v" style="color:var(--ok)">¥${fmtMoney(M.saved)}</div><div class="d muted">采购比价 / 预算偏差</div></div>
        <div class="stat"><div class="l">商机管道</div><div class="v" style="color:var(--c1)">¥${fmtMoney(M.pipeline)}</div><div class="d muted">${M.leads} 条线索</div></div>
        <div class="stat"><div class="l">已成交收入</div><div class="v" style="color:#ffca28">¥${fmtMoney(M.revenue)}</div><div class="d muted">按 20% 毛利计入价值</div></div>
      </div>
      <div class="grid2 mt">
        <div class="card"><div class="ct"><span class="h3">ROI 测算</span><span class="tag warn">模拟值 · 需基线归因</span></div>
          <div style="font-size:13px;line-height:2">经验证价值合计：<b class="grad-txt" style="font-size:20px">¥${fmtMoney(total)}</b><br>智脑运行成本（估）：¥${fmtMoney(cost)}<br>ROI：<b style="color:var(--ok);font-size:18px">${cost ? ((total - cost) / cost * 100).toFixed(0) : 0}%</b></div>
          <p class="hint mt">口径：企业ROI＝（经合理验证的收益或成本节省 − 实施、订阅、数据许可、人审成本）÷ 投入成本。增长效果作为试点验证指标，不承诺固定增收比例。</p></div>
        <div class="card"><div class="ct"><span class="h3">价值来源构成</span></div>
          ${[['人力释放', labor, '#3ee0ff'], ['降本', M.saved, '#3ddc97'], ['成交毛利', M.revenue * .2, '#ffca28']].map(([n, v, c]) => `<div class="flex" style="margin:10px 0"><span style="width:70px;font-size:12px">${n}</span><div class="bar" style="flex:1;height:10px"><i style="width:${total ? v / total * 100 : 0}%;background:${c}"></i></div><span style="width:80px;text-align:right;font-size:12px">¥${fmtMoney(v)}</span></div>`).join('')}
          <div class="h3 mt">企业专属知识库（${S.sim.knowledge.length}）</div>${S.sim.knowledge.slice(0, 5).map((k) => `<div style="font-size:12px;margin-top:6px"><i class="fas fa-book" style="color:var(--c2)"></i> ${esc(k.title)} <span class="dim">· ${esc(k.dept)}</span></div>`).join('') || '<div class="hint mt">每日 19:00 自动沉淀经营复盘</div>'}</div>
      </div>
      <div class="card mt"><div class="ct"><span class="h3">每日价值日报</span></div><table class="table"><tr><th>日期</th><th>完成任务</th><th>新增商机</th><th>管道新增</th><th>节省工时</th></tr>${[...S.sim.history].reverse().concat([]).slice(0, 10).map((h) => `<tr><td>第${h.day}天</td><td>${h.done}</td><td>${h.leads}</td><td>¥${fmtMoney(h.pipeline)}</td><td>${h.hours}h</td></tr>`).join('')}<tr style="color:var(--c1)"><td>第${S.sim.day}天（进行中）</td><td>${S.sim.today.done}</td><td>${S.sim.today.leads}</td><td>¥${fmtMoney(S.sim.today.pipeline)}</td><td>${S.sim.today.hours}h</td></tr></table></div>`;
  }

  // ---------------- 组织人才 ----------------
  function org(p) {
    p.innerHTML = hd('fa-sitemap', '组织与人才', `${S.depts.length} 个部门 · ${S.staff.length} 名员工 · ${S.agents.length} 个 Agent · 人机协同编制`, `<button class="btn btn-ghost btn-sm" id="edit-layout"><i class="fas fa-pen-ruler"></i>调整部门布局</button>`)
      + `<div class="grid3">${S.depts.map((d) => { const st = S.staff.filter((s) => s.deptId === d.id); const avg = st.length ? Math.round(st.reduce((a, s) => a + s.value, 0) / st.length) : 0; return `<div class="card" style="border-top:3px solid ${d.color}"><div class="ct"><span class="h3"><i class="fas ${d.icon}" style="color:${d.color}"></i> ${esc(d.name)}</span><button class="btn btn-ghost btn-sm" onclick="openDeptDrawer('${d.id}')">详情</button></div>
        <div class="flex between" style="font-size:12px"><span class="muted">员工 ${st.length}</span><span class="muted">Agent ${S.agents.filter((a) => a.deptId === d.id).length}</span><span class="muted">人才均分 <b style="color:var(--c1)">${avg}</b></span></div>
        <div class="flex wrap mt" style="gap:6px">${st.map((s) => `<span class="tag p" style="cursor:pointer" onclick="openStaffModal('${s.id}')"><span class="avatar" style="width:16px;height:16px;font-size:9px;background:${avColor(s.name)}">${esc(s.name[0])}</span>${esc(s.name)} ${s.value}</span>`).join('')}</div></div>`; }).join('')}</div>`;
    $('#edit-layout').onclick = () => { if (confirm('返回创建向导调整部门与人员？（运行数据保留）')) { stopSim(); S.launched = false; S.step = 3; saveState(); renderApp(); } };
  }

  // ---------------- 抽屉/弹窗 ----------------
  window.openDeptDrawer = function (id) {
    const d = S.depts.find((x) => x.id === id); if (!d) return;
    const l = deptLib(d.lib), st = S.staff.filter((s) => s.deptId === id), ag = S.agents.filter((a) => a.deptId === id), T = S.sim.tasks.filter((t) => t.deptId === id);
    openDrawer(`<div class="drawer-hd"><div class="ic" style="width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:${d.color};font-size:20px"><i class="fas ${d.icon}"></i></div><div><div class="h2">${esc(d.name)}</div><div class="hint">${l ? 'KPI：' + l.kpi.join(' · ') : '自定义部门'}</div></div><button class="close-x" data-close><i class="fas fa-xmark"></i></button></div>
      <div class="drawer-bd">
        <div class="grid3"><div class="stat"><div class="l">员工</div><div class="v">${st.length}</div></div><div class="stat"><div class="l">Agent</div><div class="v">${ag.length}</div></div><div class="stat"><div class="l">今日完成</div><div class="v">${T.filter((t) => t.status === 'done' && t.day === S.sim.day).length}</div></div></div>
        <div class="card"><div class="ct"><span class="h3">向本部门下达指令</span><span class="dim" style="font-size:11px">直达本部门 · 仍走校验与审批</span></div><div class="flex"><input id="dt-in" placeholder="输入指令，或点击下方推荐" style="flex:1"><button class="btn btn-pri btn-sm" id="dt-go">下达</button></div>
          <div class="flex wrap mt" style="gap:6px">${(l ? l.tasks : []).map((t) => `<button class="tag" data-dt="${esc(t)}" style="cursor:pointer">${esc(t)}</button>`).join('')}</div></div>
        <div class="card"><div class="ct"><span class="h3">在办任务</span></div>${T.filter((t) => !['done', 'rejected'].includes(t.status)).slice(0, 10).map((t) => `<div style="margin:8px 0;cursor:pointer" onclick="openTaskModal('${t.id}')"><div class="flex between" style="font-size:12px"><span>${Flow.cmd(t.cmdId) ? '#' + Flow.cmd(t.cmdId).no + ' ' : ''}${esc(t.title)}</span><span class="tag ${stMap[t.status][1]}">${stMap[t.status][0]}</span></div><div class="bar" style="margin-top:4px"><i style="width:${t.progress}%"></i></div></div>`).join('') || '<div class="hint">暂无在办任务 —— 本部门只在接到指令后开工</div>'}</div>
        <div class="card"><div class="ct"><span class="h3">Agent 编队</span></div><div class="grid2">${ag.filter((a) => !a.sub).map(agentCard).join('')}</div><div class="hint mt">另有 ${ag.filter((a) => a.sub).length} 个执行体负责批量低风险动作</div></div>
        <div class="card"><div class="ct"><span class="h3">员工</span></div>${st.map((s) => `<div class="flex" style="margin:8px 0;cursor:pointer" onclick="openStaffModal('${s.id}')"><div class="avatar" style="width:32px;height:32px;font-size:13px;background:${avColor(s.name)}">${esc(s.name[0])}</div><div style="flex:1"><b style="font-size:13px">${esc(s.name)}</b> <span class="dim" style="font-size:12px">${esc(s.pos)}</span></div><b class="grad-txt">${s.value}</b></div>`).join('')}</div>
      </div>`, (dr) => {
      const go = (txt) => { if (!txt) return; Flow.issue(`${d.name}：${txt}`, { plan: [{ deptId: id, title: txt, deliverable: '可直接使用的工作成果', sla: 240, needApproval: false, kind: d.lib === 'sales' && /商机|线索|订单|客户|询价|采购/.test(txt) ? 'leads' : null }] }); closeOverlay(); gotoView('flow'); toast(`指令已下达至 ${d.name}，可在调度中枢跟踪`); };
      $('#dt-go', dr).onclick = () => go($('#dt-in', dr).value.trim());
      $$('[data-dt]', dr).forEach((b) => b.onclick = () => go(b.dataset.dt));
    });
  };
  window.openStaffModal = function (id) {
    const s = S.staff.find((x) => x.id === id); if (!s) return;
    const mine = S.sim.tasks.filter((t) => t.ownerId === id);
    openModal(`<div class="flex"><div class="avatar" style="width:56px;height:56px;font-size:22px;background:${avColor(s.name)}">${esc(s.name[0])}</div><div><div class="h2">${esc(s.name)}</div><div class="hint">${esc(deptName(s.deptId))} · ${esc(s.pos)} · ${s.years}年经验</div></div><div style="margin-left:auto;text-align:right"><div class="dim" style="font-size:11px">价值评分</div><b class="grad-txt" style="font-size:30px">${s.value}</b></div><button class="close-x" data-close style="margin-left:14px"><i class="fas fa-xmark"></i></button></div>
      <div class="card mt"><div class="h3">简历与价值</div><p class="muted mt" style="line-height:1.7;font-size:13px">${esc(s.resume || '—')}</p><div class="flex wrap mt" style="gap:6px">${s.skills.map((k) => `<span class="tag">${k}</span>`).join('')}</div></div>
      <div class="grid2 mt"><div class="card"><div class="h3">AI 人才洞察</div><ul style="padding-left:18px;font-size:12px;line-height:1.9" class="muted mt"><li>适合作为「${s.value >= 80 ? '核心骨干 / 人审复核人' : '执行岗 / Agent 协作者'}」</li><li>建议搭配 Agent：${esc((S.agents.find((a) => a.deptId === s.deptId && !a.sub) || {}).name || '')}</li><li>能力补强：${pick(['数据分析', 'AI 工具使用', '项目管理', '谈判'])}</li></ul></div>
      <div class="card"><div class="h3">负责的任务（${mine.length}）</div>${mine.slice(0, 5).map((t) => `<div style="font-size:12px;margin-top:6px">▸ ${esc(t.title)} <span class="tag ${stMap[t.status][1]}">${stMap[t.status][0]}</span></div>`).join('') || '<div class="hint mt">暂无</div>'}</div></div>`);
  };
  window.openAgentModal = function (id) {
    const a = agentOf(id); if (!a) return;
    const mine = S.sim.tasks.filter((t) => t.agentId === id);
    openModal(`<div class="flex"><div class="bot-ic" style="width:52px;height:52px;font-size:22px"><i class="fas fa-robot"></i></div><div><div class="h2">${esc(a.name)}</div><div class="hint">${esc(deptName(a.deptId))} · ${a.sub ? '执行体' : '核心 Agent'} · 自治等级 ${a.level}</div></div><div style="margin-left:auto;text-align:right"><div class="dim" style="font-size:11px">综合评测</div><b class="grad-txt" style="font-size:30px">${agentTotal(a)}</b></div><button class="close-x" data-close style="margin-left:14px"><i class="fas fa-xmark"></i></button></div>
      <div class="grid2 mt"><div class="card"><div class="h3">五维评测</div>${EVAL_DIMS.map((d) => `<div class="flex" style="margin:8px 0"><span style="width:64px;font-size:12px">${d.name}</span><div class="bar" style="flex:1"><i style="width:${a.evals[d.k]}%"></i></div><b style="width:28px;text-align:right;font-size:12px">${a.evals[d.k]}</b></div>`).join('')}</div>
      <div class="card"><div class="h3">自治等级设定</div><div class="col mt">${AUTONOMY.slice(0, 3).map((l) => `<label class="chan ${a.level === l.lv ? 'on' : ''}" style="cursor:pointer"><input type="radio" name="lv" value="${l.lv}" ${a.level === l.lv ? 'checked' : ''} hidden><span class="lvl" style="background:${l.color}33;color:${l.color}">${l.lv}</span><span class="pb">${l.name}<div class="dim" style="font-size:11px">${l.desc}</div></span></label>`).join('')}</div><div class="hint mt">L4 高风险动作对所有 Agent 永久锁定，只能由老板审批。</div></div></div>
      <div class="card mt"><div class="h3">工作记录（完成 ${a.done} · 返工 ${a.fail}）</div>${mine.slice(0, 6).map((t) => `<div class="flex between" style="font-size:12px;margin-top:6px"><span>▸ ${esc(t.title)}</span><span>${t.evals ? `评测 ${t.evals.total}` : t.progress + '%'} <span class="tag ${stMap[t.status][1]}">${stMap[t.status][0]}</span></span></div>`).join('') || '<div class="hint mt">暂无</div>'}</div>`, (m) => {
      $$('input[name=lv]', m).forEach((r) => r.onchange = () => { a.level = r.value; saveState(); toast(`${a.name} 自治等级调整为 ${a.level}`); openAgentModal(id); });
    });
  };
})();
