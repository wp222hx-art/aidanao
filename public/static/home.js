// 智导 · 主页：两大方向（A 为我的企业 / B 给任何企业献策），所有平台都能一键回到这里
(function () {
  const RK = 'ebrain_route';
  window.appRoute = () => sessionStorage.getItem(RK) || 'home';
  window.goHome = () => {
    sessionStorage.setItem(RK, 'home');
    document.querySelector('.ideas-overlay')?.remove();
    if (location.hash) history.replaceState(null, '', location.pathname);
    renderApp();
  };
  // 进入企业智脑（已创建 → 调度中枢；未创建 → 创建向导）
  window.enterBrain = (view) => {
    sessionStorage.setItem(RK, 'brain');
    document.querySelector('.ideas-overlay')?.remove();
    renderApp();
    if (view && S.launched && window.gotoView && document.querySelector('#hq-main')) gotoView(view);
  };

  let stats = null;
  window.renderHome = function () {
    const has = S.launched && S.depts?.length, co = S.company?.name || '';
    const step = (i, t) => `<div class="hx-step"><i class="fas ${i}"></i><span>${t}</span></div>`;
    const arrow = '<i class="fas fa-chevron-right hx-arr"></i>';
    $('#app').innerHTML = `
    <div class="home">
      <header class="home-top">
        <div class="logo"><div class="orb"><i class="fas fa-brain"></i></div><div>智导<div class="dim" style="font-size:11px;font-weight:400">企业智脑 × 献策网络</div></div></div>
        <div class="hx-top-r"><button class="hx-wallet" id="hx-wallet"><i class="fas fa-coins"></i>我的智点 <b id="hx-bal">0</b></button><div id="home-pill"></div></div>
      </header>
      <main class="home-main">
        <section class="home-hero hx-hero">
          <h1>用 AI 经营企业，<span class="grad-txt">用点子赚智点</span></h1>
          <p>老板在这里指挥 AI 干活；人人都能给企业出主意，被采纳就有奖励</p>
          <div class="hx-ctas">
            <button class="hx-cta a" id="hx-boss"><i class="fas fa-building"></i><span><b>我是老板</b><small>让 AI 帮我经营企业</small></span></button>
            <button class="hx-cta b" id="hx-idea"><i class="fas fa-lightbulb"></i><span><b>我有点子</b><small>给企业献策赚智点</small></span></button>
          </div>
          <div class="hx-proof" id="home-stats"></div>
        </section>

        <section class="home-dirs hx-dirs">
          <article class="home-dir dir-a" id="dir-a">
            <div class="hx-dh"><div class="dir-ic"><i class="fas fa-building-circle-check"></i></div><div><h2>经营我的企业</h2><p>一句话下指令，AI 部门替你干完</p></div></div>
            <div class="hx-steps">${step('fa-comment', '说一句指令')}${arrow}${step('fa-list-check', 'AI 出 3 套方案')}${arrow}${step('fa-user-check', '你拍板')}${arrow}${step('fa-file-export', '交付文档')}</div>
            <div class="dir-acts">
              ${has ? `<button class="btn btn-pri" id="a-enter"><i class="fas fa-arrow-right-to-bracket"></i>进入「${esc(co.length > 12 ? co.slice(0, 12) + '…' : co)}」</button>
                <span class="hx-links"><a id="a-idea">用我的想法</a><a id="a-inbox">企业收件箱</a><a id="a-svc">服务中心</a></span>`
              : `<button class="btn btn-pri" id="a-create"><i class="fas fa-wand-magic-sparkles"></i>${S.step > 1 ? '继续创建' : '免费创建企业智脑'}</button>
                <span class="hx-links"><a id="a-demo"><i class="fas fa-play"></i> 先看演示</a></span>`}
            </div>
          </article>
          <article class="home-dir dir-b" id="dir-b">
            <div class="hx-dh"><div class="dir-ic"><i class="fas fa-paper-plane"></i></div><div><h2>给企业献策</h2><p>不用懂策划，AI 帮你写成方案</p></div></div>
            <div class="hx-steps">${step('fa-building', '选一家企业')}${arrow}${step('fa-pen', '说出你的想法')}${arrow}${step('fa-wand-magic-sparkles', 'AI 写成方案')}${arrow}${step('fa-inbox', '送到企业')}</div>
            <div class="dir-acts">
              <button class="btn btn-warm" id="b-go"><i class="fas fa-lightbulb"></i>开始献策</button>
              <span class="hx-links"><a id="b-mine">我的献策</a><a id="b-square">献策广场</a></span>
            </div>
          </article>
        </section>

        <section class="home-bridge hx-earn" id="home-bridge">
          <div class="hx-eh">
            <div><h3><i class="fas fa-coins"></i> 怎么赚智点</h3><p>悬赏中 <b id="hb-ch">—</b> 个征集令 · 奖池 <b id="hb-pool">—</b> 智点 · 同行方案 <b id="hb-so">—</b> 个</p></div>
            <button class="btn btn-pri" id="hb-go"><i class="fas fa-trophy"></i>去应征赚智点</button>
          </div>
          <div class="hx-grid">
            ${[['fa-trophy', '3,000', '赢企业悬赏', 'hot', 'hb-max'], ['fa-circle-check', '+100', '被企业采纳', 'hot'], ['fa-rocket', '+50', '方案落地', ''], ['fa-reply', '+10', '企业回复', ''],
              ['fa-paper-plane', '+5', '提交献策', ''], ['fa-heart', '+1', '被点赞', ''], ['fa-share-nodes', '+20', '企业共享方案', 'co'], ['fa-coins', '80%', '方案被同行购买', 'co']]
              .map(([i, v, l, k, id]) => `<div class="hx-chip ${k}"><i class="fas ${i}"></i><b${id ? ` id="${id}"` : ''}>${v}</b><span>${l}</span></div>`).join('')}
          </div>
          <div class="hx-ef"><span><i class="fas fa-shield-halved"></i>智点用于平台内兑换与打赏，不可提现；现金奖励由企业写明、双方线下约定</span><span class="hx-links"><a id="hb-so-btn">同行方案库</a><a id="hb-rank">排行榜</a><a id="hb-rule">完整规则</a></span></div>
        </section>
        <section class="home-feed" id="home-feed"></section>
        <footer class="home-foot"><span>智导 · 企业智脑 × 献策网络</span><a id="h-admin"><i class="fas fa-shield-halved"></i>平台后台</a></footer>
      </main>
    </div>`;
    const on = (id, fn) => { const el = $('#' + id); if (el) el.onclick = fn; };
    on('a-enter', () => enterBrain());
    on('a-create', () => enterBrain());
    on('a-demo', () => { enterBrain(); if (window.loadDemo) loadDemo(); });
    on('a-idea', () => openIdeas('self'));
    on('a-inbox', () => openIdeas(null, 'inbox'));
    on('a-svc', () => window.openServices && openServices());
    on('h-admin', () => window.openAdmin && openAdmin());
    on('hx-boss', () => { enterBrain(); });
    on('hx-idea', () => openIdeas('other'));
    on('hx-wallet', () => openMarket('wallet')); on('hb-rule', () => openMarket('wallet'));
    { const uid = window.Market?.uid ? Market.uid() : localStorage.getItem('ebrain_uid');
      if (uid) fetch('/api/mkt/wallet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid }) }).then((r) => r.json()).then((w) => { const e = $('#hx-bal'); if (e && w.ok) e.textContent = (w.balance || 0).toLocaleString(); }).catch(() => { }); }
    on('hb-go', () => openMarket('challenges')); on('hb-so-btn', () => openMarket('solutions')); on('hb-rank', () => openMarket('rank'));
    Promise.all([fetch('/api/mkt/challenges').then((r) => r.json()), fetch('/api/mkt/solutions').then((r) => r.json())]).then(([a, b2]) => {
      const set = (id, v) => { const e = $('#' + id); if (e) e.textContent = v; };
      set('hb-ch', a.challenges?.length ?? 0); set('hb-pool', (a.challenges || []).reduce((n, c) => n + (c.escrow || 0), 0).toLocaleString()); set('hb-so', b2.solutions?.length ?? 0);
      const mx = Math.max(0, ...(a.challenges || []).map((c) => c.rewardPoints || 0)); if (mx) set('hb-max', mx.toLocaleString());
    }).catch(() => { });
    on('b-go', () => openIdeas('other'));
    on('b-mine', () => openIdeas(null, 'mine'));
    on('b-square', () => openIdeas(null, 'square'));
    const paint = () => {
      const el = $('#home-stats'); if (!el || !stats) return;
      el.innerHTML = [[stats.ideas, '份献策'], [stats.companies, '家企业入驻'], [stats.adopted, '份被采纳'], [stats.likes, '次点赞']]
        .map(([v, l]) => `<span><b>${v ?? 0}</b>${l}</span>`).join('<i></i>');
    };
    paint();
    fetch('/api/ideas/stats').then((r) => r.json()).then((j) => { if (j.ok) { stats = j; paint(); } }).catch(() => { });
    // 献策广场精选：让主页一打开就能看到市场的热闹
    fetch('/api/ideas/market?sort=hot').then((r) => r.json()).then((j) => {
      const el = $('#home-feed'); if (!el || !j.ok || !j.ideas?.length) return;
      const KN = { proposal: ['fa-file-lines', '策划案'], suggestion: ['fa-comment-dots', '改进建议'], design: ['fa-palette', '设计思路'] };
      el.innerHTML = `<div class="hf-hd"><h3><i class="fas fa-fire" style="color:#ef4444"></i> 献策广场正在热议</h3><a id="hf-more">查看全部 <i class="fas fa-arrow-right"></i></a></div>
        <div class="hf-row">${j.ideas.slice(0, 8).map((x) => `<button class="hf-card k-${x.kind}" data-hf="${esc(x.target)}"><span class="id-kb k-${x.kind}"><i class="fas ${KN[x.kind]?.[0]}"></i>${KN[x.kind]?.[1]}</span>${x.sample ? '<span class="mk-sample">样板</span>' : ''}<b>${esc(x.title)}</b><small>→ ${esc(x.target)}</small><span class="hf-like"><i class="fas fa-heart"></i>${x.likes}</span></button>`).join('')}</div>`;
      $('#hf-more').onclick = () => openIdeas(null, 'square');
      $$('[data-hf]', el).forEach((b) => b.onclick = () => openIdeas(null, 'square'));
    }).catch(() => { });
  };
})();
