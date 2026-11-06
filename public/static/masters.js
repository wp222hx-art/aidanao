// 企业智脑 · 大师智库：每个部门一位「行业 × 部门」大师（身份 / 履历 / 思维方式 / 方法论 / 边界），老板可在后台调整
(function () {
  const CORE = { strategy: '战略', sales: '销售', marketing: '营销', brand: '品牌内容', product: '产品', rnd: '研发', production: '生产制造', quality: '质量管理', procurement: '采购', logistics: '供应链', service: '客户成功', operation: '运营', finance: '财务', hr: '人力资源', admin: '行政', legal: '法务合规', it: '数字化', project: '工程项目', design: '设计', store: '门店运营', teaching: '教研', medical: '医疗服务', risk: '风控', agri: '种养' };
  const FW = {
    strategy: ['波特五力', 'SWOT', '蓝海战略', 'BCG 矩阵', 'OKR'], sales: ['销售漏斗', 'BANT', 'SPIN 销售法', '大客户九宫格', 'MEDDIC'], marketing: ['AARRR', '4P/4C', 'STP', '营销漏斗归因', 'A/B 实验'],
    brand: ['品牌金字塔', 'AIDA', '内容矩阵', '爆款拆解', 'UGC 激励'], product: ['用户旅程地图', 'KANO 模型', 'RICE 优先级', 'JTBD', '竞品对比矩阵'], rnd: ['IPD', '技术路线图', 'DFMEA', 'TRL 成熟度', '敏捷迭代'],
    production: ['精益生产', 'OEE', '价值流图', '5S', 'TPM'], quality: ['PDCA', '8D 报告', '鱼骨图', 'SPC', 'FMEA'], procurement: ['TCO 总拥有成本', '卡拉杰克矩阵', '供应商分级', '询比价', '集采议价'],
    logistics: ['SCOR 模型', 'ABC 库存分类', '安全库存', '路径优化', 'VMI'], service: ['客户健康度', 'NPS', 'RFM', '流失预警', '客户生命周期'], operation: ['增长飞轮', '北极星指标', '漏斗分析', '用户分层', '精细化运营'],
    finance: ['杜邦分析', '本量利分析', '现金流预测', '预算偏差分析', '单位经济模型'], hr: ['胜任力模型', 'STAR 面试法', '人才九宫格', 'OKR/KPI', '薪酬带宽'], admin: ['流程标准化', '5W2H', '费用管控', '服务 SLA', '资产台账'],
    legal: ['合同风险矩阵', '合规清单', '知识产权布局', '争议解决路径', '数据合规评估'], it: ['数字化成熟度', 'TOGAF', '数据治理', 'ROI 测算', '敏捷交付'], project: ['WBS', '关键路径法', '挣值管理', '风险登记册', '里程碑管控'],
    design: ['设计思维', '用户画像', '品牌 VI 体系', '可用性测试', '设计评审'], store: ['坪效/人效分析', '会员分层', '商品陈列', '门店 SOP', '客流转化'], teaching: ['ADDIE', '布鲁姆目标', '学习效果评估', '课程地图', '个性化学习'],
    medical: ['临床路径', '患者旅程', '质量与安全指标', 'DRG 成本', '满意度管理'], risk: ['风险矩阵', '评分卡', '反欺诈规则', '压力测试', '内控三道防线'], agri: ['标准化种养', '产量预测', '成本核算', '可追溯体系', '订单农业']
  };
  const THINK = {
    strategy: ['先看行业周期与竞争格局', '定位企业的独特价值与短板', '找出 3 个最大杠杆机会', '算清投入产出与风险', '落到 90 天可执行的里程碑'],
    sales: ['先锁定高价值目标客户与决策链', '用 BANT 判断商机质量', '设计切入点与差异化价值', '测算赢单率与管道金额', '每条商机落到下一步动作与负责人'],
    marketing: ['先定义目标人群与核心场景', '拆解获客漏斗找最大流失点', '设计可量化的投放/内容实验', '算 CAC/ROAS 与预算分配', '设定复盘指标与迭代节奏'],
    finance: ['先对齐口径与数据来源', '找出偏差最大的科目', '归因到业务动作', '测算改善空间与现金影响', '给出管控措施与预警阈值']
  };
  const DEF_THINK = ['先澄清目标与成功标准', '收集行业数据与最佳实践', '用专业框架分析根因与机会', '给出可量化的方案与取舍', '落到行动计划、负责人与时间'];
  const DEF_BOUND = ['不编造数据：无来源的数字必须标注估算与口径', '高风险动作（报价、预算、对外发布、人事、支付）只出方案，必须老板审批', '遵守《广告法》《个人信息保护法》等法规', '所有建议必须写清动作、负责岗位、时间、量化目标'];
  const NAMES = ['陈思远', '林嘉禾', '周明哲', '沈若川', '许知行', '顾以宁', '韩启航', '宋清越', '方致远', '叶承泽', '苏立言', '江怀瑾', '唐修远', '秦书瑶', '陆景川', '何予安', '温煦阳', '傅承安', '程砚秋', '赵屹川', '杨知微', '吴东篱', '郑朗月', '孙一帆'];
  const indShort = () => (S.industry?.div?.name || S.industry?.name || '').replace(/(及|和).*$/, '').replace(/(制造业|服务业|业)$/, '').slice(0, 6) || '行业';

  const M = window.Masters = {};
  M.cfg = () => { S.masterCfg = Object.assign({ rules: [] }, S.masterCfg || {}); return S.masterCfg; };
  M.all = () => (S.masters = S.masters || {});
  M.get = (deptId) => M.all()[deptId] || null;
  function local(d, i) {
    const lib = d.lib, core = CORE[lib] || d.name.replace(/部$/, ''), L = deptLib(lib);
    return {
      deptId: d.id, title: `${indShort()}${core}大师`, name: NAMES[(hashCode(d.id) + i) % NAMES.length], motto: '用数据说话，用结果交付',
      resume: [`${rand(12, 20)} 年${S.industry?.name || ''}${core}一线与管理经验`, `主导过 ${rand(20, 60)} 个${core}项目，累计创造价值超 ${rand(2, 9)} 亿元`, `擅长${(FW[lib] || ['结构化分析']).slice(0, 2).join('、')}`],
      thinking: (THINK[lib] || DEF_THINK).slice(), frameworks: (FW[lib] || ['SWOT', 'PDCA', 'OKR']).slice(), style: '结论先行、数字说话、行动到人',
      boundaries: DEF_BOUND.slice(), kpis: (L?.kpi || ['交付质量', '按期率', '业务价值']).slice(0, 3), ai: false, edited: false
    };
  }
  M.ensureLocal = function () { S.depts.forEach((d, i) => { if (!M.all()[d.id]) M.all()[d.id] = local(d, i); }); saveState(); };
  let gen = null;
  M.generate = function (force) {
    M.ensureLocal();
    if (!(window.AI && AI.on)) return Promise.resolve(false);
    const todo = S.depts.filter((d) => force ? !M.get(d.id)?.edited : !M.get(d.id)?.ai);
    if (!todo.length) return Promise.resolve(true);
    if (gen) return gen;
    M.busy = true; window.onMastersChange && onMastersChange();
    const chunks = []; for (let i = 0; i < todo.length; i += 6) chunks.push(todo.slice(i, i + 6));
    gen = Promise.all(chunks.map((ch) => AI.call('/persona/batch', { company: S.company.name, industry: `${S.industry?.name || ''} › ${S.industry?.div?.name || ''}`, business: S.company.profile?.business || S.company.profile?.positioning || '', engine: roleModel('persona'), depts: ch.map((d) => { const L = deptLib(d.lib); return { id: d.id, name: d.name, kpi: L?.kpi || [], tasks: L?.tasks || [] }; }) })
      .then((r) => (r.personas || []).forEach((p) => { if (!M.get(p.deptId)?.edited) M.all()[p.deptId] = { ...p, ai: true, edited: false }; }))
      .catch((e) => toast('大师身份生成失败：' + e.message, 'fa-triangle-exclamation'))))
      .then(() => { saveState(); return true; })
      .finally(() => { gen = null; M.busy = false; window.onMastersChange && onMastersChange(); window.Flow && Flow.refresh(); });
    return gen;
  };
  M.payload = (deptId) => { const P = M.get(deptId); return { persona: P ? { title: P.title, name: P.name, motto: P.motto, resume: P.resume, thinking: P.thinking, frameworks: P.frameworks, style: P.style, boundaries: P.boundaries } : null, rules: M.cfg().rules || [], engine: officeCfg().engine }; };
  M.card = (deptId, sm) => { const P = M.get(deptId); if (!P) return ''; return `<span class="mst ${sm ? 'sm' : ''}" title="${esc(P.motto || '')}"><i class="fas fa-user-tie"></i>${esc(P.title)}<b>${esc(P.name)}</b></span>`; };

  // ---------------- 后台页面：大师智库 ----------------
  const ul = (a) => (a || []).map((x) => `<li>${esc(x)}</li>`).join('');
  window.MOD_PAGES = window.MOD_PAGES || {};
  window.MOD_PAGES.masters = function (p) {
    M.ensureLocal();
    const cfg = officeCfg(), mc = M.cfg();
    p.innerHTML = `<div class="page-hd"><div class="ic"><i class="fas fa-user-tie"></i></div><div><div class="h2">大师智库</div><div class="hint">每个部门由一位「${esc(indShort())} × 部门」大师担任首席智能体：自动生成身份、履历与思维方式；您可以随时调整他们的思维、方法论和边界</div></div>
      <div style="margin-left:auto" class="flex"><button class="btn btn-ghost btn-sm" id="ms-regen"${M.busy ? ' disabled' : ''}><i class="fas ${M.busy ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}"></i>${M.busy ? '大师生成中…' : 'AI 重新生成大师（保留已编辑）'}</button></div></div>
      <div class="grid3">
        <div class="card"><div class="h4"><i class="fas fa-sliders" style="color:var(--c2)"></i> 模型配置</div><div class="hint mt">执行：<b>${esc(modelName(roleModel('exec')))}</b> · 验收：<b>${esc(modelName(roleModel('accept')))}</b><br>幻灯片设计：<b>${esc(modelName(roleModel('slideDesign')))}</b> · 出图：<b>${esc(modelName(roleModel('slideImage')))}</b></div><button class="btn btn-ghost btn-sm mt" onclick="gotoView('models')"><i class="fas fa-gear"></i>打开模型配置中心</button></div>
        <div class="card"><div class="h4"><i class="fas fa-file-powerpoint" style="color:#ea580c"></i> 部门汇报 PPT 页数</div><div class="flex mt"><span class="hint">每个部门</span><select id="ms-slides">${[3, 4, 5, 6].map((n) => `<option ${cfg.slides === n ? 'selected' : ''}>${n}</option>`).join('')}</select><span class="hint">页</span></div><div class="hint mt">页数越多，出图积分越高（GPT Image 2 约 30 积分/页）。</div></div>
        <div class="card"><div class="h4"><i class="fas fa-shield-halved" style="color:var(--warn)"></i> 全员边界（所有大师共同遵守）</div><textarea id="ms-rules" rows="5" class="mt" style="width:100%;font-size:12px" placeholder="每行一条，例如：&#10;所有价格建议不得低于成本价 15%&#10;不得承诺交期短于 30 天">${esc((mc.rules || []).join('\n'))}</textarea><button class="btn btn-pri btn-sm mt" id="ms-rules-save"><i class="fas fa-check"></i>保存全员边界</button></div>
      </div>
      <div class="ms-grid mt">${S.depts.map((d) => { const P = M.get(d.id) || {}; return `<article class="ms-card" style="--dc:${d.color}">
        <header><span class="dpt" style="--dc:${d.color}"><i class="fas ${d.icon}"></i>${esc(d.name)}</span>${P.ai ? '<span class="tag ok">AI 生成</span>' : '<span class="tag">模板</span>'}${P.edited ? '<span class="tag warn">已调整</span>' : ''}<button class="btn btn-ghost btn-sm" data-edit="${d.id}" style="margin-left:auto"><i class="fas fa-pen"></i>调整</button></header>
        <div class="ms-id"><div class="ms-av">${esc((P.name || '?')[0])}</div><div><b>${esc(P.title || '')}</b><div>${esc(P.name || '')} <span class="dim">· ${esc(P.motto || '')}</span></div></div></div>
        <div class="ms-sec"><h5>履历</h5><ul>${ul(P.resume)}</ul></div>
        <div class="ms-sec"><h5>思维方式</h5><ol>${ul(P.thinking)}</ol></div>
        <div class="ms-sec"><h5>方法论</h5><div class="flex wrap" style="gap:4px">${(P.frameworks || []).map((x) => `<span class="tag p">${esc(x)}</span>`).join('')}</div></div>
        <div class="ms-sec"><h5>边界</h5><ul class="bd">${ul(P.boundaries)}</ul></div>
        ${(P.kpis || []).length ? `<div class="ms-sec"><h5>结果指标</h5><div class="flex wrap" style="gap:4px">${P.kpis.map((x) => `<span class="tag ok">${esc(x)}</span>`).join('')}</div></div>` : ''}
      </article>`; }).join('')}</div>`;
    $('#ms-slides').onchange = (e) => { cfg.slides = +e.target.value; saveState(); };
    $('#ms-rules-save').onclick = () => { mc.rules = $('#ms-rules').value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20); saveState(); toast(`已保存 ${mc.rules.length} 条全员边界，后续任务立即生效`, 'fa-shield-halved'); };
    $('#ms-regen').onclick = () => { M.generate(true).then((ok) => { if (!ok) toast('需要连接 Genspark 才能 AI 生成大师身份'); if ($('#page')) MOD_PAGES.masters($('#page')); }); MOD_PAGES.masters(p); };
    $$('[data-edit]', p).forEach((b) => b.onclick = () => editMaster(b.dataset.edit));
  };
  window.onMastersChange = () => { if (window.currentView && currentView() === 'masters' && $('#page')) MOD_PAGES.masters($('#page')); };
  function editMaster(id) {
    const d = S.depts.find((x) => x.id === id), P = M.get(id);
    const ta = (k, rows, ph) => `<textarea data-k="${k}" rows="${rows}" style="width:100%;font-size:12px" placeholder="${ph}">${esc((P[k] || []).join('\n'))}</textarea>`;
    openModal(`<div class="flex"><span class="dpt" style="--dc:${d.color}"><i class="fas ${d.icon}"></i>${esc(d.name)}</span><div class="h2" style="font-size:17px">调整大师思维与边界</div><button class="close-x" data-close><i class="fas fa-xmark"></i></button></div>
      <div class="grid2 mt"><div class="col" style="gap:4px"><label class="hint">专业身份</label><input data-s="title" value="${esc(P.title)}"></div><div class="col" style="gap:4px"><label class="hint">姓名</label><input data-s="name" value="${esc(P.name)}"></div></div>
      <div class="col mt" style="gap:4px"><label class="hint">信条</label><input data-s="motto" value="${esc(P.motto || '')}"></div>
      <div class="grid2 mt"><div class="col" style="gap:4px"><label class="hint">履历（每行一条）</label>${ta('resume', 4, '')}</div><div class="col" style="gap:4px"><label class="hint">思维方式（每行一步，按顺序思考）</label>${ta('thinking', 4, '')}</div></div>
      <div class="grid2 mt"><div class="col" style="gap:4px"><label class="hint">方法论（每行一个）</label>${ta('frameworks', 4, '')}</div><div class="col" style="gap:4px"><label class="hint">边界 / 红线（每行一条，违反即验收不合格）</label>${ta('boundaries', 4, '')}</div></div>
      <div class="grid2 mt"><div class="col" style="gap:4px"><label class="hint">表达风格</label><input data-s="style" value="${esc(P.style || '')}"></div><div class="col" style="gap:4px"><label class="hint">结果指标（每行一个）</label>${ta('kpis', 2, '')}</div></div>
      <div class="flex mt"><span class="hint" style="flex:1">保存后，该部门后续所有任务的规划、撰写、验收都按新的思维方式与边界执行。</span><button class="btn btn-pri" id="me-save"><i class="fas fa-check"></i>保存</button></div>`, (m) => {
      $('#me-save', m).onclick = () => { $$('[data-s]', m).forEach((i) => P[i.dataset.s] = i.value.trim()); $$('[data-k]', m).forEach((t) => P[t.dataset.k] = t.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 10)); P.edited = true; saveState(); closeOverlay(); toast(`${P.title}「${P.name}」已更新`, 'fa-user-tie'); if ($('#page') && currentView() === 'masters') MOD_PAGES.masters($('#page')); };
    });
  }

  // ---------------- 后台页面：项目档案 ----------------
  const VERD = { achieved: ['目标达成', 'ok'], partial: ['部分达成', 'warn'], failed: ['未达成', 'bad'] };
  let openId = null;
  window.MOD_PAGES.archive = function (p) {
    const L = Archive.list(); if (!openId && L[0]) openId = L[0].id;
    const tot = L.reduce((a, r) => ({ docs: a.docs + r.stats.docs, slides: a.slides + r.stats.slides, tasks: a.tasks + r.stats.tasks }), { docs: 0, slides: 0, tasks: 0 });
    p.innerHTML = `<div class="page-hd"><div class="ic"><i class="fas fa-box-archive"></i></div><div><div class="h2">项目档案</div><div class="hint">老板指令完成后自动归档：各部门 Word / Excel / 创意 PPT、执行表、验收结果与复盘，随时检查成果与执行效果</div></div></div>
      <div class="grid4"><div class="stat"><div class="l">已归档项目</div><div class="v">${L.length}</div></div><div class="stat"><div class="l">部门成果</div><div class="v">${tot.tasks}</div></div><div class="stat"><div class="l">汇报文档</div><div class="v">${tot.docs}</div><div class="d muted">Word + Excel + PPT</div></div><div class="stat"><div class="l">创意幻灯片</div><div class="v">${tot.slides}</div></div></div>
      ${L.length ? `<div class="ar-wrap mt"><aside class="ar-list">${L.map((r) => { const v = VERD[r.acceptance?.verdict] || ['—', 'p']; return `<button class="ar-item ${openId === r.id ? 'on' : ''}" data-ar="${r.id}"><div class="flex between"><b>#${r.no}</b><span class="tag ${v[1]}">${v[0]} ${r.acceptance?.score ?? ''}</span></div><div class="ar-t">${esc(r.text)}</div><div class="dim" style="font-size:11px">${r.issuedAt} → ${r.doneAt} · ${r.stats.depts} 部门 · ${r.stats.docs} 文档${r.real ? '' : ' · 仿真'}</div></button>`; }).join('')}</aside><section class="ar-main" id="ar-main">${detail(Archive.get(openId) || L[0])}</section></div>`
        : '<div class="empty-state" style="height:320px"><div><i class="fas fa-box-archive" style="font-size:36px"></i><p class="mt">暂无归档项目</p><p class="hint">老板指令全部交付并完成复盘后，会自动归档到这里</p></div></div>'}`;
    $$('[data-ar]', p).forEach((b) => b.onclick = () => { openId = b.dataset.ar; MOD_PAGES.archive(p); });
    bindDetail(p);
  };
  function detail(r) {
    if (!r) return '';
    const v = VERD[r.acceptance?.verdict] || ['—', 'p'];
    return `<div class="card"><div class="flex between"><div><div class="h2" style="font-size:17px">#${r.no} ${esc(r.text)}</div><div class="hint">${esc(r.company)} · ${esc(r.industry)} · 下达 ${r.issuedAt} · 完成 ${r.doneAt}${r.iteration > 1 ? ` · 第 ${r.iteration} 轮` : ''}</div></div><div class="flex"><button class="btn btn-ghost btn-sm" data-brief="${r.id}"><i class="fas fa-person-chalkboard"></i>全屏部门汇报会</button><button class="btn btn-pri btn-sm" data-zip="${r.id}"><i class="fas fa-file-zipper"></i>打包下载全部文档</button></div></div>
      ${r.goal ? `<div class="mt" style="font-size:13px"><b>目标：</b>${esc(r.goal)}</div>` : ''}
      <div class="grid4 mt"><div class="stat sm"><div class="l">指令验收</div><div class="v">${r.acceptance?.score ?? '—'} <span class="tag ${v[1]}" style="font-size:11px">${v[0]}</span></div></div><div class="stat sm"><div class="l">部门平均分</div><div class="v">${r.stats.avg}</div></div><div class="stat sm"><div class="l">工具调用 / 证据</div><div class="v">${r.stats.toolCalls} / ${r.stats.evidence}</div></div><div class="stat sm"><div class="l">返工次数</div><div class="v">${r.stats.rework}</div></div></div>
      ${r.acceptance?.summary ? `<div class="cp-acc mt" style="margin:12px 0 0">${esc(r.acceptance.summary)}</div>` : ''}</div>
      <div class="card mt"><div class="ct"><span class="h3"><i class="fas fa-chart-column" style="color:var(--c1)"></i> 各部门执行效果</span></div><table class="table"><tr><th>部门</th><th>首席大师</th><th>成果</th><th>负责人 / 级别</th><th>验收</th><th>返工</th><th>工具</th><th>证据</th><th>汇报材料</th></tr>
        ${r.depts.flatMap((d) => d.tasks.map((t) => `<tr><td><span class="dpt" style="--dc:${d.color}"><i class="fas ${d.icon}"></i>${esc(d.name)}</span></td><td>${d.persona ? `${esc(d.persona.title)}<div class="dim" style="font-size:11px">${esc(d.persona.name)}</div>` : '—'}</td><td>${esc(t.title)}<div class="dim" style="font-size:11px">${esc(t.deliverable || '')}</div></td><td>${t.owner ? esc(t.owner.name) : '—'} ${tierBadge(t.tier, true)}</td><td><b style="color:${t.accept?.pass === false ? 'var(--warn)' : 'var(--ok)'}">${t.score ?? '—'}</b>${t.accept ? `<span class="dots3">${(t.accept.items || []).map((x) => `<i class="${x.status}"></i>`).join('')}</span>` : ''}</td><td>${t.rework}</td><td>${t.toolCalls}</td><td>${t.evidence.length}</td><td>${t.pack ? `<span class="doc3"><button data-rv="${t.id}" data-tab="doc" class="w" title="Word"><i class="fas fa-file-word"></i></button><button data-rv="${t.id}" data-tab="xls" class="x" title="Excel"><i class="fas fa-file-excel"></i></button><button data-rv="${t.id}" data-tab="ppt" class="p" title="PPT"><i class="fas fa-file-powerpoint"></i></button></span>` : '<span class="dim">—</span>'}</td></tr>`)).join('')}</table></div>
      <div class="grid2 mt"><div class="card"><div class="h3"><i class="fas fa-book" style="color:var(--c2)"></i> 复盘经验</div>${(r.review?.lessons || []).map((x) => `<div style="font-size:13px;margin-top:8px">▸ ${esc(x)}</div>`).join('') || '<div class="hint mt">无</div>'}</div><div class="card"><div class="h3"><i class="fas fa-rotate" style="color:var(--ok)"></i> 下一轮方向</div>${(r.review?.next || []).map((x) => `<div style="font-size:13px;margin-top:8px">▸ ${esc(x)}</div>`).join('') || '<div class="hint mt">无</div>'}${Flow.cmd(r.cmdId) ? `<button class="btn btn-ghost btn-sm mt" data-iter="${r.cmdId}"><i class="fas fa-rotate"></i>基于本档案迭代下一轮</button>` : ''}</div></div>`;
  }
  const findSnap = (id) => { for (const r of Archive.list()) for (const d of r.depts) { const t = d.tasks.find((x) => x.id === id); if (t) return t; } return null; };
  function bindDetail(p) {
    $$('[data-rv]', p).forEach((b) => b.onclick = () => openReport(findSnap(b.dataset.rv), b.dataset.tab));
    $$('[data-zip]', p).forEach((b) => b.onclick = () => Archive.zip(Archive.get(b.dataset.zip)));
    $$('[data-brief]', p).forEach((b) => b.onclick = () => { const r = Archive.get(b.dataset.brief); openBriefing(r.depts.flatMap((d) => d.tasks.filter((t) => t.pack).map((t) => ({ r: t, slides: t.pack.slides })))); });
    $$('[data-iter]', p).forEach((b) => b.onclick = () => { const n = Flow.iterate(b.dataset.iter); if (n) { toast(`已基于档案下达第 ${n.iteration} 轮：#${n.no}`, 'fa-rotate'); gotoView('flow'); } });
  }
})();
