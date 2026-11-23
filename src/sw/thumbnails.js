// Thumbnail capture. Chrome can only screenshot the visible tab of a window, so we capture a tab
// whenever it is shown (activated, or finished loading while visible) and keep a small JPEG per URL.

import { putThumb, pruneThumbs } from '../lib/thumbs.js';
import { isPageUrl } from '../lib/marks.js';

const WIDTH = 480;
const MIN_GAP_MS = 600; // captureVisibleTab is limited to ~2 calls per second
let lastCapture = 0;
let filling = false; // "fill in thumbnails" is running; automatic captures stand aside
const pending = new Map(); // windowId -> timer

// Captures run one at a time, spaced out, so automatic and fill-in captures never trip the quota together.
let chain = Promise.resolve();
const serialized = (fn) => {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
};

const capturable = (tab) => tab && isPageUrl(tab.url) && tab.status === 'complete' && !tab.discarded;

async function shrink(dataUrl) {
  const bmp = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const h = Math.round((bmp.height / bmp.width) * WIDTH);
  const canvas = new OffscreenCanvas(WIDTH, h);
  canvas.getContext('2d').drawImage(bmp, 0, 0, WIDTH, h);
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
}

async function grab(windowId) {
  const wait = lastCapture + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCapture = Date.now();
  return chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 80 });
}

/** Capture a tab if it is the visible tab of its window. Returns true when a thumbnail was stored. */
export function captureTab(tabId) {
  return serialized(async () => {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!capturable(tab) || !tab.active) return false;
    try {
      let shot;
      try {
        shot = await grab(tab.windowId);
      } catch (e) {
        if (!/MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND/.test(e.message)) throw e;
        await new Promise((r) => setTimeout(r, 1000));
        shot = await grab(tab.windowId);
      }
      const now = await chrome.tabs.get(tabId).catch(() => null);
      if (!now?.active || now.url !== tab.url) return false; // user switched away mid-capture
      await putThumb(tab.url, await shrink(shot));
      chrome.runtime.sendMessage({ event: 'thumb', url: tab.url }).catch(() => {});
      return true;
    } catch {
      return false; // minimized window, devtools focus, chrome:// page, ...
    }
  });
}

function schedule(tab, delay) {
  if (filling) return;
  clearTimeout(pending.get(tab.windowId));
  pending.set(tab.windowId, setTimeout(() => { pending.delete(tab.windowId); captureTab(tab.id); }, delay));
}

/**
 * For "fill in missing thumbnails": show each tab briefly and capture it, then return to the original tab.
 * onProgress(done, total) is called after each tab.
 */
export async function fillMissing(tabIds, onProgress = () => {}) {
  const byWindow = new Map();
  for (const id of tabIds) {
    const t = await chrome.tabs.get(id).catch(() => null);
    if (t && isPageUrl(t.url)) byWindow.set(t.windowId, [...(byWindow.get(t.windowId) || []), t]);
  }
  const total = [...byWindow.values()].reduce((n, a) => n + a.length, 0);
  let done = 0;
  let captured = 0;
  filling = true;
  try {
    for (const [windowId, tabs] of byWindow) {
      const [back] = await chrome.tabs.query({ windowId, active: true });
      for (const t of tabs) {
        await chrome.tabs.update(t.id, { active: true }).catch(() => {});
        await waitLoaded(t.id, 6000);
        await new Promise((r) => setTimeout(r, 350)); // let it paint
        if (await captureTab(t.id)) captured++;
        onProgress(++done, total);
      }
      if (back) await chrome.tabs.update(back.id, { active: true }).catch(() => {});
    }
  } finally {
    filling = false;
  }
  return captured;
}

async function waitLoaded(tabId, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const t = await chrome.tabs.get(tabId).catch(() => null);
    if (!t || t.status === 'complete') return;
    await new Promise((r) => setTimeout(r, 200));
  }
}

export function initThumbnails() {
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId).then((t) => t && schedule(t, 500), () => {});
  });
  chrome.tabs.onUpdated.addListener((_id, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) schedule(tab, 900);
  });
  chrome.runtime.onStartup.addListener(async () => {
    const tabs = await chrome.tabs.query({});
    pruneThumbs(tabs.map((t) => t.url)).catch(() => {});
  });
}
