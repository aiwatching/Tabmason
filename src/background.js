// Tabmason service worker: tab actions shared by the popup and keyboard commands.

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
});

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  const run = { groupByDomain, closeDuplicates }[msg?.action];
  if (!run) return false;
  run(msg.windowId).then((n) => reply({ ok: true, n }), (e) => reply({ ok: false, error: String(e) }));
  return true; // async reply
});
