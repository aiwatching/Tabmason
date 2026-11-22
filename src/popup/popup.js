import { getLocal, getSession, getSettings, saveSettings } from '../lib/store.js';

const $ = (id) => document.getElementById(id);
const status = $('status');
const win = await chrome.windows.getCurrent();
const tabs = await chrome.tabs.query({ windowId: win.id });
$('count').textContent = `${tabs.length} tabs`;

async function send(action, extra = {}) {
  return chrome.runtime.sendMessage({ action, windowId: win.id, ...extra });
}

// ---------- toggle ----------
const settings = await getSettings();
$('enabled').checked = settings.enabled;
$('enabled').addEventListener('change', async () => {
  const s = await getSettings();
  s.enabled = $('enabled').checked;
  await saveSettings(s);
});
$('noGroups').hidden = (await getLocal('groups', [])).length > 0;
for (const id of ['openOptions', 'openOptions2']) {
  $(id).addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });
}

// ---------- actions ----------
const labels = {
  groupByDomain: (n) => `${n} group(s) made`,
  closeDuplicates: (n) => `${n} duplicate(s) closed`,
  organizeWindow: (r) => `移动 ${r.moved} 个，待确认 ${r.suggested} 个，未处理 ${r.skipped} 个${r.error ? `（AI 出错：${r.error}）` : ''}`,
};
for (const btn of document.querySelectorAll('button[data-action]')) {
  btn.addEventListener('click', async () => {
    const action = btn.dataset.action;
    btn.disabled = true;
    status.textContent = '处理中…';
    const res = await send(action);
    btn.disabled = false;
    status.textContent = res?.ok ? labels[action](res.n) : `Error: ${res?.error}`;
    render();
  });
}

// ---------- suggestions & moves ----------
function item(title, group, buttons) {
  const li = document.createElement('li');
  li.append(
    Object.assign(document.createElement('span'), { className: 't', textContent: title || '(无标题)', title }),
    Object.assign(document.createElement('span'), { className: 'g', textContent: group }),
  );
  for (const [text, fn] of buttons) {
    const b = Object.assign(document.createElement('button'), { textContent: text });
    b.addEventListener('click', async () => { await fn(); render(); });
    li.append(b);
  }
  return li;
}

async function render() {
  const open = new Set((await chrome.tabs.query({})).map((t) => t.id));
  const suggestions = (await getSession('suggestions', [])).filter((s) => open.has(s.tabId));
  const moves = (await getSession('moves', [])).filter((m) => open.has(m.tabId)).slice(0, 8);

  $('suggestBox').hidden = !suggestions.length;
  $('suggestions').replaceChildren(...suggestions.map((s) => item(s.title, `${s.group} ${Math.round(s.confidence * 100)}%`, [
    ['放入', () => send('acceptSuggestion', { tabId: s.tabId, group: s.group })],
    ['忽略', () => send('dismissSuggestion', { tabId: s.tabId })],
  ])));

  const src = { learned: '学习', rule: '规则', cache: '缓存', ai: 'AI' };
  $('movesBox').hidden = !moves.length;
  $('moves').replaceChildren(...moves.map((m) => item(m.title, `${m.group}·${src[m.source] || m.source}`, [
    ['撤销', () => send('undoMove', { tabId: m.tabId, ts: m.ts })],
  ])));
}
render();
