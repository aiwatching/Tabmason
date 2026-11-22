// OpenAI-compatible chat client (DeepSeek, GLM, OpenAI and any compatible endpoint).

export async function chatJSON(llm, system, user, { timeoutMs = 20000 } = {}) {
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
    return parseJSON(data.choices?.[0]?.message?.content ?? '');
  } finally {
    clearTimeout(timer);
  }
}

// Models sometimes wrap JSON in ```json fences or add prose; take the outermost object.
function parseJSON(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error(`AI reply was not JSON: ${text.slice(0, 200)}`);
}
