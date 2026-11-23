// Tab marks: a color and/or a short note attached to a page URL (survives browser restarts).
// marks (chrome.storage.local): { [url without #hash]: { color, note, title, ts } }

import { getLocal, updateLocal } from './store.js';

// Strong Chrome tab-group colors, used for the favicon ring (must read well at 16px).
export const MARK_HEX = {
  grey: '#5f6368', blue: '#1a73e8', red: '#d93025', yellow: '#f9ab00', green: '#188038',
  pink: '#d01884', purple: '#a142f4', cyan: '#007b83', orange: '#fa7b17',
};

// Keep in sync with src/content/mark.js (classic script, can't import this module).
export const MARK_PREFIX = { grey: '⚪', blue: '🔵', red: '🔴', yellow: '🟡', green: '🟢', pink: '🩷', purple: '🟣', cyan: '🩵', orange: '🟠' };
// Separator before a note appended to the title (settings.markNoteInTitle); same in src/content/mark.js.
const NOTE_RE = / · 📝 .*$/su;
const PREFIX_RE = new RegExp(`^(?:${Object.values(MARK_PREFIX).join('|')}) `, 'u');

/** A tab title without the colored dot and the note the content script adds to marked tabs. */
export const cleanTitle = (title) => String(title || '').replace(PREFIX_RE, '').replace(NOTE_RE, '');

/** Pages the content script can run in (and so show a favicon ring / title dot). file:// needs Chrome's file-access switch. */
export const isPageUrl = (url) => /^(https?|file):/i.test(String(url || ''));

export const markKey = (url) => String(url || '').split('#')[0];

export const getMarks = () => getLocal('marks', {});

/** Set or clear a tab's mark. A mark with no color and no note is removed. */
export async function setMark(url, { color = null, note = '', title = '' } = {}) {
  const key = markKey(url);
  if (!key) return;
  await updateLocal('marks', {}, (m) => {
    const clean = String(note || '').trim();
    if (!color && !clean) delete m[key];
    else m[key] = { color, note: clean, title, ts: Date.now() };
    return m;
  });
}
