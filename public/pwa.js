let installPrompt;
const button = document.getElementById('installApp');
const dialog = document.getElementById('installHelp');
const standalone = matchMedia('(display-mode: standalone)');
function updateButton() { button.hidden = standalone.matches || navigator.standalone === true; }
updateButton();
standalone.addEventListener('change', updateButton);
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event; updateButton();
});
window.addEventListener('appinstalled', () => { installPrompt = null; button.hidden = true; dialog.close(); });
button.addEventListener('click', async () => {
  if (!installPrompt) { dialog.showModal(); return; }
  const prompt = installPrompt; installPrompt = null;
  try { await prompt.prompt(); await prompt.userChoice; }
  catch { dialog.showModal(); }
});
document.getElementById('closeInstallHelp').addEventListener('click', () => dialog.close());
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Installation metadata still works when offline fallback cannot be registered.
    });
  });
}
