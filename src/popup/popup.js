const status = document.getElementById('status');
const win = await chrome.windows.getCurrent();
const tabs = await chrome.tabs.query({ windowId: win.id });
document.getElementById('count').textContent = `${tabs.length} tabs`;

const labels = { groupByDomain: (n) => `${n} group(s) made`, closeDuplicates: (n) => `${n} duplicate(s) closed` };
for (const btn of document.querySelectorAll('button[data-action]')) {
  btn.addEventListener('click', async () => {
    const action = btn.dataset.action;
    const res = await chrome.runtime.sendMessage({ action, windowId: win.id });
    status.textContent = res?.ok ? labels[action](res.n) : `Error: ${res?.error}`;
  });
}
