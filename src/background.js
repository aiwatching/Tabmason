// Tabmason service worker: tab actions shared by the popup, options page and keyboard commands.

import { initEngine, moveToGroup, organize } from './auto/engine.js';
import { planGroups } from './auto/classifier.js';
import { chatJSON } from './lib/llm.js';
import { getSettings, updateSession } from './lib/store.js';
import { composeFavicon, injectIntoOpenTabs, notifyUrlChange, summarizeTab } from './sw/marks.js';
import { fillMissing, initThumbnails } from './sw/thumbnails.js';
import { deleteSnapshot, initSnapshots, listSnapshots, renameSnapshot, restoreSnapshot, saveSnapshot } from './sw/snapshots.js';

// Listeners must be registered synchronously at top level so events that wake the worker are delivered.
initEngine();
initThumbnails();
initSnapshots();

chrome.runtime.onInstalled.addListener(() => { injectIntoOpenTabs().catch(() => {}); });
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => { if (changeInfo.url) notifyUrlChange(tabId); });

const OVERVIEW = chrome.runtime.getURL('src/overview/overview.html');

/** Open the overview page, or focus it if it is already open. */
async function openOverview() {
  const [existing] = await chrome.tabs.query({ url: `${OVERVIEW}*` });
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: OVERVIEW });
  }
  return true;
}

export async function groupByDomain(windowId) {
  const tabs = await chrome.tabs.query({ windowId, pinned: false });
  const byHost = new Map();
  for (const t of tabs) {
    let host;
    try { host = new URL(t.url).hostname.replace(/^www\./, ''); } catch { continue; }
    if (!host) continue;
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(t.id);
  }
  let groups = 0;
  for (const [host, ids] of byHost) {
    if (ids.length < 2) continue;
    const groupId = await chrome.tabs.group({ tabIds: ids, createProperties: { windowId } });
    await chrome.tabGroups.update(groupId, { title: host, collapsed: true });
    groups++;
  }
  return groups;
}

export async function closeDuplicates(windowId) {
  const tabs = await chrome.tabs.query({ windowId });
  const seen = new Set();
  const dupes = [];
  for (const t of tabs) {
    const key = (t.url || '').split('#')[0];
    if (seen.has(key)) dupes.push(t.id); else seen.add(key);
  }
  if (dupes.length) await chrome.tabs.remove(dupes);
  return dupes.length;
}

chrome.commands.onCommand.addListener(async (command) => {
  const win = await chrome.windows.getCurrent();
  if (command === 'group-by-domain') await groupByDomain(win.id);
  if (command === 'open-overview') await openOverview();
});

/** Ungrouped, unpinned web tabs of a window, classified and moved. */
async function organizeWindow(windowId) {
  const tabs = await chrome.tabs.query({ windowId, pinned: false, groupId: chrome.tabGroups.TAB_GROUP_ID_NONE });
  return organize(tabs.filter((t) => /^https?:/.test(t.url || '')));
}

/** Chrome groups open in a window, with their tabs (for importing / planning). */
async function currentGroups(windowId) {
  const out = [];
  for (const g of await chrome.tabGroups.query({ windowId })) {
    if (!g.title) continue;
    const tabs = await chrome.tabs.query({ groupId: g.id });
    out.push({ name: g.title, color: g.color, tabs: tabs.map((t) => ({ title: t.title, url: t.url })) });
  }
  return out;
}

async function acceptSuggestion({ tabId, group }) {
  await moveToGroup([tabId], group);
  await updateSession('suggestions', [], (s) => s.filter((x) => x.tabId !== tabId));
  return true;
}

async function dismissSuggestion({ tabId }) {
  await updateSession('suggestions', [], (s) => s.filter((x) => x.tabId !== tabId));
  return true;
}

// Ungrouping through the normal listener counts as a manual pull-out, so the engine forgets the rule/cache.
async function undoMove({ tabId, ts }) {
  await chrome.tabs.ungroup(tabId).catch(() => {});
  await updateSession('moves', [], (m) => m.filter((x) => !(x.tabId === tabId && x.ts === ts)));
  return true;
}

async function testLLM({ llm }) {
  const r = await chatJSON(llm, '只输出 JSON。', '返回 {"ok":true}', { kind: 'test' });
  return r?.ok === true;
}

const handlers = {
  groupByDomain: (m) => groupByDomain(m.windowId),
  closeDuplicates: (m) => closeDuplicates(m.windowId),
  organizeWindow: (m) => organizeWindow(m.windowId),
  currentGroups: (m) => currentGroups(m.windowId),
  planGroups: async (m) => planGroups(m.text, await currentGroups(m.windowId), await getSettings()),
  acceptSuggestion,
  dismissSuggestion,
  undoMove,
  testLLM,
  openOverview,
  saveSnapshot: (m) => saveSnapshot(m.name),
  listSnapshots,
  restoreSnapshot: (m) => restoreSnapshot(m.id),
  deleteSnapshot: (m) => deleteSnapshot(m.id),
  renameSnapshot: (m) => renameSnapshot(m.id, m.name),
  composeFavicon,
  summarizeTab: (m) => summarizeTab(m.tabId),
  fillThumbs: (m) => fillMissing(m.tabIds, (done, total) => {
    chrome.runtime.sendMessage({ event: 'fillProgress', done, total }).catch(() => {});
  }),
};

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  const run = handlers[msg?.action];
  if (!run) return false;
  run(msg).then((n) => reply({ ok: true, n }), (e) => reply({ ok: false, error: String(e?.message || e) }));
  return true; // async reply
});
