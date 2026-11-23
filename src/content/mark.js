// Tabmason content script: shows a tab's mark in the tab strip.
//  - favicon: the site's icon inside a colored ring (composed by the service worker)
//  - title:   a colored emoji in front of the title (optional, settings.markTitlePrefix)
//             and the note after it, so Chrome's hover card shows it (optional, settings.markNoteInTitle)
// Classic script (content scripts can't be ES modules).
//
// Staying out of fights over document.title:
//  - After the extension is reloaded, the old copy keeps running in its own isolated world with stale
//    state. Each copy stops as soon as its extension context is gone, and a newly started copy tells
//    older ones on the page to stop (DOM events cross isolated worlds; window globals don't).
//  - If the page keeps resetting its own title, we back off instead of rewriting it forever.

(() => {
  const INSTANCE = `${Date.now()}-${Math.random()}`;
  const TAKEOVER = 'tabmason:takeover';

  const PREFIX = { grey: '⚪', blue: '🔵', red: '🔴', yellow: '🟡', green: '🟢', pink: '🩷', purple: '🟣', cyan: '🩵', orange: '🟠' };
  const PREFIX_RE = new RegExp(`^(?:${Object.values(PREFIX).join('|')}) `, 'u');
  const NOTE_SEP = ' · 📝 ';
  const NOTE_RE = / · 📝 .*$/su;
  const NOTE_MAX = 80;
  const OURS = 'data-tabmason';
  const DISABLED = 'data-tabmason-rel'; // original rel of icon links we switched off
  const MAX_WRITES = 6; // title rewrites allowed per WINDOW_MS before backing off
  const WINDOW_MS = 10000;
  const BACKOFF_MS = 60000;

  let mark = null;
  let titlePrefix = true;
  let noteInTitle = false;
  let busy = false;
  let timer = null;
  let lastIconKey = '';
  let alive = true;
  let writes = [];
  let pausedUntil = 0;

  const key = () => location.href.split('#')[0];
  const contextOk = () => {
    try { return Boolean(chrome.runtime?.id); } catch { return false; }
  };

  async function load() {
    if (!contextOk()) return stop();
    try {
      const { marks = {}, settings = {} } = await chrome.storage.local.get(['marks', 'settings']);
      mark = marks[key()] || null;
      titlePrefix = settings.markTitlePrefix !== false;
      noteInTitle = settings.markNoteInTitle === true;
      pausedUntil = 0; // the user changed something: try again
      writes = [];
      await apply();
    } catch {
      if (!contextOk()) stop();
    }
  }

  // ---------- title ----------
  function applyTitle() {
    if (Date.now() < pausedUntil) return;
    const bare = document.title.replace(PREFIX_RE, '').replace(NOTE_RE, '');
    const note = noteInTitle && mark?.note ? mark.note.replace(/\s+/g, ' ').trim() : '';
    const suffix = note ? NOTE_SEP + (note.length > NOTE_MAX ? `${note.slice(0, NOTE_MAX - 1)}…` : note) : '';
    const want = (mark?.color && titlePrefix ? `${PREFIX[mark.color]} ` : '') + bare + suffix;
    if (document.title === want) return;
    const now = Date.now();
    writes = writes.filter((t) => now - t < WINDOW_MS);
    if (writes.length >= MAX_WRITES) {
      // Something keeps undoing us (the page, or another script). Leave the title alone for a while.
      pausedUntil = now + BACKOFF_MS;
      writes = [];
      return;
    }
    writes.push(now);
    document.title = want;
  }

  // ---------- favicon ----------
  function pageIconLinks() {
    return [...document.querySelectorAll(`link[rel~="icon" i]:not([${OURS}]), link[${DISABLED}]`)];
  }

  function originalIconHref() {
    const links = pageIconLinks();
    return links.length ? links[links.length - 1].href : `${location.origin}/favicon.ico`;
  }

  function restoreIcons() {
    document.querySelector(`link[${OURS}]`)?.remove();
    for (const l of document.querySelectorAll(`link[${DISABLED}]`)) {
      l.rel = l.getAttribute(DISABLED);
      l.removeAttribute(DISABLED);
    }
    lastIconKey = '';
  }

  async function applyIcon() {
    const ours = document.querySelector(`link[${OURS}]`);
    if (!mark?.color) {
      if (ours || document.querySelector(`link[${DISABLED}]`)) restoreIcons();
      return;
    }
    const href = originalIconHref();
    // Switch off the page's own icon links so Chrome uses ours.
    for (const l of document.querySelectorAll(`link[rel~="icon" i]:not([${OURS}])`)) {
      l.setAttribute(DISABLED, l.rel);
      l.rel = 'tabmason-disabled-icon';
    }
    const iconKey = `${href}|${mark.color}`;
    if (ours && iconKey === lastIconKey) return;
    const res = await chrome.runtime.sendMessage({ action: 'composeFavicon', iconUrl: href, pageUrl: location.href, color: mark.color });
    if (!alive || !res?.ok || !mark?.color) return;
    lastIconKey = iconKey;
    const link = ours || Object.assign(document.createElement('link'), { rel: 'icon' });
    link.setAttribute(OURS, '');
    link.type = 'image/png';
    link.href = res.n;
    if (!link.isConnected) (document.head || document.documentElement).append(link);
  }

  async function apply() {
    if (!alive) return;
    if (!contextOk()) return stop();
    busy = true;
    try {
      applyTitle();
      await applyIcon();
    } catch {
      if (!contextOk()) stop();
    } finally {
      // Let our own DOM changes flush through the observer before listening again.
      setTimeout(() => { busy = false; }, 0);
    }
  }

  // Pages change their title and favicon (unread counts, pipeline status); re-apply after them.
  const observer = new MutationObserver(() => {
    if (busy || !alive) return;
    if (!contextOk()) return stop();
    clearTimeout(timer);
    timer = setTimeout(apply, 200);
  });

  const onStorage = (changes, area) => {
    if (area === 'local' && (changes.marks || changes.settings)) load();
  };
  const onMessage = (msg) => { if (msg?.action === 'tabmasonRecheck') load(); };
  const onTakeover = (e) => { if (e.detail !== INSTANCE) stop(); };

  function stop() {
    if (!alive) return;
    alive = false;
    observer.disconnect();
    clearTimeout(timer);
    document.removeEventListener(TAKEOVER, onTakeover);
    try {
      chrome.storage.onChanged.removeListener(onStorage);
      chrome.runtime.onMessage.removeListener(onMessage);
    } catch { /* context already gone */ }
  }

  // Tell older copies on this page to stand down, then start listening ourselves.
  document.dispatchEvent(new CustomEvent(TAKEOVER, { detail: INSTANCE }));
  document.addEventListener(TAKEOVER, onTakeover);

  observer.observe(document.head || document.documentElement, {
    subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['href', 'rel'],
  });
  chrome.storage.onChanged.addListener(onStorage);
  chrome.runtime.onMessage.addListener(onMessage);

  load();
})();
