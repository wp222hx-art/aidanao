// 企业智脑 · 模型配置中心：按角色分配 Genspark 模型（列表与 gsk CLI 同源：/api/llm_proxy/v1/models + /api/tool_cli/tools）
(function () {
  let CAT = null, loading = null, tests = {};
  const VENDOR = { openai: 'OpenAI', anthropic: 'Anthropic · Claude', genspark: '开源 / 其他', arcee: 'Arcee' };
  const PRESETS = {
    best: { name: '旗舰推荐', desc: '研究/评审用 GPT，规划与幻灯片设计用 Claude，出图用 GPT Image 2', roles: { research: 'gpt-5.5', strategy: 'claude-opus-5-5', feasibility: 'gpt-5.5', exec: 'gpt-5.5', accept: 'gpt-5.5', slideDesign: 'claude-opus-5-5', slideImage: 'gpt-image-2', review: 'gpt-5.5', persona: 'gpt-5.5' } },
    claude: { name: '全 Claude', desc: '所有推理角色使用 Claude Opus 5.5，出图 GPT Image 2', roles: { research: 'claude-opus-5-5', strategy: 'claude-opus-5-5', feasibility: 'claude-opus-5-5', exec: 'claude-opus-5-5', accept: 'claude-opus-5-5', slideDesign: 'claude-opus-5-5', slideImage: 'gpt-image-2', review: 'claude-opus-5-5', persona: 'claude-opus-5-5' } },
    cross: { name: '交叉制衡', desc: '执行用 Claude、验收与评审用 GPT，让「写的人」和「查的人」不是同一个模型', roles: { research: 'gpt-5.5', strategy: 'claude-opus-5-5', feasibility: 'gpt-6.1-sol', exec: 'claude-opus-5-5', accept: 'gpt-5.5', slideDesign: 'claude-opus-5-5', slideImage: 'gpt-image-2', review: 'gpt-6.1-sol', persona: 'claude-opus-5-5' } },
    economy: { name: '经济模式', desc: '执行用 Claude Sonnet 5.5，出图 Nano Banana 2.1，积分更省', roles: { research: 'gpt-5.5', strategy: 'claude-opus-5-5', feasibility: 'gpt-5.5', exec: 'claude-sonnet-5-5', accept: 'gpt-5.5', slideDesign: 'claude-sonnet-5-5', slideImage: 'nano-banana-2.1', review: 'gpt-5.5', persona: 'claude-sonnet-5-5' } }
  };
  window.Models = {
    load(force) {
      if (CAT && !force) return Promise.resolve(CAT);
      if (!(window.AI && AI.on)) return Promise.resolve(null);
      return loading = loading || AI.call('/models', null, 'GET').then((r) => (CAT = r)).catch(() => null).finally(() => { loading = null; });
    },
    get catalog() { return CAT; }
  };
  function opts(role, cur) {
    if (role.kind === 'image') {
      const list = CAT?.images?.length ? CAT.images : SLIDE_MODELS.map((x) => x[0]);
      return list.map((id) => `<option value="${esc(id)}" ${id === cur ? 'selected' : ''}>${esc(modelName(id))}${id === 'gpt-image-2' ? '（中文排版最佳）' : ''}</option>`).join('');
    }
    const list = CAT?.llms?.length ? CAT.llms : ENGINE_LIST.map(([id]) => ({ id, vendor: /claude/.test(id) ? 'anthropic' : 'openai' }));
    const groups = {}; list.forEach((m) => (groups[m.vendor] = groups[m.vendor] || []).push(m.id));
    if (!list.some((m) => m.id === cur)) (groups.custom = groups.custom || []).push(cur);
    const order = ['anthropic', 'openai', ...Object.keys(groups).filter((k) => !['anthropic', 'openai'].includes(k))];
    return order.filter((g) => groups[g]).map((g) => `<optgroup label="${esc(VENDOR[g] || g)}">${groups[g].map((id) => `<option value="${esc(id)}" ${id === cur ? 'selected' : ''}>${esc(id)}</option>`).join('')}</optgroup>`).join('');
  }
  window.MOD_PAGES = window.MOD_PAGES || {};
  window.MOD_PAGES.models = function (p) {
    const cfg = modelCfg();
    if (!CAT && window.AI && AI.on && !loading) Models.load().then(() => { if (window.currentView && currentView() === 'models' && $('#page')) MOD_PAGES.models($('#page')); });
    const vendorCnt = CAT ? CAT.llms.reduce((m, x) => (m[x.vendor] = (m[x.vendor] || 0) + 1, m), {}) : {};
    p.innerHTML = `<div class="page-hd"><div class="ic"><i class="fas fa-sliders"></i></div><div><div class="h2">模型配置中心</div><div class="hint">每个智能体角色都可以单独指定 AI 模型；模型清单与 <code>gsk</code> CLI 同源实时读取，调用全部使用您本人的 AI 授权</div></div>
      <div style="margin-left:auto" class="flex"><button class="btn btn-ghost btn-sm" id="md-refresh"><i class="fas fa-rotate"></i>刷新模型清单</button></div></div>
      <div class="grid4">
        <div class="stat"><div class="l"><i class="fas fa-plug" style="color:${window.AI && AI.on ? 'var(--ok)' : 'var(--bad)'}"></i> AI 模型通道</div><div class="v" style="font-size:18px">${window.AI && AI.on ? '已连接' : '未连接'}</div><div class="d muted">${CAT ? esc(CAT.source) : loading ? '读取中…' : '—'}</div></div>
        <div class="stat"><div class="l"><i class="fas fa-brain" style="color:var(--c2)"></i> 可用大模型</div><div class="v">${CAT ? CAT.llms.length : '—'}</div><div class="d muted">${Object.entries(vendorCnt).map(([k, n]) => `${VENDOR[k] || k} ${n}`).join(' · ')}</div></div>
        <div class="stat"><div class="l"><i class="fas fa-image" style="color:#ea580c"></i> 可用出图模型</div><div class="v">${CAT ? CAT.images.length : '—'}</div><div class="d muted">幻灯片默认 GPT Image 2</div></div>
        <div class="stat"><div class="l"><i class="fas fa-gauge-high" style="color:var(--c1)"></i> 推理深度</div><select id="md-effort" class="mt" style="width:100%">${[['medium', '标准（medium）'], ['high', '深度（high）· 推荐'], ['xhigh', '极致（xhigh）· 最慢最贵']].map(([k, n]) => `<option value="${k}" ${cfg.effort === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      </div>
      <div class="card mt"><div class="ct"><span class="h3"><i class="fas fa-wand-magic-sparkles" style="color:var(--c2)"></i> 一键方案</span><span class="dim" style="font-size:12px">选择后可再逐个微调</span></div>
        <div class="preset-row">${Object.entries(PRESETS).map(([k, P]) => `<button class="preset" data-preset="${k}"><b>${P.name}</b><small>${P.desc}</small></button>`).join('')}</div></div>
      <div class="role-grid mt">${MODEL_ROLES.map((r) => { const cur = cfg.roles[r.k], t = tests[r.k]; return `<article class="role-card ${r.kind}">
        <header><span class="role-ic"><i class="fas ${r.icon}"></i></span><div><b>${r.name}</b><small>${r.desc}</small></div></header>
        <div class="flex mt"><select data-role="${r.k}" style="flex:1;min-width:0">${opts(r, cur)}</select>${r.kind === 'llm' ? `<button class="btn btn-ghost btn-sm" data-test="${r.k}" title="连通测试"><i class="fas ${t?.busy ? 'fa-spinner fa-spin' : 'fa-vial'}"></i></button>` : ''}</div>
        <div class="role-ft">${cur === r.def ? '<span class="tag ok">推荐默认</span>' : `<span class="tag">已自定义</span><a class="lnk" data-reset="${r.k}">恢复默认 ${esc(modelName(r.def))}</a>`}${t && !t.busy ? `<span class="${t.ok ? 'ok' : 'bad'}" style="font-size:11px">${t.ok ? `✓ ${(t.ms / 1000).toFixed(1)}s · ${esc(t.reply)}` : '✗ ' + esc(t.err)}</span>` : ''}</div>
      </article>`; }).join('')}</div>
      <div class="grid2 mt">
        <div class="card"><div class="h3"><i class="fas fa-scale-balanced" style="color:var(--warn)"></i> 规划校验规则</div>
          <label class="chk mt"><input type="checkbox" id="md-revise" ${cfg.autoRevise ? 'checked' : ''}> 可行性校验低于 80 分或存在高风险问题时，战略官按评审意见<b>自动修订一次</b>再交老板决策</label>
          <label class="chk mt"><input type="checkbox" id="md-confirm" ${S.sim?.settings?.planConfirm ? 'checked' : ''}> 规划完成后必须由老板决策（选定方案）再分发到部门</label></div>
        <div class="card"><div class="h3"><i class="fas fa-route" style="color:var(--c1)"></i> 一条老板指令的模型调用链</div>
          <div class="chain mt">${['research', 'strategy', 'feasibility', 'exec', 'accept', 'slideDesign', 'slideImage', 'review'].map((k, i) => { const r = MODEL_ROLES.find((x) => x.k === k); return `${i ? '<i class="fas fa-arrow-right"></i>' : ''}<span><b>${r.name}</b><small>${esc(modelName(cfg.roles[k]))}</small></span>`; }).join('')}</div></div>
      </div>`;
    $$('[data-role]', p).forEach((s) => s.onchange = () => { cfg.roles[s.dataset.role] = s.value; delete tests[s.dataset.role]; saveState(); toast(`${MODEL_ROLES.find((r) => r.k === s.dataset.role).name} → ${s.value}`, 'fa-sliders'); MOD_PAGES.models(p); });
    $$('[data-reset]', p).forEach((a) => a.onclick = () => { const r = MODEL_ROLES.find((x) => x.k === a.dataset.reset); cfg.roles[r.k] = r.def; saveState(); MOD_PAGES.models(p); });
    $$('[data-preset]', p).forEach((b) => b.onclick = () => { const P = PRESETS[b.dataset.preset]; Object.assign(cfg.roles, P.roles); tests = {}; saveState(); toast(`已应用「${P.name}」`, 'fa-wand-magic-sparkles'); MOD_PAGES.models(p); });
    $$('[data-test]', p).forEach((b) => b.onclick = async () => {
      const k = b.dataset.test; if (!(window.AI && AI.on)) return toast('需要先连接 AI');
      tests[k] = { busy: true }; MOD_PAGES.models(p);
      try { const r = await AI.call('/models/test', { engine: cfg.roles[k] }); tests[k] = { ok: true, ms: r.ms, reply: r.reply }; }
      catch (e) { tests[k] = { ok: false, err: e.message }; }
      if (currentView() === 'models' && $('#page')) MOD_PAGES.models($('#page'));
    });
    $('#md-effort').onchange = (e) => { cfg.effort = e.target.value; saveState(); toast(`推理深度：${e.target.value}`, 'fa-gauge-high'); };
    $('#md-revise').onchange = (e) => { cfg.autoRevise = e.target.checked; saveState(); };
    $('#md-confirm').onchange = (e) => { if (S.sim) { S.sim.settings.planConfirm = e.target.checked; saveState(); } };
    $('#md-refresh').onclick = () => { CAT = null; Models.load(true).then(() => MOD_PAGES.models(p)); MOD_PAGES.models(p); };
  };
})();
