// Auto-grouping: watch tabs finish loading, put them into the user's groups, learn from manual drags.

import { canSendToAI, classifyLocal, classifyWithAI, rememberAI } from './classifier.js';
import { getLocal, getSession, getSettings, setSession, updateLocal, updateSession, urlKey } from '../lib/store.js';

const SETTLE_MS = 1500; // SPA titles change after "complete"; also batches tabs opened together
const BOOT_QUIET_MS = 15000; // Chrome restoring groups at startup is not the user dragging
const OURS_TTL_MS = 5000;

// ---------- moving tabs ----------

/** Put tabs into the group named `name` in their window, creating that (user-defined) group there if needed. */
export async function moveToGroup(tabIds, name) {
  const groups = await getLocal('groups', []);
  const profile = groups.find((g) => g.name === name);
  if (!profile || !tabIds.length) return;
  const tabs = await Promise.all(tabIds.map((id) => chrome.tabs.get(id).catch(() => null)));
  const byWindow = new Map();
  for (const t of tabs) if (t) byWindow.set(t.windowId, [...(byWindow.get(t.windowId) || []), t.id]);

  const now = Date.now();
  await updateSession('ours', {}, (o) => { for (const id of tabIds) o[id] = now; return o; });

  for (const [windowId, ids] of byWindow) {
    const [existing] = await chrome.tabGroups.query({ windowId, title: name });
    if (existing) {
      await chrome.tabs.group({ tabIds: ids, groupId: existing.id });
    } else {
      const groupId = await chrome.tabs.group({ tabIds: ids, createProperties: { windowId } });
      await chrome.tabGroups.update(groupId, { title: name, color: profile.color || 'grey' });
    }
  }
}

async function logMove(tab, group, source) {
  await updateSession('moves', [], (m) => [{ tabId: tab.id, title: tab.title, group, source, ts: Date.now() }, ...m].slice(0, 20));
}

async function addSuggestion(tab, group, confidence) {
  await updateSession('suggestions', [], (s) =>
    [{ tabId: tab.id, title: tab.title, group, confidence, ts: Date.now() }, ...s.filter((x) => x.tabId !== tab.id)].slice(0, 20));
}

// ---------- classifying a batch ----------

/**
 * Classify tabs and move the confident ones. Used by the auto queue and by "整理当前窗口".
 * Returns { moved, suggested, skipped, error }.
 */
export async function organize(tabs, { useAI = true } = {}) {
  const settings = await getSettings();
  const groups = await getLocal('groups', []);
  const result = { moved: 0, suggested: 0, skipped: 0, error: null };
  if (!groups.length || !tabs.length) { result.skipped = tabs.length; return result; }

  const decided = new Map(); // group -> tabs
  const forAI = [];
  for (const tab of tabs) {
    const hit = await classifyLocal(tab, groups);
    if (hit) { decided.set(hit.group, [...(decided.get(hit.group) || []), { tab, source: hit.source }]); continue; }
    if (useAI && settings.llm.apiKey && canSendToAI(tab, settings)) forAI.push(tab);
    else result.skipped++;
  }

  if (forAI.length) {
    try {
      const examples = await groupExamples(forAI[0].windowId);
      const answers = await classifyWithAI(forAI, groups, examples, settings);
      for (const tab of forAI) {
        const a = answers.get(tab.id);
        if (!a?.group) { result.skipped++; continue; }
        if (a.confidence >= settings.threshold) {
          decided.set(a.group, [...(decided.get(a.group) || []), { tab, source: 'ai' }]);
          await rememberAI(tab, a.group);
        } else {
          await addSuggestion(tab, a.group, a.confidence);
          result.suggested++;
        }
      }
    } catch (e) {
      result.error = String(e.message || e);
      result.skipped += forAI.length;
    }
  }

  for (const [group, items] of decided) {
    await moveToGroup(items.map((i) => i.tab.id), group);
    for (const i of items) await logMove(i.tab, group, i.source);
    result.moved += items.length;
  }
  return result;
}

/** Tabs already in each named group of a window, as AI few-shot examples. */
async function groupExamples(windowId) {
  const out = {};
  const tgs = await chrome.tabGroups.query({ windowId });
  for (const g of tgs) {
    if (!g.title) continue;
    const tabs = await chrome.tabs.query({ groupId: g.id });
    out[g.title] = tabs.map((t) => ({ title: t.title, url: t.url }));
  }
  return out;
}

// ---------- auto queue ----------

const queue = new Set();
let timer = null;

function enqueue(tabId) {
  queue.add(tabId);
  clearTimeout(timer);
  timer = setTimeout(flush, SETTLE_MS);
}

async function flush() {
  const ids = [...queue];
  queue.clear();
  const settings = await getSettings();
  if (!settings.enabled) return;
  const manualOut = await getSession('manualOut', {});
  const tabs = [];
  for (const id of ids) {
    const tab = await chrome.tabs.get(id).catch(() => null);
    if (!tab || !isCandidate(tab, settings)) continue;
    if (manualOut[id] && manualOut[id] === tab.url) continue; // user pulled it out; leave it alone
    tabs.push(tab);
  }
  // AI examples are per window, so batch per window.
  const byWindow = new Map();
  for (const t of tabs) byWindow.set(t.windowId, [...(byWindow.get(t.windowId) || []), t]);
  for (const batch of byWindow.values()) {
    const r = await organize(batch);
    if (r.error) console.warn('[Tabmason]', r.error);
  }
}

function isCandidate(tab, settings) {
  if (tab.pinned || tab.incognito) return false;
  if (!/^https?:/.test(tab.url || '')) return false;
  if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE && !settings.regroupOnRefresh) return false;
  return true;
}

// ---------- learning from the user ----------

async function onGroupChanged(tabId, groupId, tab) {
  const ours = await getSession('ours', {});
  if (ours[tabId] && Date.now() - ours[tabId] < OURS_TTL_MS) {
    await updateSession('ours', {}, (o) => { delete o[tabId]; return o; });
    return;
  }
  const bootTs = await getSession('bootTs', 0);
  if (Date.now() - bootTs < BOOT_QUIET_MS) return;

  const key = urlKey(tab.url);
  if (groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
    // Pulled out of a group: forget what put it there, and don't put this page back.
    await updateSession('manualOut', {}, (m) => { m[tabId] = tab.url; return m; });
    if (key) {
      await updateLocal('cache', {}, (c) => { delete c[key]; return c; });
      await updateLocal('learned', {}, (l) => { delete l[key]; return l; });
    }
    return;
  }
  // Dragged into a group: if it is one of the user's groups, remember this page's key -> that group.
  const g = await chrome.tabGroups.get(groupId).catch(() => null);
  const groups = await getLocal('groups', []);
  if (!g?.title || !key || !groups.some((p) => p.name === g.title)) return;
  await updateLocal('learned', {}, (l) => { l[key] = g.title; return l; });
  await updateSession('manualOut', {}, (m) => { delete m[tabId]; return m; });
}

// ---------- wiring ----------

// Must run synchronously at service-worker top level, or events that wake the worker are lost.
export function initEngine() {
  getSession('bootTs', 0).then((ts) => ts || setSession('bootTs', Date.now()));

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if ('groupId' in changeInfo) onGroupChanged(tabId, changeInfo.groupId, tab).catch(console.error);
    if (changeInfo.status === 'complete') enqueue(tabId);
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    updateSession('manualOut', {}, (m) => { delete m[tabId]; return m; }).catch(() => {});
  });
}
