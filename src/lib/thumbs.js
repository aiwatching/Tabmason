// Tab thumbnails in IndexedDB (shared by the service worker and extension pages; same origin).
// Store "thumbs": { url (key, without #hash), blob (JPEG), ts }

const DB = 'tabmason';
const STORE = 'thumbs';
let dbp = null;

function db() {
  dbp ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'url' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function run(mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, mode);
    const out = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(out?.result ?? out);
    tx.onerror = () => reject(tx.error);
  }));
}

export const thumbKey = (url) => String(url || '').split('#')[0];

export const putThumb = (url, blob) => run('readwrite', (s) => s.put({ url: thumbKey(url), blob, ts: Date.now() }));

export const getThumb = (url) => run('readonly', (s) => s.get(thumbKey(url)));

export async function getThumbs(urls) {
  const keys = new Set(urls.map(thumbKey));
  const all = await run('readonly', (s) => s.getAll());
  return new Map(all.filter((r) => keys.has(r.url)).map((r) => [r.url, r]));
}

/** Drop thumbnails older than `days` whose page isn't open anymore. */
export async function pruneThumbs(openUrls, days = 7) {
  const keep = new Set(openUrls.map(thumbKey));
  const cutoff = Date.now() - days * 86400000;
  const all = await run('readonly', (s) => s.getAll());
  const stale = all.filter((r) => !keep.has(r.url) && r.ts < cutoff).map((r) => r.url);
  if (stale.length) await run('readwrite', (s) => { for (const k of stale) s.delete(k); });
  return stale.length;
}
