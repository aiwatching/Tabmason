import { getSettings, getLocal, setLocal } from '../lib/store.js';
import { applyI18n, makeT, resolveLang } from '../lib/i18n.js';
import { cleanTitle, getMarks, isPageUrl, markKey } from '../lib/marks.js';
import { getThumbs, thumbKey } from '../lib/thumbs.js';

const $ = (id) => document.getElementById(id);
const settings = await getSettings();
const lang = resolveLang(settings.lang);
const t = makeT(lang);
applyI18n(t, lang);
document.title = t('overviewTitle');

const self = await chrome.tabs.getCurrent();
let scope = await getLocal('overviewScope', 'window'); // 'window' | 'all'
let query = '';
const objectUrls = new Map(); // thumb url -> { ts, href }

const favicon = (url) => chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`);
const hostOf = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'file:' ? decodeURIComponent(u.pathname) : u.host || url;
  } catch { return url; }
};

// ---------- scope / search ----------

function paintScope() {
  $('scopeWindow').setAttribute('aria-selected', String(scope === 'window'));
  $('scopeAll').setAttribute('aria-selected', String(scope === 'all'));
}
for (const [id, value] of [['scopeWindow', 'window'], ['scopeAll', 'all']]) {
  $(id).addEventListener('click', () => { scope = value; setLocal('overviewScope', value); paintScope(); render(); });
}
paintScope();

$('search').addEventListener('input', () => { query = $('search').value.trim().toLowerCase(); render(); });
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== $('search')) { e.preventDefault(); $('search').focus(); }
  if (e.key === 'Escape' && document.activeElement === $('search')) { $('search').value = ''; query = ''; render(); }
});

// ---------- data ----------

async function loadWindows() {
  const wins = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
  const list = scope === 'all' ? wins : wins.filter((w) => w.id === self?.windowId);
  return list.length ? list : wins.filter((w) => w.focused).slice(0, 1);
}

/** Sections in tab-strip order: pinned, then each group as it first appears, then ungrouped tabs. */
function sections(win, groupsById) {
  const tabs = win.tabs.filter((x) => x.id !== self?.id).sort((a, b) => a.index - b.index);
  const out = [];
  const pinned = tabs.filter((x) => x.pinned);
  if (pinned.length) out.push({ kind: 'pinned', tabs: pinned });
  const byGroup = new Map();
  const ungrouped = [];
  for (const x of tabs) {
    if (x.pinned) continue;
    if (x.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) { ungrouped.push(x); continue; }
    if (!byGroup.has(x.groupId)) {
      const sec = { kind: 'group', group: groupsById.get(x.groupId), tabs: [] };
      byGroup.set(x.groupId, sec);
      out.push(sec);
    }
    byGroup.get(x.groupId).tabs.push(x);
  }
  if (ungrouped.length) out.push({ kind: 'ungrouped', tabs: ungrouped });
  return out;
}

async function thumbUrlFor(rec) {
  if (!rec) return null;
  const cached = objectUrls.get(rec.url);
  if (cached?.ts === rec.ts) return cached.href;
  if (cached) URL.revokeObjectURL(cached.href);
  const href = URL.createObjectURL(rec.blob);
  objectUrls.set(rec.url, { ts: rec.ts, href });
  return href;
}

// ---------- rendering ----------

function card(tab, mark, shot) {
  const node = $('cardTpl').content.firstElementChild.cloneNode(true);
  node.dataset.id = tab.id;
  node.querySelector('.title').textContent = cleanTitle(tab.title) || tab.url;
  node.querySelector('.host').textContent = hostOf(tab.url);
  node.title = tab.url;
  const fav = favicon(tab.url);
  node.querySelector('.fav').src = fav;
  node.querySelector('.ph-icon').src = fav;
  node.querySelector('.ph-text').textContent = isPageUrl(tab.url) ? t('noThumb') : '';
  if (shot) {
    const img = node.querySelector('.shot');
    img.src = shot;
    img.hidden = false;
  }
  if (tab.active) {
    node.classList.add('active');
    const b = node.querySelector('.badge');
    b.textContent = t('current');
    b.hidden = false;
  }
  if (mark?.color) node.classList.add('marked', `c-${mark.color}`);
  if (mark?.note) {
    const n = node.querySelector('.note');
    n.hidden = false;
    if (mark.color) n.classList.add(`c-${mark.color}`);
    n.querySelector('.note-text').textContent = mark.note;
  }
  const close = node.querySelector('.close');
  close.title = t('closeTab');
  close.addEventListener('click', (e) => { e.stopPropagation(); chrome.tabs.remove(tab.id); });
  const go = async () => {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  };
  node.addEventListener('click', go);
  node.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  return node;
}

function sectionHead(sec) {
  const head = document.createElement('div');
  head.className = 'section-head';
  if (sec.kind === 'group') {
    const g = sec.group || {};
    head.append(Object.assign(document.createElement('span'), { className: `pill c-${g.color || 'grey'}`, textContent: g.title || '•' }));
    if (g.collapsed) head.append(Object.assign(document.createElement('span'), { className: 'count', textContent: t('collapsed') }));
  } else {
    head.append(Object.assign(document.createElement('span'), { className: 'label', textContent: t(sec.kind) }));
  }
  head.append(Object.assign(document.createElement('span'), { className: 'count', textContent: t('tabCount', { n: sec.tabs.length }) }));
  return head;
}

function matches(tab, mark) {
  if (!query) return true;
  return [cleanTitle(tab.title), tab.url, mark?.note].some((s) => String(s || '').toLowerCase().includes(query));
}

let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  const [wins, groups, marks] = await Promise.all([loadWindows(), chrome.tabGroups.query({}), getMarks()]);
  const groupsById = new Map(groups.map((g) => [g.id, g]));
  const allTabs = wins.flatMap((w) => w.tabs);
  const thumbs = await getThumbs(allTabs.map((x) => x.url));
  if (seq !== renderSeq) return; // a newer render started

  const frag = document.createDocumentFragment();
  let shown = 0;
  for (const [i, win] of wins.entries()) {
    const secs = sections(win, groupsById);
    const winFrag = document.createDocumentFragment();
    for (const sec of secs) {
      const visible = sec.tabs.filter((x) => matches(x, marks[markKey(x.url)]));
      if (!visible.length) continue;
      const el = document.createElement('section');
      el.className = `section${sec.kind === 'group' ? ` grouped c-${sec.group?.color || 'grey'}` : ''}`;
      const grid = document.createElement('div');
      grid.className = 'grid';
      for (const x of visible) {
        grid.append(card(x, marks[markKey(x.url)], await thumbUrlFor(thumbs.get(thumbKey(x.url)))));
      }
      el.append(sectionHead({ ...sec, tabs: visible }), grid);
      winFrag.append(el);
      shown += visible.length;
    }
    if (wins.length > 1 && winFrag.childNodes.length) {
      const head = document.createElement('h2');
      head.className = 'window-head';
      head.textContent = t('windowN', { n: i + 1 });
      frag.append(head);
    }
    frag.append(winFrag);
  }
  if (seq !== renderSeq) return;
  $('main').replaceChildren(frag);
  $('empty').hidden = shown > 0;
}

let timer = null;
function scheduleRender() { clearTimeout(timer); timer = setTimeout(render, 250); }

for (const ev of ['onCreated', 'onRemoved', 'onUpdated', 'onMoved', 'onActivated', 'onAttached', 'onDetached']) {
  chrome.tabs[ev].addListener(scheduleRender);
}
chrome.tabGroups.onUpdated.addListener(scheduleRender);
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.marks) scheduleRender(); });

// ---------- thumbnails ----------

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.event === 'thumb') scheduleRender();
  if (msg?.event === 'fillProgress') $('status').textContent = t('filling', { done: msg.done, total: msg.total });
});

$('fill').addEventListener('click', async () => {
  const wins = await loadWindows();
  const tabs = wins.flatMap((w) => w.tabs).filter((x) => isPageUrl(x.url) && x.id !== self?.id);
  const have = await getThumbs(tabs.map((x) => x.url));
  const missing = tabs.filter((x) => !have.has(thumbKey(x.url))).map((x) => x.id);
  if (!missing.length) { $('status').textContent = t('fillDone', { n: 0 }); return; }
  $('fill').disabled = true;
  const res = await chrome.runtime.sendMessage({ action: 'fillThumbs', tabIds: missing });
  $('fill').disabled = false;
  $('status').className = `status ${res?.ok ? 'ok' : 'error'}`;
  $('status').textContent = res?.ok ? t('fillDone', { n: res.n }) : res?.error;
  render();
});

render();
