// Snapshots: every open window's tabs and groups, saved every few minutes (and on demand), restorable later.
//
// snapshots (chrome.storage.local): [{ id, kind: "auto" | "manual", name, ts, tabCount, windows: [{ tabs, groups }] }]
// Auto snapshots: one every INTERVAL_MIN minutes, skipped when nothing changed; the newest MAX_AUTO are kept.
// Manual snapshots are kept until deleted.

import { getLocal, setLocal, setSession } from '../lib/store.js';

const ALARM = 'tabmason-snapshot';
const INTERVAL_MIN = 10;
const MAX_AUTO = 24; // ~4 hours
const MAX_MANUAL = 50;

const savable = (url) => /^(https?|file|chrome|edge|about):/i.test(url || '') && !/^chrome:\/\/newtab/i.test(url) && url !== 'about:blank';

/** The current state of all normal windows. */
export async function capture() {
  const [wins, groups] = await Promise.all([
    chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }),
    chrome.tabGroups.query({}),
  ]);
  const ownPages = chrome.runtime.getURL('');
  const byId = new Map(groups.map((g) => [g.id, g]));
  const windows = [];
  for (const w of wins) {
    const tabs = [];
    const usedGroups = {};
    for (const t of w.tabs.sort((a, b) => a.index - b.index)) {
      const url = t.pendingUrl || t.url;
      if (!savable(url) || url.startsWith(ownPages)) continue;
      let group = null;
      if (t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE && byId.has(t.groupId)) {
        const g = byId.get(t.groupId);
        group = String(g.id);
        usedGroups[group] = { title: g.title || '', color: g.color, collapsed: g.collapsed };
      }
      tabs.push({ url, title: t.title || url, pinned: t.pinned, active: t.active, group });
    }
    if (tabs.length) windows.push({ focused: w.focused, tabs, groups: usedGroups });
  }
  return { windows, tabCount: windows.reduce((n, w) => n + w.tabs.length, 0) };
}

const getAll = () => getLocal('snapshots', []);

function trim(list) {
  const newest = (kind, max) => list.filter((s) => s.kind === kind).sort((a, b) => b.ts - a.ts).slice(0, max);
  return [...newest('manual', MAX_MANUAL), ...newest('auto', MAX_AUTO)];
}

// What a restore would reproduce; titles and the active tab don't count as a change.
const fingerprint = (snap) => JSON.stringify(snap.windows.map((w) =>
  w.tabs.map((t) => [t.url, t.pinned, t.group && w.groups[t.group] ? [w.groups[t.group].title, w.groups[t.group].color] : null])));

export async function saveSnapshot(name = '', kind = 'manual') {
  const state = await capture();
  const list = await getAll();
  if (kind === 'auto') {
    if (!state.tabCount) return null; // nothing open (macOS keeps Chrome running without windows)
    const last = list.filter((s) => s.kind === 'auto').sort((a, b) => b.ts - a.ts)[0];
    if (last && fingerprint(last) === fingerprint(state)) return null; // unchanged since last time
  }
  const snap = { id: `${kind[0]}-${Date.now()}`, kind, name: String(name).trim(), ts: Date.now(), ...state };
  await setLocal('snapshots', trim([snap, ...list]));
  return { id: snap.id, tabCount: snap.tabCount };
}

/** Snapshots for the UI, newest first, without the bulky tab lists. */
export async function listSnapshots() {
  return (await getAll())
    .sort((a, b) => b.ts - a.ts)
    .map(({ id, kind, name, ts, tabCount, windows }) => ({ id, kind, name, ts, tabCount, windowCount: windows.length }));
}

export async function deleteSnapshot(id) {
  await setLocal('snapshots', (await getAll()).filter((s) => s.id !== id));
  return true;
}

export async function renameSnapshot(id, name) {
  const list = await getAll();
  const s = list.find((x) => x.id === id);
  if (s) { s.name = String(name).trim(); s.kind = 'manual'; } // a named auto snapshot is kept like a manual one
  await setLocal('snapshots', trim(list));
  return true;
}

// ---------- restore ----------

async function discardWhenCommitted(tabId) {
  // A tab discarded before its navigation commits loses its URL, so wait for the URL first.
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    const t = await chrome.tabs.get(tabId).catch(() => null);
    if (!t || t.active) return;
    if (t.url && t.url !== 'about:blank' && !t.pendingUrl) {
      await chrome.tabs.discard(tabId).catch(() => {});
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

export async function restoreSnapshot(id) {
  const snap = (await getAll()).find((s) => s.id === id);
  if (!snap) throw new Error('Snapshot not found');
  // Restored tabs must not be auto-sorted, and their grouping must not be learned as manual drags.
  await setSession('pauseAutoUntil', Date.now() + 120000);
  let opened = 0;
  try {
    for (const w of snap.windows) {
      const tabs = w.tabs.filter((t) => savable(t.url));
      if (!tabs.length) continue;
      const activeIdx = Math.max(0, tabs.findIndex((t) => t.active));
      const win = await chrome.windows.create({ url: tabs[0].url, focused: true });
      const ids = [win.tabs[0].id];
      for (const t of tabs.slice(1)) {
        const created = await chrome.tabs.create({ windowId: win.id, url: t.url, active: false }).catch(() => null);
        ids.push(created?.id ?? null);
      }
      for (const [i, t] of tabs.entries()) {
        if (ids[i] != null && t.pinned) await chrome.tabs.update(ids[i], { pinned: true }).catch(() => {});
      }
      for (const [key, g] of Object.entries(w.groups || {})) {
        const members = tabs.map((t, i) => (t.group === key && !t.pinned ? ids[i] : null)).filter((x) => x != null);
        if (!members.length) continue;
        const gid = await chrome.tabs.group({ tabIds: members, createProperties: { windowId: win.id } });
        await chrome.tabGroups.update(gid, { title: g.title, color: g.color, collapsed: Boolean(g.collapsed) });
      }
      if (ids[activeIdx] != null) await chrome.tabs.update(ids[activeIdx], { active: true }).catch(() => {});
      // Don't load every page at once; the rest load when you click them.
      const later = ids.filter((tid, i) => tid != null && i !== activeIdx);
      Promise.all(later.map(discardWhenCommitted)).catch(() => {});
      opened += ids.filter((x) => x != null).length;
    }
  } finally {
    await setSession('pauseAutoUntil', Date.now() + 5000);
  }
  return opened;
}

// ---------- periodic saving ----------

export function initSnapshots() {
  chrome.alarms.get(ALARM).then((a) => {
    if (!a) chrome.alarms.create(ALARM, { delayInMinutes: 1, periodInMinutes: INTERVAL_MIN });
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) saveSnapshot('', 'auto').catch(() => {});
  });
}
