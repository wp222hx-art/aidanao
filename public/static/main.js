// 企业智脑 · 入口路由
window.renderApp = function () {
  if (window.stopSim) stopSim();
  closeOverlay();
  if (appRoute() === 'home') return renderHome();
  if (S.launched && S.depts.length) renderHQ(); else renderWizard();
};
document.addEventListener('DOMContentLoaded', async () => {
  renderApp();
  if (window.AI) { await AI.init(); if (S.launched && S.depts.length && $('#hq-main')) gotoView(window.currentView ? currentView() : 'flow'); }
});
// 献策网络深链：#ideas 打开献策工作台；#join 打开企业收件箱（邮件里的“入驻”链接）
function routeHash() {
  const h = location.hash.replace('#', '');
  if (!window.openIdeas) return;
  if (h === 'ideas') openIdeas('other');
  else if (h === 'join' || h === 'inbox') openIdeas(null, 'inbox');
  else if (h === 'square') openIdeas(null, 'square');
  else if (h === 'admin' && window.openAdmin) openAdmin();
}
document.addEventListener('DOMContentLoaded', () => setTimeout(routeHash, 50));
window.addEventListener('hashchange', routeHash);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });
