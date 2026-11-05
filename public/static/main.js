// 企业智脑 · 入口路由
window.renderApp = function () {
  if (window.stopSim) stopSim();
  closeOverlay();
  if (S.launched && S.depts.length) renderHQ(); else renderWizard();
};
document.addEventListener('DOMContentLoaded', async () => {
  renderApp();
  if (window.AI) { await AI.init(); if (S.launched && S.depts.length && $('#hq-main')) gotoView('twin'); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });
