// 智导 · 服务中心：数据雷达 / 热点视频 / 贸易数据 / 政务办事 / 交付工坊 / 客服 Agent
// 数据类结果缓存在服务端 D1：过期后打开即自动重新抓取；服务 Agent 在智脑运行时按设定自动刷新雷达
(function () {
  const H = 3600e3;
  const uid = () => { let v = localStorage.getItem('ebrain_uid'); if (!v) { v = 'u_' + Math.random().toString(36).slice(2, 12); localStorage.setItem('ebrain_uid', v); } return v; };
  const api = async (path, body) => {
    const headers = { 'Content-Type': 'application/json' }; const code = localStorage.getItem('ebrain_code'); if (code) headers['X-Brain-Code'] = code;
    const r = await fetch(path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await r.json(); } catch { }
    if (r.status === 401 && j?.needCode) { const v = prompt('该智导设置了访问口令，请输入：'); if (v) { localStorage.setItem('ebrain_code', v); return api(path, body); } }
    if (!r.ok || !j || j.ok === false) throw new Error(j?.error || `请求失败（${r.status}）`);
    return j;
  };
  const svc = () => { S.svc = S.svc || {}; S.svc.auto = Object.assign({ radar: true, notify: true }, S.svc.auto || {}); S.svc.deliver = S.svc.deliver || []; return S.svc; };
  const ctx = () => { const P = S.company?.profile || {}; return { company: S.company?.name || '', industry: `${S.industry?.name || ''}${S.industry?.div ? ' › ' + S.industry.div.name : ''}`, business: P.business || P.positioning || '', keywords: String(S.industry?.div?.kw || '').split(/\s+/).filter(Boolean).slice(0, 4), engine: window.roleModel ? roleModel('research') : undefined }; };
  const ago = (t) => { if (!t) return '—'; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? '刚刚' : m < 60 ? `${m} 分钟前` : m < 1440 ? `${Math.round(m / 60)} 小时前` : `${Math.round(m / 1440)} 天前`; };
  const src = (s) => s?.url ? `<a class="sv-src" href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.title || '')}"><i class="fas fa-link"></i>${esc((s.title || '来源').slice(0, 14))}</a>` : '';
  const ai = () => window.AI && AI.on;
  let tab = 'radar', busy = '', host = null;
  const TABS = [['radar', 'fa-satellite-dish', '数据雷达'], ['videos', 'fa-circle-play', '热点视频'], ['trade', 'fa-ship', '贸易数据'], ['gov', 'fa-landmark', '政务办事'], ['deliver', 'fa-wand-magic-sparkles', '交付工坊'], ['cs', 'fa-headset', '客服 Agent']];

  function render(p) {
    host = p; const V = svc();
    p.innerHTML = `<div class="page-hd"><div class="ic" style="background:linear-gradient(135deg,#0ea5e9,#6366f1)"><i class="fas fa-layer-group"></i></div><div><div class="h2">服务中心</div><div class="hint">企业的外部大脑：实时数据、热点参考、贸易与政务、高级交付物、7×24 客服 —— 由服务 Agent 自动维护</div></div>
      <div class="sv-auto" title="服务 Agent 自动化"><label class="sv-sw"><input type="checkbox" id="sv-auto" ${V.auto.radar ? 'checked' : ''}><span></span></label><div><b>服务 Agent 自动更新</b><small>${V.auto.radar ? `雷达每 6 小时自动刷新 · 上次 ${ago(V.radarAt)}` : '已暂停'}</small></div></div></div>
      <nav class="sv-tabs">${TABS.map(([k, i, n]) => `<button class="${tab === k ? 'on' : ''}" data-svt="${k}"><i class="fas ${i}"></i>${n}</button>`).join('')}</nav>
      <div id="sv-body" class="mt"></div>`;
    $$('[data-svt]', p).forEach((b) => b.onclick = () => { tab = b.dataset.svt; render(p); });
    $('#sv-auto', p).onchange = (e) => { V.auto.radar = e.target.checked; saveState(); render(p); if (e.target.checked) autoTick(true); };
    ({ radar, videos, trade, gov, deliver, cs })[tab]($('#sv-body', p));
  }
  const rerender = () => { if (host && document.body.contains(host)) render(host); };
  const head = (title, sub, data, refreshId) => `<div class="sv-hd"><div><div class="h3">${title}</div><div class="hint">${sub}</div></div>${data ? `<div class="sv-upd"><span class="sv-dot ${data.cached ? '' : 'fresh'}"></span>更新于 ${ago(data.updatedAt)}${data.cached ? ' · 缓存' : ' · 刚抓取'}<button class="btn btn-ghost btn-sm" id="${refreshId}" ${busy ? 'disabled' : ''}><i class="fas fa-rotate ${busy === refreshId ? 'fa-spin' : ''}"></i>立即刷新</button></div>` : ''}</div>`;
  const loading = (t) => `<div class="sv-loading"><div class="sv-pulse"><i class="fas fa-satellite-dish"></i></div><b>${t}</b><span>服务 Agent 正在全网检索并交给 AI 分析，约 30-90 秒</span></div>`;
  const needAI = () => ai() ? '' : '<div class="cmd-alert"><i class="fas fa-plug"></i> 需要连接 AI 才能使用服务中心的实时数据能力</div>';
  async function load(key, path, body, refresh) {
    const V = svc(); busy = key; rerender();
    try { const r = await api(path, { ...ctx(), ...body, refresh }); V[key] = r; if (key === 'radar') V.radarAt = r.updatedAt; saveState(); }
    catch (e) { toast('获取失败：' + e.message, 'fa-triangle-exclamation'); }
    busy = ''; rerender();
  }

  // ---------------- ① 数据雷达 ----------------
  function radar(b) {
    const R = svc().radar;
    if (!R && busy !== 'radar' && ai()) { load('radar', '/api/svc/radar', {}); }
    if (!R) { b.innerHTML = needAI() + (busy === 'radar' ? loading('正在扫描行业雷达…') : ''); return; }
    const lv = { high: ['高', 'bad'], mid: ['中', 'warn'], low: ['低', ''] }, tr = { up: ['fa-arrow-trend-up', 'var(--ok)'], down: ['fa-arrow-trend-down', 'var(--bad)'], flat: ['fa-minus', 'var(--dim)'] };
    b.innerHTML = head('行业数据雷达', `${esc(ctx().industry)} · 政策 / 需求 / 竞争 / 价格 / 技术五路信号，每条结论附来源`, R, 'radar-ref') + `
      <div class="sv-radar">
        <div class="sv-heat card"><div class="fs-ring ${R.heat >= 70 ? 'ok' : R.heat >= 50 ? 'warn' : 'bad'}" style="--p:${R.heat};width:96px;height:96px"><b style="font-size:26px">${R.heat}</b><small>景气度</small></div><div><div class="h3">${esc(R.headline)}</div><div class="hint mt">景气度为 AI 根据检索证据给出的估计值，仅供参考</div></div></div>
        <div class="sv-metrics">${(R.metrics || []).map((m) => `<div class="sv-metric"><span>${esc(m.name)}</span><b>${esc(m.value)}</b><div class="flex between"><i class="fas ${tr[m.trend][0]}" style="color:${tr[m.trend][1]}"></i>${src(m.source)}</div></div>`).join('')}</div>
      </div>
      <div class="grid2 mt"><div class="card"><div class="h4"><i class="fas fa-bolt" style="color:#f59e0b"></i> 关键信号</div>${(R.signals || []).map((s) => `<div class="sv-signal"><span class="tag ${lv[s.level][1]}">${lv[s.level][0]} · ${esc(s.type)}</span><div><b>${esc(s.title)}</b><small>${esc(s.impact)}</small>${src(s.source)}</div></div>`).join('') || '<div class="hint mt">暂无</div>'}</div>
        <div class="card"><div class="h4"><i class="fas fa-list-check" style="color:var(--ok)"></i> 本周建议动作</div>${(R.actions || []).map((a) => `<div class="sv-action"><span>${esc(a)}</span>${S.launched && window.Flow ? `<button class="btn btn-ghost btn-sm" data-issue="${esc(a)}"><i class="fas fa-paper-plane"></i>下达</button>` : ''}</div>`).join('')}
          <div class="h4 mt"><i class="fas fa-book-open" style="color:var(--c1)"></i> 证据来源（${(R.sources || []).length}）</div><div class="sv-srcs">${(R.sources || []).slice(0, 10).map((s) => src(s)).join('')}</div></div></div>`;
    on(b, '#radar-ref', () => load('radar', '/api/svc/radar', {}, true));
    issueBtns(b);
  }
  function issueBtns(b) { $$('[data-issue]', b).forEach((x) => x.onclick = () => { const c = Flow.issue(x.dataset.issue, { source: 'boss' }); if (c) { toast(`已作为指令 #${c.no} 下达`, 'fa-paper-plane'); gotoView('flow'); } }); }
  const on = (b, sel, fn) => { const el = $(sel, b); if (el) el.onclick = fn; };

  // ---------------- ② 热点视频 ----------------
  function videos(b) {
    const R = svc().videos;
    if (!R && busy !== 'videos' && ai()) load('videos', '/api/svc/videos', {});
    if (!R) { b.innerHTML = needAI() + (busy === 'videos' ? loading('正在检索可参考的热点视频…') : ''); return; }
    const fmt = (n) => n >= 1e4 ? (n / 1e4).toFixed(1) + '万' : n;
    b.innerHTML = head('热点视频参考', `按企业特色（${esc(ctx().keywords.join(' / ') || ctx().industry)}）推荐可借鉴的视频，AI 标注可借鉴点`, R, 'vid-ref') + `
      ${R.summary ? `<div class="fb-box mt"><b>规律：</b>${esc(R.summary)}</div>` : ''}
      <div class="sv-vids mt">${(R.videos || []).map((v) => `<a class="sv-vid" href="${esc(v.url)}" target="_blank" rel="noopener"><div class="sv-thumb" style="background-image:url('${esc(v.thumb)}')"><span>${esc(v.length || '')}</span>${v.angle ? `<em>${esc(v.angle)}</em>` : ''}</div><div class="sv-vb"><b>${esc(v.title)}</b><small>${esc(v.channel)} · ${fmt(v.views)} 次播放 · ${esc(v.published || '')}</small>${v.why ? `<p><i class="fas fa-lightbulb"></i>${esc(v.why)}</p>` : ''}</div></a>`).join('')}</div>
      ${(R.ideas || []).length ? `<div class="card mt"><div class="h4"><i class="fas fa-clapperboard" style="color:#ec4899"></i> 我们可以拍的选题</div><div class="grid3 mt">${R.ideas.map((x) => `<div class="sv-idea"><span class="tag p">${esc(x.format)}</span><b>${esc(x.title)}</b><small>开头 3 秒：${esc(x.hook)}</small>${S.launched && window.Flow ? `<button class="btn btn-ghost btn-sm" data-issue="${esc('拍摄短视频：' + x.title + '（钩子：' + x.hook + '）')}"><i class="fas fa-paper-plane"></i>交给内容团队</button>` : ''}</div>`).join('')}</div></div>` : ''}
      <div class="hint mt">视频来自公开平台检索，仅作创意参考；转载或二次创作请遵守原作者授权。</div>`;
    on(b, '#vid-ref', () => load('videos', '/api/svc/videos', {}, true));
    issueBtns(b);
  }

  // ---------------- ③ 贸易数据 ----------------
  function trade(b) {
    const V = svc(), R = V.trade;
    const prod = V.tradeQ || ctx().keywords[0] || '';
    b.innerHTML = head('贸易数据', '海关 / 商务部等公开数据检索：进出口规模、主要市场、关税与政策，每个数字附来源', R, 'trade-ref') + needAI() + `
      <div class="flex mt"><input id="tr-q" placeholder="输入产品或品类，如：储能电池、光伏组件、电动工具" value="${esc(prod)}" style="flex:1"><button class="btn btn-pri" id="tr-go" ${busy || !ai() ? 'disabled' : ''}><i class="fas ${busy === 'trade' ? 'fa-spinner fa-spin' : 'fa-magnifying-glass-chart'}"></i>${busy === 'trade' ? '检索中…' : '查询贸易数据'}</button></div>
      ${busy === 'trade' ? loading('正在检索公开贸易数据…') : ''}
      ${R ? `<div class="card mt"><div class="flex between"><div class="h3">${esc(R.product)}${R.hs ? ` <span class="tag">HS ${esc(R.hs)}</span>` : ''}</div></div><p class="mt">${esc(R.overview)}</p>
        <div class="sv-metrics mt">${(R.figures || []).map((f) => `<div class="sv-metric"><span>${esc(f.name)}</span><b>${esc(f.value)}</b><div class="flex between"><small style="color:${/^-|下降|减少/.test(f.yoy) ? 'var(--bad)' : 'var(--ok)'}">${f.yoy ? '同比 ' + esc(f.yoy) : ''}</small>${src(f.source)}</div></div>`).join('') || '<div class="hint">未检索到可核验的数字</div>'}</div></div>
        <div class="grid3 mt"><div class="card"><div class="h4"><i class="fas fa-earth-asia" style="color:var(--c1)"></i> 主要市场</div>${(R.markets || []).map((m) => `<div class="sv-row"><b>${esc(m.name)}</b><small>${esc(m.note)}</small>${src(m.source)}</div>`).join('')}</div>
          <div class="card"><div class="h4"><i class="fas fa-scale-balanced" style="color:#d97706"></i> 关税与政策</div>${(R.policies || []).map((x) => `<div class="sv-row"><b>${esc(x.title)}</b><small>${esc(x.impact)}</small>${src(x.source)}</div>`).join('')}</div>
          <div class="card"><div class="h4"><i class="fas fa-rocket" style="color:var(--ok)"></i> 机会</div>${(R.opportunities || []).map((o) => `<div class="sv-row"><span>${esc(o)}</span>${S.launched && window.Flow ? `<button class="btn btn-ghost btn-sm" data-issue="${esc('评估贸易机会：' + o)}">评估</button>` : ''}</div>`).join('')}
            <div class="h4 mt">官方数据入口</div>${(R.links || []).map((l) => `<a class="sv-link" href="${esc(l.url)}" target="_blank" rel="noopener"><i class="fas fa-arrow-up-right-from-square"></i>${esc(l.name)}</a>`).join('')}</div></div>` : ''}`;
    const go = (refresh) => { const q = $('#tr-q', b).value.trim(); if (!q) return toast('请输入产品'); V.tradeQ = q; load('trade', '/api/svc/trade', { product: q }, refresh); };
    on(b, '#tr-go', () => go(false)); on(b, '#trade-ref', () => go(true));
    $('#tr-q', b).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) go(false); });
    issueBtns(b);
  }

  // ---------------- ④ 政务办事 ----------------
  const GOV_LINKS = [['国家税务总局', 'https://www.chinatax.gov.cn/', 'fa-file-invoice-dollar', '电子税务局、申报缴税、发票'], ['国家企业信用信息公示系统', 'https://www.gsxt.gov.cn/', 'fa-building-shield', '企业年报、信用查询'], ['国家政务服务平台', 'https://gjzwfw.www.gov.cn/', 'fa-landmark', '全国一网通办入口'], ['国家市场监督管理总局', 'https://www.samr.gov.cn/', 'fa-stamp', '企业登记注册、变更、注销'], ['国家社会保险公共服务平台', 'https://si.12333.gov.cn/', 'fa-people-roof', '社保查询与业务办理'], ['中国国际贸易单一窗口', 'https://www.singlewindow.cn/', 'fa-ship', '进出口申报、备案']];
  const GOV_ITEMS = [['企业注册开办', 'fa-building-circle-check'], ['工商变更登记', 'fa-pen-to-square'], ['新办企业税务报到', 'fa-id-card'], ['增值税纳税申报', 'fa-receipt'], ['企业所得税汇算清缴', 'fa-calculator'], ['企业年度报告公示', 'fa-file-signature'], ['数电发票开具与领用', 'fa-file-invoice'], ['单位社保开户', 'fa-people-group'], ['住房公积金单位开户', 'fa-house-chimney'], ['进出口经营者备案', 'fa-ship'], ['高新技术企业认定', 'fa-award'], ['企业简易注销', 'fa-door-closed']];
  function taxCalendar() {
    const d = new Date(), y = d.getFullYear(), m = d.getMonth(), day = (yy, mm, dd) => new Date(yy, mm, dd, 23, 59);
    const ev = [];
    for (let k = 0; k < 3; k++) { const mm = m + k, dl = day(y, mm, 15); ev.push({ t: dl, n: '月度申报', d: '增值税、附加税费、个人所得税（代扣代缴）等，每月 1-15 日（遇节假日顺延）', tag: '每月' }); }
    [0, 3, 6, 9].forEach((qm) => { [y, y + 1].forEach((yy) => ev.push({ t: day(yy, qm, 15), n: '企业所得税季度预缴', d: '季度终了后 15 日内预缴申报', tag: '每季' })); });
    [y, y + 1].forEach((yy) => { ev.push({ t: day(yy, 4, 31), n: '企业所得税年度汇算清缴', d: '1 月 1 日 - 5 月 31 日，汇算上一年度', tag: '每年' }); ev.push({ t: day(yy, 5, 30), n: '企业年度报告公示', d: '1 月 1 日 - 6 月 30 日，在信用信息公示系统报送上一年度年报', tag: '每年' }); ev.push({ t: day(yy, 5, 30), n: '个人所得税综合所得汇算', d: '3 月 1 日 - 6 月 30 日（员工个人办理，企业可协助提醒）', tag: '每年' }); });
    return ev.filter((e) => e.t >= d).sort((a, b) => a.t - b.t).filter((e, i, arr) => arr.findIndex((x) => x.n === e.n) === i).slice(0, 5);
  }
  function gov(b) {
    const V = svc(), R = V.gov, cal = taxCalendar(), dleft = (t) => Math.ceil((t - Date.now()) / 86400e3);
    b.innerHTML = head('政务办事', '报税日历、注册年报、社保发票、进出口备案等一站式指引；AI 只做办事指引，不代办、不收集任何账号密码') + `
      <div class="sv-gov">
        <div class="card"><div class="h4"><i class="fas fa-calendar-check" style="color:var(--c1)"></i> 报税与年报日历（通用规则）</div>${cal.map((e) => { const n = dleft(e.t); return `<div class="sv-cal ${n <= 7 ? 'urgent' : ''}"><div class="sv-cd"><b>${n}</b><small>天后</small></div><div><b>${e.n}</b> <span class="tag">${e.tag}</span><small>截止 ${e.t.getMonth() + 1} 月 ${e.t.getDate()} 日 · ${e.d}</small></div>${S.launched && window.Flow && n <= 15 ? `<button class="btn btn-ghost btn-sm" data-issue="${esc(`准备${e.n}（截止 ${e.t.getMonth() + 1}/${e.t.getDate()}）：核对数据、准备材料、按时申报`)}">安排</button>` : ''}</div>`; }).join('')}<div class="hint mt">具体期限以主管税务机关公布的申报日历为准（节假日会顺延）。</div></div>
        <div class="card"><div class="h4"><i class="fas fa-landmark" style="color:#0ea5e9"></i> 官方办理入口</div><div class="sv-links">${GOV_LINKS.map(([n, u, i, d]) => `<a href="${u}" target="_blank" rel="noopener"><i class="fas ${i}"></i><div><b>${n}</b><small>${d}</small></div><i class="fas fa-arrow-up-right-from-square sv-ext"></i></a>`).join('')}</div></div>
      </div>
      <div class="card mt"><div class="h4"><i class="fas fa-robot" style="color:var(--c2)"></i> AI 政务指引：要办什么事？</div>
        <div class="sv-govitems mt">${GOV_ITEMS.map(([n, i]) => `<button data-gq="${n}"><i class="fas ${i}"></i>${n}</button>`).join('')}</div>
        <div class="flex mt"><input id="gv-region" placeholder="所在地区（如：上海市浦东新区）" value="${esc(V.region || '')}" style="width:220px"><input id="gv-q" placeholder="或直接描述，例如：公司想申请小规模纳税人转一般纳税人" value="${esc(V.govQ || '')}" style="flex:1"><button class="btn btn-pri" id="gv-go" ${busy || !ai() ? 'disabled' : ''}><i class="fas ${busy === 'gov' ? 'fa-spinner fa-spin' : 'fa-compass'}"></i>${busy === 'gov' ? '检索官方指引中…' : '生成办事指引'}</button></div>
        ${busy === 'gov' ? loading('正在检索政府官网的办事指南…') : ''}
        ${R ? `<div class="sv-guide mt"><div class="flex between"><div><div class="h3">${esc(R.title)}</div><div class="hint">主管部门：${esc(R.dept || '—')} · 时限：${esc(R.timeline || '—')} · 费用：${esc(R.fee || '—')}</div></div>${R.entry?.source ? `<a class="btn btn-pri btn-sm" href="${esc(R.entry.source.url)}" target="_blank" rel="noopener"><i class="fas fa-arrow-up-right-from-square"></i>${esc(R.entry.name || '官方入口')}</a>` : ''}</div>
          <div class="grid3 mt"><div><div class="h4">办理条件</div><ul>${(R.conditions || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div><div><div class="h4">所需材料</div><ul>${(R.materials || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div><div><div class="h4">办理步骤</div><ol>${(R.steps || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div></div>
          ${(R.notes || []).length ? `<div class="fb-box mt"><b>注意：</b>${R.notes.map(esc).join('；')}</div>` : ''}
          <div class="flex mt wrap"><span class="hint">依据：</span>${(R.sources || []).map(src).join('')}<span class="hint" style="margin-left:auto">各地规定可能不同，请以当地主管部门为准</span></div></div>` : ''}</div>`;
    const ask = (q) => { q = (q || $('#gv-q', b).value).trim(); if (!q) return toast('请描述要办的事'); V.govQ = q; V.region = $('#gv-region', b).value.trim(); busy = 'gov'; rerender(); api('/api/svc/gov/ask', { ...ctx(), q, region: V.region }).then((r) => { V.gov = r; saveState(); }).catch((e) => toast('获取失败：' + e.message, 'fa-triangle-exclamation')).finally(() => { busy = ''; rerender(); }); };
    $$('[data-gq]', b).forEach((x) => x.onclick = () => { $('#gv-q', b).value = x.dataset.gq; ask(x.dataset.gq); });
    on(b, '#gv-go', () => ask());
    $('#gv-q', b).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) ask(); });
    issueBtns(b);
  }

  // ---------------- ⑤ 交付工坊：网站 / 海报 / 视频 ----------------
  let sites = null;
  function deliver(b) {
    const V = svc(), c = ctx(), P = S.company?.profile || {};
    if (sites === null) { sites = []; api('/api/svc/sites?uid=' + uid()).then((r) => { sites = r.sites; rerender(); }).catch(() => { }); }
    const styles = ['明亮、专业、现代', '科技感、未来、深浅对比', '温暖、国潮、亲和', '极简、高端、留白'];
    b.innerHTML = head('交付工坊', '比文档更高一级的交付物：企业官网 / 宣传海报 / 宣传短视频，一键生成、可直接使用') + needAI() + `
      <div class="sv-dl">
        <div class="sv-dcard dc-site"><div class="sv-dic"><i class="fas fa-globe"></i></div><h3>企业官网</h3><p>AI 设计并写出完整的响应式落地页，生成后获得公开访问链接，可直接分享</p>
          <select id="dl-style">${styles.map((s) => `<option ${V.siteStyle === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
          <button class="btn btn-pri" id="dl-site" ${busy || !ai() || !c.company ? 'disabled' : ''}><i class="fas ${busy === 'site' ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}"></i>${busy === 'site' ? '设计中（约 1-3 分钟）…' : '生成官网'}</button><small>模型：${esc(window.modelName ? modelName(roleModel('slideDesign')) : 'Claude')}</small></div>
        <div class="sv-dcard dc-poster"><div class="sv-dic"><i class="fas fa-image"></i></div><h3>宣传海报</h3><p>按企业主营生成海报主视觉；需要加文案排版时，可到内容工厂继续编辑</p>
          <input id="dl-ptheme" placeholder="海报主题（选填），如：秋季新品发布" value="${esc(V.posterTheme || '')}">
          <button class="btn btn-pri" id="dl-poster" ${busy || !ai() ? 'disabled' : ''}><i class="fas ${busy === 'poster' ? 'fa-spinner fa-spin' : 'fa-palette'}"></i>${busy === 'poster' ? '出图中…' : '生成海报（约 20 积分）'}</button><small><a class="lnk" id="dl-studio">去内容工厂排版 →</a></small></div>
        <div class="sv-dcard dc-video"><div class="sv-dic"><i class="fas fa-film"></i></div><h3>宣传短视频</h3><p>5 秒竖版宣传短视频，适合抖音 / 视频号 / 小红书开场</p>
          <input id="dl-vtheme" placeholder="视频画面（选填），如：储能柜在工厂屋顶日出" value="${esc(V.videoTheme || '')}">
          <button class="btn btn-pri" id="dl-video" ${busy || !ai() ? 'disabled' : ''}><i class="fas ${busy === 'video' ? 'fa-spinner fa-spin' : 'fa-clapperboard'}"></i>${busy === 'video' ? '生成中（20-90 秒）…' : '生成视频（约 110 积分）'}</button><small>竖版 9:16 · 480p</small></div>
      </div>
      <div class="h3 mt">我的交付物</div>
      <div class="sv-outs mt">${[...(sites || []).map((s) => ({ type: 'site', ...s })), ...V.deliver].sort((a, b2) => (b2.created_at || b2.at) - (a.created_at || a.at)).map((x) => x.type === 'site'
        ? `<div class="sv-out"><div class="sv-oprev site"><iframe src="/s/${x.id}" loading="lazy" title="${esc(x.title)}" sandbox="allow-scripts"></iframe></div><div class="sv-ob"><span class="tag p"><i class="fas fa-globe"></i> 官网</span><b>${esc(x.title)}</b><small>${new Date(x.created_at).toLocaleString('zh-CN', { hour12: false })} · ${x.views} 次访问</small><div class="flex"><a class="btn btn-ghost btn-sm" href="/s/${x.id}" target="_blank" rel="noopener"><i class="fas fa-arrow-up-right-from-square"></i>打开</a><button class="btn btn-ghost btn-sm" data-copy="${location.origin}/s/${x.id}"><i class="fas fa-link"></i>复制链接</button></div></div></div>`
        : `<div class="sv-out"><div class="sv-oprev">${x.type === 'video' ? `<video src="${esc(x.url)}" ${x.poster ? `poster="${esc(x.poster)}"` : ''} controls playsinline></video>` : `<img src="${esc(x.url)}" alt="海报">`}</div><div class="sv-ob"><span class="tag ${x.type === 'video' ? 'warn' : 'ok'}"><i class="fas ${x.type === 'video' ? 'fa-film' : 'fa-image'}"></i> ${x.type === 'video' ? '短视频' : '海报'}</span><b>${esc(x.title)}</b><small>${new Date(x.at).toLocaleString('zh-CN', { hour12: false })}</small><div class="flex"><a class="btn btn-ghost btn-sm" href="${esc(x.url)}" target="_blank" rel="noopener" download><i class="fas fa-download"></i>下载</a></div></div></div>`).join('') || '<div class="hint">还没有交付物，从上面三张卡片开始生成吧</div>'}</div>`;
    on(b, '#dl-studio', () => window.gotoView && gotoView('studio'));
    $$('[data-copy]', b).forEach((x) => x.onclick = () => { navigator.clipboard?.writeText(x.dataset.copy); toast('链接已复制'); });
    on(b, '#dl-site', async () => {
      V.siteStyle = $('#dl-style', b).value; busy = 'site'; rerender();
      try { const r = await api('/api/svc/site/make', { company: c.company, industry: c.industry, business: c.business, strengths: [...(P.opportunities || []).slice(0, 2), P.positioning].filter(Boolean), audience: P.canvas?.['客户细分'] || '', style: V.siteStyle, uid: uid(), engine: roleModel('slideDesign') }); sites = null; toast('官网已生成 🎉', 'fa-globe'); window.open(r.url, '_blank'); if (window.simLog) simLog('content', `🌐 交付工坊生成企业官网 · <a class="lnk" href="${r.url}" target="_blank">打开</a>`, '#6366f1'); }
      catch (e) { toast('生成失败：' + e.message, 'fa-triangle-exclamation'); }
      busy = ''; rerender(); AI.refreshCredits?.();
    });
    on(b, '#dl-poster', async () => {
      V.posterTheme = $('#dl-ptheme', b).value.trim(); busy = 'poster'; rerender();
      const prompt = `Premium commercial advertising poster key visual for a Chinese company in ${c.industry}. Business: ${c.business}. ${V.posterTheme ? 'Theme: ' + V.posterTheme + '.' : ''} Bright, clean, modern composition, strong focal product or scene, soft studio lighting, generous negative space at top for headline, high-end brand photography style`;
      try { const r = await AI.call('/image', { prompt, aspect: '3:4' }); V.deliver.unshift({ type: 'poster', url: r.url, title: V.posterTheme || `${c.company} 宣传海报`, at: Date.now() }); toast('海报已生成', 'fa-image'); }
      catch (e) { toast('出图失败：' + e.message, 'fa-triangle-exclamation'); }
      busy = ''; saveState(); rerender(); AI.refreshCredits?.();
    });
    on(b, '#dl-video', async () => {
      V.videoTheme = $('#dl-vtheme', b).value.trim();
      if (!confirm('将生成 5 秒宣传短视频（约 110 积分，耗时 20-90 秒），继续？')) return;
      busy = 'video'; rerender();
      const prompt = `Cinematic vertical brand promo shot for a company in ${c.industry} (${c.business}). ${V.videoTheme || 'Hero product in a bright modern real-world scene'}. Smooth slow camera push-in, golden hour light, premium commercial look, no text`;
      try { const r = await AI.call('/video', { prompt, aspect: '9:16' }); V.deliver.unshift({ type: 'video', url: r.url, poster: r.poster, title: V.videoTheme || `${c.company} 宣传短视频`, at: Date.now() }); toast('短视频已生成', 'fa-film'); }
      catch (e) { toast('生成失败：' + e.message, 'fa-triangle-exclamation'); }
      busy = ''; saveState(); rerender(); AI.refreshCredits?.();
    });
  }

  // ---------------- ⑥ 客服 Agent ----------------
  let sess = null, cur = null, curMsgs = null;
  function kbFromProfile() {
    const P = S.company?.profile || {}, c = ctx();
    return [`【公司】${c.company}`, `【行业】${c.industry}`, c.business && `【主营】${c.business}`, P.positioning && `【定位】${P.positioning}`,
      S.depts?.length && `【部门】${S.depts.map((d) => d.name).join('、')}`,
      '【常见问题】', '- 合作方式：请留下联系方式，销售顾问 1 个工作日内联系', '- 报价：根据项目规模定制报价，需转人工确认', '- 售后：工作日 9:00-18:00 提供售后支持',
      '（请补充真实的产品、价格规则、售后政策、联系方式，客服只会依据这里的内容回答）'].filter(Boolean).join('\n');
  }
  function cs(b) {
    const V = svc(), B = V.cs || {};
    const embed = B.id ? `<script src="${location.origin}/cs/widget.js" data-bot="${B.id}"></script>` : '';
    if (B.id && sess === null) { sess = []; api('/api/cs/bot/sessions', { id: B.id, token: B.token }).then((r) => { sess = r; rerender(); }).catch((e) => toast(e.message, 'fa-triangle-exclamation')); }
    b.innerHTML = head('客服 Agent', '基于企业知识库 7×24 回答客户问题；答不了或客户要求时自动转人工，会话全部入库，人工可在这里接管回复') + `
      <div class="sv-cs">
        <div class="card"><div class="h4"><i class="fas fa-sliders" style="color:var(--c1)"></i> ${B.id ? '客服设置' : '创建客服 Agent'}</div>
          <div class="col mt"><div class="grid2"><input id="cs-name" placeholder="客服名称" value="${esc(B.name || (S.company?.name ? S.company.name.replace(/(股份有限公司|有限公司|科技)/g, '') + '小助手' : '智能客服'))}"><input id="cs-human" placeholder="人工客服联系方式（选填）" value="${esc(B.human || '')}"></div>
          <input id="cs-greet" placeholder="欢迎语" value="${esc(B.greeting || '')}">
          <div class="flex between"><span class="hint">企业知识库（客服只依据这里回答，不会编造）</span><button class="btn btn-ghost btn-sm" id="cs-fill"><i class="fas fa-wand-magic-sparkles"></i>用企业画像生成草稿</button></div>
          <textarea id="cs-kb" rows="9" placeholder="产品介绍、价格规则、售后政策、营业时间、联系方式、常见问题…">${esc(B.knowledge || '')}</textarea>
          <button class="btn btn-pri" id="cs-save"><i class="fas fa-check"></i>${B.id ? '保存设置' : '创建并上线'}</button></div></div>
        <div class="card">${B.id ? `<div class="h4"><i class="fas fa-code" style="color:var(--ok)"></i> 嵌入到官网</div><div class="hint mt">把这一行代码放到网站 &lt;/body&gt; 前，右下角就会出现客服按钮：</div><pre class="sv-code">${esc(embed)}</pre><div class="flex"><button class="btn btn-ghost btn-sm" id="cs-copy"><i class="fas fa-copy"></i>复制代码</button><a class="btn btn-ghost btn-sm" href="/cs/chat/${B.id}" target="_blank" rel="noopener"><i class="fas fa-arrow-up-right-from-square"></i>独立对话页</a></div>
          <div class="sv-phone mt"><iframe src="/cs/chat/${B.id}" title="客服预览"></iframe></div>` : '<div class="empty-state" style="height:100%;min-height:300px"><div><i class="fas fa-headset" style="font-size:40px;color:var(--c1)"></i><p class="mt">创建后可预览对话、拿到嵌入代码</p></div></div>'}</div>
      </div>
      ${B.id ? `<div class="card mt"><div class="flex between"><div class="h4"><i class="fas fa-comments" style="color:var(--c2)"></i> 会话记录 ${sess?.stats ? `<span class="hint">近 7 天 ${sess.stats.sessions7d} 个会话 · ${sess.stats.msgs7d || 0} 条消息 · 转人工 ${sess.stats.human7d || 0}</span>` : ''}</div><button class="btn btn-ghost btn-sm" id="cs-ref"><i class="fas fa-rotate"></i>刷新</button></div>
        <div class="sv-sess mt"><div class="sv-slist">${(sess?.sessions || []).map((x) => `<button class="${cur === x.id ? 'on' : ''}" data-sid="${x.id}"><span class="tag ${x.status === 'human' ? 'warn' : x.status === 'closed' ? '' : 'ok'}">${x.status === 'human' ? '待人工' : x.status === 'closed' ? '已结束' : 'AI 接待'}</span><b>${esc(x.last_text || '（新会话）')}</b><small>${ago(x.updated_at)} · ${x.msgs} 条</small></button>`).join('') || '<div class="hint">还没有会话，试试在右上方预览窗口里提问</div>'}</div>
          <div class="sv-sview">${cur && curMsgs ? `<div class="sv-msgs">${curMsgs.map((m) => `<div class="sv-m ${m.role}"><small>${{ user: '客户', bot: 'AI 客服', agent: '人工客服' }[m.role]} · ${new Date(m.at).toLocaleTimeString('zh-CN', { hour12: false })}</small>${esc(m.text)}</div>`).join('')}</div>
            <div class="flex mt"><input id="cs-reply" placeholder="以人工客服身份回复…" style="flex:1"><button class="btn btn-pri btn-sm" id="cs-send"><i class="fas fa-paper-plane"></i>回复</button><button class="btn btn-ghost btn-sm" id="cs-close">结束会话</button></div>` : '<div class="hint">选择左侧会话查看详情，可以人工接管回复</div>'}</div></div></div>` : ''}`;
    on(b, '#cs-fill', () => { $('#cs-kb', b).value = kbFromProfile(); });
    on(b, '#cs-save', async () => {
      const body = { id: B.id, token: B.token, name: $('#cs-name', b).value, human: $('#cs-human', b).value, greeting: $('#cs-greet', b).value, knowledge: $('#cs-kb', b).value, company: S.company?.name || '' };
      if (!body.knowledge.trim()) { body.knowledge = kbFromProfile(); }
      try { const r = await api('/api/cs/bot/save', body); V.cs = { ...body, id: r.id, token: r.token }; saveState(); sess = null; toast(B.id ? '已保存' : '客服 Agent 已上线 🎧', 'fa-headset'); rerender(); }
      catch (e) { toast(e.message, 'fa-triangle-exclamation'); }
    });
    on(b, '#cs-copy', () => { navigator.clipboard?.writeText(embed); toast('嵌入代码已复制'); });
    on(b, '#cs-ref', () => { sess = null; if (cur) openSess(cur); else rerender(); });
    $$('[data-sid]', b).forEach((x) => x.onclick = () => openSess(x.dataset.sid));
    const reply = async (close) => { const t = $('#cs-reply', b)?.value.trim() || ''; if (!t && !close) return; try { await api('/api/cs/bot/reply', { id: B.id, token: B.token, sid: cur, text: t, close }); sess = null; openSess(cur); } catch (e) { toast(e.message, 'fa-triangle-exclamation'); } };
    on(b, '#cs-send', () => reply(false)); on(b, '#cs-close', () => reply(true));
    const ri = $('#cs-reply', b); if (ri) ri.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) reply(false); });
  }
  async function openSess(sid) { const B = svc().cs; cur = sid; try { const r = await api('/api/cs/bot/messages', { id: B.id, token: B.token, sid }); curMsgs = r.msgs; } catch (e) { curMsgs = []; } rerender(); setTimeout(() => { const m = $('.sv-msgs', host); if (m) m.scrollTop = m.scrollHeight; }, 30); }

  // ---------------- 服务 Agent 自动化：智脑运行时，过期数据自动刷新 ----------------
  let autoBusy = false;
  async function autoTick(force) {
    const V = svc();
    if (autoBusy || !V.auto.radar || !ai() || !S.launched) return;
    if (!force && V.radarAt && Date.now() - V.radarAt < 6 * H) return;
    autoBusy = true;
    try {
      const r = await api('/api/svc/radar', { ...ctx() }); V.radar = r; V.radarAt = r.updatedAt; saveState();
      const hi = (r.signals || []).filter((s) => s.level === 'high').length;
      if (window.simLog && V.auto.notify) simLog('svc', `📡 服务 Agent 已更新行业雷达：${esc(r.headline)} · 高优先级信号 <b>${hi}</b> 条 · <a class="lnk" onclick="gotoView('services')">查看</a>`, '#0ea5e9');
      if (tab === 'radar') rerender();
    } catch { }
    autoBusy = false;
  }
  window.Services = { autoTick };
  setInterval(() => { if (S.launched && document.querySelector('#hq-main')) autoTick(false); }, 10 * 60e3);
  setTimeout(() => { if (S.launched) autoTick(false); }, 8000);

  window.MOD_PAGES = window.MOD_PAGES || {};
  window.MOD_PAGES.services = (p) => render(p);
  window.openServices = (t) => { if (t) tab = t; if (window.enterBrain) enterBrain('services'); };
})();
