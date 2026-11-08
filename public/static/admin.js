// 智导 · 后台管理（平台运营者）：入口 /#admin，口令 = 环境变量 ADMIN_CODE
(function () {
  const K = 'ebrain_admin';
  let tab = 'overview', data = {}, q = '', f = 'all', host = null, chart = null;
  const api = async (path, body) => {
    const r = await fetch('/api/admin' + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Admin-Code': sessionStorage.getItem(K) || '' }, body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await r.json(); } catch { }
    if (r.status === 401 && j?.needAdmin) { sessionStorage.removeItem(K); throw Object.assign(new Error(j.error), { auth: true }); }
    if (!r.ok || !j || j.ok === false) throw new Error(j?.error || `请求失败（${r.status}）`);
    return j;
  };
  const dt = (t) => t ? new Date(t).toLocaleString('zh-CN', { hour12: false }).slice(0, 16) : '—';
  const TABS = [['overview', 'fa-chart-line', '运营总览'], ['ideas', 'fa-lightbulb', '献策审核'], ['companies', 'fa-building', '入驻企业'], ['emails', 'fa-envelope', '邮件与退订'], ['cs', 'fa-headset', '客服会话'], ['sites', 'fa-globe', '网站交付'], ['cache', 'fa-database', '数据缓存']];
  const KN = { proposal: '策划案', suggestion: '改进建议', design: '设计思路' }, CHN = { inbox: '直推收件箱', email: '邮件代发', public: '公开献策' };

  window.openAdmin = function () {
    document.querySelector('.adm-overlay')?.remove();
    const o = document.createElement('div'); o.className = 'adm-overlay'; o.innerHTML = '<section class="adm"></section>';
    document.body.appendChild(o); host = o.firstChild; render();
  };
  const close = () => { document.querySelector('.adm-overlay')?.remove(); if (location.hash === '#admin') history.replaceState(null, '', location.pathname); };
  function render() {
    if (!sessionStorage.getItem(K)) return login();
    host.innerHTML = `<aside class="adm-nav"><div class="adm-logo"><i class="fas fa-shield-halved"></i><div><b>智导后台</b><small>平台运营管理</small></div></div>
      ${TABS.map(([k, i, n]) => `<button class="${tab === k ? 'on' : ''}" data-at="${k}"><i class="fas ${i}"></i>${n}</button>`).join('')}
      <div style="flex:1"></div><button data-home><i class="fas fa-house"></i>返回主页</button><button data-out><i class="fas fa-right-from-bracket"></i>退出后台</button></aside>
      <main class="adm-main" id="adm-main"><div class="hint"><i class="fas fa-spinner fa-spin"></i> 加载中…</div></main>`;
    $$('[data-at]', host).forEach((b) => b.onclick = () => { tab = b.dataset.at; render(); });
    $('[data-home]', host).onclick = () => { close(); window.goHome && goHome(); };
    $('[data-out]', host).onclick = () => { sessionStorage.removeItem(K); close(); };
    load();
  }
  function login() {
    host.innerHTML = `<div class="adm-login"><div class="adm-logo big"><i class="fas fa-shield-halved"></i></div><h2>智导后台管理</h2><p class="hint">请输入管理口令（部署时在环境变量 ADMIN_CODE 中设置）</p>
      <input id="adm-code" type="password" placeholder="管理口令" autocomplete="current-password"><button class="btn btn-pri" id="adm-go"><i class="fas fa-right-to-bracket"></i>进入后台</button><button class="btn btn-ghost btn-sm" id="adm-x"><i class="fas fa-house"></i>返回主页</button></div>`;
    const go = async () => { sessionStorage.setItem(K, $('#adm-code', host).value); try { await api('/overview'); render(); } catch (e) { sessionStorage.removeItem(K); toast(e.message, 'fa-triangle-exclamation'); } };
    $('#adm-go', host).onclick = go; $('#adm-x', host).onclick = () => { close(); window.goHome && goHome(); };
    $('#adm-code', host).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) go(); });
    setTimeout(() => $('#adm-code', host)?.focus(), 50);
  }
  async function load() {
    const m = $('#adm-main', host);
    try {
      const path = { overview: '/overview', ideas: `/ideas?q=${encodeURIComponent(q)}&f=${f}`, companies: '/companies', emails: '/emails', cs: '/cs', sites: '/sites', cache: '/cache' }[tab];
      data[tab] = await api(path); ({ overview, ideas, companies, emails, cs, sites, cache })[tab](m, data[tab]);
    } catch (e) { if (e.auth) return render(); m.innerHTML = `<div class="cmd-alert"><i class="fas fa-triangle-exclamation"></i> ${esc(e.message)}</div>`; }
  }
  const hd = (t, s, right = '') => `<div class="adm-hd"><div><h2>${t}</h2><p class="hint">${s}</p></div><div class="flex">${right}<button class="btn btn-ghost btn-sm" data-reload><i class="fas fa-rotate"></i>刷新</button></div></div>`;
  const bindReload = (m) => { const r = $('[data-reload]', m); if (r) r.onclick = load; };
  const act = async (path, body, msg) => { try { await api(path, body); toast(msg || '已更新'); load(); } catch (e) { toast(e.message, 'fa-triangle-exclamation'); } };

  function overview(m, d) {
    const T = d.totals, kpi = (i, l, v, s, c) => `<div class="adm-kpi"><i class="fas ${i}" style="color:${c}"></i><div><span>${l}</span><b>${v}</b><small>${s}</small></div></div>`;
    m.innerHTML = hd('运营总览', '献策市场、企业入驻、邮件代发、客服 Agent 与交付物的整体运营数据') + `
      <div class="adm-kpis">${kpi('fa-lightbulb', '献策总数', T.ideas, `真实 ${T.real} · 样板 ${T.samples} · 隐藏 ${T.hidden}`, '#f59e0b')}${kpi('fa-circle-check', '被采纳', T.adopted, `采纳率 ${T.real ? Math.round(T.adopted / T.real * 100) : 0}%`, '#059669')}${kpi('fa-building', '入驻企业', T.companies, '可接收直推献策', '#2563eb')}${kpi('fa-heart', '点赞', T.likes, '市场互动', '#ec4899')}
        ${kpi('fa-envelope', '代发邮件', T.emailsAll, `近 7 天 ${T.emails7} · 退订 ${T.optout}`, '#d97706')}${kpi('fa-headset', '客服 Agent', T.bots, `近 7 天会话 ${T.sessions7} · 转人工 ${T.human7}`, '#7c3aed')}${kpi('fa-globe', '生成网站', T.sites, `累计访问 ${T.siteViews}`, '#0ea5e9')}${kpi('fa-shield-halved', '合规', T.optout, '退订邮箱数（永不再发）', '#64748b')}</div>
      <div class="adm-grid"><div class="card"><div class="h4">近 14 天趋势（真实献策 / 客服会话）</div><div style="height:240px"><canvas id="adm-chart"></canvas></div></div>
        <div class="card"><div class="h4">献策构成</div>${(d.kinds || []).map((k) => `<div class="mk-bar2"><span>${KN[k.kind] || k.kind}</span><i><em class="k-${k.kind}" style="width:${Math.round(k.n / Math.max(1, T.ideas) * 100)}%"></em></i><b>${k.n}</b></div>`).join('')}
          <div class="h4 mt">投递渠道</div>${(d.channels || []).map((k) => `<div class="mk-bar2"><span>${CHN[k.channel] || k.channel}</span><i><em style="width:${Math.round(k.n / Math.max(1, T.ideas) * 100)}%;background:var(--c1)"></em></i><b>${k.n}</b></div>`).join('')}</div></div>`;
    bindReload(m);
    const draw = () => { if (!window.Chart || !$('#adm-chart', m)) return; chart?.destroy?.(); chart = new Chart($('#adm-chart', m), { type: 'line', data: { labels: d.series.map((x) => x.day), datasets: [{ label: '献策', data: d.series.map((x) => x.ideas), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.12)', fill: true, tension: .35 }, { label: '客服会话', data: d.series.map((x) => x.cs), borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.08)', fill: true, tension: .35 }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } }); };
    if (window.Chart) draw(); else { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/chart.js'; s.onload = draw; document.head.appendChild(s); }
  }
  function ideas(m, d) {
    const fs = [['all', '全部'], ['real', '真实用户'], ['sample', '样板'], ['featured', '精选'], ['hidden', '已隐藏'], ['email', '邮件代发']];
    m.innerHTML = hd('献策审核', '精选优质内容、隐藏违规内容；样板数据可一键整体隐藏', `<button class="btn btn-ghost btn-sm" id="smp-hide"><i class="fas fa-eye-slash"></i>隐藏全部样板</button><button class="btn btn-ghost btn-sm" id="smp-show"><i class="fas fa-eye"></i>显示样板</button>`) + `
      <div class="flex mt"><div class="mk-seg">${fs.map(([k, n]) => `<button class="${f === k ? 'on' : ''}" data-f="${k}">${n}</button>`).join('')}</div><input id="adm-q" placeholder="搜索标题 / 企业 / 昵称，回车" value="${esc(q)}" style="flex:1"></div>
      <table class="adm-table mt"><thead><tr><th>献策</th><th>目标企业</th><th>类型</th><th>渠道 / 状态</th><th>AI</th><th>赞</th><th>时间</th><th>操作</th></tr></thead><tbody>
      ${d.ideas.map((x) => `<tr class="${x.hidden ? 'dim-row' : ''}"><td><b>${esc(x.title)}</b>${x.sample ? ' <span class="mk-sample">样板</span>' : ''}${x.featured ? ' <span class="mk-feat"><i class="fas fa-star"></i>精选</span>' : ''}<small>${esc(x.nickname || '匿名')}${x.contact ? ' · ' + esc(x.contact) : ''}</small></td><td>${esc(x.target_name)}${x.company_id ? ' <i class="fas fa-circle-check" style="color:var(--ok)" title="已入驻"></i>' : ''}</td><td>${KN[x.kind] || x.kind}</td><td><span class="tag">${CHN[x.channel] || x.channel}</span><small>${esc(x.status)}${x.email_to ? ' · ' + esc(x.email_to) : ''}</small></td><td>${x.eval?.total ?? '—'}</td><td>${x.likes}</td><td><small>${dt(x.created_at)}</small></td>
        <td class="adm-ops"><a class="btn btn-ghost btn-sm" href="/api/ideas/view/${x.id}" target="_blank" rel="noopener" title="查看"><i class="fas fa-eye"></i></a><button class="btn btn-ghost btn-sm" data-op="feature" data-id="${x.id}" data-v="${x.featured ? 0 : 1}" title="${x.featured ? '取消精选' : '设为精选'}"><i class="fas fa-star" style="color:${x.featured ? '#f59e0b' : ''}"></i></button><button class="btn btn-ghost btn-sm" data-op="hide" data-id="${x.id}" data-v="${x.hidden ? 0 : 1}" title="${x.hidden ? '恢复显示' : '隐藏'}"><i class="fas ${x.hidden ? 'fa-eye' : 'fa-eye-slash'}"></i></button><button class="btn btn-danger btn-sm" data-op="delete" data-id="${x.id}" title="删除"><i class="fas fa-trash"></i></button></td></tr>`).join('') || '<tr><td colspan="8" class="hint">暂无数据</td></tr>'}</tbody></table>`;
    bindReload(m);
    $$('[data-f]', m).forEach((b) => b.onclick = () => { f = b.dataset.f; load(); });
    $('#adm-q', m).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { q = e.target.value.trim(); load(); } });
    $$('[data-op]', m).forEach((b) => b.onclick = () => { if (b.dataset.op === 'delete' && !confirm('确定永久删除这条献策？')) return; act('/idea', { id: b.dataset.id, action: b.dataset.op, value: +b.dataset.v }); });
    $('#smp-hide', m).onclick = () => act('/idea', { action: 'samples', value: 1 }, '已隐藏全部样板');
    $('#smp-show', m).onclick = () => act('/idea', { action: 'samples', value: 0 }, '样板已恢复显示');
  }
  function companies(m, d) {
    m.innerHTML = hd('入驻企业', '入驻企业可在收件箱接收用户献策；删除企业后其献策回到公开状态') + `<table class="adm-table mt"><thead><tr><th>企业</th><th>别名</th><th>行业</th><th>通知邮箱</th><th>收到献策</th><th>入驻时间</th><th></th></tr></thead><tbody>
      ${d.companies.map((x) => `<tr><td><b>${esc(x.name)}</b><small>${x.id}</small></td><td>${esc(x.alias || '—')}</td><td>${esc(x.industry || '—')}</td><td>${esc(x.email || '—')}</td><td>${x.ideas}</td><td><small>${dt(x.created_at)}</small></td><td><button class="btn btn-danger btn-sm" data-del="${x.id}"><i class="fas fa-trash"></i></button></td></tr>`).join('') || '<tr><td colspan="7" class="hint">暂无入驻企业</td></tr>'}</tbody></table>`;
    bindReload(m);
    $$('[data-del]', m).forEach((b) => b.onclick = () => { if (confirm('删除该企业？其献策将回到公开状态')) act('/company/delete', { id: b.dataset.del }, '已删除'); });
  }
  function emails(m, d) {
    m.innerHTML = hd('邮件与退订', '所有代发邮件的发送记录与退订名单（退订邮箱永不再发）') + `<div class="adm-grid"><div class="card"><div class="h4">发送记录（${d.emails.length}）</div><table class="adm-table mt"><thead><tr><th>收件邮箱</th><th>献策</th><th>提案人</th><th>时间</th></tr></thead><tbody>${d.emails.map((x) => `<tr><td>${esc(x.to_email)}</td><td><b>${esc(x.title || '—')}</b><small>→ ${esc(x.target_name || '')}</small></td><td>${esc(x.nickname || '')}</td><td><small>${dt(x.at)}</small></td></tr>`).join('') || '<tr><td colspan="4" class="hint">暂无</td></tr>'}</tbody></table></div>
      <div class="card"><div class="h4">退订名单（${d.optout.length}）</div>${d.optout.map((x) => `<div class="sv-row"><b>${esc(x.email)}</b><small>${dt(x.at)}</small></div>`).join('') || '<div class="hint mt">暂无</div>'}</div></div>`;
    bindReload(m);
  }
  function cs(m, d) {
    m.innerHTML = hd('客服会话', '全平台客服 Agent 与会话（只读，企业在自己的服务中心接管回复）') + `<div class="adm-grid"><div class="card"><div class="h4">客服 Agent（${d.bots.length}）</div>${d.bots.map((x) => `<div class="sv-row"><b>${esc(x.name)}</b><small>${esc(x.company || '—')} · ${x.sessions} 个会话 · ${dt(x.created_at)}</small><a class="lnk" href="/cs/chat/${x.id}" target="_blank" rel="noopener">对话页</a></div>`).join('') || '<div class="hint mt">暂无</div>'}</div>
      <div class="card"><div class="h4">最近会话</div><div id="adm-sess">${d.sessions.map((x) => `<button class="adm-sess" data-s="${x.id}"><span class="tag ${x.status === 'human' ? 'warn' : x.status === 'closed' ? '' : 'ok'}">${x.status === 'human' ? '待人工' : x.status === 'closed' ? '已结束' : 'AI'}</span><b>${esc(x.last_text || '（新会话）')}</b><small>${esc(x.bot || '')} · ${x.msgs} 条 · ${dt(x.updated_at)}</small></button>`).join('') || '<div class="hint mt">暂无</div>'}</div><div id="adm-msgs" class="mt"></div></div></div>`;
    bindReload(m);
    $$('[data-s]', m).forEach((b) => b.onclick = async () => { const r = await api('/cs/messages?sid=' + b.dataset.s); $('#adm-msgs', m).innerHTML = `<div class="sv-msgs">${r.msgs.map((x) => `<div class="sv-m ${x.role}"><small>${{ user: '客户', bot: 'AI 客服', agent: '人工' }[x.role]} · ${dt(x.at)}</small>${esc(x.text)}</div>`).join('')}</div>`; });
  }
  function sites(m, d) {
    m.innerHTML = hd('网站交付', 'AI 生成的企业官网（公开访问地址 /s/:id），可下线违规站点') + `<table class="adm-table mt"><thead><tr><th>网站</th><th>企业</th><th>大小</th><th>访问</th><th>生成时间</th><th></th></tr></thead><tbody>
      ${d.sites.map((x) => `<tr><td><b>${esc(x.title)}</b><small>/s/${x.id}</small></td><td>${esc(x.company)}</td><td>${Math.round(x.size / 1024)} KB</td><td>${x.views}</td><td><small>${dt(x.created_at)}</small></td><td class="adm-ops"><a class="btn btn-ghost btn-sm" href="/s/${x.id}" target="_blank" rel="noopener"><i class="fas fa-arrow-up-right-from-square"></i></a><button class="btn btn-danger btn-sm" data-del="${x.id}"><i class="fas fa-trash"></i></button></td></tr>`).join('') || '<tr><td colspan="6" class="hint">暂无</td></tr>'}</tbody></table>`;
    bindReload(m);
    $$('[data-del]', m).forEach((b) => b.onclick = () => { if (confirm('下线并删除该网站？')) act('/site/delete', { id: b.dataset.del }, '已下线'); });
  }
  function cache(m, d) {
    m.innerHTML = hd('数据缓存', '雷达 / 视频 / 贸易数据的服务端缓存：过期后被访问会自动重新抓取；清除可强制下次实时抓取', '<button class="btn btn-danger btn-sm" id="cc-all"><i class="fas fa-broom"></i>清空全部</button>') + `<table class="adm-table mt"><thead><tr><th>缓存键</th><th>大小</th><th>更新时间</th><th></th></tr></thead><tbody>
      ${d.cache.map((x) => `<tr><td><code>${esc(x.key)}</code></td><td>${Math.round(x.size / 1024 * 10) / 10} KB</td><td><small>${dt(x.updated_at)}</small></td><td><button class="btn btn-ghost btn-sm" data-ck="${esc(x.key)}"><i class="fas fa-xmark"></i>清除</button></td></tr>`).join('') || '<tr><td colspan="4" class="hint">暂无缓存</td></tr>'}</tbody></table>`;
    bindReload(m);
    $$('[data-ck]', m).forEach((b) => b.onclick = () => act('/cache/clear', { key: b.dataset.ck }, '已清除'));
    $('#cc-all', m).onclick = () => { if (confirm('清空全部数据缓存？')) act('/cache/clear', {}, '已清空'); };
  }
})();
