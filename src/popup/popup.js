import { COLORS, getLocal, getSession, getSettings, saveSettings } from '../lib/store.js';
import { cleanTitle, getMarks, isPageUrl, markKey, setMark } from '../lib/marks.js';
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

$('openOverview').addEventListener('click', async () => { await send('openOverview'); window.close(); });

// ---------- mark this tab ----------
const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
// Any tab with a URL can carry a mark and note. Whether the tab strip can show it depends on the page.
const markable = Boolean(activeTab?.url) && !activeTab.url.startsWith(chrome.runtime.getURL(''));
const isFile = /^file:/i.test(activeTab?.url || '');
const fileAccess = isFile ? await chrome.extension.isAllowedFileSchemeAccess() : true;
const ringable = isPageUrl(activeTab?.url) && fileAccess;
$('markBox').hidden = !markable;
$('notMarkable').hidden = markable;
let mark = markable ? (await getMarks())[markKey(activeTab.url)] || { color: null, note: '' } : null;

function paintColors() {
  for (const b of $('markColors').children) b.setAttribute('aria-checked', String((b.dataset.color || null) === (mark.color || null)));
}
async function saveMark() {
  await setMark(activeTab.url, { color: mark.color, note: mark.note, title: cleanTitle(activeTab.title) });
  render();
}
if (markable && !ringable) {
  $('markHint').hidden = false;
  $('markHintText').textContent = t(isFile ? 'fileAccessOff' : 'markListOnly');
  if (isFile) {
    $('fileAccessLink').hidden = false;
    $('fileAccessLink').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
    });
  }
}
if (markable) {
  $('aiSummary').hidden = !isPageUrl(activeTab.url);
  $('markTitle').textContent = cleanTitle(activeTab.title) || activeTab.url;
  $('markTitle').title = activeTab.url;
  const none = Object.assign(document.createElement('button'), { className: 'none', title: t('noMark') });
  none.setAttribute('role', 'radio');
  $('markColors').append(none);
  for (const c of COLORS) {
    const b = Object.assign(document.createElement('button'), { className: `c-${c}`, title: c });
    b.dataset.color = c;
    b.setAttribute('role', 'radio');
    $('markColors').append(b);
  }
  $('markColors').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    mark.color = b.dataset.color || null;
    paintColors();
    saveMark();
  });
  paintColors();
  $('markNote').value = mark.note || '';
  let noteTimer;
  $('markNote').addEventListener('input', () => {
    mark.note = $('markNote').value;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(saveMark, 400);
  });
  $('aiSummary').addEventListener('click', async () => {
    $('aiSummary').disabled = true;
    $('markStatus').className = 'status';
    $('markStatus').textContent = t('summarizing');
    const res = await send('summarizeTab', { tabId: activeTab.id });
    $('aiSummary').disabled = false;
    if (!res?.ok) {
      $('markStatus').className = 'status error';
      $('markStatus').textContent = res?.error;
      $('markStatus').title = res?.error || '';
      return;
    }
    $('markStatus').textContent = '';
    mark.note = res.n;
    $('markNote').value = res.n;
    saveMark();
  });
}

// ---------- snapshots ----------
const fmtTime = (ts) => new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(ts);
let showAllSnaps = false;

function snapStatus(text, kind = '') {
  $('snapStatus').className = `status ${kind}`;
  $('snapStatus').textContent = text;
}

async function restore(id, btn) {
  if (btn) btn.disabled = true;
  snapStatus(t('restoring'));
  const res = await send('restoreSnapshot', { id });
  if (res?.ok) snapStatus(t('restored', { n: res.n }), 'ok');
  else { snapStatus(res?.error, 'error'); if (btn) btn.disabled = false; }
}

async function renderSnapshots() {
  const res = await send('listSnapshots');
  const snaps = res?.ok ? res.n : [];
  $('snapEmpty').hidden = snaps.length > 0;
  const shown = showAllSnaps ? snaps : snaps.slice(0, 4);
  $('snapMore').hidden = shown.length === snaps.length;
  $('snapMore').textContent = t('moreSnapshots', { n: snaps.length - shown.length });
  $('snapList').replaceChildren(...shown.map((s) => {
    const li = document.createElement('li');
    li.className = 'snap';
    const col = Object.assign(document.createElement('div'), { className: 'snap-col' });
    const label = s.name || t(s.kind === 'auto' ? 'snapAuto' : 'snapManual');
    const name = Object.assign(document.createElement('span'), { className: 't', textContent: label, title: t('snapRename') });
    name.addEventListener('click', () => {
      name.contentEditable = 'true';
      name.focus();
      document.getSelection().selectAllChildren(name);
    });
    const commit = async () => {
      if (name.contentEditable !== 'true') return;
      name.contentEditable = 'false';
      const v = name.textContent.trim();
      if (v && v !== label) await send('renameSnapshot', { id: s.id, name: v });
      renderSnapshots();
    };
    name.addEventListener('blur', commit);
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); name.blur(); } if (e.key === 'Escape') { name.textContent = label; name.blur(); } });
    const meta = Object.assign(document.createElement('span'), {
      className: 'meta',
      textContent: t('snapMeta', { time: fmtTime(s.ts), n: s.tabCount }) + (s.windowCount > 1 ? t('snapWindows', { n: s.windowCount }) : ''),
    });
    col.append(name, meta);
    const restoreBtn = Object.assign(document.createElement('button'), { className: 'btn btn-sm btn-primary', textContent: t('restore') });
    restoreBtn.addEventListener('click', () => restore(s.id, restoreBtn));
    const del = Object.assign(document.createElement('button'), { className: 'btn btn-sm btn-ghost btn-danger', textContent: '×', title: t('deleteSnap') });
    del.addEventListener('click', async () => { await send('deleteSnapshot', { id: s.id }); renderSnapshots(); });
    li.append(col, restoreBtn, del);
    return li;
  }));
}

$('snapMore').addEventListener('click', () => { showAllSnaps = true; renderSnapshots(); });
$('saveSnapshot').addEventListener('click', async () => {
  $('saveSnapshot').disabled = true;
  const res = await send('saveSnapshot');
  $('saveSnapshot').disabled = false;
  if (res?.ok) snapStatus(t('savedSnapshot', { n: res.n.tabCount }), 'ok');
  else snapStatus(res?.error, 'error');
  renderSnapshots();
});

renderSnapshots();

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
    Object.assign(document.createElement('span'), { className: 't', textContent: cleanTitle(title) || t('untitled'), title: cleanTitle(title) }),
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

  const marks = await getMarks();
  const allTabs = await chrome.tabs.query({});
  const markedTabs = allTabs.filter((x) => marks[markKey(x.url)]);
  $('markedBox').hidden = !markedTabs.length;
  $('markedList').replaceChildren(...markedTabs.map((x) => {
    const m = marks[markKey(x.url)];
    const li = document.createElement('li');
    li.className = 'clickable';
    li.title = m.note || x.title;
    li.append(
      Object.assign(document.createElement('span'), { className: `dot c-${m.color || 'grey'}`, style: m.color ? '' : 'visibility:hidden' }),
      Object.assign(document.createElement('span'), { className: 't', textContent: m.note ? `${cleanTitle(x.title)} — ` : cleanTitle(x.title) }),
    );
    if (m.note) li.querySelector('.t').append(Object.assign(document.createElement('span'), { className: 'note', textContent: m.note }));
    li.addEventListener('click', async () => {
      await chrome.tabs.update(x.id, { active: true });
      await chrome.windows.update(x.windowId, { focused: true });
      window.close();
    });
    return li;
  }));

  $('movesBox').hidden = !moves.length;
  $('moves').replaceChildren(...moves.map((m) => item(m.title, m.group, t(`src_${m.source}`), [
    [t('undo'), () => send('undoMove', { tabId: m.tabId, ts: m.ts })],
  ])));
}
render();
