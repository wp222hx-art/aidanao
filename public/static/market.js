// 智导 · 撮合中心：把「我的企业」与「给企业献策」两个入口连成一个市场
// 企业发布悬赏征集令（智点托管）→ 用户应征献策 → 企业采纳发奖 → 落地验收 → 方案脱敏共享给同行 → 同行使用、作者分成
(function () {
  const uid = () => { let v = localStorage.getItem('ebrain_uid'); if (!v) { v = 'u_' + Math.random().toString(36).slice(2, 12); localStorage.setItem('ebrain_uid', v); } return v; };
  const api = async (path, body) => {
    const headers = { 'Content-Type': 'application/json' }; const code = localStorage.getItem('ebrain_code'); if (code) headers['X-Brain-Code'] = code;
    const r = await fetch('/api/mkt' + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await r.json(); } catch { }
    if (!r.ok || !j || j.ok === false) throw new Error(j?.error || `请求失败（${r.status}）`);
    return j;
  };
  const co = () => S.network ? { id: S.network.id, token: S.network.token } : null;
  const who = () => co() ? { co: co() } : { uid: uid() };
  const ai = () => window.AI && AI.on;
  const KN = { proposal: '策划案', suggestion: '改进建议', design: '设计思路' };
  const left = (t) => { if (!t) return ''; const d = Math.ceil((t - Date.now()) / 86400e3); return d > 0 ? `剩 ${d} 天` : '已截止'; };
  const sampleTag = (x) => x.sample ? '<span class="mk-sample" title="平台样板数据，用于展示效果">样板</span>' : '';
  let tab = 'match', host = null, cache = {}, rules = null;
  const TABS = [['match', 'fa-handshake', '智能撮合'], ['challenges', 'fa-trophy', '悬赏征集令'], ['solutions', 'fa-book-open', '同行方案库'], ['rank', 'fa-ranking-star', '排行榜'], ['wallet', 'fa-coins', '我的智点']];

  function render(p) {
    host = p;
    p.innerHTML = `<div class="page-hd"><div class="ic" style="background:linear-gradient(135deg,#10b981,#3b6cf6)"><i class="fas fa-handshake"></i></div><div><div class="h2">撮合中心</div><div class="hint">企业出题、用户解题、同行复用：好点子能赚智点，验证过的方案能分享给同行</div></div>
      <div class="flex" style="margin-left:auto;gap:8px"><span class="mc-bal" id="mc-bal"><i class="fas fa-coins"></i>—</span><button class="btn btn-ghost btn-sm" id="mc-home"><i class="fas fa-house"></i>返回主页</button>${p.dataset.overlay ? '<button class="close-x" id="mc-close" style="margin-left:0" title="关闭"><i class="fas fa-xmark"></i></button>' : ''}</div></div>
      <section class="mc-loop">${[['fa-bullhorn', '企业发布征集令', '悬赏智点托管'], ['fa-lightbulb', '用户应征献策', 'AI 帮你写成方案'], ['fa-circle-check', '企业采纳发奖', '悬赏 + 平台奖励'], ['fa-rocket', '智脑落地验收', '再奖 50 智点'], ['fa-share-nodes', '脱敏共享同行', '方案进入方案库'], ['fa-coins', '同行使用分成', '作者得 80%']].map(([i, t, s], k) => `<div class="mc-step"><i class="fas ${i}"></i><b>${t}</b><small>${s}</small></div>${k < 5 ? '<span class="mc-arrow"><i class="fas fa-chevron-right"></i></span>' : ''}`).join('')}</section>
      <nav class="sv-tabs mt">${TABS.map(([k, i, n]) => `<button class="${tab === k ? 'on' : ''}" data-mct="${k}"><i class="fas ${i}"></i>${n}</button>`).join('')}</nav>
      <div id="mc-body" class="mt"></div>`;
    $$('[data-mct]', p).forEach((b) => b.onclick = () => { tab = b.dataset.mct; render(p); });
    $('#mc-home', p).onclick = () => goHome();
    const cx = $('#mc-close', p); if (cx) cx.onclick = () => p.closest('.ideas-overlay')?.remove();
    api('/wallet', { uid: uid() }).then((w) => { const el = $('#mc-bal', p); if (el) el.innerHTML = `<i class="fas fa-coins"></i>我的智点 <b>${w.balance}</b>`; }).catch(() => { });
    ({ match, challenges, solutions, rank, wallet })[tab]($('#mc-body', p));
  }
  const rerender = () => { if (host && document.body.contains(host)) render(host); };
  const on = (b, sel, fn) => { const el = $(sel, b); if (el) el.onclick = fn; };

  // ---------------- ① 智能撮合 ----------------
  function match(b) {
    const P = S.company?.profile || {}, def = S.launched ? [S.industry?.div?.name, P.positioning || '', (P.risks || []).slice(0, 2).join(' ')].filter(Boolean).join(' ') : '';
    const q = cache.matchQ ?? def, R = cache.match;
    b.innerHTML = `<div class="card"><div class="h4"><i class="fas fa-wand-magic-sparkles" style="color:#10b981"></i> 说说你在找什么</div>
      <div class="hint mt">企业：描述你的问题，撮合出同行已验证的方案、相关献策；个人：描述你擅长的领域，撮合出正在悬赏的征集令</div>
      <div class="flex mt"><input id="mt-q" placeholder="例：储能柜 中小工厂 获客难 / 我擅长游戏活动策划" value="${esc(q)}" style="flex:1"><button class="btn btn-pri" id="mt-go"><i class="fas fa-handshake"></i>撮合</button></div></div>
      ${R ? `<div class="mc-cols mt">
        <div class="card"><div class="h4"><i class="fas fa-trophy" style="color:#f59e0b"></i> 匹配的征集令（${R.challenges.length}）</div>${R.challenges.map(chRow).join('') || '<div class="hint mt">暂无匹配，去「悬赏征集令」看看全部</div>'}</div>
        <div class="card"><div class="h4"><i class="fas fa-book-open" style="color:#10b981"></i> 同行已验证方案（${R.solutions.length}）</div>${R.solutions.map((s) => `<div class="mc-row" data-sol="${s.id}"><div><b>${esc(s.title)}</b> ${sampleTag(s)}<small>${esc(s.author)} · ${esc(s.industry)} · ${s.uses} 家使用</small></div><span class="tag ${s.price ? 'warn' : 'ok'}">${s.price ? s.price + ' 智点' : '免费'}</span></div>`).join('') || '<div class="hint mt">暂无匹配</div>'}</div>
        <div class="card"><div class="h4"><i class="fas fa-lightbulb" style="color:#ec4899"></i> 相关献策（${R.ideas.length}）</div>${R.ideas.map((x) => `<div class="mc-row" data-idea="1"><div><b>${esc(x.title)}</b> ${sampleTag(x)}<small>→ ${esc(x.target)} · ${KN[x.kind] || ''} · ♥ ${x.likes}</small></div></div>`).join('') || '<div class="hint mt">暂无匹配</div>'}</div></div>` : ''}`;
    const go = async () => { cache.matchQ = $('#mt-q', b).value.trim(); if (!cache.matchQ) return toast('先描述一下'); try { cache.match = await api('/match', { text: cache.matchQ }); rerender(); } catch (e) { toast(e.message, 'fa-triangle-exclamation'); } };
    on(b, '#mt-go', go);
    $('#mt-q', b).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) go(); });
    if (!R && q) go();
    bindCommon(b);
  }
  const chRow = (c) => `<div class="mc-row"><div><b>${esc(c.title)}</b> ${sampleTag(c)}<small>${esc(c.company)} · ${left(c.deadline)} · ${c.entries} 人应征</small></div><span class="mc-pts">${c.rewardPoints ? c.rewardPoints + ' 智点' : '荣誉'}</span><button class="btn btn-warm btn-sm" data-apply="${c.id}">应征</button></div>`;
  function bindCommon(b) {
    $$('[data-apply]', b).forEach((x) => x.onclick = () => apply(x.dataset.apply));
    $$('[data-sol]', b).forEach((x) => x.onclick = (e) => { if (e.target.closest('button')) return; useSolution(x.dataset.sol); });
    $$('[data-idea]', b).forEach((x) => x.onclick = () => openIdeas(null, 'square'));
  }

  // ---------------- ② 悬赏征集令 ----------------
  async function apply(id) {
    try {
      const { challenge: c } = await api('/challenge/' + id);
      if (c.status !== 'open') return toast('该征集令已结束');
      host?.closest('.ideas-overlay')?.remove();
      window.ideaApply && ideaApply(c);
    } catch (e) { toast(e.message, 'fa-triangle-exclamation'); }
  }
  function challenges(b) {
    if (!cache.ch) { b.innerHTML = '<div class="hint"><i class="fas fa-spinner fa-spin"></i> 加载中…</div>'; api('/challenges').then((r) => { cache.ch = r.challenges; rerender(); }).catch((e) => toast(e.message)); return; }
    if (co() && !cache.myCh) api('/challenge/mine', co()).then((r) => { cache.myCh = r.challenges; rerender(); }).catch(() => { cache.myCh = []; });
    const pool = cache.ch.reduce((n, c) => n + (c.escrow || 0), 0);
    b.innerHTML = `<div class="mc-bar"><div class="mc-stat"><b>${cache.ch.length}</b><span>个征集中</span></div><div class="mc-stat"><b>${pool.toLocaleString()}</b><span>智点悬赏池</span></div><div class="mc-stat"><b>${cache.ch.reduce((n, c) => n + c.entries, 0)}</b><span>份应征方案</span></div>
        <div style="flex:1"></div>${co() ? `<button class="btn btn-pri" id="ch-new"><i class="fas fa-bullhorn"></i>发布征集令</button>` : `<button class="btn btn-ghost" id="ch-join"><i class="fas fa-building"></i>企业入驻后可发布征集令（送 1000 智点）</button>`}</div>
      ${cache.myCh?.length ? `<div class="card mt"><div class="h4"><i class="fas fa-building" style="color:var(--c1)"></i> 我发布的征集令</div>${cache.myCh.map((c) => `<div class="mc-row"><div><b>${esc(c.title)}</b><small>${c.entries} 份应征 · 托管剩余 ${c.escrow} 智点 · ${c.status === 'closed' ? '已结束' : left(c.deadline)}</small></div>${c.status === 'closed' ? '<span class="tag">已结束</span>' : `<button class="btn btn-ghost btn-sm" data-inbox>去收件箱评选</button><button class="btn btn-ghost btn-sm" data-close-ch="${c.id}">结束并退回余额</button>`}</div>`).join('')}</div>` : ''}
      <div class="mc-grid mt">${cache.ch.map((c) => `<article class="mc-card"><div class="mc-ctop"><span class="mc-co">${esc(c.company)}</span>${sampleTag(c)}<span class="mc-left">${left(c.deadline)}</span></div>
        <h4>${esc(c.title)}</h4><p>${esc(c.problem)}</p>
        <div class="mc-tags">${c.category ? `<em>${esc(c.category)}</em>` : ''}${c.kindPref ? `<em>偏好：${KN[c.kindPref]}</em>` : ''}${c.industry ? `<em>${esc(c.industry)}</em>` : ''}</div>
        <div class="mc-reward"><div><b>${c.rewardPoints ? c.rewardPoints.toLocaleString() : '—'}</b><small>智点悬赏（已托管）</small></div>${c.rewardCash ? `<div class="mc-cash"><i class="fas fa-gift"></i>${esc(c.rewardCash)}</div>` : ''}</div>
        <div class="mc-cfoot"><span>${c.entries} 人应征</span><button class="btn btn-warm btn-sm" data-apply="${c.id}"><i class="fas fa-lightbulb"></i>我来应征</button></div></article>`).join('') || '<div class="hint">暂无征集令</div>'}</div>
      <div class="hint mt">智点悬赏在发布时就从企业钱包托管，采纳时直接发给提案人；现金奖励由企业自行声明，与提案人线下约定，平台不经手资金。</div>`;
    on(b, '#ch-new', newChallenge);
    on(b, '#ch-join', () => openIdeas(null, 'inbox'));
    $$('[data-inbox]', b).forEach((x) => x.onclick = () => openIdeas(null, 'inbox'));
    $$('[data-close-ch]', b).forEach((x) => x.onclick = async () => { if (!confirm('结束征集令？剩余托管智点将退回企业钱包')) return; try { const r = await api('/challenge/close', { ...co(), challengeId: x.dataset.closeCh }); toast(`已结束，退回 ${r.refund} 智点`, 'fa-coins'); cache.ch = null; cache.myCh = null; rerender(); } catch (e) { toast(e.message, 'fa-triangle-exclamation'); } });
    bindCommon(b);
  }
  function newChallenge() {
    const m = openModal(`<div class="flex between"><div class="h2">发布悬赏征集令</div><button class="close-x" data-close><i class="fas fa-xmark"></i></button></div>
      <div class="hint mt">把企业遇到的难题公开征集，全网用户用 AI 帮你出方案；悬赏智点会先从企业钱包托管，结束时未发放的部分自动退回。</div>
      <div class="col mt"><input id="nc-title" placeholder="征集标题，例如：如何降低中小工厂的储能决策门槛？" maxlength="40">
        <textarea id="nc-problem" rows="5" placeholder="写清问题背景、目标、限制条件（预算 / 时间 / 不能做什么），越具体收到的方案越好"></textarea>
        <div class="grid3"><select id="nc-cat"><option value="">分类（选填）</option>${['产品创意', '营销活动', '商业模式', '用户体验', '游戏玩法', '降本增效', '品牌联名', '社会公益'].map((c) => `<option>${c}</option>`).join('')}</select>
          <select id="nc-kind"><option value="">方案类型不限</option><option value="proposal">策划案</option><option value="suggestion">改进建议</option><option value="design">设计思路</option></select>
          <select id="nc-days"><option value="7">征集 7 天</option><option value="14" selected>征集 14 天</option><option value="30">征集 30 天</option></select></div>
        <div class="grid2"><div><label class="hint">智点悬赏（从企业钱包托管）</label><input id="nc-pts" type="number" min="0" step="100" value="500"></div><div><label class="hint">现金 / 实物奖励说明（选填，线下兑现）</label><input id="nc-cash" placeholder="例：采纳另付 2000 元创意奖金" maxlength="60"></div></div>
        <div class="hint" id="nc-bal">企业钱包余额：加载中…</div>
        <button class="btn btn-pri" id="nc-go"><i class="fas fa-bullhorn"></i>发布</button></div>`);
    $$('[data-close]', m).forEach((x) => x.onclick = closeOverlay);
    api('/wallet', { co: co() }).then((w) => { $('#nc-bal', m).textContent = `企业钱包余额：${w.balance} 智点（入驻礼包 1000 智点已到账）`; }).catch(() => { });
    $('#nc-go', m).onclick = async () => {
      try { await api('/challenge/create', { ...co(), title: $('#nc-title', m).value, problem: $('#nc-problem', m).value, category: $('#nc-cat', m).value, kindPref: $('#nc-kind', m).value, days: $('#nc-days', m).value, rewardPoints: $('#nc-pts', m).value, rewardCash: $('#nc-cash', m).value, industry: S.industry?.div?.name || '' }); closeOverlay(); toast('征集令已发布 📣', 'fa-bullhorn'); cache.ch = null; cache.myCh = null; rerender(); }
      catch (e) { toast(e.message, 'fa-triangle-exclamation'); }
    };
  }

  // ---------------- ③ 同行方案库 ----------------
  function solutions(b) {
    const f = cache.soF || { sort: 'hot', price: '', q: '' }; cache.soF = f;
    const key = JSON.stringify(f);
    if (cache.soKey !== key) { cache.soKey = key; cache.so = null; api(`/solutions?sort=${f.sort}&price=${f.price}&q=${encodeURIComponent(f.q)}`).then((r) => { cache.so = r.solutions; rerender(); }).catch((e) => toast(e.message)); }
    b.innerHTML = `<div class="mc-bar"><div class="mk-seg">${[['hot', '最多人用'], ['score', '效果最好'], ['new', '最新']].map(([k, n]) => `<button class="${f.sort === k ? 'on' : ''}" data-ss="${k}">${n}</button>`).join('')}</div><div class="mk-seg">${[['', '全部'], ['free', '免费'], ['paid', '付费']].map(([k, n]) => `<button class="${f.price === k ? 'on' : ''}" data-sp="${k}">${n}</button>`).join('')}</div>
        <input id="so-q" placeholder="搜索方案 / 行业 / 关键词，回车" value="${esc(f.q)}" style="flex:1;min-width:180px"><button class="btn btn-pri" id="so-share"><i class="fas fa-share-nodes"></i>共享我的方案</button></div>
      <div class="mc-grid mt">${cache.so === null ? Array.from({ length: 3 }, () => '<div class="mk-card sk"></div>').join('') : cache.so.map((s) => `<article class="mc-card so" data-sol="${s.id}"><div class="mc-ctop"><span class="mc-co"><i class="fas fa-building"></i> ${esc(s.author)}</span>${sampleTag(s)}<span class="tag ${s.price ? 'warn' : 'ok'}">${s.price ? s.price + ' 智点' : '免费'}</span></div>
        <h4>${esc(s.title)}</h4><p>${esc(s.problem)}</p>${s.results ? `<div class="mc-result"><i class="fas fa-chart-line"></i>${esc(s.results)}</div>` : ''}
        <div class="mc-tags">${s.industry ? `<em>${esc(s.industry)}</em>` : ''}${s.tags.map((t) => `<em>#${esc(t)}</em>`).join('')}</div>
        <div class="mc-cfoot"><span>${s.uses} 家使用${s.score ? ` · 验收 ${s.score}` : ''}</span><button class="btn btn-ghost btn-sm">查看方案</button></div></article>`).join('') || '<div class="hint">没有符合条件的方案</div>'}</div>
      <div class="hint mt">共享的方案会经过 AI 脱敏（去掉企业名、客户、金额等）；免费方案每被同行使用一次作者 +2 智点，付费方案作者得 80%。</div>`;
    $$('[data-ss]', b).forEach((x) => x.onclick = () => { f.sort = x.dataset.ss; rerender(); });
    $$('[data-sp]', b).forEach((x) => x.onclick = () => { f.price = x.dataset.sp; rerender(); });
    $('#so-q', b).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { f.q = e.target.value.trim(); rerender(); } });
    on(b, '#so-share', () => shareModal());
    bindCommon(b);
  }
  async function useSolution(id) {
    const s0 = (cache.so || []).find((x) => x.id === id) || (cache.match?.solutions || []).find((x) => x.id === id);
    if (s0?.price && !s0.sample && !confirm(`这是付费方案，使用需 ${s0.price} 智点（作者得 80%），继续？`)) return;
    try {
      const { solution: s, paid } = await api('/solution/use', { id, ...who() });
      if (paid) toast(`已支付 ${paid} 智点`, 'fa-coins');
      const m = openModal(`<div class="flex between"><div><span class="tag ok"><i class="fas fa-book-open"></i> 同行方案</span> ${sampleTag(s)}<div class="h2 mt" style="font-size:19px">${esc(s.title)}</div><div class="hint">${esc(s.author)} · ${esc(s.industry)} · ${s.uses} 家使用${s.score ? ' · 验收 ' + s.score : ''}</div></div><button class="close-x" data-close><i class="fas fa-xmark"></i></button></div>
        ${s.results ? `<div class="fb-box ok mt"><b>效果：</b>${esc(s.results)}</div>` : ''}
        <div class="md id-md mt">${mdRender(s.approach || '')}</div>
        <div class="flex mt"><span class="hint" style="flex:1">${s.sample ? '平台样板方案，用于展示效果。' : '方案已脱敏，借鉴时请结合自身情况调整。'}</span>${S.launched && window.Flow ? '<button class="btn btn-pri btn-sm" id="so-run"><i class="fas fa-rocket"></i>交给我的智脑落地</button>' : ''}</div>`);
      $$('[data-close]', m).forEach((x) => x.onclick = closeOverlay);
      const run = $('#so-run', m); if (run) run.onclick = () => { closeOverlay(); host?.closest('.ideas-overlay')?.remove(); if (!S.sim) enterBrain(); const c = Flow.issue(`借鉴同行方案落地：${s.title}`, { idea: `# ${s.title}\n${s.problem}\n\n${s.approach}`, ideaBy: '同行方案库' }); if (c) { toast(`已作为指令 #${c.no} 交给智脑，先研究是否适合本企业`, 'fa-rocket'); enterBrain('flow'); } };
      cache.so = null; cache.soKey = '';
    } catch (e) { toast(e.message, 'fa-triangle-exclamation'); }
  }
  // 共享方案：可从项目档案一键 AI 脱敏整理
  function shareModal(prefill = {}, rec = null) {
    const L = window.Archive ? Archive.list() : [];
    const m = openModal(`<div class="flex between"><div class="h2">共享方案给同行</div><button class="close-x" data-close><i class="fas fa-xmark"></i></button></div>
      <div class="hint mt">把你企业验证过的做法分享出去：帮同行少走弯路，你也能赚智点、建立行业影响力。</div>
      ${L.length ? `<div class="flex mt"><select id="sh-ar" style="flex:1"><option value="">从项目档案选择（AI 自动脱敏整理）</option>${L.map((r) => `<option value="${r.id}" ${rec?.id === r.id ? 'selected' : ''}>#${r.no} ${esc(r.text.slice(0, 30))} · 验收 ${r.acceptance?.score ?? '—'}</option>`).join('')}</select><button class="btn btn-ghost" id="sh-ai" ${ai() ? '' : 'disabled'}><i class="fas fa-wand-magic-sparkles"></i>AI 脱敏整理</button></div>` : ''}
      <div class="col mt"><input id="sh-title" placeholder="方案标题" value="${esc(prefill.title || '')}" maxlength="40"><input id="sh-problem" placeholder="解决什么问题" value="${esc(prefill.problem || '')}" maxlength="100">
        <textarea id="sh-approach" rows="9" placeholder="方案正文（适用场景 / 核心做法 / 实施步骤 / 所需资源 / 关键经验）">${esc(prefill.approach || '')}</textarea>
        <div class="grid3"><input id="sh-results" placeholder="效果（用比例或区间）" value="${esc(prefill.results || '')}"><input id="sh-tags" placeholder="标签，逗号分隔" value="${esc((prefill.tags || []).join(','))}"><select id="sh-price"><option value="0">免费共享（每次被用 +2 智点）</option><option value="50">50 智点</option><option value="100">100 智点</option><option value="200">200 智点</option><option value="500">500 智点</option></select></div>
        <label class="chk"><input type="checkbox" id="sh-anon" checked> 匿名共享（显示为「匿名企业」）</label>
        <button class="btn btn-pri" id="sh-go"><i class="fas fa-share-nodes"></i>共享到方案库</button></div>`);
    $$('[data-close]', m).forEach((x) => x.onclick = closeOverlay);
    const fill = (d) => { $('#sh-title', m).value = d.title || ''; $('#sh-problem', m).value = d.problem || ''; $('#sh-approach', m).value = d.approach || ''; $('#sh-results', m).value = d.results || ''; $('#sh-tags', m).value = (d.tags || []).join(','); };
    const draft = async () => {
      const r = Archive.get($('#sh-ar', m).value); if (!r) return toast('先选择一个项目档案');
      const btn = $('#sh-ai', m); btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>整理中…';
      try { const d = await api('/solution/draft', { industry: r.industry, text: r.text, goal: r.goal, acceptance: r.acceptance?.summary, lessons: r.review?.lessons || [], steps: r.depts.flatMap((d) => d.tasks.map((t) => `${d.name}：${t.title}（${t.deliverable || ''}）验收 ${t.score ?? '—'}；${String(t.output || '').slice(0, 120)}`)) }); fill(d); m.dataset.score = r.acceptance?.score || 0; m.dataset.industry = r.industry; toast('已脱敏整理，请检查后共享', 'fa-shield-halved'); }
      catch (e) { toast(e.message, 'fa-triangle-exclamation'); }
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>AI 脱敏整理';
    };
    on(m, '#sh-ai', draft);
    if (rec && ai()) draft();
    $('#sh-go', m).onclick = async () => {
      try {
        const r = await api('/solution/share', { ...who(), ownerName: S.company?.name || '', industry: m.dataset.industry || (S.industry ? `${S.industry.name} › ${S.industry.div?.name || ''}` : ''), score: +m.dataset.score || 0, title: $('#sh-title', m).value, problem: $('#sh-problem', m).value, approach: $('#sh-approach', m).value, results: $('#sh-results', m).value, tags: $('#sh-tags', m).value.split(/[,，]/).map((x) => x.trim()).filter(Boolean), price: $('#sh-price', m).value, anonymous: $('#sh-anon', m).checked });
        closeOverlay(); toast(`方案已共享${r.reward ? `，获得 ${r.reward} 智点` : ''} 🎉`, 'fa-share-nodes'); cache.so = null; cache.soKey = ''; tab = 'solutions'; rerender();
      } catch (e) { toast(e.message, 'fa-triangle-exclamation'); }
    };
  }

  // ---------------- ④ 排行榜 ----------------
  function rank(b) {
    if (!cache.lb) { b.innerHTML = '<div class="hint"><i class="fas fa-spinner fa-spin"></i> 加载中…</div>'; api('/leaderboard').then((r) => { cache.lb = r; rerender(); }).catch((e) => toast(e.message)); return; }
    const L = cache.lb, medal = (i) => i < 3 ? ['🥇', '🥈', '🥉'][i] : `<b>${i + 1}</b>`;
    const col = (title, icon, list, val) => `<div class="card"><div class="h4"><i class="fas ${icon}"></i> ${title}</div>${list.map((x, i) => `<div class="mc-rank"><span class="mc-medal">${medal(i)}</span><div><b>${esc(x.name)}</b> ${sampleTag(x)}<small>${val(x)}</small></div></div>`).join('') || '<div class="hint mt">还没有人上榜，第一个就是你</div>'}</div>`;
    b.innerHTML = `<div class="mc-cols">${col('献策达人总榜', 'fa-crown', L.all, (x) => `累计 ${x.earned} 智点 · ${x.ideas ?? 0} 份献策 · ${x.adopted ?? 0} 份被采纳`)}${col('近 30 天新星', 'fa-bolt', L.month, (x) => `30 天获得 ${x.earned} 智点`)}${col('共享先锋企业', 'fa-share-nodes', L.sharers, (x) => `${x.n} 个方案 · 被同行使用 ${x.uses} 次`)}</div>`;
  }

  // ---------------- ⑤ 我的智点 ----------------
  const KIND = { submit: '提交献策', like: '获得点赞', reply: '企业回复', adopt: '被采纳奖励', bounty: '征集令悬赏', tip: '企业打赏', done: '落地验收', feature: '入选精选', share: '共享方案', use: '方案被使用', royalty: '方案分成', buy: '购买方案', grant: '入驻礼包', escrow: '悬赏托管', refund: '托管退回' };
  function wallet(b) {
    if (!rules) api('/rules').then((r) => { rules = r.rules; rerender(); }).catch(() => { });
    if (!cache.w) { b.innerHTML = '<div class="hint"><i class="fas fa-spinner fa-spin"></i> 加载中…</div>'; Promise.all([api('/wallet', { uid: uid() }), co() ? api('/wallet', { co: co() }) : null]).then(([u, c]) => { cache.w = { u, c }; rerender(); }).catch((e) => toast(e.message)); return; }
    const card = (t, icon, w, extra = '') => `<div class="mc-wallet"><div class="mc-wtop"><span><i class="fas ${icon}"></i> ${t}</span>${extra}</div><b>${w.balance.toLocaleString()}</b><small>智点余额</small><div class="mc-wsub"><span>累计获得 <b>${w.earned}</b></span><span>累计使用 <b>${w.spent}</b></span>${w.rank ? `<span>排名 <b>#${w.rank}</b></span>` : ''}</div></div>`;
    const led = (w) => w.ledger.map((x) => `<div class="mc-led"><span class="tag ${x.delta > 0 ? 'ok' : 'warn'}">${KIND[x.kind] || x.kind}</span><div>${esc(x.note)}<small>${new Date(x.at).toLocaleString('zh-CN', { hour12: false }).slice(0, 16)}</small></div><b class="${x.delta > 0 ? 'up' : 'down'}">${x.delta > 0 ? '+' : ''}${x.delta}</b></div>`).join('') || '<div class="hint mt">还没有记录，去献一策吧</div>';
    b.innerHTML = `<div class="mc-cols two"><div>${card('个人智点', 'fa-user', cache.w.u)}<div class="card mt"><div class="h4">个人明细</div>${led(cache.w.u)}</div></div>
      <div>${cache.w.c ? card(`企业智点 · ${esc(S.network.name)}`, 'fa-building', cache.w.c) + `<div class="card mt"><div class="h4">企业明细</div>${led(cache.w.c)}</div>` : `<div class="card"><div class="h4"><i class="fas fa-building"></i> 企业智点</div><p class="hint mt">企业入驻献策网络后获得 1000 智点礼包，可用于发布征集令、打赏好点子、购买同行方案。</p><button class="btn btn-ghost btn-sm mt" id="w-join">去入驻</button></div>`}
        <div class="card mt"><div class="h4"><i class="fas fa-circle-question" style="color:var(--c1)"></i> 智点怎么赚、怎么用</div>${rules ? `<div class="mc-rules">${Object.entries(rules).map(([k, r]) => `<div><b>${r.name}</b><span>${r.pts ? '+' + r.pts : r.rate ? Math.round(r.rate * 100) + '%' : ''}</span><small>${r.desc}</small></div>`).join('')}</div>` : ''}
          <div class="hint mt">智点是平台内的激励积分，可用于发布征集令、打赏、购买同行方案和兑换平台服务，<b>不可提现</b>。征集令里写明的现金 / 实物奖励由企业与提案人线下约定兑现，平台不经手资金。</div></div></div></div>`;
    on(b, '#w-join', () => openIdeas(null, 'inbox'));
  }

  // ---------------- 入口 ----------------
  window.MOD_PAGES = window.MOD_PAGES || {};
  window.MOD_PAGES.market = (p) => { delete p.dataset.overlay; cache = {}; render(p); };
  window.openMarket = function (t) {
    if (t) tab = t; cache = {};
    document.querySelector('.ideas-overlay')?.remove();
    const o = document.createElement('div'); o.className = 'ideas-overlay';
    o.innerHTML = '<section class="page ideas-page mkt-page" data-overlay="1"></section>';
    document.body.appendChild(o); render(o.firstChild);
  };
  window.Market = { shareFromArchive: (rec) => shareModal({}, rec), api, uid, refresh: () => { cache = {}; rerender(); } };
})();
