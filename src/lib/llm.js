// OpenAI-compatible chat client (DeepSeek, GLM, OpenAI and any compatible endpoint).
// Every call records its token usage per day and per kind, shown on the options page.

import { updateLocal } from './store.js';

export async function chatJSON(llm, system, user, { timeoutMs = 20000, kind = 'other' } = {}) {
  if (!llm?.apiKey || !llm?.baseURL || !llm?.model) throw new Error('AI not configured: set Base URL, model and API key in Tabmason settings');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${llm.baseURL.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llm.apiKey}` },
      body: JSON.stringify({
        model: llm.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`AI request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    await recordUsage(kind, data.usage).catch(() => {});
    return parseJSON(data.choices?.[0]?.message?.content ?? '');
  } finally {
    clearTimeout(timer);
  }
}

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** usage: { "2026-11-22": { calls, in, out, kinds: { classify: { calls, in, out } } } }, last 60 days kept. */
async function recordUsage(kind, usage) {
  const tin = Number(usage?.prompt_tokens) || 0;
  const tout = Number(usage?.completion_tokens) || 0;
  await updateLocal('usage', {}, (u) => {
    const day = (u[dayKey()] ||= { calls: 0, in: 0, out: 0, kinds: {} });
    const k = (day.kinds[kind] ||= { calls: 0, in: 0, out: 0 });
    for (const x of [day, k]) { x.calls += 1; x.in += tin; x.out += tout; }
    for (const d of Object.keys(u).sort().slice(0, -60)) delete u[d];
    return u;
  });
}

// Models sometimes wrap JSON in ```json fences or add prose; take the outermost object.
function parseJSON(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error(`AI reply was not JSON: ${text.slice(0, 200)}`);
}
