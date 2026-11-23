// Persistent state. MV3 service workers sleep at any time, so nothing lives only in memory.
//
// local:   settings, groups (the user's group profiles), learned (key -> group), cache (key -> group)
// session: ours (tabIds we are moving right now), manualOut (tabs the user pulled out of a group),
//          moves (recent auto moves, for undo), suggestions (low-confidence AI answers), bootTs

export const COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

export const PROVIDERS = {
  deepseek: { baseURL: 'https://api.deepseek.com', model: 'deepseek-chat' },
  glm: { baseURL: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  openai: { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  custom: { baseURL: '', model: '' },
};

export const DEFAULT_SETTINGS = {
  enabled: true,
  lang: 'auto', // 'auto' | 'zh' | 'en'
  regroupOnRefresh: false, // re-classify tabs that are already in a group
  markTitlePrefix: true, // marked tabs also get a colored emoji in front of their title
  markNoteInTitle: false, // append the note to the title so Chrome's hover card shows it
  llm: { provider: 'deepseek', ...PROVIDERS.deepseek, apiKey: '' },
  threshold: 0.7,
  neverSendHosts: ['localhost', '127.0.0.1'], // hosts whose tabs are never sent to the AI
};

/** Group profile: { name, color, description, rules: ["host:x", "url:x", "title:x"] } */

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...settings, llm: { ...DEFAULT_SETTINGS.llm, ...settings?.llm } };
}
export const saveSettings = (settings) => chrome.storage.local.set({ settings });

export async function getLocal(key, fallback) {
  const r = await chrome.storage.local.get(key);
  return r[key] ?? fallback;
}
export const setLocal = (key, value) => chrome.storage.local.set({ [key]: value });

export async function getSession(key, fallback) {
  const r = await chrome.storage.session.get(key);
  return r[key] ?? fallback;
}
export const setSession = (key, value) => chrome.storage.session.set({ [key]: value });

export async function updateLocal(key, fallback, fn) {
  const next = fn(await getLocal(key, fallback));
  await setLocal(key, next);
  return next;
}
export async function updateSession(key, fallback, fn) {
  const next = fn(await getSession(key, fallback));
  await setSession(key, next);
  return next;
}

/** Key used for learning and caching: host plus first path segment, e.g. "git.example.com/backend". */
export function urlKey(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    const seg = u.pathname.split('/').filter(Boolean)[0] || '';
    return `${u.host.replace(/^www\./, '')}/${seg}`;
  } catch { return null; }
}

/** Loose group-name identity: "Works", " works ", "WORKS 🛠" all name the same group. */
export function sameName(a, b) {
  const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const na = norm(a);
  return na !== '' && na === norm(b);
}
