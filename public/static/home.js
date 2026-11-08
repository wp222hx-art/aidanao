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
    $('#app').innerHTML = `
    <div class="home">
      <header class="home-top">
        <div class="logo"><div class="orb"><i class="fas fa-brain"></i></div><div>智导<div class="dim" style="font-size:11px;font-weight:400">企业智脑 × 献策网络</div></div></div>
        <div id="home-pill"></div>
      </header>
      <main class="home-main">
        <section class="home-hero">
          <h1>选一个方向，<span class="grad-txt">让 AI 替你把事做成</span></h1>
          <p>经营自己的企业，或者给任何一家企业出个好主意，都从这里开始</p>
        </section>
        <section class="home-dirs">
          <article class="home-dir dir-a" id="dir-a">
            <div class="dir-tag">方向 A</div>
            <div class="dir-ic"><i class="fas fa-building-circle-check"></i></div>
            <h2>经营我的企业</h2>
            <p class="dir-sub">老板的 AI 指挥舱：下达一句话指令 → 深度研究 → 3 套方案 → 可行性校验 → 你拍板 → 各部门 AI 大师执行，最后交付 Word / Excel / PPT</p>
            <ul>
              <li><i class="fas fa-check"></i>数字孪生企业，99+ 个 Agent 分部门上岗</li>
              <li><i class="fas fa-check"></i><b>用我自己的想法</b>解决企业问题，AI 写成策划案后直接交给智脑执行</li>
              <li><i class="fas fa-check"></i>服务中心：数据雷达、热点视频、贸易数据、政务办事、官网 / 海报 / 视频、7×24 客服</li>
              <li><i class="fas fa-check"></i>企业入驻后，用户写给你的点子直接进收件箱</li>
            </ul>
            <div class="dir-acts">
              ${has ? `<button class="btn btn-pri" id="a-enter"><i class="fas fa-arrow-right-to-bracket"></i>进入「${esc(co.length > 14 ? co.slice(0, 14) + '…' : co)}」</button>
                <button class="btn btn-ghost" id="a-idea"><i class="fas fa-lightbulb"></i>用我的想法</button>
                <button class="btn btn-ghost" id="a-inbox"><i class="fas fa-inbox"></i>企业收件箱</button>
                <button class="btn btn-ghost" id="a-svc"><i class="fas fa-layer-group"></i>服务中心</button>`
              : `<button class="btn btn-pri" id="a-create"><i class="fas fa-wand-magic-sparkles"></i>${S.step > 1 ? '继续创建企业智脑' : '创建企业智脑'}</button>
                <button class="btn btn-ghost" id="a-demo"><i class="fas fa-play"></i>体验演示企业</button>`}
            </div>
          </article>
          <article class="home-dir dir-b" id="dir-b">
            <div class="dir-tag">方向 B</div>
            <div class="dir-ic"><i class="fas fa-paper-plane"></i></div>
            <h2>给企业献策</h2>
            <p class="dir-sub">人人都能给大公司出主意：选企业（如米哈游）→ 写下你的想法 → AI 写成专业策划案并打分 → 送到企业手里。<b>不用创建企业也能用</b></p>
            <ul>
              <li><i class="fas fa-check"></i>企业已入驻：直推企业收件箱</li>
              <li><i class="fas fa-check"></i>未入驻但找到公开邮箱：经你确认后代发邮件</li>
              <li><i class="fas fa-check"></i>企业的处理状态实时回到「我的献策」</li>
            </ul>
            <div class="dir-acts">
              <button class="btn btn-warm" id="b-go"><i class="fas fa-lightbulb"></i>开始献策</button>
              <button class="btn btn-ghost" id="b-mine"><i class="fas fa-paper-plane"></i>我的献策</button>
              <button class="btn btn-ghost" id="b-square"><i class="fas fa-fire"></i>献策广场</button>
            </div>
          </article>
        </section>
        <section class="home-bridge" id="home-bridge">
          <div class="hb-l"><span class="hb-tag"><i class="fas fa-handshake"></i> 撮合中心</span><h3>A 出题 · B 解题 · 同行复用</h3><p>企业发布悬赏征集令，用户用 AI 写方案应征；被采纳拿智点，落地验收再加奖；企业把验证过的方案脱敏共享给同行，被使用就有分成</p></div>
          <div class="hb-flow"><div><i class="fas fa-bullhorn"></i><b id="hb-ch">—</b><small>悬赏征集中</small></div><span><i class="fas fa-arrow-right"></i></span><div><i class="fas fa-coins"></i><b id="hb-pool">—</b><small>智点悬赏池</small></div><span><i class="fas fa-arrow-right"></i></span><div><i class="fas fa-book-open"></i><b id="hb-so">—</b><small>同行方案</small></div></div>
          <div class="hb-acts"><button class="btn btn-pri" id="hb-go"><i class="fas fa-trophy"></i>去应征赚智点</button><button class="btn btn-ghost" id="hb-so-btn"><i class="fas fa-book-open"></i>同行方案库</button><button class="btn btn-ghost" id="hb-rank"><i class="fas fa-ranking-star"></i>排行榜</button></div>
        </section>
        <section class="home-stats" id="home-stats"></section>
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
    on('hb-go', () => openMarket('challenges')); on('hb-so-btn', () => openMarket('solutions')); on('hb-rank', () => openMarket('rank'));
    Promise.all([fetch('/api/mkt/challenges').then((r) => r.json()), fetch('/api/mkt/solutions').then((r) => r.json())]).then(([a, b2]) => {
      const set = (id, v) => { const e = $('#' + id); if (e) e.textContent = v; };
      set('hb-ch', a.challenges?.length ?? 0); set('hb-pool', (a.challenges || []).reduce((n, c) => n + (c.escrow || 0), 0).toLocaleString()); set('hb-so', b2.solutions?.length ?? 0);
    }).catch(() => { });
    on('b-go', () => openIdeas('other'));
    on('b-mine', () => openIdeas(null, 'mine'));
    on('b-square', () => openIdeas(null, 'square'));
    const paint = () => {
      const el = $('#home-stats'); if (!el || !stats) return;
      el.innerHTML = [['fa-lightbulb', stats.ideas, '份献策已提交'], ['fa-building', stats.companies, '家企业已入驻'], ['fa-thumbs-up', stats.adopted, '份献策被采纳'], ['fa-robot', has ? (S.agents?.length || 0) : '—', '个 Agent 在为你工作']]
        .map(([i, v, l]) => `<div><i class="fas ${i}"></i><b>${v ?? 0}</b><span>${l}</span></div>`).join('');
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
