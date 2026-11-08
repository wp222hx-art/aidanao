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
              <li><i class="fas fa-check"></i>企业入驻后，用户写给你的点子直接进收件箱</li>
            </ul>
            <div class="dir-acts">
              ${has ? `<button class="btn btn-pri" id="a-enter"><i class="fas fa-arrow-right-to-bracket"></i>进入「${esc(co.length > 14 ? co.slice(0, 14) + '…' : co)}」</button>
                <button class="btn btn-ghost" id="a-idea"><i class="fas fa-lightbulb"></i>用我的想法</button>
                <button class="btn btn-ghost" id="a-inbox"><i class="fas fa-inbox"></i>企业收件箱</button>`
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
        <section class="home-stats" id="home-stats"></section>
      </main>
    </div>`;
    const on = (id, fn) => { const el = $('#' + id); if (el) el.onclick = fn; };
    on('a-enter', () => enterBrain());
    on('a-create', () => enterBrain());
    on('a-demo', () => { enterBrain(); if (window.loadDemo) loadDemo(); });
    on('a-idea', () => openIdeas('self'));
    on('a-inbox', () => openIdeas(null, 'inbox'));
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
  };
})();
