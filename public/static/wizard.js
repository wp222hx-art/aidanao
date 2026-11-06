// 企业智脑 · 四步图形化创建向导
(function () {
  const STEPS = ['选择行业', '企业扫描', '部署布局', '录入人员'];

  // 仅在真正按下回车时触发；中文输入法选词（isComposing / keyCode 229）时按回车不触发，其它按键一律放行
  const isEnter = (e) => e.key === 'Enter' && !e.isComposing && e.keyCode !== 229;
  window.renderWizard = function () {
    const app = $('#app');
    app.innerHTML = `
    <div class="wiz">
      <header class="wiz-top">
        <div class="logo"><div class="orb"><i class="fas fa-brain"></i></div><div>企业智脑<div class="dim" style="font-size:11px;font-weight:400">老板的 AI 经营指挥舱 · 数字孪生创建</div></div></div>
        <nav class="steps">${STEPS.map((s, i) => `${i ? '<span class="step-line"></span>' : ''}<div class="step ${S.step === i + 1 ? 'on' : S.step > i + 1 ? 'done' : ''}" data-s="${i + 1}"><span class="n">${S.step > i + 1 ? '<i class="fas fa-check"></i>' : i + 1}</span>${s}</div>`).join('')}</nav>
        <span class="flex" style="gap:8px"><button class="btn btn-ghost btn-sm" id="btn-ideas" title="不用建企业，也能给任何公司出主意"><i class="fas fa-lightbulb" style="color:#f59e0b"></i>给企业献策</button>
        <button class="btn btn-ghost btn-sm" id="btn-demo"><i class="fas fa-wand-magic-sparkles"></i>一键体验演示企业</button></span>
      </header>
      <main class="wiz-body" id="wiz-body"></main>
      <footer class="wiz-foot">
        <button class="btn btn-ghost" id="btn-prev" ${S.step === 1 ? 'style="visibility:hidden"' : ''}><i class="fas fa-arrow-left"></i>上一步</button>
        <div class="hint" id="foot-hint"></div>
        <button class="btn btn-pri" id="btn-next">${S.step === 4 ? '<i class="fas fa-rocket"></i>启动企业智脑' : '下一步<i class="fas fa-arrow-right"></i>'}</button>
      </footer>
    </div>`;
    $$('.step').forEach((el) => el.onclick = () => { const s = +el.dataset.s; if (s < S.step) { S.step = s; saveState(); renderWizard(); } });
    $('#btn-prev').onclick = () => { S.step--; saveState(); renderWizard(); };
    $('#btn-next').onclick = next;
    $('#btn-demo').onclick = loadDemo;
    $('#btn-ideas').onclick = () => window.openIdeas && openIdeas('other');
    [null, stepIndustry, stepScan, stepLayout, stepStaff][S.step]();
    updateNext();
  };

  function updateNext() {
    const ok = [null, !!S.industry?.div, !!S.company.profile, S.depts.length >= 2, true][S.step];
    $('#btn-next').disabled = !ok;
    $('#foot-hint').textContent = [null,
      S.industry?.div ? `已选：${S.industry.name} › ${S.industry.div.code} ${S.industry.div.name}${S.company.profile ? ' · 企业画像已同步生成' : ''}` : '在顶部输入企业名称自动归类，或点击星球手动选择门类与大类（GB/T 4754-2017 · 20门类 97大类）',
      S.company.profile ? `画像置信度 ${S.company.profile.confidence}% · 证据 ${S.company.profile.evidence} 条` : '输入企业名称，启动全网扫描',
      `已部署 ${S.depts.length} 个部门节点 · 拖动节点调整布局`,
      `已录入 ${S.staff.length} 名员工 · 可跳过，后续在总部继续录入`][S.step];
  }
  window._updateNext = updateNext;

  function next() {
    if (S.step === 4) return launch();
    if (S.step === 2 && !S.depts.length) autoLayout();
    S.step++; saveState(); renderWizard();
  }

  // ---------- STEP 1 行业星图 ----------
  function stepIndustry() {
    const body = $('#wiz-body');
    body.innerHTML = `
    <section class="stage ind-stage">
     <div class="ident-bar">
      <div class="ident-row">
        <div class="ident-title"><i class="fas fa-wand-magic-sparkles"></i> 智能识别行业</div>
        <div class="ident-input"><i class="fas fa-building"></i><input id="ident-name" placeholder="输入你的企业名称，AI 自动检索企业体系并归类，例如：宁德时代 / 海底捞 / 某某建筑工程有限公司" value="${esc(S.company.name || '')}"></div>
        <button class="btn btn-pri" id="ident-go"><i class="fas fa-satellite-dish"></i>检索并归类</button>
      </div>
      <div class="ident-result" id="ident-result">${S.ident ? '' : '<span class="hint"><i class="fas fa-circle-info"></i> 也可以跳过识别，直接在下方行业星图中手动选择</span>'}</div>
     </div>
     <div class="galaxy-wrap">
      <div class="galaxy" id="galaxy"><svg class="orbits" id="orbits"></svg>
        <div class="core" id="core"><div class="inner">${S.industry ? `<div><i class="fas ${S.industry.icon}" style="font-size:22px;color:${S.industry.color}"></i><div style="margin-top:4px">${esc(S.industry.name)}</div></div>` : '<div><i class="fas fa-earth-asia" style="font-size:24px;color:var(--c1)"></i><div style="margin-top:4px">选择你的<br>行业星球</div></div>'}</div></div>
      </div>
      <aside class="ind-side">
        <div><div class="h2">你的企业属于哪个行业？</div><div class="hint mt">依据《国民经济行业分类》GB/T 4754-2017，覆盖全国 20 个门类、97 个大类及常见细分领域。</div></div>
        <div style="position:relative"><i class="fas fa-magnifying-glass" style="position:absolute;left:12px;top:13px;color:var(--dim)"></i><input id="ind-search" placeholder="搜索：如 预制菜 / 光伏 / 灵活用工 / 口腔" style="width:100%;padding-left:34px"></div>
        <div class="div-list" id="div-list"></div>
      </aside>
     </div>
    </section>`;
    const g = $('#galaxy');
    const place = () => {
      const W = g.clientWidth, H = g.clientHeight, cx = W / 2, cy = H / 2;
      $('#core').style.left = cx + 'px'; $('#core').style.top = cy + 'px';
      const r1 = Math.min(W, H) * 0.27, r2 = Math.min(W, H) * 0.44;
      $('#orbits').innerHTML = [r1, r2].map((r) => `<ellipse cx="${cx}" cy="${cy}" rx="${r * 1.25}" ry="${r}" fill="none" stroke="rgba(120,170,255,.15)" stroke-dasharray="4 6"/>`).join('');
      $$('.planet', g).forEach((p, i) => {
        const inner = i < 8; const n = inner ? 8 : 12; const k = inner ? i : i - 8;
        const a = (k / n) * Math.PI * 2 - Math.PI / 2 + (inner ? 0 : 0.26);
        const r = inner ? r1 : r2;
        p.style.left = cx + Math.cos(a) * r * 1.25 + 'px'; p.style.top = cy + Math.sin(a) * r + 'px';
      });
    };
    INDUSTRIES.forEach((ind) => {
      const p = document.createElement('div');
      p.className = 'planet' + (S.industry?.code === ind.code ? ' sel' : '');
      p.style.setProperty('--pc', ind.color);
      p.innerHTML = `<div class="ball" style="background:radial-gradient(circle at 30% 30%,${ind.color},${ind.color}55 70%)"><i class="fas ${ind.icon}"></i><span class="code">${ind.code}</span></div><div class="lbl">${ind.name}</div>`;
      p.onclick = () => selectCat(ind);
      g.appendChild(p);
    });
    place(); window.onresize = place;
    renderDivs(S.industry ? INDUSTRIES.find((i) => i.code === S.industry.code) : null);
    $('#ind-search').oninput = (e) => searchInd(e.target.value.trim());
    $('#ident-go').onclick = identify;
    $('#ident-name').addEventListener('keydown', (e) => { if (isEnter(e)) { e.preventDefault(); identify(); } });
    if (S.ident) renderIdent(S.ident);
  }

  // ---------- 智能识别：检索企业体系 → 自动归类 ----------
  async function identify() {
    const name = $('#ident-name').value.trim();
    if (!name) return toast('请输入企业名称', 'fa-triangle-exclamation');
    const btn = $('#ident-go'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>检索中…';
    const res = $('#ident-result');
    res.innerHTML = `<div class="ident-log" id="ident-log"></div>`;
    const L = (t) => { const el = $('#ident-log'); if (el) el.innerHTML = `<span><i class="fas fa-angle-right"></i> ${t}</span>`; };
    $('#core .inner').innerHTML = `<div><i class="fas fa-satellite-dish fa-beat" style="font-size:22px;color:var(--c1)"></i><div style="margin-top:4px;font-size:12px">${esc(name.slice(0, 8))}<br>检索中</div></div>`;
    const useAI = window.AI && AI.on;
    L(useAI ? `锁定企业「${esc(name)}」，调用 Genspark 全网检索企业简介、主营业务、经营范围…` : `锁定企业「${esc(name)}」，正在检索维基百科、公开资讯、主营业务…`);
    const req = fetch(`/api/scan?name=${encodeURIComponent(name)}`).then((r) => r.json()).catch(() => null);
    const aiReq = useAI ? AI.call('/classify', { name }).catch((e) => ({ error: e.message })) : Promise.resolve(null);
    // 遍历行业星球动画
    const planets = $$('.planet');
    planets.forEach((p) => p.classList.remove('sel', 'dimmed', 'rank1', 'rank2', 'rank3'));
    for (let i = 0; i < planets.length; i++) {
      planets[i].classList.add('probe');
      L(`遍历行业体系：${INDUSTRIES[i].code} ${INDUSTRIES[i].name}（${INDUSTRIES[i].divisions.length} 个大类）`);
      await sleep(70);
      planets[i].classList.remove('probe');
    }
    const scan = await req;
    L(useAI ? 'Genspark AI 正在阅读检索证据，判断主营业务并归入 97 个国标大类…' : '提取企业主营业务关键词，匹配 97 个行业大类…');
    const air = await aiReq;
    let r;
    if (air && !air.error && air.cands?.length) {
      r = { name, ai: true, business: air.business, sources: [`Genspark 全网检索（${Math.round((air.evidenceChars || 0) / 100) / 10}k 字证据）`, 'AI 归类'], summary: air.business,
        cands: air.cands.map((c) => ({ code: c.code, indName: c.indName, div: c.div, divName: c.divName, conf: c.conf, hits: [...(air.keywords || []).slice(0, 6), c.reason].filter(Boolean), reason: c.reason })) };
      if (!air.found) r.sources.push('⚠ 未检索到该企业的确切资料，结果为名称推断');
    } else {
      if (air?.error) toast('AI 归类失败，已改用本地规则：' + air.error, 'fa-triangle-exclamation');
      await sleep(200); r = classifyCompany(name, scan);
    }
    S.company.name = name;
    S.company.scan = scan || { news: [], wiki: null };
    S.company.profile = null;
    S.ident = r;
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-satellite-dish"></i>重新识别';
    if (!r.cands.length) {
      $('#core .inner').innerHTML = '<div><i class="fas fa-circle-question" style="font-size:22px;color:var(--warn)"></i><div style="margin-top:4px;font-size:12px">未能识别<br>请手动选择</div></div>';
      res.innerHTML = `<span class="hint" style="color:var(--warn)"><i class="fas fa-triangle-exclamation"></i> 公开信息不足，未能自动归类。请在下方行业星图手动选择，或补充更完整的企业名称（如带“科技/食品/建筑”等字样）。</span>`;
      saveState(); updateNext(); return;
    }
    applyCandidate(r.cands[0], true);
    if (r.business && S.company.profile) S.company.profile.business = r.business;
    renderIdent(r);
    toast(`${r.ai ? 'Genspark AI ' : ''}已自动归类：${r.cands[0].indName} › ${r.cands[0].divName}`, 'fa-location-crosshairs');
    if (r.ai) { saveState(); AI.enrichProfile().then(() => { updateNext(); toast('企业深度画像已生成（第 2 步可查看）', 'fa-brain'); }).catch(() => { }); }
  }

  function applyCandidate(c, silent) {
    const ind = INDUSTRIES.find((i) => i.code === c.code);
    const d = ind.divisions.find((x) => x[0] === c.div);
    selectCat(ind);
    S.industry.div = { code: d[0], name: d[1], kw: d[2] };
    const keep = S.company.profile?.ai ? S.company.profile : null;
    S.company.profile = S.company.scan && S.company.name ? (keep || buildProfile(S.company.scan)) : null;
    if (S.company.profile && S.ident?.business) S.company.profile.business = S.company.profile.business || S.ident.business;
    S.depts = [];
    renderDivs(ind);
    saveState(); updateNext();
    if (!silent) toast(`已切换为：${d[1]}`, 'fa-location-crosshairs');
    if (S.ident) renderIdent(S.ident);
  }

  function renderIdent(r) {
    const res = $('#ident-result'); if (!res) return;
    // 星球排名标记
    $$('.planet').forEach((p, i) => { p.classList.remove('rank1', 'rank2', 'rank3'); const k = r.cands.findIndex((c) => c.code === INDUSTRIES[i].code); if (k >= 0 && k < 3) p.classList.add('rank' + (k + 1)); });
    const cur = S.industry?.div?.code;
    res.innerHTML = `
      <div class="ident-cands">
        <span class="dim" style="font-size:12px;white-space:nowrap"><i class="fas fa-ranking-star"></i> 归类结果${r.ai ? ' <span class="tag ok" style="font-size:10px">Genspark AI</span>' : ''}</span>
        ${r.cands.slice(0, 3).map((c, i) => `<button class="cand ${cur === c.div ? 'on' : ''}" data-i="${i}">
          <span class="rk">${i + 1}</span>
          <span class="cn"><b>${c.code}${c.div} ${esc(c.divName)}</b><small>${esc(c.indName)}</small></span>
          <span class="cf"><span class="bar" style="width:70px"><i style="width:${c.conf}%"></i></span><b>${c.conf}%</b></span>
        </button>`).join('')}
      </div>
      <div class="ident-evi"><span class="dim">识别依据：</span>${r.cands[0].hits.slice(0, 8).map((h) => `<span class="tag">${esc(h)}</span>`).join('')}
        <span class="dim" style="margin-left:6px">· 来源：${r.sources.join(' / ') || '企业名称语义'}</span>
        ${r.summary ? `<div class="dim" style="margin-top:6px;font-size:11px;line-height:1.5">${esc(r.summary)}</div>` : ''}</div>`;
    $$('.cand', res).forEach((b) => b.onclick = () => applyCandidate(r.cands[+b.dataset.i]));
  }

  // 行业归类打分：企业名称（高权重）+ 百科 + 公开资讯，匹配大类名称/细分关键词/常见同义词
  const EXTRA_KW = {
    '01': '种植 农场 果业 茶业 蔬菜 农业科技', '03': '养殖 牧业 畜牧 禽业 生猪 奶牛', '04': '水产 渔业', '06': '煤业 煤矿 煤炭', '07': '石油 油田 天然气',
    '09': '矿业 铜业 稀土 锂业', '13': '粮油 饲料 屠宰 肉业 米业', '14': '食品 乳业 乳品 零食 调味 预制菜 烘焙', '15': '酒业 白酒 啤酒 饮料 饮品 茶业 酒厂 酿酒',
    '17': '纺织 棉纺 家纺', '18': '服饰 服装 制衣 女装 男装', '19': '鞋业 皮革 箱包', '21': '家具 家居 橱柜 定制家居', '22': '纸业 造纸 包装',
    '23': '印刷 印务', '26': '化工 化学 涂料 化妆品 日化 农药 化肥', '27': '药业 制药 医药 生物医药 药品 疫苗 中药', '29': '塑料 塑胶 橡胶 轮胎',
    '30': '水泥 玻璃 陶瓷 建材 石材', '31': '钢铁 特钢 钢材', '32': '铝业 铜材 有色金属', '33': '五金 金属制品 不锈钢', '34': '机械 机床 重工 轴承 泵业 阀门 机器人',
    '35': '装备 医疗器械 环保设备 专用设备 农机', '36': '汽车 整车 汽配 汽车零部件 新能源汽车 电动汽车', '37': '船舶 航空 航天 飞机 轨道交通 无人机 摩托车 电动车',
    '38': '电气 电器 电池 储能 光伏 新能源 电缆 家电 照明 动力电池 锂电池 太阳能 逆变器', '39': '电子 半导体 芯片 集成电路 通信设备 手机 智能手机 计算机 服务器 显示 终端 消费电子 ICT',
    '40': '仪器 仪表 传感器', '44': '电力 发电 电网 能源 热电 风电', '45': '燃气 天然气', '46': '水务 自来水 污水',
    '47': '建设 建工 建筑 房建 施工', '48': '路桥 交通建设 市政 水利工程 隧道 桥梁 基建', '49': '安装 机电安装 消防', '50': '装饰 装修 幕墙 园林',
    '51': '贸易 商贸 进出口 供应链 批发 国际贸易', '52': '超市 商店 百货 零售 便利店 电商 商城 药房 连锁', '54': '运输 物流 货运 客运 出行 公交 网约车',
    '55': '航运 海运 港口', '56': '航空公司 航空 机场', '58': '货代 国际物流 报关', '59': '仓储 冷链 仓库', '60': '快递 速运 速递 邮政',
    '61': '酒店 宾馆 民宿', '62': '餐饮 火锅 餐厅 茶饮 咖啡 快餐 烧烤 奶茶 外卖', '63': '电信 移动 联通 宽带 广电', '64': '互联网 网络平台 社交 搜索引擎 游戏 视频平台 直播 云计算 电商平台',
    '65': '软件 信息技术 信息科技 网络科技 数据 人工智能 SaaS 系统集成 IT 数字科技 智能科技', '66': '银行 农商行 信用社 小贷', '67': '证券 基金 期货 投资 资本 资产管理 创投',
    '68': '保险 人寿 财险', '69': '支付 金融科技 融资租赁 担保', '70': '地产 置业 房地产 物业 不动产 置地', '71': '租赁', '72': '咨询 管理咨询 人力资源 劳务 广告 会展 律师 会计师 税务师 策划 营销 外包 灵活用工 企业服务',
    '73': '研究院 研究所 实验室', '74': '检测 认证 设计院 勘察 测绘 工程设计', '75': '孵化器 技术转移 科技服务', '77': '环保 环境 固废 节能',
    '78': '环卫 园林绿化 景区', '80': '家政 养老 托育 美容 美发 婚庆 摄影', '81': '维修 汽修', '83': '教育 培训 学校 学院 大学 幼儿园 学堂 教育科技',
    '84': '医院 诊所 口腔 医疗 体检 医美 健康管理', '86': '出版 报社 新闻', '87': '影视 传媒 文化传媒 影业 动画 娱乐 MCN 短视频', '88': '文化艺术 艺术团 博物馆',
    '89': '体育 健身 运动 俱乐部 电竞', '90': '游乐 主题乐园 KTV 剧本杀 文旅'
  };
  function classifyCompany(name, scan) {
    const short = name.replace(/(股份有限公司|有限责任公司|有限公司|集团|公司|\(.*?\)|（.*?）)/g, '');
    const wikiTxt = scan?.wiki ? scan.wiki.title + ' ' + scan.wiki.extract : '';
    const newsTxt = (scan?.news || []).map((n) => n.title + ' ' + n.desc).join(' ');
    const srcs = []; if (scan?.wiki) srcs.push('维基百科'); if (scan?.news?.length) srcs.push(`公开资讯 ${scan.news.length} 条`);
    const cnt = (txt, w) => { if (!txt || !w) return 0; let n = 0, i = 0; while ((i = txt.indexOf(w, i)) !== -1) { n++; i += w.length; } return n; };
    const scores = [];
    INDUSTRIES.forEach((ind) => ind.divisions.forEach((d) => {
      const words = new Set([...d[2].split(' '), ...(EXTRA_KW[d[0]] || '').split(' '), d[1].replace(/业$|制造业$|服务$/, '')].filter((w) => w && w.length >= 2));
      let s = 0; const hits = [];
      words.forEach((w) => {
        const a = cnt(short, w) * 12, b = Math.min(cnt(wikiTxt, w), 5) * 3, c = Math.min(cnt(newsTxt, w), 6) * 1.2;
        const v = a + b + c; if (v > 0) { s += v + (w.length >= 3 ? 1 : 0); hits.push(w); }
      });
      if (s > 0) scores.push({ code: ind.code, indName: ind.name, div: d[0], divName: d[1], score: s, hits });
    }));
    scores.sort((a, b) => b.score - a.score);
    const top = scores.slice(0, 3);
    const total = top.reduce((x, y) => x + y.score, 0) || 1;
    const evidence = (scan?.wiki ? 2 : 0) + Math.min(scan?.news?.length || 0, 6) * .5;
    top.forEach((c, i) => { const share = c.score / total; c.conf = Math.round(Math.min(96, (i === 0 ? 45 : 15) + share * 40 + evidence * 2 + Math.min(c.score, 30) / 2)); });
    // 保证排序后的置信度单调递减
    for (let i = 1; i < top.length; i++) top[i].conf = Math.min(top[i].conf, top[i - 1].conf - 6);
    const summary = scan?.wiki ? scan.wiki.extract.slice(0, 120) + '…' : (scan?.news?.[0]?.desc || '').slice(0, 120);
    return { name, cands: top.filter((c) => c.conf > 0), sources: srcs, summary };
  }
  function selectCat(ind) {
    S.industry = { code: ind.code, name: ind.name, icon: ind.icon, color: ind.color, div: null };
    $$('.planet').forEach((p, i) => p.classList.toggle('sel', INDUSTRIES[i].code === ind.code));
    $('#core .inner').innerHTML = `<div><i class="fas ${ind.icon}" style="font-size:22px;color:${ind.color}"></i><div style="margin-top:4px">${esc(ind.name)}</div></div>`;
    renderDivs(ind); saveState(); updateNext();
  }
  function renderDivs(ind, list) {
    const box = $('#div-list');
    const items = list || (ind ? ind.divisions.map((d) => ({ ind, d })) : []);
    if (!items.length) { box.innerHTML = `<div class="empty-state"><div><i class="fas fa-hand-pointer" style="font-size:28px"></i><p class="mt">点击左侧任一行业星球</p></div></div>`; return; }
    box.innerHTML = items.map(({ ind, d }) => `<div class="div-item ${S.industry?.div?.code === d[0] ? 'sel' : ''}" data-c="${ind.code}" data-d="${d[0]}">
      <div><span class="cd">${ind.code}${d[0]}</span><b>${d[1]}</b>${list ? `<span class="tag p" style="margin-left:6px">${ind.name}</span>` : ''}</div><div class="kw">${d[2]}</div></div>`).join('');
    $$('.div-item', box).forEach((el) => el.onclick = () => {
      const ind = INDUSTRIES.find((i) => i.code === el.dataset.c); const d = ind.divisions.find((x) => x[0] === el.dataset.d);
      if (S.industry?.code !== ind.code) selectCat(ind);
      S.industry.div = { code: d[0], name: d[1], kw: d[2] };
      $$('.div-item').forEach((x) => x.classList.remove('sel')); el.classList.add('sel');
      S.company.profile = (S.company.scan && S.company.name) ? buildProfile(S.company.scan) : null; S.depts = []; saveState(); updateNext();
      if (S.ident) renderIdent(S.ident);
      toast(`已锁定行业：${d[1]}`, 'fa-location-crosshairs');
    });
  }
  function searchInd(q) {
    if (!q) { $$('.planet').forEach((p) => p.classList.remove('dimmed')); return renderDivs(S.industry ? INDUSTRIES.find((i) => i.code === S.industry.code) : null); }
    const res = [];
    INDUSTRIES.forEach((ind) => ind.divisions.forEach((d) => { if ((ind.name + d[1] + d[2]).includes(q)) res.push({ ind, d }); }));
    const codes = new Set(res.map((r) => r.ind.code));
    $$('.planet').forEach((p, i) => p.classList.toggle('dimmed', !codes.has(INDUSTRIES[i].code)));
    renderDivs(null, res);
  }

  // ---------- STEP 2 企业扫描 ----------
  const SOURCES = [
    { n: '维基百科', i: 'fa-book-open' }, { n: '必应资讯', i: 'fa-newspaper' }, { n: '工商公示', i: 'fa-id-card' },
    { n: '招聘信息', i: 'fa-user-tie' }, { n: '招投标', i: 'fa-gavel' }, { n: '知识产权', i: 'fa-lightbulb' },
    { n: '社媒声量', i: 'fa-hashtag' }, { n: '行业对标', i: 'fa-chart-simple' }
  ];
  function stepScan() {
    const body = $('#wiz-body');
    body.innerHTML = `
    <section class="stage scan-wrap">
      <div class="radar-box">
        <div class="radar" id="radar">
          ${[90, 190, 290, 378].map((s) => `<div class="ring" style="width:${s}px;height:${s}px"></div>`).join('')}
          <div class="sweep"></div>
          <div class="center" id="r-center">${S.company.name ? esc(S.company.name) : '<span class="dim">待扫描企业</span>'}</div>
          ${SOURCES.map((s, i) => { const a = i / SOURCES.length * Math.PI * 2 - Math.PI / 2; return `<div class="src-node" style="left:${190 + Math.cos(a) * 150}px;top:${190 + Math.sin(a) * 150}px"><div class="d"><i class="fas ${s.i}"></i></div>${s.n}</div>`; }).join('')}
        </div>
        <div class="name-input"><input id="co-name" placeholder="输入企业全称，例如：华为技术有限公司" value="${esc(S.company.name)}"><button class="btn btn-pri" id="btn-scan"><i class="fas fa-satellite-dish"></i>全网扫描</button></div>
        <div class="scan-log" id="scan-log">> 就绪：将从合法公开来源采集企业信息，并结合「${esc(S.industry?.div?.name || '')}」行业知识生成企业画像。</div>
      </div>
      <div class="report" id="report"></div>
    </section>`;
    $('#btn-scan').onclick = doScan;
    $('#co-name').addEventListener('keydown', (e) => { if (isEnter(e)) { e.preventDefault(); doScan(); } });
    if (S.company.profile) renderReport(); else $('#report').innerHTML = `<div class="empty-state"><div><i class="fas fa-radar" style="font-size:40px"></i><i class="fas fa-satellite" style="font-size:40px;color:var(--c1)"></i><p class="mt h3">企业体系与价值分析报告</p><p class="hint mt">扫描完成后在此生成：企业定位 · 价值链 · 商业模式画布 · 七域诊断 · 机会与风险</p></div></div>`;
  }
  async function doScan() {
    const name = $('#co-name').value.trim();
    if (!name) return toast('请输入企业名称', 'fa-triangle-exclamation');
    S.company.name = name; $('#r-center').textContent = name;
    const log = $('#scan-log'); log.innerHTML = '';
    const L = (t) => { log.innerHTML += `<div>> ${t}</div>`; log.scrollTop = 1e9; };
    $('#radar').classList.add('on'); $('#btn-scan').disabled = true;
    $$('.src-node').forEach((n) => n.classList.remove('hit', 'miss'));
    L(`锁定目标：${name}`); L('并行接入公开情报源…');
    let scan = null;
    const p = fetch(`/api/scan?name=${encodeURIComponent(name)}&industry=${encodeURIComponent(S.industry?.div?.name || '')}`).then((r) => r.json()).catch(() => null);
    const nodes = $$('.src-node');
    for (let i = 2; i < nodes.length; i++) { await sleep(320); nodes[i].classList.add('hit'); L(window.AI && AI.on ? `${SOURCES[i].n}：交由 Genspark 全网检索` : `${SOURCES[i].n}：行业知识库推断完成（需后续授权接入真实数据）`); }
    scan = await p;
    nodes[0].classList.add(scan?.wiki ? 'hit' : 'miss'); nodes[1].classList.add(scan?.news?.length ? 'hit' : 'miss');
    L(`维基百科：${scan?.wiki ? '命中词条「' + scan.wiki.title + '」' : '未命中'}`);
    L(`必应资讯：相关结果 ${scan?.news?.length || 0} 条`);
    await sleep(400); L('构建企业价值链与商业模式画布…'); await sleep(500); L('执行七域经营诊断…'); await sleep(500);
    S.company.scan = scan || { news: [], wiki: null };
    S.company.profile = buildProfile(S.company.scan);
    if (window.AI && AI.on) {
      L('<span style="color:#7c3aed">调用 Genspark：全网检索企业简介、客户、竞争对手、最新动态…</span>');
      const tick = setInterval(() => L(pick(['AI 阅读检索证据…', 'AI 构建价值链…', 'AI 填写商业模式画布…', 'AI 评估七域经营健康度…', 'AI 挖掘生意机会与风险…', 'AI 生成找订单检索词…'])), 1800);
      try { await AI.enrichProfile(); L('<span style="color:var(--ok)">Genspark 深度画像完成</span>'); }
      catch (e) { L(`<span style="color:var(--warn)">AI 画像失败（${esc(e.message)}），已使用行业推断画像</span>`); }
      clearInterval(tick);
    }
    L(`<span style="color:var(--ok)">完成！画像置信度 ${S.company.profile.confidence}%</span>`);
    $('#radar').classList.remove('on'); $('#btn-scan').disabled = false;
    S.depts = []; saveState(); renderReport(); updateNext();
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.sleep = sleep;
  function renderReport() {
    const P = S.company.profile, sc = S.company.scan || {};
    $('#report').innerHTML = `
      <div class="card"><div class="ct"><span class="h3"><i class="fas fa-building" style="color:var(--c1)"></i> ${esc(S.company.name)}</span><span class="flex">${P.ai ? '<span class="tag ok"><i class="fas fa-brain"></i> Genspark 深度画像</span>' : '<span class="tag warn">行业推断</span>'}<span class="tag ${P.confidence > 60 ? 'ok' : 'warn'}">置信度 ${P.confidence}%</span></span></div>
        ${P.business ? `<p style="font-size:13px;margin-bottom:6px"><b>主营：</b>${esc(P.business)}</p>` : ''}
        <p style="line-height:1.7">${esc(P.positioning)}</p>
        ${sc.wiki ? `<p class="muted mt" style="font-size:12px;line-height:1.7">${esc(sc.wiki.extract.slice(0, 260))}… <a href="${sc.wiki.url}" target="_blank" style="color:var(--c1)">维基来源</a></p>` : '<p class="hint mt">未检索到百科词条，以下画像以行业知识推断为主，建议上传企业介绍/官网链接提高精度。</p>'}
      </div>
      <div class="card"><div class="ct"><span class="h3"><i class="fas fa-link" style="color:var(--c2)"></i> 企业价值链</span></div>
        <div class="vchain">${P.chain.map((c, i) => `${i ? '<i class="fas fa-angle-right ar"></i>' : ''}<span class="v">${c}</span>`).join('')}</div></div>
      <div class="card"><div class="ct"><span class="h3"><i class="fas fa-heart-pulse" style="color:var(--c3)"></i> 七域经营诊断（初判）</span></div>
        ${P.domains.map((d) => `<div class="flex" style="margin:6px 0" title="${esc(d.note || '')}"><span style="width:70px;font-size:12px">${d.name}</span><div class="bar" style="flex:1"><i style="width:${d.score}%;${d.score < 60 ? 'background:linear-gradient(90deg,#dc2626,#d97706)' : ''}"></i></div><b style="width:30px;text-align:right;font-size:12px">${d.score}</b></div>`).join('')}
        <p class="hint mt">短板：${P.weakest.map((w) => w.name).join('、')} —— 将作为首批增长项目候选。</p></div>
      <div class="card"><div class="ct"><span class="h3"><i class="fas fa-table-cells" style="color:var(--warn)"></i> 商业模式画布（精简）</span></div>
        <div class="grid2" style="gap:8px">${Object.entries(P.canvas).map(([k, v]) => `<div style="padding:8px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid var(--line)"><div class="dim" style="font-size:11px">${k}</div><div style="font-size:12px;margin-top:3px">${esc(v)}</div></div>`).join('')}</div></div>
      <div class="card"><div class="ct"><span class="h3"><i class="fas fa-lightbulb" style="color:var(--ok)"></i> 生意机会</span></div>${P.opportunities.map((o) => `<div class="flex" style="align-items:flex-start;margin:6px 0;font-size:13px"><i class="fas fa-circle-check" style="color:var(--ok);margin-top:3px"></i>${esc(o)}</div>`).join('')}
        <div class="hint mt">${P.risks.map((r) => '⚠ ' + esc(r)).join('<br>')}</div>
        ${P.competitors?.length ? `<div class="mt" style="font-size:12px"><span class="dim">主要竞争对手：</span>${P.competitors.map((c) => `<span class="tag p">${esc(c)}</span>`).join(' ')}</div>` : ''}
        ${P.leadKeywords?.length ? `<div class="mt" style="font-size:12px"><span class="dim">商机雷达检索词：</span>${P.leadKeywords.map((c) => `<span class="tag">${esc(c)}</span>`).join(' ')}</div>` : ''}</div>
      ${sc.news?.length ? `<div class="card"><div class="ct"><span class="h3"><i class="fas fa-newspaper"></i> 公开资讯证据（${sc.news.length}）</span></div>${sc.news.map((n) => `<div class="news-item"><a href="${esc(n.link)}" target="_blank">${esc(n.title)}</a><p>${esc(n.desc)}</p><span class="dim" style="font-size:11px">${esc(n.source)}</span></div>`).join('')}</div>` : ''}`;
  }

  // ---------- STEP 3 部署布局 ----------
  function autoLayout() {
    const rec = (S.company.profile?.recommendedDepts || []).filter((id) => deptLib(id));
    const ids = rec.length >= 4 ? [...new Set(['strategy', 'sales', 'finance', ...rec])].slice(0, 16) : [...new Set([...INDUSTRY_DEPTS.base, ...(INDUSTRY_DEPTS[S.industry?.code] || [])])];
    S.depts = ids.map((id) => { const l = deptLib(id); return { id: uid('d'), lib: id, name: l.name, icon: l.icon, color: l.color }; });
    arrange();
  }
  function arrange() {
    const n = S.depts.length;
    S.depts.forEach((d, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2 + Math.PI / n; d.x = 50 + Math.cos(a) * 36; d.y = 56 + Math.sin(a) * 34; });
  }
  function stepLayout() {
    const body = $('#wiz-body');
    body.innerHTML = `
    <section class="stage layout-wrap">
      <aside class="palette">
        <div class="h3">部门模块库</div><div class="hint">点击或拖拽到画布添加；${S.company.profile?.recommendedDepts?.length ? '<b style="color:var(--ok)">Genspark AI</b> 已根据企业画像' : 'AI 已按「' + esc(S.industry?.div?.name || '') + '」'}推荐初始布局。</div>
        <div class="pal-list" id="pal-list"></div>
        <div class="flex"><input id="custom-dept" placeholder="自定义部门名称" style="flex:1;min-width:0"><button class="btn btn-ghost btn-sm" id="add-custom"><i class="fas fa-plus"></i></button></div>
      </aside>
      <div class="canvas" id="canvas"><svg id="links"></svg>
        <div class="canvas-tools"><button class="btn btn-ghost btn-sm" id="re-ai"><i class="fas fa-wand-magic-sparkles"></i>AI 重新推荐</button><button class="btn btn-ghost btn-sm" id="re-arr"><i class="fas fa-circle-nodes"></i>自动环形排布</button><button class="btn btn-ghost btn-sm" id="clr"><i class="fas fa-eraser"></i>清空</button></div>
        <div class="canvas-tip"><i class="fas fa-hand"></i> 拖动节点调整组织布局 · 悬停节点可删除</div>
      </div>
    </section>`;
    renderPalette(); renderCanvas();
    $('#re-ai').onclick = () => { autoLayout(); saveState(); renderPalette(); renderCanvas(); toast('AI 已根据行业与企业画像重新规划部门', 'fa-wand-magic-sparkles'); };
    $('#re-arr').onclick = () => { arrange(); saveState(); renderCanvas(); };
    $('#clr').onclick = () => { S.depts = []; saveState(); renderPalette(); renderCanvas(); };
    $('#add-custom').onclick = () => { const v = $('#custom-dept').value.trim(); if (!v) return; addDept(null, v); $('#custom-dept').value = ''; };
    const cv = $('#canvas');
    cv.ondragover = (e) => e.preventDefault();
    cv.ondrop = (e) => { e.preventDefault(); const id = e.dataTransfer.getData('lib'); if (!id) return; const r = cv.getBoundingClientRect(); addDept(id, null, (e.clientX - r.left) / r.width * 100, (e.clientY - r.top) / r.height * 100); };
  }
  function addDept(lib, custom, x, y) {
    const l = lib ? deptLib(lib) : null;
    if (l && S.depts.some((d) => d.lib === lib)) return toast('该部门已在布局中');
    S.depts.push({ id: uid('d'), lib: lib || 'custom', name: l ? l.name : custom, icon: l ? l.icon : 'fa-sitemap', color: l ? l.color : '#2563eb', x: x ?? rand(15, 85), y: y ?? rand(40, 88) });
    saveState(); renderPalette(); renderCanvas(); updateNext();
  }
  function renderPalette() {
    $('#pal-list').innerHTML = DEPT_LIBRARY.map((d) => `<div class="pal-item ${S.depts.some((x) => x.lib === d.id) ? 'used' : ''}" draggable="true" data-id="${d.id}"><span class="ic" style="background:${d.color}33;color:${d.color}"><i class="fas ${d.icon}"></i></span>${d.name}<span class="dim" style="margin-left:auto;font-size:11px">${d.agents.length}AI</span></div>`).join('');
    $$('.pal-item').forEach((el) => { el.ondragstart = (e) => e.dataTransfer.setData('lib', el.dataset.id); el.onclick = () => addDept(el.dataset.id); });
  }
  function renderCanvas() {
    const cv = $('#canvas'); $$('.node', cv).forEach((n) => n.remove());
    const mk = (cls, html, x, y) => { const n = document.createElement('div'); n.className = 'node ' + cls; n.style.left = x + '%'; n.style.top = y + '%'; n.innerHTML = html; cv.appendChild(n); return n; };
    mk('boss', `<div class="ic"><i class="fas fa-crown"></i></div><div class="nm">老板 · 决策中心</div><div class="ag">审批 L4 高风险动作</div>`, 50, 9);
    mk('brain', `<div class="ic" style="background:linear-gradient(135deg,var(--c1),var(--c2))"><i class="fas fa-brain"></i></div><div class="nm">企业智脑中枢</div><div class="ag">六引擎 · 双域情报</div>`, 50, 56);
    S.depts.forEach((d) => {
      const l = deptLib(d.lib);
      const n = mk('', `<button class="x"><i class="fas fa-xmark"></i></button><div class="ic" style="background:${d.color}"><i class="fas ${d.icon}"></i></div><div class="nm">${esc(d.name)}</div><div class="ag"><i class="fas fa-robot"></i> ${l ? l.agents.length : 2} 个核心Agent</div>`, d.x, d.y);
      n.style.setProperty('--nc', d.color);
      $('.x', n).onclick = (e) => { e.stopPropagation(); S.depts = S.depts.filter((x) => x.id !== d.id); S.staff = S.staff.filter((s) => s.deptId !== d.id); saveState(); renderPalette(); renderCanvas(); updateNext(); };
      n.onpointerdown = (e) => {
        if (e.target.closest('.x')) return;
        const r = cv.getBoundingClientRect(); n.setPointerCapture(e.pointerId);
        n.onpointermove = (ev) => { d.x = Math.max(6, Math.min(94, (ev.clientX - r.left) / r.width * 100)); d.y = Math.max(8, Math.min(94, (ev.clientY - r.top) / r.height * 100)); n.style.left = d.x + '%'; n.style.top = d.y + '%'; drawLinks(); };
        n.onpointerup = () => { n.onpointermove = null; saveState(); };
      };
    });
    drawLinks();
  }
  function drawLinks() {
    const cv = $('#canvas'); const W = cv.clientWidth, H = cv.clientHeight;
    const bx = W * .5, by = H * .56;
    let s = `<defs><linearGradient id="lg" x1="0" x2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs>`;
    s += `<path d="M${W * .5} ${H * .09 + 40} L${bx} ${by - 45}" stroke="#d97706" stroke-width="2" class="flow" fill="none"/>`;
    S.depts.forEach((d) => { const x = d.x / 100 * W, y = d.y / 100 * H; const mx = (x + bx) / 2, my = (y + by) / 2 - 30; s += `<path d="M${bx} ${by} Q${mx} ${my} ${x} ${y}" stroke="${d.color}" stroke-opacity=".7" stroke-width="1.6" class="flow" fill="none"/>`; });
    $('#links').innerHTML = s;
  }

  // ---------- STEP 4 录入人员 ----------
  let curDept = null;
  function stepStaff() {
    if (!curDept || !S.depts.find((d) => d.id === curDept)) curDept = S.depts[0]?.id;
    const body = $('#wiz-body');
    body.innerHTML = `
    <section class="stage staff-wrap">
      <aside class="dept-tabs" id="dept-tabs"></aside>
      <div class="staff-main">
        <div class="staff-form glass" style="padding:16px">
          <div class="h3" id="form-title">录入员工</div>
          <div class="flex"><div class="col" style="flex:1;gap:4px"><label>姓名</label><input id="f-name"></div><div class="col" style="width:90px;gap:4px"><label>工龄(年)</label><input id="f-years" type="number" value="3" min="0"></div></div>
          <div class="col" style="gap:4px"><label>岗位</label><input id="f-pos" placeholder="如：销售经理"></div>
          <div class="col" style="gap:4px"><label>能力级别 <span class="dim">（决定执行标准、模型与可调用的工具库；默认按岗位自动判定）</span></label><div class="tier-pick" id="f-tier">${TIER_ORDER.map((k) => { const T = TIERS[k]; return `<button type="button" data-k="${k}" style="--tc:${T.color};--tb:${T.bg}"><i class="fas ${T.icon}"></i>${T.name}</button>`; }).join('')}</div><div class="hint" id="f-tier-desc">自动：总监/总经理 → 超级领袖级；经理/主管/高级 → 大师级；其他 → 一般级</div></div>
          <div class="col" style="gap:4px"><label>简历 / 价值描述（粘贴文本或上传 .txt）</label><textarea id="f-resume" rows="6" placeholder="例：5年B2B大客户销售经验，擅长渠道拓展与谈判，熟练使用Excel与CRM，年度回款800万……"></textarea></div>
          <div class="flex"><label class="btn btn-ghost btn-sm" style="cursor:pointer"><i class="fas fa-file-arrow-up"></i>上传简历<input type="file" id="f-file" accept=".txt,.md" hidden></label><span class="hint" id="f-skills">AI 将自动识别技能标签</span></div>
          <button class="btn btn-pri" id="f-add"><i class="fas fa-user-plus"></i>录入并评估价值</button>
          <button class="btn btn-ghost" id="f-gen"><i class="fas fa-wand-magic-sparkles"></i>AI 生成本部门示例员工</button>
          <button class="btn btn-ghost" id="f-genall"><i class="fas fa-users"></i>为所有部门一键生成</button>
        </div>
        <div class="staff-grid" id="staff-grid"></div>
      </div>
    </section>`;
    let fTier = null;
    const syncTier = () => { const auto = autoTier({ pos: $('#f-pos').value }); const k = fTier || auto; $$('#f-tier button').forEach((b) => b.classList.toggle('on', b.dataset.k === k)); $('#f-tier-desc').innerHTML = `${fTier ? '' : '<b>自动判定</b> · '}${TIERS[k].desc} · 工具：${TIERS[k].tools.map((x) => toolMeta(x).name).join(' / ')}`; };
    $$('#f-tier button').forEach((b) => b.onclick = () => { fTier = fTier === b.dataset.k ? null : b.dataset.k; syncTier(); });
    $('#f-pos').oninput = syncTier; syncTier();
    $('#f-resume').oninput = (e) => { const sk = parseSkills(e.target.value); $('#f-skills').innerHTML = sk.length ? sk.map((s) => `<span class="tag">${s}</span>`).join(' ') : 'AI 将自动识别技能标签'; };
    $('#f-file').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { $('#f-resume').value = String(rd.result).slice(0, 3000); $('#f-resume').oninput({ target: $('#f-resume') }); }; rd.readAsText(f); };
    $('#f-add').onclick = () => {
      const name = $('#f-name').value.trim(); if (!name) return toast('请填写姓名');
      const resume = $('#f-resume').value.trim();
      addStaff({ name, pos: $('#f-pos').value.trim() || '专员', years: +$('#f-years').value || 0, resume, skills: parseSkills(resume), ...(fTier ? { tier: fTier, tierManual: true } : {}) });
      fTier = null;
      ['#f-name', '#f-pos', '#f-resume'].forEach((s) => $(s).value = ''); $('#f-skills').textContent = 'AI 将自动识别技能标签'; syncTier();
    };
    $('#f-gen').onclick = () => { genFor(curDept, rand(2, 4)); renderStaff(); };
    $('#f-genall').onclick = () => { S.depts.forEach((d) => { if (!S.staff.some((s) => s.deptId === d.id)) genFor(d.id, rand(2, 4)); }); renderStaff(); toast('已为所有部门生成示例员工', 'fa-users'); };
    renderStaff();
  }
  function addStaff(p) {
    const s = { id: uid('p'), deptId: curDept, ...p }; s.value = scoreStaff(s); if (!s.tier) s.tier = autoTier(s);
    S.staff.push(s); saveState(); renderStaff();
    if (window.AI && AI.on && (s.resume || '').length >= 10) {
      toast(`${s.name} 已入职，Genspark 正在解析简历…`, 'fa-user-check');
      AI.resume(s).then(() => { if ($('#staff-grid')) renderStaff(); toast(`AI 评估完成：${s.name} · ${TIERS[tierOf(s)].name} · ${s.value} 分`, 'fa-brain'); });
    } else toast(`${s.name} 已入职 · 价值评分 ${s.value}`, 'fa-user-check');
  }
  window.genFor = function (deptId, n) {
    const d = S.depts.find((x) => x.id === deptId); const l = deptLib(d.lib);
    const base = d.name.replace(/部$/, '');
    const pos = [base + '总监', base + '经理', '高级' + base + '专员', base + '专员', base + '助理'];
    for (let i = 0; i < n; i++) {
      const skills = [...new Set([...(l ? SKILL_DICT.filter((k) => (l.name + l.tasks.join('')).includes(k)) : []), pick(SKILL_DICT), pick(SKILL_DICT)])].slice(0, 5);
      const years = i === 0 ? rand(8, 15) : rand(1, 8);
      const s = { id: uid('p'), deptId, name: genName(), pos: pos[Math.min(i, 4)], years, skills, resume: `${years}年${base}相关经验，擅长${skills.join('、')}。` };
      s.value = scoreStaff(s); s.tier = autoTier(s); S.staff.push(s);
    }
    saveState();
  };
  function renderStaff() {
    $('#dept-tabs').innerHTML = `<div class="h3" style="padding:4px 6px 8px">部门</div>` + S.depts.map((d) => `<div class="dept-tab ${d.id === curDept ? 'on' : ''}" data-id="${d.id}"><span class="ic" style="width:26px;height:26px;border-radius:7px;display:grid;place-items:center;background:${d.color}33;color:${d.color}"><i class="fas ${d.icon}" style="font-size:12px"></i></span>${esc(d.name)}<span class="cnt">${S.staff.filter((s) => s.deptId === d.id).length}</span></div>`).join('');
    $$('.dept-tab').forEach((el) => el.onclick = () => { curDept = el.dataset.id; renderStaff(); });
    const d = S.depts.find((x) => x.id === curDept);
    $('#form-title').innerHTML = `录入员工 · <span style="color:${d?.color}">${esc(d?.name || '')}</span>`;
    const list = S.staff.filter((s) => s.deptId === curDept);
    $('#staff-grid').innerHTML = list.length ? list.map((p) => `<div class="person"><div class="top"><div class="avatar" style="background:${avColor(p.name)}">${esc(p.name[0])}</div><div><b>${esc(p.name)}</b><div class="dim" style="font-size:12px">${esc(p.pos)} · ${p.years}年</div></div></div>
      <div class="val"><div class="dim" style="font-size:10px">${p.aiPending ? '<i class="fas fa-spinner fa-spin"></i> AI评估中' : p.ai ? 'AI 评分' : '价值评分'}</div><b class="grad-txt">${p.value}</b></div>
      ${p.ai ? `<div style="font-size:11px;margin-top:8px;line-height:1.6"><span class="tag ok">${esc(p.aiRole || '')}</span> <span class="muted">优势：${esc(p.strengths || '')}</span><br><span class="dim">待提升：${esc(p.gaps || '')} · 搭档：${esc(p.pairAgent || '')}</span></div>` : ''}
      <div class="bar mt"><i style="width:${p.value}%"></i></div>
      <div class="tl-row" style="margin-top:8px" title="可调用的 Genspark 工具">${staffTools(p).map((x) => `<span class="tl ok" title="${toolMeta(x).name}"><i class="fas ${toolMeta(x).icon}"></i></span>`).join('')}</div>
      <div class="sk">${p.skills.map((s) => `<span class="tag">${s}</span>`).join('') || '<span class="dim" style="font-size:12px">暂无技能标签</span>'}</div>
      <p class="dim" style="font-size:11px;margin-top:8px;line-height:1.5;max-height:34px;overflow:hidden">${esc(p.resume)}</p>
      <span class="tier-sw" data-id="${p.id}" title="点击切换能力级别">${tierBadge(tierOf(p))}</span>
      <button class="del" data-id="${p.id}"><i class="fas fa-trash"></i></button></div>`).join('')
      : `<div class="empty-state" style="grid-column:1/-1;height:300px"><div><i class="fas fa-user-astronaut" style="font-size:36px"></i><p class="mt">该部门还没有员工</p><p class="hint">手动录入或点击「AI 生成示例员工」</p></div></div>`;
    $$('.person .tier-sw').forEach((b) => b.onclick = () => { const p = S.staff.find((x) => x.id === b.dataset.id); const i = TIER_ORDER.indexOf(tierOf(p)); p.tier = TIER_ORDER[(i + 1) % 3]; p.tierManual = true; p.tools = null; saveState(); renderStaff(); toast(`${p.name} → ${TIERS[p.tier].name}`, 'fa-user-graduate'); });
    $$('.person .del').forEach((b) => b.onclick = () => { S.staff = S.staff.filter((s) => s.id !== b.dataset.id); saveState(); renderStaff(); });
    updateNext();
  }

  // ---------- 启动 ----------
  async function launch() {
    S.depts.forEach((d) => { if (!S.staff.some((s) => s.deptId === d.id)) genFor(d.id, 2); });
    buildAgents();
    const el = document.createElement('div'); el.className = 'launch';
    el.innerHTML = `<div style="text-align:center"><div class="big"><i class="fas fa-brain"></i></div><div class="lines" id="ll"></div></div>`;
    document.body.appendChild(el);
    const lines = [`载入企业画像：${S.company.name}`, `映射组织：${S.depts.length} 个部门 · ${S.staff.length} 名员工`, `孵化智能体：${S.agents.length} 个 Agent 已上岗`, '挂载六引擎：诊断 / 情报 / 策略 / 编排 / 实验 / 进化', '部署管理机制：评测五维 · 每日校验 · 督办升级 · 审批护栏', '<span style="color:var(--ok)">数字孪生总部已上线 ✔</span>'];
    for (const l of lines) { await sleep(480); $('#ll').innerHTML += `<div>▸ ${l}</div>`; }
    await sleep(700);
    S.launched = true; S.sim = null; saveState(); el.remove(); renderApp();
  }

  // ---------- 演示企业 ----------
  function loadDemo() {
    const ind = INDUSTRIES.find((i) => i.code === 'C'); const d = ind.divisions.find((x) => x[0] === '38');
    S.industry = { code: 'C', name: ind.name, icon: ind.icon, color: ind.color, div: { code: d[0], name: d[1], kw: d[2] } };
    S.company = { name: '星澜新能源科技有限公司', scan: { news: [], wiki: null }, profile: null };
    S.company.profile = buildProfile(S.company.scan);
    S.staff = []; autoLayout();
    S.depts.forEach((x) => genFor(x.id, rand(2, 4)));
    S.step = 4; saveState(); renderWizard(); toast('已载入演示企业：星澜新能源（电气机械和器材制造业）', 'fa-wand-magic-sparkles');
  }
})();
