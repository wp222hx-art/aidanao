// 企业智脑 · 核心状态与工具
(function () {
  const KEY = 'ebrain_state_v1';
  const def = () => ({ step: 1, industry: null, company: { name: '', scan: null, profile: null }, depts: [], staff: [], agents: [], launched: false, sim: null });
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)) || def(); } catch { S = def(); }
  window.S = S;
  // 兼容旧数据：补齐员工能力级别
  setTimeout(() => { (window.S.staff || []).forEach((p) => { if (!p.tier && window.autoTier) p.tier = autoTier(p); }); }, 0);
  window.saveState = () => { try { localStorage.setItem(KEY, JSON.stringify(window.S)); } catch (e) { } };
  window.resetState = () => { localStorage.removeItem(KEY); window.S = def(); };

  window.$ = (sel, root = document) => root.querySelector(sel);
  window.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  window.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  window.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  window.uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);
  window.hashCode = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
  window.seeded = (seed) => { let x = hashCode(seed) || 1; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; };
  const AV = ['#ff7043', '#29b6f6', '#ab47bc', '#66bb6a', '#ec407a', '#ffa726', '#5c6bc0', '#26a69a', '#8d6e63', '#ef5350'];
  window.avColor = (s) => AV[hashCode(s) % AV.length];
  window.fmtMoney = (n) => n >= 10000 ? (n / 10000).toFixed(1) + '万' : Math.round(n).toLocaleString();
  window.deptLib = (id) => DEPT_LIBRARY.find((d) => d.id === id);

  window.toast = (msg, icon = 'fa-circle-info') => {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<i class="fas ${icon}" style="color:var(--c1);margin-right:8px"></i>${msg}`;
    $('#toast-layer').appendChild(el);
    setTimeout(() => el.remove(), 2800);
  };

  window.openDrawer = (html, onMount) => {
    closeOverlay();
    const m = document.createElement('div'); m.className = 'drawer-mask'; m.onclick = closeOverlay;
    const d = document.createElement('aside'); d.className = 'drawer'; d.innerHTML = html;
    document.body.append(m, d);
    $$('[data-close]', d).forEach((b) => (b.onclick = closeOverlay));
    onMount && onMount(d);
    return d;
  };
  window.openModal = (html, onMount) => {
    closeOverlay();
    const m = document.createElement('div'); m.className = 'drawer-mask'; m.onclick = closeOverlay;
    const d = document.createElement('div'); d.className = 'modal'; d.innerHTML = html;
    document.body.append(m, d);
    $$('[data-close]', d).forEach((b) => (b.onclick = closeOverlay));
    onMount && onMount(d);
    return d;
  };
  window.closeOverlay = () => { $$('.drawer-mask,.drawer,.modal').forEach((e) => e.remove()); };

  // 员工价值评估：经验 + 技能匹配 + 简历信息密度
  window.scoreStaff = (p) => {
    const lib = deptLib((S.depts.find((d) => d.id === p.deptId) || {}).lib);
    const kw = lib ? (lib.name + lib.tasks.join('') + lib.kpi.join('')) : '';
    const match = p.skills.filter((s) => kw.includes(s) || ['数据分析', 'AI', '项目管理', '管理'].includes(s)).length;
    const v = Math.min(99, 42 + Math.min(p.years, 15) * 2.4 + p.skills.length * 2.5 + match * 4 + Math.min((p.resume || '').length / 40, 8));
    return Math.round(v);
  };
  window.parseSkills = (text) => SKILL_DICT.filter((k) => text.toLowerCase().includes(k.toLowerCase()));
  window.genName = () => pick(SURNAMES) + pick(GIVEN);

  // AI 企业画像（基于行业与扫描结果推断；明确标注为推断）
  window.buildProfile = (scan) => {
    const ind = S.industry; const name = S.company.name;
    const r = seeded(name + (ind?.div?.code || ''));
    const kw = (ind?.div?.kw || '').split(' ').filter(Boolean);
    const main = kw.slice(0, 3);
    const isMfg = ['C', 'B', 'A', 'D'].includes(ind?.code);
    const chain = isMfg ? ['原料采购', '研发设计', '生产制造', '质量管控', '仓储物流', '渠道销售', '售后服务']
      : ['E', 'K'].includes(ind?.code) ? ['商机获取', '方案设计', '投标签约', '项目施工', '验收交付', '回款结算', '运维服务']
        : ['F', 'H', 'O'].includes(ind?.code) ? ['选品采购', '门店/渠道', '营销引流', '交易转化', '履约配送', '会员复购', '口碑裂变']
          : ['市场洞察', '产品研发', '营销获客', '销售转化', '交付实施', '客户成功', '续费增购'];
    const domains = SEVEN_DOMAINS.map((d) => ({ name: d, score: Math.round(45 + r() * 45) }));
    const weakest = [...domains].sort((a, b) => a.score - b.score).slice(0, 2);
    const evidence = (scan?.news?.length || 0) + (scan?.wiki ? 3 : 0);
    return {
      positioning: `${name} 位于「${ind?.name} › ${ind?.div?.name}」赛道，核心业务聚焦 ${main.join('、') || ind?.div?.name}。`,
      chain, domains, weakest,
      canvas: {
        客户细分: isMfg ? '下游品牌商 / 经销商 / 工程客户' : '中小企业 / 区域客户 / 重点行业大客户',
        价值主张: `以更稳定的交付与更快的响应提供 ${main[0] || '核心产品'}`,
        渠道通路: '直销团队 + 行业展会 + 线上内容获客 + 老客户转介绍',
        收入来源: isMfg ? '产品销售 + 定制加工 + 售后配件' : '项目收入 + 订阅/服务费 + 增值服务',
        核心资源: '行业经验团队、客户关系、交付体系、资质与数据',
        成本结构: isMfg ? '原材料 + 人工 + 制造费用 + 渠道费用' : '人力成本 + 获客成本 + 交付成本'
      },
      opportunities: [
        `在「${main[0] || ind?.div?.name}」相关公开采购/招标中建立线索订阅，预计可提升线索覆盖`,
        `「${weakest[0].name}」是当前短板，建议立项 90 天增长实验`,
        `将老客户复购与转介绍纳入 ${pick(['客户成功部', '销售部'])} 的周目标`,
        `用 AI 内容工厂把交付案例转为海报/短视频，降低获客成本`
      ],
      risks: ['公开数据有限，部分结论为行业推断，需内部数据校验', '外部情报需遵守平台授权与个人信息保护', '营销内容需过广告法合规审校'],
      confidence: Math.min(92, 38 + evidence * 6),
      evidence
    };
  };

  // 生成部门 Agent 列表
  window.buildAgents = () => {
    const out = [];
    S.depts.forEach((d) => {
      const lib = deptLib(d.lib);
      const names = lib ? lib.agents : ['通用执行官', '进度督办官'];
      names.forEach((n, i) => out.push({
        id: uid('ag'), deptId: d.id, name: n, level: i === 0 ? 'L2' : pick(['L1', 'L2', 'L3']),
        score: rand(78, 96), done: 0, fail: 0, status: 'idle', evals: { acc: rand(80, 97), evi: rand(70, 95), time: rand(75, 99), comp: rand(85, 99), val: rand(65, 92) }
      }));
      // 每个部门再配置若干执行型子 Agent（模拟“几十到几百个Agent”）
      const sub = Math.max(2, Math.round((S.staff.filter((s) => s.deptId === d.id).length || 2) * 1.5));
      for (let k = 0; k < sub; k++) out.push({ id: uid('ag'), deptId: d.id, name: `${d.name.replace(/部$/, '')}执行体-${String(k + 1).padStart(2, '0')}`, level: 'L3', score: rand(75, 94), done: 0, fail: 0, status: 'idle', sub: true, evals: { acc: rand(78, 96), evi: rand(70, 92), time: rand(75, 99), comp: rand(85, 99), val: rand(60, 88) } });
    });
    S.agents = out;
  };
  window.agentTotal = (a) => Math.round(EVAL_DIMS.reduce((s, d) => s + a.evals[d.k] * d.w, 0) / 100);
})();
