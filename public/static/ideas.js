// 智导 · 献策网络：①为我的企业出主意（交给智脑执行） ②向指定企业献策（已入驻直推收件箱 / 未入驻按公开邮箱代发）
(function () {
  const UIDK = 'ebrain_uid', DRAFTK = 'ebrain_idea_draft';
  const uid = () => { let v = localStorage.getItem(UIDK); if (!v) { v = 'u_' + Math.random().toString(36).slice(2, 12); localStorage.setItem(UIDK, v); } return v; };
  const CATS = ['产品创意', '营销活动', '商业模式', '用户体验', '游戏玩法', '降本增效', '品牌联名', '社会公益'];
  const HOT = ['米哈游', '小米', '蔚来', '瑞幸咖啡', '泡泡玛特', '名创优品', '比亚迪', '网易游戏'];
  const ST = { delivered: ['已送达企业收件箱', 'ok'], emailed: ['已代发邮件', 'ok'], saved: ['公开献策 · 待企业入驻认领', 'p'], read: ['企业已读', ''], adopted: ['企业已采纳', 'ok'], replied: ['企业已回复', 'ok'], declined: ['企业婉拒', 'bad'], done: ['已落地执行', 'ok'] };
  const KINDS = [['proposal', 'fa-file-lines', '策划案', '完整方案：为什么做、怎么做、价值多大'], ['suggestion', 'fa-comment-dots', '改进建议', '指出问题 + 给出可执行的改进'], ['design', 'fa-palette', '设计思路', '视觉概念 + AI 生成设计稿']];
  const KN = Object.fromEntries(KINDS.map(([k, i, n]) => [k, [i, n]]));
  const CH = { inbox: ['fa-inbox', '直推收件箱'], email: ['fa-envelope', '邮件代发'], public: ['fa-globe', '公开献策'] };
  let D = (() => { try { return JSON.parse(localStorage.getItem(DRAFTK)) || {}; } catch { return {}; } })();
  D = Object.assign({ tab: 'make', mode: 'other', q: '', target: null, cat: '产品创意', kind: 'proposal', listed: true, idea: '', nick: '', contact: '', res: null, fb: '', via: '', emailTo: '', consent: false, sent: null }, D);
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
      <div class="id-tabs">${tabs.map(([k, i, n]) => `<button class="${D.tab === k ? 'on' : ''}" data-tab="${k}"><i class="fas ${i}"></i>${n}</button>`).join('')}<button class="id-tab-mkt" data-mkt><i class="fas fa-handshake"></i>撮合中心 · 悬赏征集</button></div>
      <div id="id-body" class="mt"></div>`;
    const mb = $('[data-mkt]', p); if (mb) mb.onclick = () => window.openMarket && openMarket('challenges');
    $$('[data-tab]', p).forEach((b) => b.onclick = () => { D.tab = b.dataset.tab; if (D.tab === 'inbox') inbox = null; if (D.tab === 'mine') mine = null; if (D.tab === 'square') { stats = null; mk.list = null; } save(); render(p); });
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
      tgt = (D.challenge ? `<div class="id-chal"><i class="fas fa-trophy"></i><div><b>正在应征：${esc(D.challenge.title)}</b><small>${esc(D.challenge.company)} · ${D.challenge.rewardPoints ? D.challenge.rewardPoints + ' 智点悬赏' : '荣誉征集'}${D.challenge.rewardCash ? ' · ' + esc(D.challenge.rewardCash) : ''}</small><p>${esc(D.challenge.problem)}</p></div><button class="btn btn-ghost btn-sm" id="id-chal-x">不应征了</button></div>` : '') + `<div class="flex"><input id="id-q" placeholder="输入企业名称，如：米哈游、泡泡玛特、蔚来汽车" value="${esc(D.q)}" style="flex:1"><button class="btn btn-pri" id="id-find" ${busy === 'target' ? 'disabled' : ''}><i class="fas ${busy === 'target' ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'}"></i>${busy === 'target' ? '全网识别中…' : '识别企业'}</button></div>
        <div class="id-hot">${HOT.map((x) => `<button data-hot="${x}">${x}</button>`).join('')}</div>
        ${busy === 'target' ? '<div class="hint mt"><i class="fas fa-spinner fa-spin"></i> 正在检索企业画像、近期动态、用户痛点与公开联系邮箱，约 30-60 秒…</div>' : ''}
        ${T && !T.self ? targetCard(T) : ''}`;
    }
    const curT = D.mode === 'self' ? (S.launched ? selfTarget() : null) : (T && !T.self ? T : null);
    const ideaHtml = `<div class="id-kinds">${KINDS.map(([k, i, n, d]) => `<button class="id-kind ${D.kind === k ? 'on' : ''}" data-kind="${k}"><i class="fas ${i}"></i><b>${n}</b><small>${d}</small></button>`).join('')}</div>
      <div class="id-cats">${CATS.map((c) => `<button class="${D.cat === c ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('')}</div>
      <textarea id="id-idea" rows="5" placeholder="${D.mode === 'self' ? '用大白话写下你的想法，比如：我觉得我们可以把储能柜做成按月租赁，让小工厂也用得起…' : '用大白话写下你的想法，哪怕只有一句话，比如：给原神做一个和城市文旅联动的线下寻宝活动…'}">${esc(D.idea)}</textarea>
      ${(curT?.ideaHints || []).length ? `<div class="id-hints"><span class="dim">灵感：</span>${curT.ideaHints.map((h) => `<button data-hint="${esc(h)}">${esc(h)}</button>`).join('')}</div>` : ''}
      ${D.mode === 'other' ? `<div class="grid2 mt"><input id="id-nick" placeholder="你的署名（可匿名）" value="${esc(D.nick)}"><input id="id-contact" placeholder="联系方式（选填，企业想联系你时用）" value="${esc(D.contact)}"></div>` : ''}
      <div class="flex mt"><span class="hint" style="flex:1">AI 会保留你的核心想法，结合企业真实业务补全成一份完整策划案，并给出客观评分。</span><button class="btn btn-pri" id="id-write" ${busy === 'write' || !ai() ? 'disabled' : ''}><i class="fas ${busy === 'write' ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}"></i>${busy === 'write' ? 'AI 撰写中（约 1-2 分钟）…' : R ? '重新生成' : `AI 写成${KN[D.kind][1]}`}</button></div>
      ${!ai() ? '<div class="hint mt" style="color:var(--bad)">需要连接 AI 才能撰写</div>' : ''}`;
    const resHtml = R ? proposalCard(R) : '';
    const sendHtml = R ? deliverPanel(curT) : '';
    b.innerHTML = `<div class="id-wrap"><div class="id-main">
      ${step(1, '选择献策入口', modeHtml, true)}
      ${step(2, D.mode === 'self' ? '确认我的企业' : '选择要献策的企业', tgt, true)}
      ${step(3, '写下你的想法', ideaHtml, !!curT)}
      ${step(4, `AI ${KN[R?.kind || D.kind][1]}与评估`, resHtml, !!R)}
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
      <div class="id-prop-hd"><div><span class="id-kb k-${R.kind || 'proposal'}"><i class="fas ${KN[R.kind || 'proposal'][0]}"></i>${KN[R.kind || 'proposal'][1]}</span><div class="id-title">${esc(R.title)}</div><div class="id-one">${esc(R.oneLiner)}</div><div class="mt">${(R.tags || []).map((t) => `<span class="tag p">${esc(t)}</span>`).join(' ')}</div></div>
        <div class="id-score"><div class="fs-ring ${E.total >= 80 ? 'ok' : E.total >= 65 ? 'warn' : 'bad'}" style="--p:${E.total || 0}"><b>${E.total || '—'}</b><small>AI 评分</small></div></div></div>
      <div class="id-dims">${dim.map(([k, n]) => `<div><span>${n}</span><i><em style="width:${E[k] || 0}%"></em></i><b>${E[k] ?? '—'}</b></div>`).join('')}</div>
      ${E.comment ? `<div class="fb-box mt"><b>AI 点评：</b>${esc(E.comment)}${(E.improve || []).length ? `<div class="mt">${E.improve.map((x) => `<div>▸ ${esc(x)}</div>`).join('')}</div>` : ''}</div>` : ''}
      ${R.kind === 'design' ? `<div class="id-visual mt">${R.cover ? `<img src="${esc(R.cover)}" alt="AI 设计稿">` : `<div class="id-visual-empty"><i class="fas fa-image"></i><span>根据设计思路生成一张 AI 设计稿（约 20 积分）</span></div>`}
        <div class="flex mt"><span class="hint" style="flex:1">${R.cover ? '设计稿会随献策一起展示在广场和企业收件箱' : '出图模型：' + esc(window.modelName ? modelName(roleModel('slideImage')) : 'GPT Image 2')}</span><button class="btn btn-ghost btn-sm" id="id-visual" ${busy ? 'disabled' : ''}><i class="fas ${busy === 'visual' ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}"></i>${busy === 'visual' ? '出图中…' : R.cover ? '换一张' : '生成设计稿'}</button></div></div>` : ''}
      <div class="md id-md mt">${mdRender(R.proposal)}</div>
      <div class="flex mt"><input id="id-fb" placeholder="不满意？写下修改意见，比如：更聚焦年轻用户 / 预算控制在 10 万以内" value="${esc(D.fb)}" style="flex:1"><button class="btn btn-ghost btn-sm" id="id-revise" ${busy ? 'disabled' : ''}><i class="fas fa-rotate"></i>按意见改一版</button><button class="btn btn-ghost btn-sm" id="id-copy"><i class="fas fa-copy"></i>复制</button></div></div>`;
  }
  function deliverPanel(T) {
    if (!T) return '';
    if (T.self) {
      return `<div class="id-deliver self"><i class="fas fa-brain"></i><div><b>交给企业智脑执行</b><small>这份策划案会作为一条老板指令进入调度中枢：深度研究验证可行性 → 3 套方案（以你的创意为主线）→ 七维可行性校验 → 你拍板 → 各部门大师执行，产出 Word / Excel / 创意 PPT。</small></div><button class="btn btn-pri" id="id-run"><i class="fas fa-rocket"></i>交给智脑执行</button></div>`;
    }
    const opts = [];
    if (D.challenge) opts.push(['challenge', 'fa-trophy', `应征「${D.challenge.title}」`, `直接投递到 ${D.challenge.company} 的征集收件箱；被采纳可得 ${D.challenge.rewardPoints || 0} 智点悬赏 + 100 智点平台奖励`]);
    if (T.registered) opts.push(['inbox', 'fa-inbox', `直推「${T.registered.name}」收件箱`, '企业已入驻智导，提案将即时出现在企业收件箱，企业可在线采纳、回复，并交给自己的智脑执行']);
    else if ((T.emails || []).length) opts.push(['email', 'fa-envelope', '邮件代发到企业公开邮箱', '由智导代你发送一封排版好的策划案邮件；同一企业邮箱 7 天内只代发 1 封，企业可一键退订']);
    opts.push(['public', 'fa-globe', '保存为公开献策', '先放进献策广场；企业日后入驻智导时，会自动出现在它的收件箱']);
    if (!opts.some((o) => o[0] === D.via)) D.via = opts[0][0];
    if (D.via === 'email' && !D.emailTo) D.emailTo = T.emails[0].email;
    if (D.sent && D.sent.target === T.name) {
      const s = D.sent, st = ST[s.status] || ['', 'p'];
      return `<div class="id-sent"><i class="fas ${CH[s.channel]?.[0] || 'fa-check'}"></i><div><b>${st[0]}</b><small>${esc(s.emailMsg || (s.channel === 'inbox' ? `已送达「${s.company?.name}」收件箱，企业处理后你会在「我的献策」看到状态变化` : '已保存为公开献策'))}</small>${s.points ? `<span class="tag ok" style="width:max-content"><i class="fas fa-coins"></i> +${s.points} 智点</span>` : ''}<a class="lnk" href="${esc(s.view)}" target="_blank" rel="noopener">在线查看提案页 →</a><a class="lnk" onclick="openMarket('wallet')">查看我的智点 →</a></div><button class="btn btn-ghost btn-sm" id="id-new"><i class="fas fa-plus"></i>再献一策</button></div>`;
    }
    return `<div class="id-via">${opts.map(([k, i, n, d]) => `<label class="id-opt ${D.via === k ? 'on' : ''}"><input type="radio" name="id-via" value="${k}" ${D.via === k ? 'checked' : ''} hidden><i class="fas ${i}"></i><div><b>${n}</b><small>${d}</small></div></label>`).join('')}</div>
      ${D.via === 'email' ? `<div class="id-email mt"><div class="flex"><span class="hint">收件邮箱</span><select id="id-to" style="flex:1">${T.emails.map((e) => `<option value="${esc(e.email)}" ${D.emailTo === e.email ? 'selected' : ''}>${esc(e.email)}（${esc(e.type)}）</option>`).join('')}</select></div>
        <label class="chk mt"><input type="checkbox" id="id-consent" ${D.consent ? 'checked' : ''}> 我确认这是我本人的原创想法，同意以「${esc(D.nick || '匿名用户')}」的名义，由智导代发到该企业的<b>公开</b>邮箱</label></div>` : ''}
      <label class="chk mt"><input type="checkbox" id="id-listed" ${D.listed !== false ? 'checked' : ''}> 同时公开到献策广场（去掉联系方式，其他用户可以点赞）</label>
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
    on('#id-chal-x', () => { D.challenge = null; D.target = null; D.res = null; save(); rerender(); });
    on('#id-gowiz', () => enterBrain());
    const find = async () => {
      const q = ($('#id-q', b)?.value || '').trim(); if (!q) return toast('请输入企业名称');
      if (!ai()) return toast('需要连接 AI 才能识别企业');
      D.q = q; busy = 'target'; D.target = null; D.challenge = null; D.res = null; D.sent = null; save(); rerender();
      try { const r = await AI.call('/idea/target', { name: q, engine: roleModel('research') }); D.target = r; }
      catch (e) { toast('识别失败：' + e.message, 'fa-triangle-exclamation'); }
      busy = ''; save(); rerender();
    };
    on('#id-find', find);
    const qi = $('#id-q', b); if (qi) qi.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); find(); } });
    $$('[data-hot]', b).forEach((x) => x.onclick = () => { $('#id-q', b).value = x.dataset.hot; find(); });
    $$('[data-kind]', b).forEach((x) => x.onclick = () => { D.kind = x.dataset.kind; keep(b); save(); rerender(); });
    $$('[data-cat]', b).forEach((x) => x.onclick = () => { D.cat = x.dataset.cat; keep(b); save(); rerender(); });
    $$('[data-hint]', b).forEach((x) => x.onclick = () => { const t = $('#id-idea', b); t.value = (t.value ? t.value + '\n' : '') + x.dataset.hint; keep(b); save(); });
    ['#id-idea', '#id-nick', '#id-contact', '#id-fb'].forEach((s) => { const el = $(s, b); if (el) el.addEventListener('input', () => { keep(b); save(); }); });
    const write = async (revise) => {
      keep(b); if (!D.idea.trim()) return toast('先写下你的想法');
      busy = 'write'; D.sent = null; save(); rerender();
      try { const r = await AI.call('/idea/write', { target: curT, idea: D.challenge ? `【应征企业征集令】${D.challenge.title}\n企业要解决的问题：${D.challenge.problem}\n\n【我的想法】\n${D.idea}` : D.idea, category: D.cat, kind: D.kind, self: D.mode === 'self', engine: roleModel('strategy'), feedback: revise ? D.fb : '', previous: revise ? D.res?.proposal : '' }); D.res = r; if (revise) D.fb = ''; }
      catch (e) { toast('撰写失败：' + e.message, 'fa-triangle-exclamation'); }
      busy = ''; save(); rerender();
      setTimeout(() => $('.id-prop', host)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    };
    on('#id-write', () => write(false));
    on('#id-revise', () => { keep(b); if (!D.fb.trim()) return toast('先写下修改意见'); write(true); });
    on('#id-visual', async () => {
      if (!D.res?.visualPrompt) return toast('这份设计思路缺少画面描述，请重新生成');
      busy = 'visual'; rerender();
      try { const r = await AI.call('/image', { prompt: D.res.visualPrompt, aspect: '4:3' }); D.res.cover = r.url; toast('设计稿已生成', 'fa-image'); window.AI?.refreshCredits?.(); }
      catch (e) { toast('出图失败：' + e.message, 'fa-triangle-exclamation'); }
      busy = ''; save(); rerender();
    });
    on('#id-copy', () => { navigator.clipboard?.writeText(`# ${D.res.title}\n\n${D.res.proposal}`); toast('已复制策划案'); });
    $$('[name=id-via]', b).forEach((r) => r.onchange = () => { D.via = r.value; save(); rerender(); });
    on('#id-to', (e) => { D.emailTo = e.target.value; save(); }, 'onchange');
    on('#id-listed', (e) => { D.listed = e.target.checked; save(); }, 'onchange');
    on('#id-consent', (e) => { D.consent = e.target.checked; save(); rerender(); }, 'onchange');
    on('#id-new', () => { D.res = null; D.idea = ''; D.sent = null; D.consent = false; save(); rerender(); });
    on('#id-send', async () => {
      keep(b); busy = 'submit'; rerender();
      try {
        const r = await api('/submit', { uid: uid(), nickname: D.nick, contact: D.contact, target: curT, category: D.cat, title: D.res.title, oneLiner: D.res.oneLiner, proposal: D.res.proposal, eval: D.res.eval, emailTo: D.via === 'email' ? D.emailTo : '', emailSource: D.via === 'email' ? (curT.emails.find((e) => e.email === D.emailTo)?.source?.url || '') : '', consent: D.via === 'email' && D.consent, emailSubject: D.res.email?.subject, emailOpening: D.res.email?.opening, challengeId: D.via === 'challenge' ? D.challenge?.id : '', kind: D.res.kind || D.kind, tags: D.res.tags || [], cover: D.res.cover || '', listed: D.listed !== false });
        D.sent = { ...r, target: curT.name }; mine = null; if (r.challenge) D.challenge = null; window.Market?.refresh?.();
        if (r.points) setTimeout(() => toast(`献策奖励 +${r.points} 智点 🪙`, 'fa-coins'), 900);
        toast(r.challenge ? '已应征征集令 🏆' : r.channel === 'inbox' ? '已直推企业收件箱 🎯' : r.channel === 'email' ? '邮件已代发 ✉️' : (r.emailMsg || '已保存为公开献策'), 'fa-paper-plane');
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
    window.Market?.api('/wallet', { uid: uid() }).then((w) => { const el = $('#mine-pts', b); if (el) el.innerHTML = `<div class="id-pts"><i class="fas fa-coins"></i><div><b>${w.balance}</b><small>我的智点 · 累计获得 ${w.earned}${w.rank ? ' · 排名 #' + w.rank : ''}</small></div><button class="btn btn-ghost btn-sm" onclick="openMarket('wallet')">明细与规则</button><button class="btn btn-warm btn-sm" onclick="openMarket('challenges')"><i class="fas fa-trophy"></i>去应征悬赏</button></div>`; }).catch(() => { });
    b.innerHTML = `<div id="mine-pts"></div><div class="grid4 mt"><div class="stat"><div class="l">我的献策</div><div class="v">${mine.length}</div></div><div class="stat"><div class="l">已送达企业</div><div class="v">${cnt((x) => x.channel !== 'public')}</div></div><div class="stat"><div class="l">企业已采纳</div><div class="v" style="color:var(--ok)">${cnt((x) => ['adopted', 'done'].includes(x.status))}</div></div><div class="stat"><div class="l">企业回复</div><div class="v">${cnt((x) => x.reply)}</div></div></div>
      <div class="id-list mt">${mine.map((x) => { const st = ST[x.status] || [x.status, 'p']; return `<article class="id-item"><div class="flex between"><div><span class="id-kb k-${x.kind}"><i class="fas ${KN[x.kind]?.[0] || 'fa-file-lines'}"></i>${KN[x.kind]?.[1] || '策划案'}</span> <span class="tag"><i class="fas ${CH[x.channel]?.[0]}"></i> ${CH[x.channel]?.[1]}</span> <b>→ ${esc(x.target)}</b> <span class="dim">· ${esc(x.category || '')} · ${new Date(x.createdAt).toLocaleString('zh-CN', { hour12: false }).slice(0, 16)}</span></div><span class="tag ${st[1]}">${st[0]}</span></div>
        <div class="id-it-t">${esc(x.title)}</div><div class="hint">${esc(x.oneLiner || '')}</div>
        ${x.emailMsg ? `<div class="hint mt"><i class="fas fa-envelope"></i> ${esc(x.emailTo ? x.emailTo + ' · ' : '')}${esc(x.emailMsg)}</div>` : ''}
        ${x.reply ? `<div class="fb-box ok mt"><b>企业回复：</b>${esc(x.reply)}</div>` : ''}
        ${x.rewardPoints || x.rewardCash ? `<div class="id-reward"><i class="fas fa-gift"></i>${x.rewardPoints ? `获得悬赏 / 打赏 <b>${x.rewardPoints}</b> 智点` : ''}${x.rewardCash ? `　现金奖励：${esc(x.rewardCash)}（与企业线下约定）` : ''}</div>` : ''}
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
      ${inbox.length ? `<div class="id-list mt">${inbox.map((x) => { const st = ST[x.status] || [x.status, 'p']; return `<article class="id-item inbox" data-iid="${x.id}"><div class="flex between"><div>${x.challengeId ? '<span class="tag warn"><i class="fas fa-trophy"></i> 征集令应征</span> ' : ''}<b>${esc(x.title)}</b> <span class="dim">· 来自 ${esc(x.nickname)}${x.contact ? `（${esc(x.contact)}）` : ''} · ${esc(x.category || '')} · ${new Date(x.createdAt).toLocaleDateString('zh-CN')}</span></div><div class="flex"><span class="tag">AI ${x.eval?.total ?? '—'}</span><span class="tag ${st[1]}">${st[0]}</span></div></div>
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
        const tipOf = () => { if (x.challengeId) return 0; const v = prompt('采纳并打赏提案人多少智点？（从企业钱包扣，0 = 不打赏；平台另奖励提案人 100 智点）', '100'); if (v === null) return null; return Math.max(0, parseInt(v, 10) || 0); };
        const said = (r) => { const g = (r?.reward?.bonus || 0) + (r?.reward?.paid || 0); if (g) setTimeout(() => toast(`提案人获得 ${g} 智点${r.reward.paid ? `（含${x.challengeId ? '悬赏' : '打赏'} ${r.reward.paid}）` : ''} 🪙`, 'fa-coins'), 800); };
        if (act === 'adopted') { const tip = tipOf(); if (tip === null) return; said(await upd({ status: 'adopted', reward: tip })); }
        else if (act === 'run') {
          if (!S.launched || !window.Flow) return toast('请先创建企业智脑');
          if (!S.sim) { enterBrain(); $('.ideas-overlay') || openIdeas(null, 'inbox'); }
          const tip = tipOf(); if (tip === null) return;
          const c = Flow.issue(`落地用户献策：${x.title}`, { idea: `# ${x.title}\n${x.oneLiner || ''}\n\n${x.proposal}`, ideaBy: `用户「${x.nickname}」`, ideaRef: x.id });
          if (!c) return; said(await upd({ status: 'adopted', cmdNo: c.no, reward: tip })); toast(`已采纳并作为指令 #${c.no} 交给智脑`, 'fa-rocket'); enterBrain('flow');
        } else if (act !== 'adopted') await upd({ status: act });
        inbox = null; rerender();
      } catch (e) { toast(e.message, 'fa-triangle-exclamation'); }
    });
  }

  // ---------------- ④ 献策广场 ----------------
  // ---------------- ④ 献策广场（市场） ----------------
  let mk = { kind: '', sort: 'hot', cat: '', q: '', list: null, key: '' };
  function square(b) {
    const key = [mk.kind, mk.sort, mk.cat, mk.q].join('|');
    if (!stats) api('/stats').then((r) => { stats = r; paintTop(); setTimeout(() => { stats = null; }, 30000); }).catch(() => { });
    if (mk.list === null || mk.key !== key) {
      mk.key = key; mk.list = null;
      api(`/market?kind=${mk.kind}&sort=${mk.sort}&cat=${encodeURIComponent(mk.cat)}&q=${encodeURIComponent(mk.q)}&uid=${uid()}`).then((r) => { mk.list = r.ideas; if (mk.key === key) rerender(); }).catch((e) => toast('加载失败：' + e.message, 'fa-triangle-exclamation'));
    }
    const sorts = [['hot', 'fa-fire', '热门'], ['new', 'fa-clock', '最新'], ['featured', 'fa-star', '精选'], ['adopted', 'fa-circle-check', '已被回应']];
    const kinds = [['', 'fa-layer-group', '全部'], ...KINDS.map(([k, i, n]) => [k, i, n])];
    b.innerHTML = `<section class="mk-hero"><div><h2>献策广场</h2><p>看看大家都在给哪些企业出主意：策划案、改进建议、设计思路，点赞你认同的点子，或者照着思路给同一家企业也献一策</p></div><div class="mk-top" id="mk-top"></div></section>
      <div class="mk-bar">
        <div class="mk-seg">${kinds.map(([k, i, n]) => `<button class="${mk.kind === k ? 'on' : ''}" data-mkind="${k}"><i class="fas ${i}"></i>${n}</button>`).join('')}</div>
        <div class="mk-seg">${sorts.map(([k, i, n]) => `<button class="${mk.sort === k ? 'on' : ''}" data-msort="${k}"><i class="fas ${i}"></i>${n}</button>`).join('')}</div>
        <select id="mk-cat"><option value="">全部分类</option>${CATS.map((c) => `<option ${mk.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <input id="mk-q" placeholder="搜索企业 / 标题，回车" value="${esc(mk.q)}">
      </div>
      <div class="mk-wrap"><div class="mk-grid" id="mk-grid">${mk.list === null ? Array.from({ length: 6 }, () => '<div class="mk-card sk"></div>').join('') : mk.list.length ? mk.list.map(card).join('') : '<div class="empty-state" style="grid-column:1/-1;height:260px"><div><i class="fas fa-magnifying-glass" style="font-size:32px"></i><p class="mt">没有符合条件的献策</p></div></div>'}</div>
        <aside class="mk-side" id="mk-side"></aside></div>`;
    paintTop();
    $$('[data-mkind]', b).forEach((x) => x.onclick = () => { mk.kind = x.dataset.mkind; rerender(); });
    $$('[data-msort]', b).forEach((x) => x.onclick = () => { mk.sort = x.dataset.msort; rerender(); });
    $('#mk-cat', b).onchange = (e) => { mk.cat = e.target.value; rerender(); };
    $('#mk-q', b).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { mk.q = e.target.value.trim(); rerender(); } });
    $$('[data-like]', b).forEach((x) => x.onclick = async (ev) => {
      ev.stopPropagation();
      try { const r = await api('/like', { uid: uid(), id: x.dataset.like }); const it = mk.list.find((i) => i.id === x.dataset.like); if (it) { it.liked = r.liked; it.likes = r.likes; } x.classList.toggle('on', r.liked); x.querySelector('b').textContent = r.likes; if (r.liked) x.classList.add('pop'); setTimeout(() => x.classList.remove('pop'), 400); }
      catch (e) { toast(e.message, 'fa-triangle-exclamation'); }
    });
    $$('[data-open]', b).forEach((x) => x.onclick = () => openDetail(x.dataset.open));
    $$('[data-also]', b).forEach((x) => x.onclick = (ev) => { ev.stopPropagation(); alsoFor(x.dataset.also); });
  }
  function card(x) {
    const k = KN[x.kind] || KN.proposal, st = ST[x.status] || ['', 'p'];
    return `<article class="mk-card k-${x.kind}" data-open="${x.id}">
      ${x.cover ? `<div class="mk-cover" style="background-image:url('${esc(x.cover)}')"></div>` : `<div class="mk-cover none k-${x.kind}"><i class="fas ${k[0]}"></i></div>`}
      <div class="mk-body">
        <div class="mk-meta"><span class="id-kb k-${x.kind}"><i class="fas ${k[0]}"></i>${k[1]}</span>${x.featured ? '<span class="mk-feat"><i class="fas fa-star"></i>精选</span>' : ''}${x.sample ? '<span class="mk-sample" title="平台样板数据，用于展示效果">样板</span>' : ''}<span class="mk-to">→ ${esc(x.target)}</span></div>
        <h4>${esc(x.title)}</h4><p>${esc(x.oneLiner || '')}</p>
        ${(x.tags || []).length ? `<div class="mk-tags">${x.tags.slice(0, 3).map((t) => `<em>#${esc(t)}</em>`).join('')}</div>` : ''}
        <div class="mk-foot"><span class="mk-by">${esc(x.nickname)}</span>${['adopted', 'done', 'replied'].includes(x.status) ? `<span class="tag ok">${st[0]}</span>` : ''}<span class="mk-score" title="AI 评分">AI ${x.eval?.total ?? '—'}</span>
          <button class="mk-like ${x.liked ? 'on' : ''}" data-like="${x.id}" title="点赞"><i class="fas fa-heart"></i><b>${x.likes || 0}</b></button></div>
      </div></article>`;
  }
  function paintTop() {
    const s = stats, el = $('#mk-top', host), side = $('#mk-side', host); if (!s || !el) return;
    const kn = (k) => (s.kinds || []).find((x) => x.kind === k)?.n || 0;
    el.innerHTML = [['fa-lightbulb', s.ideas, '份献策'], ['fa-heart', s.likes, '次点赞'], ['fa-building', s.companies, '家企业入驻'], ['fa-circle-check', s.adopted, '份被采纳']].map(([i, v, l]) => `<div><i class="fas ${i}"></i><b>${v ?? 0}</b><span>${l}</span></div>`).join('');
    if (side) side.innerHTML = `<div class="card"><div class="h4"><i class="fas fa-fire" style="color:#ef4444"></i> 最受关注的企业</div>${(s.hot || []).map((h, i) => `<div class="mk-rank" data-go="${esc(h.name)}"><b class="r${i}">${i + 1}</b><span>${esc(h.name)}</span><em>${h.n} 策</em></div>`).join('') || '<div class="hint mt">暂无</div>'}</div>
      <div class="card mt"><div class="h4"><i class="fas fa-chart-pie" style="color:var(--c2)"></i> 献策构成</div>${KINDS.map(([k, i, n]) => { const v = kn(k), t = Math.max(1, s.ideas); return `<div class="mk-bar2"><span><i class="fas ${i}"></i>${n}</span><i><em class="k-${k}" style="width:${Math.round(v / t * 100)}%"></em></i><b>${v}</b></div>`; }).join('')}</div>
      <button class="btn btn-warm mt" style="width:100%;justify-content:center" id="mk-new"><i class="fas fa-lightbulb"></i>我也来献一策</button>`;
    $$('[data-go]', side || el).forEach((x) => x.onclick = () => alsoFor(x.dataset.go));
    const nb = $('#mk-new', host); if (nb) nb.onclick = () => { D.tab = 'make'; D.mode = 'other'; save(); rerender(); };
  }
  function alsoFor(name) { D.tab = 'make'; D.mode = 'other'; D.q = name; D.target = null; D.res = null; D.sent = null; save(); rerender(); setTimeout(() => $('#id-find', host)?.click(), 50); }
  async function openDetail(id) {
    const m = openModal('<div class="hint"><i class="fas fa-spinner fa-spin"></i> 加载中…</div>');
    try {
      const { idea: x } = await api('/detail/' + id); const k = KN[x.kind] || KN.proposal, E = x.eval || {};
      m.innerHTML = `<div class="flex between"><div><span class="id-kb k-${x.kind}"><i class="fas ${k[0]}"></i>${k[1]}</span>${x.sample ? ' <span class="mk-sample">样板</span>' : ''}<div class="h2 mt" style="font-size:19px">${esc(x.title)}</div><div class="hint">${esc(x.nickname)} → ${esc(x.target)} · ${esc(x.category || '')} · ${new Date(x.createdAt).toLocaleDateString('zh-CN')}</div></div><button class="close-x" data-close><i class="fas fa-xmark"></i></button></div>
        ${x.cover ? `<img src="${esc(x.cover)}" class="mk-dimg mt" alt="设计稿">` : ''}
        <p class="mt" style="font-size:14px;color:var(--sub)">${esc(x.oneLiner || '')}</p>
        <div class="grid4 mt">${[['创新度', E.novelty], ['契合度', E.fit], ['可行性', E.feasibility], ['价值', E.value]].map(([n, v]) => `<div class="stat"><div class="l">${n}</div><div class="v" style="font-size:20px">${v ?? '—'}</div></div>`).join('')}</div>
        <div class="md id-md mt">${mdRender(x.proposal || '')}</div>
        ${x.reply ? `<div class="fb-box ok mt"><b>企业回复：</b>${esc(x.reply)}</div>` : ''}
        <div class="flex mt"><span class="hint" style="flex:1">${x.sample ? '这是平台样板，用来展示献策长什么样；不代表企业已收到或采纳。' : '公开献策不展示提案人联系方式。'}</span><button class="btn btn-warm btn-sm" id="dt-also"><i class="fas fa-lightbulb"></i>我也给「${esc(x.target)}」献一策</button></div>`;
      $$('[data-close]', m).forEach((b) => b.onclick = closeOverlay);
      $('#dt-also', m).onclick = () => { closeOverlay(); alsoFor(x.target); };
    } catch (e) { m.innerHTML = `<div class="hint">加载失败：${esc(e.message)}</div><button class="btn btn-ghost btn-sm mt" data-close>关闭</button>`; $$('[data-close]', m).forEach((b) => b.onclick = closeOverlay); }
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
  window.ideaApply = (c) => {
    D.tab = 'make'; D.mode = 'other'; D.res = null; D.sent = null; D.via = 'challenge'; if (c.kindPref) D.kind = c.kindPref; if (c.category) D.cat = c.category;
    D.challenge = { id: c.id, title: c.title, company: c.company, problem: c.problem, rewardPoints: c.rewardPoints, rewardCash: c.rewardCash };
    D.target = { name: c.company, short: c.company, industry: c.industry, business: '', products: [], recent: [], audience: '', pains: [c.problem], opportunities: [], ideaHints: [], emails: [], registered: c.companyId ? { id: c.companyId, name: c.company } : null };
    save(); openIdeas(); toast(`正在应征：${c.title}`, 'fa-trophy');
  };
  window.ideaReload = () => { try { D = Object.assign(D, JSON.parse(localStorage.getItem(DRAFTK)) || {}); } catch { } rerender(); };
  window.ideaPrefill = (v) => { D.idea = String(v || ''); save(); rerender(); };
  // 指令完成后，把执行结果回写到献策（企业收件箱 / 提案人可见）
  window.ideaCmdDone = function (c) {
    if (!c?.ideaRef || !S.network) return;
    api('/company/update', { id: S.network.id, token: S.network.token, ideaId: c.ideaRef, status: 'done', cmdNo: c.no, cmdScore: c.acceptance?.score ?? null }).catch(() => { });
  };
})();
