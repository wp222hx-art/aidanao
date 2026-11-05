// 企业智脑 · 入口路由
window.renderApp = function () {
  if (window.stopSim) stopSim();
  closeOverlay();
  if (S.launched && S.depts.length) renderHQ(); else renderWizard();
};
document.addEventListener('DOMContentLoaded', renderApp);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });
