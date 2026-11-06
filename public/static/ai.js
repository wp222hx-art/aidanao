// 企业智脑 · Genspark 真实能力接入层
// 所有 AI 能力通过本站后端 /api/ai/* 调用 Genspark（企业主本人授权），浏览器不接触密钥。
(function () {
  const AI = window.AI = { on: false, user: null, model: '', reason: '', busy: { img: false, video: false, leads: false, brief: false }, running: new Set(), briefing: false, lastLeadScan: 0 };
  const CONCURRENCY = 2;

  // ---------- 基础调用 ----------
  AI.call = async function (path, body, method = 'POST') {
    const headers = { 'Content-Type': 'application/json' };
    const code = localStorage.getItem('ebrain_code'); if (code) headers['X-Brain-Code'] = code;
    const r = await fetch('/api/ai' + path, { method, headers, body: method === 'POST' ? JSON.stringify(body || {}) : undefined });
    let j = null; try { j = await r.json(); } catch { }
    if (r.status === 401 && j?.needCode) {
      const v = prompt('该企业智脑设置了访问口令，请输入：');
      if (v) { localStorage.setItem('ebrain_code', v); return AI.call(path, body, method); }
    }
    if (!r.ok || !j || j.ok === false) throw new Error(j?.error || `请求失败（${r.status}）`);
    return j;
  };

  AI.init = async function () {
    try {
      const ctl = new AbortController(); setTimeout(() => ctl.abort(), 6000);
      const r = await fetch('/api/ai/status', { signal: ctl.signal }).then((x) => x.json());
      AI.on = !!r.connected; AI.user = r.user || null; AI.model = r.model || ''; AI.reason = r.reason || '';
    } catch (e) { AI.on = false; AI.reason = '无法连接 AI 服务'; }
    renderPill();
  };

  // ---------- 连接状态胶囊 ----------
  function pillHtml() {
    if (AI.on) return `<div class="ai-pill on" title="${esc(AI.user?.email || '')} · 模型 ${esc(AI.model)}"><span class="pulse"></span><b>Genspark 已授权</b><span class="dim">${esc((AI.user?.plan || '').toUpperCase())} · 积分 ${Math.round(AI.user?.credits || 0).toLocaleString()}</span></div>`;
    return `<div class="ai-pill off" title="${esc(AI.reason)}"><span class="pulse"></span><b>仿真模式</b><span class="dim">${esc(AI.reason || '未连接 Genspark')}</span></div>`;
  }
  function renderPill() {
    $$('.ai-pill').forEach((e) => e.remove());
    const w = $('.wiz-top #btn-demo'); if (w) w.insertAdjacentHTML('beforebegin', pillHtml());
    const h = $('.hq-top .kpis'); if (h) h.insertAdjacentHTML('beforebegin', pillHtml());
  }
  AI.refreshCredits = async () => { try { const r = await fetch('/api/ai/status').then((x) => x.json()); if (r.connected) { AI.user = r.user; renderPill(); } } catch { } };

  // ---------- 简易 Markdown 渲染（先转义，后格式化） ----------
  window.mdRender = function (md) {
    const lines = esc(md || '').split('\n'); let html = '', list = null;
    const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/(https?:\/\/[^\s)）<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    const close = () => { if (list) { html += `</${list}>`; list = null; } };
    lines.forEach((raw) => {
      const l = raw.trimEnd();
      let m;
      if (!l.trim()) { close(); return; }
      if ((m = l.match(/^\s*(#{1,4})\s+(.*)/))) { close(); html += `<h${m[1].length + 2}>${inline(m[2])}</h${m[1].length + 2}>`; return; }
      if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(m[1])}</li>`; return; }
      if ((m = l.match(/^\s*\d+[.)、]\s*(.*)/))) { if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(m[1])}</li>`; return; }
      if (/^\s*\|.*\|\s*$/.test(l)) { close(); if (/^\s*\|[\s:-|]+\|\s*$/.test(l)) return; html += `<div class="md-row">${l.split('|').slice(1, -1).map((c) => `<span>${inline(c.trim())}</span>`).join('')}</div>`; return; }
      close(); html += `<p>${inline(l)}</p>`;
    });
    close(); return html;
  };

  const ctxBase = () => ({ company: S.company.name, industry: `${S.industry?.name || ''} › ${S.industry?.div?.name || ''}`, business: S.company.profile?.business || S.company.profile?.positioning || '' });

  // ====================== 向导：画像 / 简历 ======================
  AI.enrichProfile = async function () {
    const r = await AI.call('/profile', { name: S.company.name, industry: S.industry?.name, division: S.industry?.div?.name, deptIds: DEPT_LIBRARY.map((d) => d.id).join(',') });
    const A = r.profile || {}, P = S.company.profile || buildProfile(S.company.scan);
    if (A.positioning) P.positioning = A.positioning;
    if (A.business) P.business = A.business;
    if (Array.isArray(A.chain) && A.chain.length >= 3) P.chain = A.chain.slice(0, 8);
    if (Array.isArray(A.domains) && A.domains.length === 7) P.domains = A.domains;
    if (A.canvas && typeof A.canvas === 'object') P.canvas = { ...P.canvas, ...A.canvas };
    if (Array.isArray(A.opportunities) && A.opportunities.length) P.opportunities = A.opportunities.slice(0, 5);
    if (Array.isArray(A.risks) && A.risks.length) P.risks = A.risks.slice(0, 4);
    P.competitors = (A.competitors || []).slice(0, 5);
    P.leadKeywords = (A.leadKeywords || []).slice(0, 6);
    P.recommendedDepts = (A.recommendedDepts || []).filter((id) => deptLib(id));
    P.weakest = [...P.domains].sort((a, b) => a.score - b.score).slice(0, 2);
    P.confidence = A.confidence || P.confidence;
    P.evidence = Math.max(P.evidence || 0, Math.round((r.evidenceChars || 0) / 500));
    P.ai = true;
    S.company.profile = P; saveState();
    return P;
  };

  AI.resume = async function (s) {
    s.aiPending = true;
    try {
      const d = S.depts.find((x) => x.id === s.deptId);
      const r = await AI.call('/resume', { dept: d?.name, pos: s.pos, resume: s.resume });
      if (r.years >= 0) s.years = Math.round(r.years);
      if (Array.isArray(r.skills) && r.skills.length) s.skills = r.skills.slice(0, 8);
      if (r.value) s.value = Math.max(1, Math.min(99, Math.round(r.value)));
      s.aiRole = r.role; s.strengths = r.strengths; s.gaps = r.gaps; s.pairAgent = r.pairAgent; s.ai = true;
      if (!s.tierManual && TIERS[r.tier]) { s.tier = r.tier; s.tools = null; }
    } catch (e) { toast('AI 简历解析失败：' + e.message, 'fa-triangle-exclamation'); }
    s.aiPending = false; saveState();
  };

  // ---------- 商机雷达：Genspark 全网检索 + AI 分级 ----------
  AI.scanLeads = async function (kwsIn, cmdId) {
    if (!AI.on) return [];
    const P = S.company.profile || {};
    const kws = (kwsIn?.length ? kwsIn : (P.leadKeywords?.length ? P.leadKeywords : (S.industry?.div?.kw || S.industry?.div?.name || '').split(' '))).filter(Boolean);
    const pickKw = [...kws].sort(() => Math.random() - .5).slice(0, 2);
    simLog('lead', `🛰️ 销售 Agent 调用 Genspark 全网检索采购/招标：${esc(pickKw.join('、'))}`, '#2563eb', cmdId);
    const r = await AI.call('/leads', { ...ctxBase(), keywords: pickKw });
    const out = [];
    (r.leads || []).forEach((l) => {
      if (S.sim.leads.some((x) => x.link === l.link)) return;
      let src = ''; try { src = new URL(l.link).hostname.replace(/^www\./, ''); } catch { }
      const L = { id: uid('l'), title: l.title, link: l.link, desc: l.desc, source: src || '公开网络', real: true, ai: true, grade: l.grade, value: l.value, match: l.match, buyer: l.buyer, reason: l.reason, next: l.next, status: 'new', day: S.sim.day, cmdId };
      S.sim.leads.unshift(L); out.push(L);
      S.sim.metrics.leads++; S.sim.today.leads++; S.sim.real.leads++;
      simLog('lead', `🎯 发现 <b>${L.grade}级</b> 真实商机：${esc(L.title.slice(0, 30))} · ${esc(L.reason || '')}`, L.grade === 'A' ? '#059669' : '#2563eb', cmdId);
    });
    if (S.sim.leads.length > 80) S.sim.leads.length = 80;
    simLog('lead', `📡 检索 ${r.searched} 条公开信息，AI 筛出 ${out.length} 条有效商机`, '#2563eb', cmdId);
    saveState(); updateBadges();
    return out;
  };

  // ---------- AI 经营日报 ----------
  AI.brief = async function () {
    if (!AI.on || AI.briefing) return;
    AI.briefing = true; if ($('#brief-card')) gotoView('cockpit');
    const T = S.sim.tasks;
    const data = {
      day: S.sim.day, time: simTime(), today: S.sim.today, real: S.sim.real || {},
      metrics: { 管道: S.sim.metrics.pipeline, 成交: S.sim.metrics.revenue, 降本: S.sim.metrics.saved, 返工: S.sim.metrics.rework, 督办: S.sim.metrics.esc },
      openTasks: T.filter((t) => t.status !== 'done').length,
      escalations: T.filter((t) => t.esc > 0 && t.status !== 'done').slice(0, 6).map((t) => t.title),
      pendingApprovals: S.sim.approvals.filter((a) => a.status === 'pending').slice(0, 6).map((a) => `${a.action}:${a.desc}`),
      topLeads: S.sim.leads.filter((l) => l.ai).slice(0, 6).map((l) => `${l.grade}级 ${l.title} ${l.reason || ''}`),
      realOutputs: T.filter((t) => t.real && t.evals).slice(0, 8).map((t) => `${t.title}（${t.status === 'done' ? '已完成' : t.status}，评测${t.evals.total}）`),
      weakDomains: S.company.profile?.weakest?.map((w) => w.name),
    };
    try {
      const r = await AI.call('/brief', { ...ctxBase(), data });
      S.sim.brief = { text: r.text, day: S.sim.day, t: simTime() };
      simLog('cp', '📰 Genspark AI 经营日报已生成 · <a class="lnk" onclick="gotoView(\'cockpit\')">查看</a>', '#2563eb');
      toast('AI 经营日报已生成', 'fa-file-lines');
    } catch (e) { toast('日报生成失败：' + e.message); }
    AI.briefing = false; saveState(); if ($('#brief-card')) gotoView('cockpit');
  };

  // ---------- 内容工厂：AI 文案 / 海报画面 / 宣传视频 ----------
  const rerenderStudio = () => { if ($('#pc') || $('.poster-stage')) gotoView('studio'); };
  AI.copy = async function () {
    const st = studioState();
    toast('Genspark 正在撰写合规文案…', 'fa-wand-magic-sparkles');
    try {
      const r = await AI.call('/copy', { ...ctxBase(), theme: pick(['新品发布', '客户案例', '品牌故事', '行业解决方案', '招商合作']) });
      Object.assign(st, { title: r.title || st.title, sub: r.sub || st.sub, cta: r.cta || st.cta, post: r.post || '', imagePrompt: r.imagePrompt || '', videoPrompt: r.videoPrompt || '' });
      rerenderStudio(); toast('AI 文案已生成（已按广告法约束）', 'fa-wand-magic-sparkles');
    } catch (e) { toast('文案生成失败：' + e.message); }
  };
  AI.posterBg = async function () {
    const st = studioState(); if (AI.busy.img) return;
    AI.busy.img = true; rerenderStudio();
    const prompt = st.imagePrompt || `Premium commercial key visual for a company in ${S.industry?.div?.name || 'business'} industry, ${S.company.profile?.business || ''}, cinematic lighting, modern, high-end advertising photography, dark elegant background, space for headline text`;
    try {
      const r = await AI.call('/image', { prompt, aspect: '3:4' });
      st.bgUrl = r.url;
      await new Promise((ok) => { const im = new Image(); im.onload = () => { window._posterBg = im; ok(); }; im.onerror = ok; im.src = r.url; });
      simLog('content', `🖼️ Genspark 生成海报画面（${esc(r.model || '')}，约 ${r.credits ?? '?'} 积分）`, '#ff4fa3');
      toast('AI 海报画面已生成', 'fa-image'); AI.refreshCredits();
    } catch (e) { toast('海报画面生成失败：' + e.message); }
    AI.busy.img = false; st.type = 'poster'; rerenderStudio();
  };
  AI.promoVideo = async function () {
    const st = studioState(); if (AI.busy.video) return;
    if (!confirm('将调用 Genspark 生成 5 秒宣传短视频（约 110 积分，耗时约 20-90 秒），继续？')) return;
    AI.busy.video = true; rerenderStudio();
    simLog('content', '🎬 视频剪辑官调用 Genspark 生成宣传短视频…', '#ff4fa3');
    const prompt = st.videoPrompt || `Cinematic 5-second commercial for ${S.company.profile?.business || S.industry?.div?.name}, smooth camera motion, premium product and team shots, modern brand film style, vertical`;
    try {
      const r = await AI.call('/video', { prompt, aspect: '9:16' });
      st.videoUrl = r.url; st.type = 'video';
      const C = { id: uid('c'), type: 'video', ai: true, url: r.url, title: `${st.title}·AI宣传视频`, status: 'pending', channels: ['抖音', '视频号', '小红书'], views: 0, leads: 0, day: S.sim.day };
      S.sim.contents.unshift(C); S.sim.metrics.contents++;
      const b = deptByLib('brand') || deptByLib('marketing') || S.depts[0];
      addApproval('对外发布声明', b.id, `对外分发 AI 宣传视频「${C.title}」至 ${C.channels.join('/')}`, 0, C.id);
      simLog('content', '✅ AI 宣传视频生成完成，已提交老板审批分发 · <a class="lnk" onclick="gotoView(\'studio\')">预览</a>', '#ff4fa3');
      toast('AI 宣传视频已生成', 'fa-film'); AI.refreshCredits();
    } catch (e) { toast('视频生成失败：' + e.message); simLog('esc', `⚠️ 视频生成失败：${esc(e.message)}`, '#dc2626'); }
    AI.busy.video = false; saveState(); rerenderStudio();
  };

  // ---------- Genspark 超级智能体（深度任务） ----------
  AI.deepAgent = async function (t) {
    if (!confirm('将把该任务交给 Genspark 超级智能体深度执行（会多步检索、分析，可能耗时数分钟并消耗较多积分），继续？')) return;
    const d = S.depts.find((x) => x.id === t.deptId);
    const query = `我是「${S.company.name}」（${S.industry?.name} › ${S.industry?.div?.name}）的老板。企业主营：${S.company.profile?.business || S.company.profile?.positioning || ''}。\n请以「${d?.name}」负责人的身份深度完成以下任务：${t.title}。\n交付物要求：${t.deliverable || '结构化、可执行的中文成果'}。${t.output ? `\n\n已有初稿供参考：\n${t.output.slice(0, 1500)}` : ''}\n\n请先检索事实与数据，再给出结论、依据来源、执行步骤与风险提示。`;
    try {
      const r = await AI.call('/agent', { name: `智脑·${d?.name || ''}·${t.title}`.slice(0, 40), query });
      t.deep = { runId: r.runId, state: r.state || 'queued', at: `D${S.sim.day} ${simTime()}` };
      simLog('task', `🧠 「${esc(t.title.slice(0, 20))}」已交给 Genspark 超级智能体深度执行`, '#7c3aed', t.cmdId);
      toast('已提交 Genspark 超级智能体', 'fa-brain'); saveState(); pollDeep(t); openTaskModal(t.id);
    } catch (e) { toast('提交失败：' + e.message); }
  };
  async function pollDeep(t) {
    if (!t.deep || ['succeeded', 'failed', 'cancelled'].includes(t.deep.state) || t.deep.polling) return;
    t.deep.polling = true;
    while (t.deep && !['succeeded', 'failed', 'cancelled', 'canceled', 'error'].includes(t.deep.state)) {
      await sleep(15000);
      try {
        const r = await AI.call('/agent/status?id=' + encodeURIComponent(t.deep.runId), null, 'GET');
        t.deep.state = r.state; t.deep.taskUrl = r.taskUrl;
        if (r.result) { t.deep.result = r.result; simLog('deliver', `🧠 超级智能体完成「${esc(t.title.slice(0, 20))}」深度成果 · <a class="lnk" onclick="openTaskModal('${t.id}')">查看</a>`, '#7c3aed', t.cmdId); AI.refreshCredits(); }
        saveState();
        const m = $('.modal[data-task="' + t.id + '"]'); if (m) openTaskModal(t.id);
      } catch (e) { if (/无效/.test(e.message)) break; }
    }
    if (t.deep) t.deep.polling = false;
  }

  // ---------- 挂载：包装渲染函数以插入状态胶囊、安装指令接管 ----------
  const _rw = window.renderWizard; window.renderWizard = function () { _rw.apply(this, arguments); renderPill(); };
  const _rh = window.renderHQ; window.renderHQ = function () {
    _rh.apply(this, arguments); renderPill();
    (S.sim?.tasks || []).forEach((t) => { if (t.real && t.status === 'exec') t.status = t.rework ? 'rework' : 'queued'; if (t.real && t.status === 'verify' && !t.evals) t.status = 'queued'; if (t.deep) { t.deep.polling = false; pollDeep(t); } });
  };
})();
