// Decide which of the user's groups a tab belongs to.
// Order: learned (from manual drags) > profile rules > cache (earlier AI answers) > AI.
// The answer is always one of the user's group names, or null. Never a new group.

import { chatJSON } from '../lib/llm.js';
import { COLORS, getLocal, updateLocal, urlKey } from '../lib/store.js';

export function ruleMatches(rule, tab) {
  const s = String(rule).trim();
  if (!s) return false;
  const i = s.indexOf(':');
  const kind = i > 0 ? s.slice(0, i).toLowerCase() : '';
  const raw = ['host', 'url', 'title'].includes(kind) ? s.slice(i + 1).trim() : s;
  const pat = raw.toLowerCase();
  if (!pat) return false;
  const url = (tab.url || '').toLowerCase();
  if (kind === 'title') return (tab.title || '').toLowerCase().includes(pat);
  if (kind === 'host') {
    let host;
    try { host = new URL(tab.url).host.toLowerCase(); } catch { return false; }
    return host === pat || host.endsWith(`.${pat}`);
  }
  return url.includes(pat); // "url:" or bare text
}

/** Classify without AI. Returns { group, source } or null. */
export async function classifyLocal(tab, groups) {
  const names = new Set(groups.map((g) => g.name));
  const key = urlKey(tab.url);
  if (key) {
    const learned = (await getLocal('learned', {}))[key];
    if (learned && names.has(learned)) return { group: learned, source: 'learned', confidence: 1 };
  }
  for (const g of groups) {
    if ((g.rules || []).some((r) => ruleMatches(r, tab))) return { group: g.name, source: 'rule', confidence: 1 };
  }
  if (key) {
    const cached = (await getLocal('cache', {}))[key];
    if (cached && names.has(cached)) return { group: cached, source: 'cache', confidence: 1 };
  }
  return null;
}

function hostOf(url) { try { return new URL(url).host; } catch { return ''; } }
function pathOf(url) { try { return new URL(url).pathname; } catch { return ''; } }

export function canSendToAI(tab, settings) {
  const host = hostOf(tab.url).replace(/:\d+$/, '').toLowerCase();
  if (!host) return false;
  return !settings.neverSendHosts.some((h) => {
    const p = h.trim().toLowerCase();
    return p && (host === p || host.endsWith(`.${p}`));
  });
}

/**
 * Ask the AI about several tabs at once.
 * examples: { [groupName]: [{title, url}] } — tabs already in each group, as few-shot context.
 * Returns Map(tabId -> { group, confidence }).
 */
export async function classifyWithAI(tabs, groups, examples, settings) {
  const out = new Map();
  if (!tabs.length) return out;
  const names = new Set(groups.map((g) => g.name));
  const system = [
    '你是浏览器标签页分类器。用户已经定义好了一组标签组，你只能把标签页分到这些组里，绝不能新建或改名。',
    '依据组的描述和每组已有标签页的例子判断。没有把握、或不属于任何组时，group 返回 null。',
    'confidence 是 0 到 1 的数字，表示你有多确定。',
    '只输出 JSON：{"results":[{"id":<标签页 id>,"group":"组名或 null","confidence":0.0}]}',
  ].join('\n');
  const user = JSON.stringify({
    groups: groups.map((g) => ({
      name: g.name,
      description: g.description || '',
      examples: (examples[g.name] || [])
        .filter((t) => canSendToAI(t, settings))
        .slice(0, 6)
        .map((t) => `${t.title} — ${hostOf(t.url)}${pathOf(t.url)}`),
    })),
    tabs: tabs.map((t) => ({ id: t.id, title: t.title, host: hostOf(t.url), path: pathOf(t.url) })),
  });
  const res = await chatJSON(settings.llm, system, user);
  for (const r of res.results || []) {
    const id = Number(r.id);
    if (!tabs.some((t) => t.id === id)) continue;
    const group = names.has(r.group) ? r.group : null;
    out.set(id, { group, confidence: Number(r.confidence) || 0 });
  }
  return out;
}

export async function rememberAI(tab, group) {
  const key = urlKey(tab.url);
  if (!key) return;
  await updateLocal('cache', {}, (c) => {
    c[key] = group;
    const keys = Object.keys(c);
    if (keys.length > 2000) for (const k of keys.slice(0, keys.length - 2000)) delete c[k];
    return c;
  });
}

/**
 * Turn the user's free-text description into group profiles.
 * current: [{ name, color, tabs: [{title, url}] }] — Chrome groups open right now, so names line up.
 */
export async function planGroups(text, current, settings) {
  const system = [
    '你帮用户规划 Chrome 标签组。根据用户的文字描述，输出他想要的分组。',
    '如果描述里提到的组和"当前已有的组"是同一个意思，必须沿用已有组的名字和颜色（一字不差），这样才能对上已经存在的组。',
    '只输出用户描述中提到的组，不要自己发明额外的组。',
    `color 只能是：${COLORS.join(', ')}。`,
    'description 用一两句话说明什么样的标签页属于这个组，给之后的自动分类用。',
    'rules 是确定性的匹配规则，每条是字符串："host:域名"（含子域名）、"url:网址片段" 或 "title:标题关键词"。只写有把握的，没有就给空数组。',
    '只输出 JSON：{"groups":[{"name":"","color":"","description":"","rules":[]}]}',
  ].join('\n');
  const user = JSON.stringify({
    description: text,
    currentGroups: current.map((g) => ({
      name: g.name,
      color: g.color,
      tabs: g.tabs.filter((t) => canSendToAI(t, settings)).slice(0, 8).map((t) => `${t.title} — ${hostOf(t.url)}`),
    })),
  });
  const res = await chatJSON(settings.llm, system, user, { timeoutMs: 60000 });
  return (res.groups || [])
    .filter((g) => g && String(g.name || '').trim())
    .map((g) => ({
      name: String(g.name).trim(),
      color: COLORS.includes(g.color) ? g.color : 'grey',
      description: String(g.description || ''),
      rules: Array.isArray(g.rules) ? g.rules.map(String).filter(Boolean) : [],
    }));
}
