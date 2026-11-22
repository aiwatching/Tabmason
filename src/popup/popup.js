import { getLocal, getSession, getSettings, saveSettings } from '../lib/store.js';
import { applyI18n, makeT, resolveLang } from '../lib/i18n.js';

const $ = (id) => document.getElementById(id);
const settings = await getSettings();
const lang = resolveLang(settings.lang);
const t = makeT(lang);
applyI18n(t, lang);

const status = $('status');
const win = await chrome.windows.getCurrent();
const tabs = await chrome.tabs.query({ windowId: win.id });
$('count').textContent = t('tabs', { n: tabs.length });

const send = (action, extra = {}) => chrome.runtime.sendMessage({ action, windowId: win.id, ...extra });

// ---------- toggle & setup ----------
$('enabled').checked = settings.enabled;
$('enabled').addEventListener('change', async () => {
  await saveSettings({ ...(await getSettings()), enabled: $('enabled').checked });
});
const profiles = await getLocal('groups', []);
$('noGroups').hidden = profiles.length > 0;
for (const a of document.querySelectorAll('.openOptions')) {
  a.addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });
}

// ---------- actions ----------
const labels = {
  groupByDomain: (n) => t('resultGroups', { n }),
  closeDuplicates: (n) => t('resultDupes', { n }),
  organizeWindow: (r) => t('resultOrganize', r) + (r.error ? ` — ${t('resultAIError', { e: r.error })}` : ''),
};
for (const btn of document.querySelectorAll('button[data-action]')) {
  btn.addEventListener('click', async () => {
    const action = btn.dataset.action;
    btn.disabled = true;
    status.className = 'status';
    status.textContent = t('working');
    const res = await send(action);
    btn.disabled = false;
    const bad = !res?.ok || res.n?.error;
    status.className = `status ${bad ? 'error' : 'ok'}`;
    status.textContent = res?.ok ? labels[action](res.n) : res?.error;
    render();
  });
}

// ---------- suggestions & moves ----------
const colorOf = (group) => profiles.find((p) => p.name === group)?.color || 'grey';

function item(title, group, meta, buttons) {
  const li = document.createElement('li');
  li.append(
    Object.assign(document.createElement('span'), { className: 't', textContent: title || t('untitled'), title: title || '' }),
    Object.assign(document.createElement('span'), { className: `pill c-${colorOf(group)}`, textContent: group, title: group }),
  );
  if (meta) li.append(Object.assign(document.createElement('span'), { className: 'meta', textContent: meta }));
  for (const [text, fn, primary] of buttons) {
    const b = Object.assign(document.createElement('button'), { className: `btn btn-sm ${primary ? 'btn-primary' : 'btn-ghost'}`, textContent: text });
    b.addEventListener('click', async () => { b.disabled = true; await fn(); render(); });
    li.append(b);
  }
  return li;
}

async function render() {
  const open = new Set((await chrome.tabs.query({})).map((x) => x.id));
  const suggestions = (await getSession('suggestions', [])).filter((s) => open.has(s.tabId));
  const moves = (await getSession('moves', [])).filter((m) => open.has(m.tabId)).slice(0, 6);

  $('suggestBox').hidden = !suggestions.length;
  $('suggestions').replaceChildren(...suggestions.map((s) => item(s.title, s.group, `${Math.round(s.confidence * 100)}%`, [
    [t('accept'), () => send('acceptSuggestion', { tabId: s.tabId, group: s.group }), true],
    [t('dismiss'), () => send('dismissSuggestion', { tabId: s.tabId })],
  ])));

  $('movesBox').hidden = !moves.length;
  $('moves').replaceChildren(...moves.map((m) => item(m.title, m.group, t(`src_${m.source}`), [
    [t('undo'), () => send('undoMove', { tabId: m.tabId, ts: m.ts })],
  ])));
}
render();
