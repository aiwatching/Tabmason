// Service-worker side of tab marks: favicon composing, AI summaries, keeping content scripts in sync.

import { MARK_HEX, isPageUrl } from '../lib/marks.js';
import { chatJSON } from '../lib/llm.js';
import { canSendToAI } from '../auto/classifier.js';
import { getSettings } from '../lib/store.js';
import { resolveLang } from '../lib/i18n.js';

const CONTENT_SCRIPT = 'src/content/mark.js';

async function loadBitmap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return createImageBitmap(await res.blob()); // fails on SVG; caller falls back
}

function chromeFavicon(pageUrl) {
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', pageUrl);
  u.searchParams.set('size', '32');
  return u.toString();
}

async function blobToDataURL(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type};base64,${btoa(bin)}`;
}

/**
 * The page's icon inside a colored ring, as a PNG data URL.
 * Source: the page's own icon URL (host permission lets us fetch it), else Chrome's favicon cache for the
 * site root (not the page itself, whose cached icon may already be our ringed one).
 */
export async function composeFavicon({ iconUrl, pageUrl, color }) {
  const hex = MARK_HEX[color] || MARK_HEX.grey;
  let bmp = null;
  const origin = new URL(pageUrl).origin; // "null" for file:// pages
  const sources = [iconUrl, origin !== 'null' && chromeFavicon(`${origin}/`), chromeFavicon(pageUrl)].filter(Boolean);
  for (const src of sources) {
    try { bmp = await loadBitmap(src); break; } catch { /* try next */ }
  }
  const S = 32;
  const canvas = new OffscreenCanvas(S, S);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = hex;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(S / 2, S / 2, 11.5, 0, Math.PI * 2); ctx.fill();
  if (bmp) {
    ctx.save();
    ctx.beginPath(); ctx.arc(S / 2, S / 2, 11.5, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(bmp, 6, 6, 20, 20);
    ctx.restore();
  } else {
    ctx.fillStyle = hex;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, 5, 0, Math.PI * 2); ctx.fill();
  }
  return blobToDataURL(await canvas.convertToBlob({ type: 'image/png' }));
}

/** One or two sentence summary of a tab's page, written by the AI. Sends page text — only on explicit request. */
export async function summarizeTab(tabId) {
  const settings = await getSettings();
  const tab = await chrome.tabs.get(tabId);
  if (!isPageUrl(tab.url)) throw new Error('Only web pages and local files can be summarized');
  // Local files have no host; you asked for this summary explicitly, so the host list doesn't apply.
  if (!tab.url.startsWith('file:') && !canSendToAI(tab, settings)) throw new Error('This host is in "never send to AI"');
  const [{ result: page } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      title: document.title,
      description: document.querySelector('meta[name="description" i]')?.content || '',
      text: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 4000),
    }),
  });
  const lang = resolveLang(settings.lang) === 'zh' ? '简体中文' : 'English';
  const system = [
    `You summarize a web page for a browser-tab note. Write in ${lang}.`,
    'One or two short sentences (max ~60 Chinese characters or ~35 English words): what the page is and its key point or status.',
    'No preamble. Output JSON only: {"summary":"..."}',
  ].join('\n');
  const user = JSON.stringify({ url: tab.url.split('?')[0], ...page });
  const res = await chatJSON(settings.llm, system, user, { timeoutMs: 30000, kind: 'summary' });
  return String(res.summary || '').trim();
}

/** Static content scripts don't reach tabs that were open before install/reload; inject into those. */
export async function injectIntoOpenTabs() {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*', 'file:///*'] });
  await Promise.all(tabs.map((t) => chrome.scripting.executeScript({ target: { tabId: t.id }, files: [CONTENT_SCRIPT] }).catch(() => {})));
}

/** SPA navigations change the URL without reloading the content script; tell it to look up its mark again. */
export function notifyUrlChange(tabId) {
  chrome.tabs.sendMessage(tabId, { action: 'tabmasonRecheck' }).catch(() => {});
}
