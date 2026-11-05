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
    } catch (e) { toast('AI 简历解析失败：' + e.message, 'fa-triangle-exclamation'); }
    s.aiPending = false; saveState();
  };

  // ====================== 总部：真实任务执行引擎 ======================
  const RESEARCH_RE = /线索|商机|竞品|竞争|市场|比价|行业|情报|法规|政策|招聘|供应商|价格|对标|客户画像|专利|标准/;
  async function runTask(t) {
    AI.running.add(t.id);
    const d = S.depts.find((x) => x.id === t.deptId), a = agentOf(t.agentId);
    t.status = 'doing'; t.stuck = false; t.error = '';
    if (a) a.status = 'busy';
    const anim = setInterval(() => { if (t.progress < 92) t.progress = Math.min(92, t.progress + rand(3, 8)); }, 900);
    bubble(t.agentId, t.rework ? '按评审意见返工中…' : '正在调用 Genspark…', 'ai');
    try {
      const r = await AI.call('/execute', {
        ...ctxBase(), dept: d?.name, agent: a?.name, task: t.title, deliverable: t.deliverable,
        research: t.kind === 'lead' || RESEARCH_RE.test(t.title), feedback: t.rework ? t.feedback : '', previous: t.rework ? t.output : '',
      });
      t.history.push({ v: t.history.length + 1, output: r.output, evals: r.evals, total: r.total, feedback: r.feedback, at: `D${S.sim.day} ${simTime()}`, researched: r.researched });
      t.output = r.output; t.evals = { ev: r.evals, total: r.total }; t.feedback = r.feedback; t.progress = 100;
      S.sim.real = S.sim.real || { done: 0, rework: 0, review: 0, leads: 0 };
      if (r.verdict === 'pass') { completeTask(t); }
      else if (t.rework < 1) {
        t.rework++; t.status = 'rework'; t.progress = 40; S.sim.metrics.rework++; S.sim.real.rework++;
        if (a) a.fail++;
        simLog('rework', `↩️ AI 质检官评测「${esc(t.title.slice(0, 20))}」${r.total} 分未达标 → 打回返工：${esc(r.feedback)} · <a class="lnk" onclick="openTaskModal('${t.id}')">查看</a>`, '#ff8a65');
        bubble(t.agentId, `${r.total}分，返工`, 'warn');
      } else {
        t.status = 'review'; S.sim.real.review++;
        simLog('review', `👤 「${esc(t.title.slice(0, 20))}」返工后 ${r.total} 分仍未达标，转人工复核 · <a class="lnk" onclick="openTaskModal('${t.id}')">去复核</a>`, '#ffb547');
        bubble(t.ownerId, '我来人工复核');
        updateBadges();
      }
      if (a && t.status !== 'doing') a.status = 'idle';
    } catch (e) {
      t.status = 'todo'; t.progress = 0; t.stuck = true; t.error = e.message; t.retries = (t.retries || 0) + 1;
      if (a) a.status = 'idle';
      simLog('esc', `⚠️ 「${esc(t.title.slice(0, 20))}」AI 执行失败：${esc(e.message)}${t.retries >= 2 ? '（已暂停，可在任务详情重试）' : '，稍后重试'}`, '#ff5d6c');
      if (t.retries >= 2) t.paused = true;
    } finally { clearInterval(anim); AI.running.delete(t.id); saveState(); }
  }
  function executorLoop() {
    if (!AI.on || !S.launched || !S.sim || S.sim.speed === 0) return;
    const queue = S.sim.tasks.filter((t) => t.real && !t.paused && !AI.running.has(t.id) && (t.status === 'todo' || t.status === 'rework')).reverse();
    while (AI.running.size < CONCURRENCY && queue.length) runTask(queue.shift());
  }
  setInterval(executorLoop, 1500);

  // ---------- 老板指令：AI 拆解 → 真实执行 ----------
  const localCommand = () => window._localBossCommand;
  function installCommand() {
    if (window._localBossCommand || !window.bossCommand) return;
    window._localBossCommand = window.bossCommand;
    window.bossCommand = async function (text) {
      text = (text || '').trim(); if (!text) return;
      if (!AI.on) return localCommand()(text);
      const inp = $('#cmd'); if (inp) inp.value = '';
      simLog('cmd', `👑 老板指令「${esc(text)}」→ 智脑正在调用 Genspark 拆解…`, '#ffd54f');
      bubble('boss', text.slice(0, 14));
      try {
        const r = await AI.call('/command', { ...ctxBase(), text, depts: S.depts.map((d) => ({ id: d.id, name: d.name })) });
        if (!r.tasks?.length) throw new Error('未拆解出任务');
        r.tasks.forEach((x, i) => {
          createTask(x.deptId, x.title, { core: true, kind: 'cmd', real: true, deliverable: x.deliverable, sla: x.sla, needApproval: x.needApproval });
          setTimeout(() => packet('boss', x.deptId, '指令', '#ffd54f'), i * 250);
        });
        simLog('cmd', `🎯 目标：<b>${esc(r.goal)}</b> · 拆解为 ${r.tasks.length} 个真实任务${r.tasks.some((x) => x.needApproval) ? '（含高风险动作，成果需老板审批）' : ''}`, '#ffd54f');
        toast(`Genspark 已拆解为 ${r.tasks.length} 个部门任务，Agent 开始真实执行`, 'fa-diagram-project');
        if (/订单|销售|商机|客户|市场/.test(text)) AI.scanLeads(true);
      } catch (e) { toast('AI 拆解失败，改用本地规则：' + e.message, 'fa-triangle-exclamation'); localCommand()(text); }
      saveState();
    };
  }

  // ---------- 商机雷达：Genspark 全网检索 + AI 分级 ----------
  AI.scanLeads = async function (manual) {
    if (!AI.on || AI.busy.leads) return;
    AI.busy.leads = true; AI.lastLeadScan = Date.now();
    const P = S.company.profile || {};
    const kws = (P.leadKeywords?.length ? P.leadKeywords : (S.industry?.div?.kw || S.industry?.div?.name || '').split(' ')).filter(Boolean);
    const pickKw = [...kws].sort(() => Math.random() - .5).slice(0, 2);
    simLog('lead', `🛰️ 销售 Agent 调用 Genspark 全网检索采购/招标：${esc(pickKw.join('、'))}`, '#3ee0ff');
    if (manual) toast('Genspark 全网检索商机中…', 'fa-satellite-dish');
    try {
      const r = await AI.call('/leads', { ...ctxBase(), keywords: pickKw });
      let added = 0, synced = 0;
      (r.leads || []).forEach((l) => {
        if (S.sim.leads.some((x) => x.link === l.link)) return;
        let src = ''; try { src = new URL(l.link).hostname.replace(/^www\./, ''); } catch { }
        const L = { id: uid('l'), title: l.title, link: l.link, desc: l.desc, source: src || '公开网络', real: true, ai: true, grade: l.grade, value: l.value, match: l.match, buyer: l.buyer, reason: l.reason, next: l.next, status: 'new', day: S.sim.day };
        S.sim.leads.unshift(L); added++;
        S.sim.metrics.leads++; S.sim.today.leads++;
        S.sim.real = S.sim.real || { done: 0, rework: 0, review: 0, leads: 0 }; S.sim.real.leads++;
        simLog('lead', `🎯 发现 <b>${L.grade}级</b> 真实商机：${esc(L.title.slice(0, 34))} · ${esc(L.reason || '')}`, L.grade === 'A' ? '#3ddc97' : '#3ee0ff');
        if (L.grade === 'A' && synced < 2) { synced++; syncLead(L, true); }
      });
      if (S.sim.leads.length > 80) S.sim.leads.length = 80;
      simLog('lead', `📡 本轮检索 ${r.searched} 条公开信息，AI 筛出 ${added} 条有效商机${synced ? `，${synced} 条 A 级已同步部门并生成真实跟进任务` : ''}`, '#3ee0ff');
      if (manual) toast(`新增 ${added} 条真实商机`, 'fa-crosshairs');
    } catch (e) { simLog('esc', `⚠️ 商机检索失败：${esc(e.message)}`, '#ff5d6c'); if (manual) toast('商机检索失败：' + e.message); }
    AI.busy.leads = false; saveState(); updateBadges();
  };
  // 自动巡检：每个仿真日最多一次，且真实时间间隔 ≥ 8 分钟（控制积分消耗）
  setInterval(() => {
    if (!AI.on || !S.launched || !S.sim || S.sim.speed === 0) return;
    if (S.sim.aiLeadDay === S.sim.day || Date.now() - AI.lastLeadScan < 8 * 60 * 1000) return;
    S.sim.aiLeadDay = S.sim.day; AI.scanLeads(false);
  }, 4000);

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
      simLog('cp', '📰 Genspark AI 经营日报已生成 · <a class="lnk" onclick="gotoView(\'cockpit\')">查看</a>', '#3ee0ff');
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
    } catch (e) { toast('视频生成失败：' + e.message); simLog('esc', `⚠️ 视频生成失败：${esc(e.message)}`, '#ff5d6c'); }
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
      simLog('task', `🧠 「${esc(t.title.slice(0, 20))}」已交给 Genspark 超级智能体深度执行`, '#8b5cff');
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
        if (r.result) { t.deep.result = r.result; simLog('done', `🧠 超级智能体完成「${esc(t.title.slice(0, 20))}」深度成果 · <a class="lnk" onclick="openTaskModal('${t.id}')">查看</a>`, '#8b5cff'); AI.refreshCredits(); }
        saveState();
        const m = $('.modal[data-task="' + t.id + '"]'); if (m) openTaskModal(t.id);
      } catch (e) { if (/无效/.test(e.message)) break; }
    }
    if (t.deep) t.deep.polling = false;
  }

  // ---------- 任务详情（成果 / 五维评测 / 版本 / 人工复核） ----------
  window.openTaskModal = function (id) {
    const t = S.sim.tasks.find((x) => x.id === id); if (!t) return toast('任务已归档');
    const d = S.depts.find((x) => x.id === t.deptId), a = agentOf(t.agentId);
    const st = { todo: '待执行', doing: 'AI执行中', rework: '返工中', review: '待人工复核', done: '已完成' }[t.status];
    const ev = t.evals?.ev;
    const m = openModal(`<div class="flex"><div class="bot-ic"><i class="fas fa-robot"></i></div><div style="min-width:0"><div class="h2" style="font-size:17px">${esc(t.title)}</div><div class="hint">${esc(d?.name || '')} · ${esc(a?.name || '')} · ${st}${t.real ? ' · <span style="color:var(--ok)">Genspark 真实执行</span>' : ' · 仿真任务'}</div></div><button class="close-x" data-close><i class="fas fa-xmark"></i></button></div>
      ${t.deliverable ? `<div class="hint mt"><b>交付物要求：</b>${esc(t.deliverable)}</div>` : ''}
      ${!t.real ? `<div class="card mt"><p class="muted" style="font-size:13px">这是平台背景仿真任务，没有真实成果。${AI.on ? '可以把它交给 Genspark 真实执行：' : '连接 Genspark 后可真实执行。'}</p>${AI.on ? '<button class="btn btn-pri btn-sm mt" id="tm-real"><i class="fas fa-bolt"></i>改为真实 AI 执行</button>' : ''}</div>` : ''}
      ${t.real && t.status !== 'done' && !t.output ? `<div class="card mt"><div class="flex"><i class="fas fa-spinner fa-spin" style="color:var(--c1)"></i><span>${t.error ? `执行失败：${esc(t.error)}` : 'Agent 正在调用 Genspark 执行…'}</span><div class="bar" style="flex:1"><i style="width:${t.progress}%"></i></div></div>${t.paused ? '<button class="btn btn-ghost btn-sm mt" id="tm-retry"><i class="fas fa-rotate"></i>重试</button>' : ''}</div>` : ''}
      ${ev ? `<div class="grid2 mt" style="grid-template-columns:1.6fr 1fr">
        <div class="card"><div class="ct"><span class="h3">AI 成果 ${t.history.length > 1 ? `<span class="tag p">第 ${t.history.length} 版</span>` : ''}</span><button class="btn btn-ghost btn-sm" id="tm-copy"><i class="fas fa-copy"></i>复制</button></div><div class="md" style="max-height:46vh;overflow:auto">${mdRender(t.output)}</div></div>
        <div class="col"><div class="card"><div class="ct"><span class="h3">AI 质检官 · 五维评测</span><b class="grad-txt" style="font-size:24px">${t.evals.total}</b></div>${EVAL_DIMS.map((dm) => `<div class="flex" style="margin:6px 0"><span style="width:60px;font-size:12px">${dm.name}</span><div class="bar" style="flex:1"><i style="width:${ev[dm.k]}%;${ev[dm.k] < 70 ? 'background:linear-gradient(90deg,#ff5d6c,#ffb547)' : ''}"></i></div><b style="width:26px;text-align:right;font-size:12px">${ev[dm.k]}</b></div>`).join('')}
          <div class="hint mt" style="line-height:1.6"><b>${t.evals.total >= 80 ? '亮点' : '评审意见'}：</b>${esc(t.feedback || '—')}</div></div>
          ${t.history.length > 1 ? `<div class="card"><div class="h3">版本记录</div>${t.history.map((h) => `<div class="flex between" style="font-size:12px;margin-top:6px"><span>v${h.v} · ${h.at}${h.researched ? ' · 含检索' : ''}</span><b style="color:${h.total >= 80 ? 'var(--ok)' : 'var(--warn)'}">${h.total}分</b></div>`).join('')}</div>` : ''}
        </div></div>` : ''}
      ${t.deep ? `<div class="card mt"><div class="ct"><span class="h3"><i class="fas fa-brain" style="color:var(--c2)"></i> Genspark 超级智能体</span><span class="tag ${t.deep.state === 'succeeded' ? 'ok' : 'p'}">${esc(t.deep.state)}</span></div>${t.deep.result ? `<div class="md" style="max-height:40vh;overflow:auto">${mdRender(t.deep.result.text || '（无文本成果）')}</div>` : '<div class="hint"><i class="fas fa-spinner fa-spin"></i> 深度执行中，每 15 秒自动刷新…</div>'}${t.deep.taskUrl ? `<a class="btn btn-ghost btn-sm mt" href="${esc(t.deep.taskUrl)}" target="_blank"><i class="fas fa-up-right-from-square"></i>在 Genspark 中查看完整过程</a>` : ''}</div>` : ''}
      ${t.real && t.output ? `<div class="card mt"><div class="h3">老板操作</div><div class="flex mt wrap">
        ${t.status !== 'done' ? '<button class="btn btn-pri btn-sm" id="tm-pass"><i class="fas fa-check"></i>人工通过</button>' : ''}
        <input id="tm-fb" placeholder="写下修改意见，让 Agent 返工" style="flex:1;min-width:200px;font-size:13px"><button class="btn btn-ghost btn-sm" id="tm-redo"><i class="fas fa-rotate-left"></i>打回重做</button>
        ${AI.on && !t.deep ? '<button class="btn btn-ghost btn-sm" id="tm-deep" style="border-color:var(--c2);color:#b69bff"><i class="fas fa-brain"></i>交给超级智能体深度执行</button>' : ''}
      </div></div>` : ''}`);
    m.dataset.task = id;
    const on = (sel, fn) => { const el = $(sel, m); if (el) el.onclick = fn; };
    on('#tm-real', () => { t.real = true; t.status = 'todo'; t.progress = 0; t.sla = 240; t.history = t.history || []; saveState(); toast('已交给 Genspark 真实执行'); openTaskModal(id); });
    on('#tm-retry', () => { t.paused = false; t.retries = 0; t.stuck = false; t.error = ''; saveState(); toast('已重新排队'); closeOverlay(); });
    on('#tm-copy', () => { navigator.clipboard?.writeText(t.output || ''); toast('已复制成果'); });
    on('#tm-pass', () => { if (t.status !== 'done') { t.evals.total = Math.max(t.evals.total, 80); completeTask(t); simLog('approval', `👤 老板人工通过「${esc(t.title.slice(0, 20))}」`, '#3ddc97'); saveState(); } openTaskModal(id); });
    on('#tm-redo', () => { const fb = $('#tm-fb', m).value.trim(); if (!fb) return toast('请写下修改意见'); if (t.status === 'done') S.sim.metrics.done--; t.feedback = `老板意见：${fb}`; t.rework = Math.max(1, t.rework || 0); t.status = 'rework'; t.progress = 30; t.paused = false; simLog('rework', `👑 老板打回「${esc(t.title.slice(0, 20))}」：${esc(fb)}`, '#ffd54f'); saveState(); toast('已打回，Agent 将按意见返工'); closeOverlay(); });
    on('#tm-deep', () => AI.deepAgent(t));
  };

  // ---------- 挂载：包装渲染函数以插入状态胶囊、安装指令接管 ----------
  const _rw = window.renderWizard; window.renderWizard = function () { _rw.apply(this, arguments); renderPill(); };
  const _rh = window.renderHQ; window.renderHQ = function () {
    _rh.apply(this, arguments); renderPill(); installCommand();
    (S.sim?.tasks || []).forEach((t) => { if (t.real && (t.status === 'doing')) { t.status = t.rework ? 'rework' : 'todo'; } if (t.deep) { t.deep.polling = false; pollDeep(t); } });
    if (AI.on && S.sim && !S.sim.leads.some((l) => l.ai) && Date.now() - AI.lastLeadScan > 60000) setTimeout(() => AI.scanLeads(false), 2500);
  };
})();
