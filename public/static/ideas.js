// 智导 · 献策网络：①为我的企业出主意（交给智脑执行） ②向指定企业献策（已入驻直推收件箱 / 未入驻按公开邮箱代发）
(function () {
  const UIDK = 'ebrain_uid', DRAFTK = 'ebrain_idea_draft';
  const uid = () => { let v = localStorage.getItem(UIDK); if (!v) { v = 'u_' + Math.random().toString(36).slice(2, 12); localStorage.setItem(UIDK, v); } return v; };
  const CATS = ['产品创意', '营销活动', '商业模式', '用户体验', '游戏玩法', '降本增效', '品牌联名', '社会公益'];
  const HOT = ['米哈游', '小米', '蔚来', '瑞幸咖啡', '泡泡玛特', '名创优品', '比亚迪', '网易游戏'];
  const ST = { delivered: ['已送达企业收件箱', 'ok'], emailed: ['已代发邮件', 'ok'], saved: ['公开献策 · 待企业入驻认领', 'p'], read: ['企业已读', ''], adopted: ['企业已采纳', 'ok'], replied: ['企业已回复', 'ok'], declined: ['企业婉拒', 'bad'], done: ['已落地执行', 'ok'] };
  const CH = { inbox: ['fa-inbox', '直推收件箱'], email: ['fa-envelope', '邮件代发'], public: ['fa-globe', '公开献策'] };
  let D = (() => { try { return JSON.parse(localStorage.getItem(DRAFTK)) || {}; } catch { return {}; } })();
  D = Object.assign({ tab: 'make', mode: 'other', q: '', target: null, cat: '产品创意', idea: '', nick: '', contact: '', res: null, fb: '', via: '', emailTo: '', consent: false, sent: null }, D);
  let busy = '', mine = null, stats = null, inbox = null, host = null;
  const save = () => { try { localStorage.setItem(DRAFTK, JSON.stringify(D)); } catch { } };
  const api = async (path, body, method = body ? 'POST' : 'GET') => {
    const headers = { 'Content-Type': 'application/json' }; const code = localStorage.getItem('ebrain_code'); if (code) headers['X-Brain-Code'] = code;
    const r = await fetch('/api/ideas' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await r.json(); } catch { }
    if (!r.ok || !j || j.ok === false) throw new Error(j?.error || `请求失败（${r.status}）`);
    return j;
  };
  const ai = () => window.AI && AI.on;
  const selfTarget = () => { const P = S.company?.profile || {}; return { name: S.company?.name || '我的企业', short: (S.company?.name || '').replace(/(股份有限公司|有限责任公司|有限公司)$/, ''), industry: `${S.industry?.name || ''}${S.industry?.div ? ' › ' + S.industry.div.name : ''}`, business: P.business || P.positioning || '', products: [], recent: [], audience: P.canvas?.['客户细分'] || '', pains: [...(P.risks || []), ...(P.domains || []).filter((d) => d.score < 65).map((d) => `${d.name}偏弱（${d.score} 分）${d.note ? '：' + d.note : ''}`)].slice(0, 4), opportunities: P.opportunities || [], ideaHints: (P.opportunities || []).slice(0, 3), emails: [], registered: S.network ? { id: S.network.id, name: S.network.name } : null, self: true }; };
  const rerender = () => { if (host && document.body.contains(host)) render(host); };

  // ---------------- 主渲染 ----------------
  function render(p) {
    host = p;
    const tabs = [['make', 'fa-lightbulb', '献策工作台'], ['mine', 'fa-paper-plane', '我的献策'], ['inbox', 'fa-inbox', '企业收件箱'], ['square', 'fa-fire', '献策广场']];
    p.innerHTML = `<div class="page-hd"><div class="ic" style="background:linear-gradient(135deg,#f59e0b,#ec4899)"><i class="fas fa-lightbulb"></i></div><div><div class="h2">智导 · 献策网络</div><div class="hint">人人都能给企业出主意：AI 帮你把一个念头写成专业策划案，并送到企业手里 —— 已入驻的直达企业收件箱，未入驻的按公开邮箱代发</div></div>
      <div class="flex" style="margin-left:auto;gap:8px"><button class="btn btn-ghost btn-sm" id="id-home"><i class="fas fa-house"></i>返回主页</button>${p.dataset.overlay ? '<button class="close-x" id="id-close" style="margin-left:0" title="关闭"><i class="fas fa-xmark"></i></button>' : ''}</div></div>
      <div class="id-tabs">${tabs.map(([k, i, n]) => `<button class="${D.tab === k ? 'on' : ''}" data-tab="${k}"><i class="fas ${i}"></i>${n}</button>`).join('')}</div>
      <div id="id-body" class="mt"></div>`;
    $$('[data-tab]', p).forEach((b) => b.onclick = () => { D.tab = b.dataset.tab; if (D.tab === 'inbox') inbox = null; if (D.tab === 'mine') mine = null; if (D.tab === 'square') stats = null; save(); render(p); });
    $('#id-home', p).onclick = () => goHome();
    const cx = $('#id-close', p); if (cx) cx.onclick = () => { p.closest('.ideas-overlay')?.remove(); history.replaceState(null, '', location.pathname); };
    const body = $('#id-body', p);
    ({ make, mine: mineTab, inbox: inboxTab, square })[D.tab](body);
  }

  // ---------------- ① 献策工作台 ----------------
  function make(b) {
    const T = D.target, R = D.res;
    const step = (n, title, inner, on) => `<section class="id-step ${on ? 'on' : 'off'}"><div class="id-n">${n}</div><div class="id-sc"><h3>${title}</h3>${on ? inner : ''}</div></section>`;
    const modeHtml = `<div class="id-modes">
      <button class="id-mode dir-a ${D.mode === 'self' ? 'on' : ''}" data-mode="self"><span class="id-dir">方向 A</span><i class="fas fa-building-circle-check"></i><b>为我的企业出主意</b><small>用你自己的想法解决自己企业的问题 —— 写成策划案后，一键交给企业智脑：深度研究 → 3 套方案 → 可行性校验 → 部门执行</small></button>
      <button class="id-mode dir-b ${D.mode === 'other' ? 'on' : ''}" data-mode="other"><span class="id-dir">方向 B</span><i class="fas fa-paper-plane"></i><b>向指定企业献策</b><small>想给米哈游、小米、瑞幸……出个好点子？选企业 → 写想法 → AI 成稿 → 送达（已入驻直推收件箱，未入驻按公开邮箱代发）</small></button></div>`;
    let tgt = '';
    if (D.mode === 'self') {
      tgt = S.launched && S.company?.name ? targetCard(selfTarget()) : `<div class="cmd-alert"><i class="fas fa-circle-info"></i> 还没有创建你的企业。先在向导里创建企业智脑，再回来为它出主意。<button class="btn btn-pri btn-sm" id="id-gowiz">去创建企业</button></div>`;
    } else {
      tgt = `<div class="flex"><input id="id-q" placeholder="输入企业名称，如：米哈游、泡泡玛特、蔚来汽车" value="${esc(D.q)}" style="flex:1"><button class="btn btn-pri" id="id-find" ${busy === 'target' ? 'disabled' : ''}><i class="fas ${busy === 'target' ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'}"></i>${busy === 'target' ? '全网识别中…' : '识别企业'}</button></div>
        <div class="id-hot">${HOT.map((x) => `<button data-hot="${x}">${x}</button>`).join('')}</div>
        ${busy === 'target' ? '<div class="hint mt"><i class="fas fa-spinner fa-spin"></i> 正在检索企业画像、近期动态、用户痛点与公开联系邮箱，约 30-60 秒…</div>' : ''}
        ${T && !T.self ? targetCard(T) : ''}`;
    }
    const curT = D.mode === 'self' ? (S.launched ? selfTarget() : null) : (T && !T.self ? T : null);
    const ideaHtml = `<div class="id-cats">${CATS.map((c) => `<button class="${D.cat === c ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('')}</div>
      <textarea id="id-idea" rows="5" placeholder="${D.mode === 'self' ? '用大白话写下你的想法，比如：我觉得我们可以把储能柜做成按月租赁，让小工厂也用得起…' : '用大白话写下你的想法，哪怕只有一句话，比如：给原神做一个和城市文旅联动的线下寻宝活动…'}">${esc(D.idea)}</textarea>
      ${(curT?.ideaHints || []).length ? `<div class="id-hints"><span class="dim">灵感：</span>${curT.ideaHints.map((h) => `<button data-hint="${esc(h)}">${esc(h)}</button>`).join('')}</div>` : ''}
      ${D.mode === 'other' ? `<div class="grid2 mt"><input id="id-nick" placeholder="你的署名（可匿名）" value="${esc(D.nick)}"><input id="id-contact" placeholder="联系方式（选填，企业想联系你时用）" value="${esc(D.contact)}"></div>` : ''}
      <div class="flex mt"><span class="hint" style="flex:1">AI 会保留你的核心想法，结合企业真实业务补全成一份完整策划案，并给出客观评分。</span><button class="btn btn-pri" id="id-write" ${busy === 'write' || !ai() ? 'disabled' : ''}><i class="fas ${busy === 'write' ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}"></i>${busy === 'write' ? 'AI 撰写中（约 1-2 分钟）…' : R ? '重新生成' : 'AI 写成策划案'}</button></div>
      ${!ai() ? '<div class="hint mt" style="color:var(--bad)">需要连接 Genspark 才能使用 AI 撰写</div>' : ''}`;
    const resHtml = R ? proposalCard(R) : '';
    const sendHtml = R ? deliverPanel(curT) : '';
    b.innerHTML = `<div class="id-wrap"><div class="id-main">
      ${step(1, '选择献策入口', modeHtml, true)}
      ${step(2, D.mode === 'self' ? '确认我的企业' : '选择要献策的企业', tgt, true)}
      ${step(3, '写下你的想法', ideaHtml, !!curT)}
      ${step(4, 'AI 策划案与评估', resHtml, !!R)}
      ${step(5, D.mode === 'self' ? '交给企业智脑执行' : '送达企业', sendHtml, !!R)}
      </div><aside class="id-side">${sideHelp()}</aside></div>`;
    bindMake(b, curT);
  }
  function targetCard(T) {
    const reg = T.registered;
    return `<div class="id-target">
      <div class="flex between"><div><b style="font-size:16px">${esc(T.name)}</b> <span class="dim">${esc(T.industry || '')}</span></div>
        ${T.self ? `<span class="tag ok"><i class="fas fa-crown"></i> 我的企业</span>` : reg ? `<span class="tag ok"><i class="fas fa-circle-check"></i> 已入驻 · 直推收件箱</span>` : (T.emails || []).length ? `<span class="tag warn"><i class="fas fa-envelope"></i> 未入驻 · 找到 ${T.emails.length} 个公开邮箱</span>` : `<span class="tag p"><i class="fas fa-globe"></i> 未入驻 · 未找到公开邮箱</span>`}</div>
      ${T.business ? `<p class="mt" style="font-size:13px">${esc(T.business)}</p>` : ''}
      ${(T.products || []).length ? `<div class="id-kv"><span>代表产品</span>${T.products.map((x) => `<em>${esc(x)}</em>`).join('')}</div>` : ''}
      ${(T.recent || []).length ? `<div class="id-kv"><span>近期动态</span><div>${T.recent.map((x) => `<div>▸ ${esc(x)}</div>`).join('')}</div></div>` : ''}
      ${(T.pains || []).length ? `<div class="id-kv"><span>痛点</span><div>${T.pains.map((x) => `<div>▸ ${esc(x)}</div>`).join('')}</div></div>` : ''}
      ${(T.opportunities || []).length ? `<div class="id-kv"><span>可献策方向</span>${T.opportunities.map((x) => `<em class="op">${esc(x)}</em>`).join('')}</div>` : ''}
      ${!T.self && (T.emails || []).length ? `<div class="id-kv"><span>公开邮箱</span><div>${T.emails.map((e) => `<div><code>${esc(e.email)}</code> <span class="tag">${esc(e.type)}</span> <small class="dim">来源：${e.source?.url ? `<a href="${esc(e.source.url)}" target="_blank" rel="noopener">${esc(e.source.title || '网页')}</a>` : esc(e.source?.title || '检索')}</small></div>`).join('')}</div></div>` : ''}
      ${!T.self && T.found === false ? '<div class="hint mt" style="color:var(--warn)">检索证据较少，画像可能不准确，建议输入更完整的企业名称</div>' : ''}</div>`;
  }
  function proposalCard(R) {
    const E = R.eval || {}, dim = [['novelty', '创新度'], ['fit', '契合度'], ['feasibility', '可行性'], ['value', '价值']];
    return `<div class="id-prop">
      <div class="id-prop-hd"><div><div class="id-title">${esc(R.title)}</div><div class="id-one">${esc(R.oneLiner)}</div><div class="mt">${(R.tags || []).map((t) => `<span class="tag p">${esc(t)}</span>`).join(' ')}</div></div>
        <div class="id-score"><div class="fs-ring ${E.total >= 80 ? 'ok' : E.total >= 65 ? 'warn' : 'bad'}" style="--p:${E.total || 0}"><b>${E.total || '—'}</b><small>AI 评分</small></div></div></div>
      <div class="id-dims">${dim.map(([k, n]) => `<div><span>${n}</span><i><em style="width:${E[k] || 0}%"></em></i><b>${E[k] ?? '—'}</b></div>`).join('')}</div>
      ${E.comment ? `<div class="fb-box mt"><b>AI 点评：</b>${esc(E.comment)}${(E.improve || []).length ? `<div class="mt">${E.improve.map((x) => `<div>▸ ${esc(x)}</div>`).join('')}</div>` : ''}</div>` : ''}
      <div class="md id-md mt">${mdRender(R.proposal)}</div>
      <div class="flex mt"><input id="id-fb" placeholder="不满意？写下修改意见，比如：更聚焦年轻用户 / 预算控制在 10 万以内" value="${esc(D.fb)}" style="flex:1"><button class="btn btn-ghost btn-sm" id="id-revise" ${busy ? 'disabled' : ''}><i class="fas fa-rotate"></i>按意见改一版</button><button class="btn btn-ghost btn-sm" id="id-copy"><i class="fas fa-copy"></i>复制</button></div></div>`;
  }
  function deliverPanel(T) {
    if (!T) return '';
    if (T.self) {
      return `<div class="id-deliver self"><i class="fas fa-brain"></i><div><b>交给企业智脑执行</b><small>这份策划案会作为一条老板指令进入调度中枢：深度研究验证可行性 → 3 套方案（以你的创意为主线）→ 七维可行性校验 → 你拍板 → 各部门大师执行，产出 Word / Excel / 创意 PPT。</small></div><button class="btn btn-pri" id="id-run"><i class="fas fa-rocket"></i>交给智脑执行</button></div>`;
    }
    const opts = [];
    if (T.registered) opts.push(['inbox', 'fa-inbox', `直推「${T.registered.name}」收件箱`, '企业已入驻智导，提案将即时出现在企业收件箱，企业可在线采纳、回复，并交给自己的智脑执行']);
    else if ((T.emails || []).length) opts.push(['email', 'fa-envelope', '邮件代发到企业公开邮箱', '由智导代你发送一封排版好的策划案邮件；同一企业邮箱 7 天内只代发 1 封，企业可一键退订']);
    opts.push(['public', 'fa-globe', '保存为公开献策', '先放进献策广场；企业日后入驻智导时，会自动出现在它的收件箱']);
    if (!opts.some((o) => o[0] === D.via)) D.via = opts[0][0];
    if (D.via === 'email' && !D.emailTo) D.emailTo = T.emails[0].email;
    if (D.sent && D.sent.target === T.name) {
      const s = D.sent, st = ST[s.status] || ['', 'p'];
      return `<div class="id-sent"><i class="fas ${CH[s.channel]?.[0] || 'fa-check'}"></i><div><b>${st[0]}</b><small>${esc(s.emailMsg || (s.channel === 'inbox' ? `已送达「${s.company?.name}」收件箱，企业处理后你会在「我的献策」看到状态变化` : '已保存为公开献策'))}</small><a class="lnk" href="${esc(s.view)}" target="_blank" rel="noopener">在线查看提案页 →</a></div><button class="btn btn-ghost btn-sm" id="id-new"><i class="fas fa-plus"></i>再献一策</button></div>`;
    }
    return `<div class="id-via">${opts.map(([k, i, n, d]) => `<label class="id-opt ${D.via === k ? 'on' : ''}"><input type="radio" name="id-via" value="${k}" ${D.via === k ? 'checked' : ''} hidden><i class="fas ${i}"></i><div><b>${n}</b><small>${d}</small></div></label>`).join('')}</div>
      ${D.via === 'email' ? `<div class="id-email mt"><div class="flex"><span class="hint">收件邮箱</span><select id="id-to" style="flex:1">${T.emails.map((e) => `<option value="${esc(e.email)}" ${D.emailTo === e.email ? 'selected' : ''}>${esc(e.email)}（${esc(e.type)}）</option>`).join('')}</select></div>
        <label class="chk mt"><input type="checkbox" id="id-consent" ${D.consent ? 'checked' : ''}> 我确认这是我本人的原创想法，同意以「${esc(D.nick || '匿名用户')}」的名义，由智导代发到该企业的<b>公开</b>邮箱</label></div>` : ''}
      <div class="flex mt"><span class="hint" style="flex:1">${D.via === 'email' ? '邮件包含：策划案全文、AI 评分、你的署名与联系方式、在线查看与退订链接。' : ''}</span><button class="btn btn-pri" id="id-send" ${busy === 'submit' || (D.via === 'email' && !D.consent) ? 'disabled' : ''}><i class="fas ${busy === 'submit' ? 'fa-spinner fa-spin' : 'fa-paper-plane'}"></i>${busy === 'submit' ? '投递中…' : '确认送达'}</button></div>`;
  }
  function sideHelp() {
    return `<div class="card"><div class="h4"><i class="fas fa-route" style="color:#f59e0b"></i> 投递规则</div>
      <div class="id-rule"><i class="fas fa-inbox" style="color:var(--ok)"></i><div><b>企业已入驻</b><small>直推企业收件箱，企业可采纳、回复，并一键交给它自己的智脑执行；状态实时回到「我的献策」</small></div></div>
      <div class="id-rule"><i class="fas fa-envelope" style="color:#d97706"></i><div><b>未入驻 · 找到公开邮箱</b><small>你勾选确认后由智导代发邮件。只用公开渠道邮箱；同一邮箱 7 天限 1 封；全站每日限量；企业可退订</small></div></div>
      <div class="id-rule"><i class="fas fa-globe" style="color:var(--c1)"></i><div><b>未入驻 · 没找到邮箱</b><small>保存为公开献策；企业入驻时自动认领到收件箱</small></div></div></div>
      <div class="card mt"><div class="h4"><i class="fas fa-shield-halved" style="color:var(--c2)"></i> 原则</div><div class="hint" style="line-height:1.8">· 只投递你的原创想法，不冒用他人<br>· 不承诺企业一定采纳或付费<br>· 涉及采用与知识产权，由你和企业直接沟通<br>· 每人每天最多 5 份献策</div></div>
      ${S.launched ? `<div class="card mt"><div class="h4"><i class="fas fa-building" style="color:var(--ok)"></i> 我的企业${S.network ? '已入驻' : '尚未入驻'}</div><div class="hint mt">${S.network ? `「${esc(S.network.name)}」正在接收用户献策，去「企业收件箱」查看` : '入驻后，用户写给你企业的点子会直达收件箱'}</div>${S.network ? '' : '<button class="btn btn-ghost btn-sm mt" data-tab2="inbox"><i class="fas fa-right-to-bracket"></i>入驻献策网络</button>'}</div>` : ''}`;
  }
  function bindMake(b, curT) {
    const on = (sel, fn, ev = 'onclick') => { const el = $(sel, b); if (el) el[ev] = fn; };
    $$('[data-mode]', b).forEach((x) => x.onclick = () => { if (D.mode !== x.dataset.mode) { D.mode = x.dataset.mode; D.res = null; D.sent = null; } save(); rerender(); });
    $$('[data-tab2]', b).forEach((x) => x.onclick = () => { D.tab = x.dataset.tab2; save(); rerender(); });
    on('#id-gowiz', () => enterBrain());
    const find = async () => {
      const q = ($('#id-q', b)?.value || '').trim(); if (!q) return toast('请输入企业名称');
      if (!ai()) return toast('需要连接 Genspark 才能识别企业');
      D.q = q; busy = 'target'; D.target = null; D.res = null; D.sent = null; save(); rerender();
      try { const r = await AI.call('/idea/target', { name: q, engine: roleModel('research') }); D.target = r; }
      catch (e) { toast('识别失败：' + e.message, 'fa-triangle-exclamation'); }
      busy = ''; save(); rerender();
    };
    on('#id-find', find);
    const qi = $('#id-q', b); if (qi) qi.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); find(); } });
    $$('[data-hot]', b).forEach((x) => x.onclick = () => { $('#id-q', b).value = x.dataset.hot; find(); });
    $$('[data-cat]', b).forEach((x) => x.onclick = () => { D.cat = x.dataset.cat; keep(b); save(); rerender(); });
    $$('[data-hint]', b).forEach((x) => x.onclick = () => { const t = $('#id-idea', b); t.value = (t.value ? t.value + '\n' : '') + x.dataset.hint; keep(b); save(); });
    ['#id-idea', '#id-nick', '#id-contact', '#id-fb'].forEach((s) => { const el = $(s, b); if (el) el.addEventListener('input', () => { keep(b); save(); }); });
    const write = async (revise) => {
      keep(b); if (!D.idea.trim()) return toast('先写下你的想法');
      busy = 'write'; D.sent = null; save(); rerender();
      try { const r = await AI.call('/idea/write', { target: curT, idea: D.idea, category: D.cat, self: D.mode === 'self', engine: roleModel('strategy'), feedback: revise ? D.fb : '', previous: revise ? D.res?.proposal : '' }); D.res = r; if (revise) D.fb = ''; }
      catch (e) { toast('撰写失败：' + e.message, 'fa-triangle-exclamation'); }
      busy = ''; save(); rerender();
      setTimeout(() => $('.id-prop', host)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    };
    on('#id-write', () => write(false));
    on('#id-revise', () => { keep(b); if (!D.fb.trim()) return toast('先写下修改意见'); write(true); });
    on('#id-copy', () => { navigator.clipboard?.writeText(`# ${D.res.title}\n\n${D.res.proposal}`); toast('已复制策划案'); });
    $$('[name=id-via]', b).forEach((r) => r.onchange = () => { D.via = r.value; save(); rerender(); });
    on('#id-to', (e) => { D.emailTo = e.target.value; save(); }, 'onchange');
    on('#id-consent', (e) => { D.consent = e.target.checked; save(); rerender(); }, 'onchange');
    on('#id-new', () => { D.res = null; D.idea = ''; D.sent = null; D.consent = false; save(); rerender(); });
    on('#id-send', async () => {
      keep(b); busy = 'submit'; rerender();
      try {
        const r = await api('/submit', { uid: uid(), nickname: D.nick, contact: D.contact, target: curT, category: D.cat, title: D.res.title, oneLiner: D.res.oneLiner, proposal: D.res.proposal, eval: D.res.eval, emailTo: D.via === 'email' ? D.emailTo : '', emailSource: D.via === 'email' ? (curT.emails.find((e) => e.email === D.emailTo)?.source?.url || '') : '', consent: D.via === 'email' && D.consent, emailSubject: D.res.email?.subject, emailOpening: D.res.email?.opening });
        D.sent = { ...r, target: curT.name }; mine = null;
        toast(r.channel === 'inbox' ? '已直推企业收件箱 🎯' : r.channel === 'email' ? '邮件已代发 ✉️' : (r.emailMsg || '已保存为公开献策'), 'fa-paper-plane');
      } catch (e) { toast('投递失败：' + e.message, 'fa-triangle-exclamation'); }
      busy = ''; save(); rerender();
    });
    on('#id-run', () => {
      if (!S.launched || !window.Flow) return toast('请先创建企业智脑');
      if (!S.sim) enterBrain();
      const c = Flow.issue(`落地创意提案：${D.res.title}`, { idea: `# ${D.res.title}\n${D.res.oneLiner}\n\n${D.res.proposal}`, ideaBy: '老板本人' });
      if (c) { toast(`已作为指令 #${c.no} 交给智脑：先做深度研究验证你的创意`, 'fa-rocket'); D.res = null; D.idea = ''; save(); enterBrain('flow'); }
    });
  }
  const keep = (b) => { const v = (s) => $(s, b)?.value; if (v('#id-idea') != null) D.idea = v('#id-idea'); if (v('#id-nick') != null) D.nick = v('#id-nick'); if (v('#id-contact') != null) D.contact = v('#id-contact'); if (v('#id-fb') != null) D.fb = v('#id-fb'); };

  // ---------------- ② 我的献策 ----------------
  function mineTab(b) {
    if (!mine) { b.innerHTML = '<div class="hint"><i class="fas fa-spinner fa-spin"></i> 加载中…</div>'; api('/mine?uid=' + uid()).then((r) => { mine = r.ideas; rerender(); }).catch((e) => { b.innerHTML = `<div class="hint">加载失败：${esc(e.message)}</div>`; }); return; }
    if (!mine.length) { b.innerHTML = '<div class="empty-state" style="height:300px"><div><i class="fas fa-paper-plane" style="font-size:36px"></i><p class="mt">还没有献策</p><p class="hint">去「献策工作台」给你喜欢的企业出个好主意吧</p></div></div>'; return; }
    const cnt = (f) => mine.filter(f).length;
    b.innerHTML = `<div class="grid4"><div class="stat"><div class="l">我的献策</div><div class="v">${mine.length}</div></div><div class="stat"><div class="l">已送达企业</div><div class="v">${cnt((x) => x.channel !== 'public')}</div></div><div class="stat"><div class="l">企业已采纳</div><div class="v" style="color:var(--ok)">${cnt((x) => ['adopted', 'done'].includes(x.status))}</div></div><div class="stat"><div class="l">企业回复</div><div class="v">${cnt((x) => x.reply)}</div></div></div>
      <div class="id-list mt">${mine.map((x) => { const st = ST[x.status] || [x.status, 'p']; return `<article class="id-item"><div class="flex between"><div><span class="tag"><i class="fas ${CH[x.channel]?.[0]}"></i> ${CH[x.channel]?.[1]}</span> <b>→ ${esc(x.target)}</b> <span class="dim">· ${esc(x.category || '')} · ${new Date(x.createdAt).toLocaleString('zh-CN', { hour12: false }).slice(0, 16)}</span></div><span class="tag ${st[1]}">${st[0]}</span></div>
        <div class="id-it-t">${esc(x.title)}</div><div class="hint">${esc(x.oneLiner || '')}</div>
        ${x.emailMsg ? `<div class="hint mt"><i class="fas fa-envelope"></i> ${esc(x.emailTo ? x.emailTo + ' · ' : '')}${esc(x.emailMsg)}</div>` : ''}
        ${x.reply ? `<div class="fb-box ok mt"><b>企业回复：</b>${esc(x.reply)}</div>` : ''}
        ${x.cmdNo ? `<div class="hint mt"><i class="fas fa-brain"></i> 企业已将你的提案交给智脑执行（指令 #${x.cmdNo}${x.cmdScore != null ? ` · 验收 ${x.cmdScore} 分` : ''}）</div>` : ''}
        <div class="flex mt"><span class="dim" style="font-size:12px">AI 评分 ${x.eval?.total ?? '—'}</span><a class="lnk" href="/api/ideas/view/${x.id}" target="_blank" rel="noopener" style="margin-left:auto">查看提案页 →</a></div></article>`; }).join('')}</div>`;
  }

  // ---------------- ③ 企业收件箱 ----------------
  function inboxTab(b) {
    const N = S.network;
    if (!N) {
      const nm = S.company?.name || '', P = S.company?.profile || {};
      b.innerHTML = `<div class="grid2"><div class="card"><div class="h3"><i class="fas fa-building-circle-arrow-right" style="color:var(--ok)"></i> 入驻献策网络</div><div class="hint mt">入驻后，所有用户写给贵司的点子（包括入驻前的公开献策）都会进入收件箱；你可以采纳、回复，并一键交给企业智脑执行。</div>
        <div class="col mt" style="gap:8px"><input id="nw-name" placeholder="企业全称" value="${esc(nm)}"><input id="nw-alias" placeholder="简称 / 品牌名（逗号分隔，用于匹配用户的献策）" value="${esc(nm.replace(/(股份有限公司|有限责任公司|有限公司|科技|集团)/g, ''))}"><input id="nw-email" placeholder="接收通知的邮箱（选填）"></div>
        <button class="btn btn-pri mt" id="nw-reg"><i class="fas fa-check"></i>入驻并开通收件箱</button></div>
        <div class="card"><div class="h3"><i class="fas fa-key" style="color:var(--c2)"></i> 已入驻？用企业密钥登录</div><div class="hint mt">企业密钥在入驻时生成，请妥善保存。</div><div class="flex mt"><input id="nw-token" placeholder="tk_xxxxxxxx" style="flex:1"><button class="btn btn-ghost" id="nw-login">登录</button></div></div></div>`;
      $('#nw-reg', b).onclick = async () => {
        try { const r = await api('/company/register', { name: $('#nw-name', b).value, alias: $('#nw-alias', b).value, email: $('#nw-email', b).value, industry: S.industry?.name || '', business: P.business || '' }); S.network = { id: r.id, token: r.token, name: r.name }; saveState(); inbox = null; toast(`入驻成功${r.claimed ? `，认领了 ${r.claimed} 份历史献策` : ''}`, 'fa-building-circle-check'); openModal(`<div class="h2">入驻成功 🎉</div><p class="mt">请保存企业密钥（换设备登录收件箱时使用）：</p><div class="id-token">${esc(r.token)}</div><button class="btn btn-pri mt" data-close>我已保存</button>`); rerender(); }
        catch (e) { toast(e.message, 'fa-triangle-exclamation'); }
      };
      $('#nw-login', b).onclick = async () => { const t = $('#nw-token', b).value.trim(); try { const r = await api('/company/login', { token: t }); S.network = { id: r.company.id, token: t, name: r.company.name }; saveState(); inbox = null; rerender(); } catch (e) { toast(e.message, 'fa-triangle-exclamation'); } };
      return;
    }
    if (!inbox) { b.innerHTML = '<div class="hint"><i class="fas fa-spinner fa-spin"></i> 加载收件箱…</div>'; api('/company/inbox', { id: N.id, token: N.token }).then((r) => { inbox = r.ideas; rerender(); }).catch((e) => { b.innerHTML = `<div class="hint">加载失败：${esc(e.message)} <button class="btn btn-ghost btn-sm" id="nw-out">退出企业身份</button></div>`; $('#nw-out', b).onclick = () => { S.network = null; saveState(); rerender(); }; }); return; }
    const cnt = (f) => inbox.filter(f).length;
    b.innerHTML = `<div class="flex between"><div class="h3"><i class="fas fa-inbox" style="color:var(--ok)"></i> ${esc(N.name)} · 用户献策收件箱</div><div class="flex"><button class="btn btn-ghost btn-sm" id="nw-ref"><i class="fas fa-rotate"></i>刷新</button><button class="btn btn-ghost btn-sm" id="nw-out">退出企业身份</button></div></div>
      <div class="grid4 mt"><div class="stat"><div class="l">收到献策</div><div class="v">${inbox.length}</div></div><div class="stat"><div class="l">待处理</div><div class="v" style="color:var(--warn)">${cnt((x) => ['delivered', 'saved', 'emailed'].includes(x.status))}</div></div><div class="stat"><div class="l">已采纳</div><div class="v" style="color:var(--ok)">${cnt((x) => ['adopted', 'done'].includes(x.status))}</div></div><div class="stat"><div class="l">平均 AI 评分</div><div class="v">${inbox.length ? Math.round(inbox.reduce((a, x) => a + (x.eval?.total || 0), 0) / inbox.length) : '—'}</div></div></div>
      ${inbox.length ? `<div class="id-list mt">${inbox.map((x) => { const st = ST[x.status] || [x.status, 'p']; return `<article class="id-item inbox" data-iid="${x.id}"><div class="flex between"><div><b>${esc(x.title)}</b> <span class="dim">· 来自 ${esc(x.nickname)}${x.contact ? `（${esc(x.contact)}）` : ''} · ${esc(x.category || '')} · ${new Date(x.createdAt).toLocaleDateString('zh-CN')}</span></div><div class="flex"><span class="tag">AI ${x.eval?.total ?? '—'}</span><span class="tag ${st[1]}">${st[0]}</span></div></div>
        <div class="hint mt">${esc(x.oneLiner || '')}</div>
        <details class="mt"><summary class="lnk">展开策划案全文</summary><div class="md id-md mt">${mdRender(x.proposal || '')}</div></details>
        ${x.reply ? `<div class="fb-box ok mt"><b>已回复：</b>${esc(x.reply)}</div>` : ''}
        ${x.cmdNo ? `<div class="hint mt"><i class="fas fa-brain"></i> 已交给智脑执行：指令 #${x.cmdNo}${x.cmdScore != null ? ` · 验收 ${x.cmdScore} 分` : ''}</div>` : ''}
        <div class="flex mt wrap"><button class="btn btn-pri btn-sm" data-act="run"><i class="fas fa-rocket"></i>采纳并交给智脑执行</button><button class="btn btn-ghost btn-sm" data-act="reply"><i class="fas fa-reply"></i>回复提案人</button><button class="btn btn-ghost btn-sm" data-act="adopted"><i class="fas fa-thumbs-up"></i>标记采纳</button><button class="btn btn-ghost btn-sm" data-act="declined"><i class="fas fa-hand"></i>婉拒</button></div></article>`; }).join('')}</div>` : '<div class="empty-state" style="height:240px"><div><i class="fas fa-inbox" style="font-size:36px"></i><p class="mt">还没有收到献策</p><p class="hint">把智导献策入口分享给你的用户，他们的点子会出现在这里</p></div></div>'}`;
    $('#nw-ref', b).onclick = () => { inbox = null; rerender(); };
    $('#nw-out', b).onclick = () => { if (confirm('退出后需用企业密钥重新登录，确定？')) { S.network = null; inbox = null; saveState(); rerender(); } };
    $$('[data-act]', b).forEach((btn) => btn.onclick = async () => {
      const x = inbox.find((i) => i.id === btn.closest('[data-iid]').dataset.iid), act = btn.dataset.act;
      const upd = (o) => api('/company/update', { id: N.id, token: N.token, ideaId: x.id, ...o });
      try {
        if (act === 'reply') { const v = prompt('回复提案人：', '感谢你的创意！我们已认真阅读，'); if (!v) return; await upd({ reply: v, status: x.status === 'adopted' || x.status === 'done' ? x.status : 'replied' }); }
        else if (act === 'run') {
          if (!S.launched || !window.Flow) return toast('请先创建企业智脑');
          if (!S.sim) { enterBrain(); $('.ideas-overlay') || openIdeas(null, 'inbox'); }
          const c = Flow.issue(`落地用户献策：${x.title}`, { idea: `# ${x.title}\n${x.oneLiner || ''}\n\n${x.proposal}`, ideaBy: `用户「${x.nickname}」`, ideaRef: x.id });
          if (!c) return; await upd({ status: 'adopted', cmdNo: c.no }); toast(`已采纳并作为指令 #${c.no} 交给智脑`, 'fa-rocket'); enterBrain('flow');
        } else await upd({ status: act });
        inbox = null; rerender();
      } catch (e) { toast(e.message, 'fa-triangle-exclamation'); }
    });
  }

  // ---------------- ④ 献策广场 ----------------
  function square(b) {
    if (!stats) { b.innerHTML = '<div class="hint"><i class="fas fa-spinner fa-spin"></i> 加载中…</div>'; api('/stats').then((r) => { stats = r; rerender(); setTimeout(() => { stats = null; }, 20000); }).catch((e) => { b.innerHTML = `<div class="hint">加载失败：${esc(e.message)}</div>`; }); return; }
    const s = stats;
    b.innerHTML = `<div class="grid3"><div class="stat"><div class="l"><i class="fas fa-lightbulb" style="color:#f59e0b"></i> 全站献策</div><div class="v">${s.ideas}</div></div><div class="stat"><div class="l"><i class="fas fa-building" style="color:var(--ok)"></i> 入驻企业</div><div class="v">${s.companies}</div></div><div class="stat"><div class="l"><i class="fas fa-thumbs-up" style="color:var(--c1)"></i> 被企业采纳</div><div class="v">${s.adopted}</div></div></div>
      <div class="grid2 mt"><div class="card"><div class="h3"><i class="fas fa-fire" style="color:#ef4444"></i> 最受关注的企业</div>${(s.hot || []).length ? s.hot.map((h, i) => `<div class="id-hotrow" data-go="${esc(h.name)}"><b>${i + 1}</b><span>${esc(h.name)}</span><em>${h.n} 份献策</em><button class="btn btn-ghost btn-sm">我也献一策</button></div>`).join('') : '<div class="hint mt">暂无</div>'}</div>
        <div class="card"><div class="h3"><i class="fas fa-bolt" style="color:#f59e0b"></i> 最新献策</div>${(s.recent || []).length ? s.recent.map((r) => `<div class="id-recent"><span class="tag ${(ST[r.status] || [, 'p'])[1]}">${(ST[r.status] || [r.status])[0]}</span><div><b>${esc(r.title)}</b><small>${esc(r.nickname)} → ${esc(r.target)} · ${esc(r.category || '')}</small></div></div>`).join('') : '<div class="hint mt">暂无</div>'}</div></div>`;
    $$('[data-go]', b).forEach((x) => x.onclick = () => { D.tab = 'make'; D.mode = 'other'; D.q = x.dataset.go; D.target = null; D.res = null; D.sent = null; save(); rerender(); setTimeout(() => $('#id-find', host)?.click(), 50); });
  }

  // ---------------- 入口 ----------------
  window.MOD_PAGES = window.MOD_PAGES || {};
  window.MOD_PAGES.ideas = (p) => { delete p.dataset.overlay; render(p); };
  window.openIdeas = function (mode, tab) {
    if (mode) { D.mode = mode; D.tab = 'make'; }
    if (tab) D.tab = tab;
    save();
    document.querySelector('.ideas-overlay')?.remove();
    const o = document.createElement('div'); o.className = 'ideas-overlay';
    o.innerHTML = '<section class="page ideas-page" data-overlay="1"></section>';
    document.body.appendChild(o);
    render(o.firstChild);
  };
  window.ideaReload = () => { try { D = Object.assign(D, JSON.parse(localStorage.getItem(DRAFTK)) || {}); } catch { } rerender(); };
  window.ideaPrefill = (v) => { D.idea = String(v || ''); save(); rerender(); };
  // 指令完成后，把执行结果回写到献策（企业收件箱 / 提案人可见）
  window.ideaCmdDone = function (c) {
    if (!c?.ideaRef || !S.network) return;
    api('/company/update', { id: S.network.id, token: S.network.token, ideaId: c.ideaRef, status: 'done', cmdNo: c.no, cmdScore: c.acceptance?.score ?? null }).catch(() => { });
  };
})();
