import { COLORS, PROVIDERS, getLocal, getSettings, saveSettings, setLocal } from '../lib/store.js';

// Approximate Chrome tab-group colors, for the swatch only.
const SWATCH = { grey: '#9aa0a6', blue: '#8ab4f8', red: '#f28b82', yellow: '#fdd663', green: '#81c995', pink: '#ff8bcb', purple: '#c58af9', cyan: '#78d9ec', orange: '#fcad70' };

const $ = (id) => document.getElementById(id);
const win = await chrome.windows.getCurrent();
let settings = await getSettings();

function status(id, text, error = false) {
  const el = $(id);
  el.textContent = text;
  el.classList.toggle('error', error);
}

async function send(action, extra = {}) {
  const res = await chrome.runtime.sendMessage({ action, windowId: win.id, ...extra });
  if (!res?.ok) throw new Error(res?.error || '未知错误');
  return res.n;
}

// ---------- auto toggles ----------

$('enabled').checked = settings.enabled;
$('regroupOnRefresh').checked = settings.regroupOnRefresh;
for (const id of ['enabled', 'regroupOnRefresh']) {
  $(id).addEventListener('change', async () => {
    settings = await getSettings();
    settings[id] = $(id).checked;
    await saveSettings(settings);
  });
}

// ---------- groups ----------

function groupCard(g = { name: '', color: 'grey', description: '', rules: [] }) {
  const node = $('groupTpl').content.firstElementChild.cloneNode(true);
  const color = node.querySelector('.color');
  for (const c of COLORS) color.add(new Option(c, c));
  node.querySelector('.name').value = g.name;
  color.value = COLORS.includes(g.color) ? g.color : 'grey';
  node.querySelector('.description').value = g.description || '';
  node.querySelector('.rules').value = (g.rules || []).join('\n');
  const swatch = node.querySelector('.swatch');
  const paint = () => { swatch.style.background = SWATCH[color.value]; };
  color.addEventListener('change', paint);
  paint();
  node.querySelector('.remove').addEventListener('click', () => node.remove());
  return node;
}

function renderGroups(groups) {
  $('groups').replaceChildren(...groups.map(groupCard));
}

function readGroups() {
  return [...document.querySelectorAll('#groups .group')]
    .map((n) => ({
      name: n.querySelector('.name').value.trim(),
      color: n.querySelector('.color').value,
      description: n.querySelector('.description').value.trim(),
      rules: n.querySelector('.rules').value.split('\n').map((s) => s.trim()).filter(Boolean),
    }))
    .filter((g) => g.name);
}

renderGroups(await getLocal('groups', []));
$('planText').value = await getLocal('planText', '');

$('plan').addEventListener('click', async () => {
  const text = $('planText').value.trim();
  if (!text) return status('planStatus', '先写一段描述', true);
  $('plan').disabled = true;
  status('planStatus', 'AI 分析中…');
  try {
    await setLocal('planText', text);
    const groups = await send('planGroups', { text });
    renderGroups(groups);
    status('planStatus', `生成了 ${groups.length} 个组，确认后点“保存分组”`);
  } catch (e) {
    status('planStatus', e.message, true);
  } finally {
    $('plan').disabled = false;
  }
});

$('import').addEventListener('click', async () => {
  try {
    const current = await send('currentGroups');
    const existing = readGroups();
    const names = new Set(existing.map((g) => g.name));
    const added = current.filter((g) => !names.has(g.name)).map((g) => ({ name: g.name, color: g.color, description: '', rules: [] }));
    renderGroups([...existing, ...added]);
    status('planStatus', added.length ? `导入了 ${added.length} 个组，补上描述后保存` : '当前窗口没有新的已命名组');
  } catch (e) {
    status('planStatus', e.message, true);
  }
});

$('addGroup').addEventListener('click', () => $('groups').append(groupCard()));

$('saveGroups').addEventListener('click', async () => {
  const groups = readGroups();
  const dup = groups.map((g) => g.name).find((n, i, a) => a.indexOf(n) !== i);
  if (dup) return status('groupsStatus', `组名重复：${dup}`, true);
  await setLocal('groups', groups);
  status('groupsStatus', `已保存 ${groups.length} 个组`);
});

// ---------- AI ----------

function fillAI() {
  $('provider').value = settings.llm.provider;
  $('baseURL').value = settings.llm.baseURL;
  $('model').value = settings.llm.model;
  $('apiKey').value = settings.llm.apiKey;
  $('threshold').value = settings.threshold;
  $('neverSend').value = settings.neverSendHosts.join('\n');
}
fillAI();

$('provider').addEventListener('change', () => {
  const p = PROVIDERS[$('provider').value];
  if (p.baseURL) { $('baseURL').value = p.baseURL; $('model').value = p.model; }
});

function readAI() {
  return {
    llm: {
      provider: $('provider').value,
      baseURL: $('baseURL').value.trim(),
      model: $('model').value.trim(),
      apiKey: $('apiKey').value.trim(),
    },
    threshold: Math.min(1, Math.max(0, Number($('threshold').value) || 0.7)),
    neverSendHosts: $('neverSend').value.split('\n').map((s) => s.trim()).filter(Boolean),
  };
}

// Custom endpoints need a host permission; request it inside the click so Chrome sees a user gesture.
function ensureHostPermission(baseURL) {
  let origin;
  try { origin = `${new URL(baseURL).origin}/*`; } catch { return Promise.resolve(false); }
  return chrome.permissions.request({ origins: [origin] });
}

$('saveAI').addEventListener('click', async () => {
  const ai = readAI();
  const granted = await ensureHostPermission(ai.llm.baseURL);
  if (!granted) return status('aiStatus', '没有拿到访问该 Base URL 的权限', true);
  settings = { ...(await getSettings()), ...ai };
  await saveSettings(settings);
  status('aiStatus', '已保存');
});

$('testAI').addEventListener('click', async () => {
  const ai = readAI();
  const granted = await ensureHostPermission(ai.llm.baseURL);
  if (!granted) return status('aiStatus', '没有拿到访问该 Base URL 的权限', true);
  $('testAI').disabled = true;
  status('aiStatus', '测试中…');
  try {
    const ok = await send('testLLM', { llm: ai.llm });
    status('aiStatus', ok ? '连接正常' : '有返回，但格式不对', !ok);
  } catch (e) {
    status('aiStatus', e.message, true);
  } finally {
    $('testAI').disabled = false;
  }
});

// ---------- learned ----------

async function renderLearned() {
  const learned = await getLocal('learned', {});
  const entries = Object.entries(learned);
  if (!entries.length) {
    $('learned').replaceChildren(Object.assign(document.createElement('li'), { textContent: '还没有，手动拖几个标签页进组就会出现' }));
    return;
  }
  $('learned').replaceChildren(...entries.map(([key, group]) => {
    const li = document.createElement('li');
    li.textContent = `${key} → ${group}`;
    const del = Object.assign(document.createElement('button'), { textContent: '删除' });
    del.addEventListener('click', async () => {
      const l = await getLocal('learned', {});
      delete l[key];
      await setLocal('learned', l);
      renderLearned();
    });
    li.append(del);
    return li;
  }));
}
renderLearned();
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.learned) renderLearned(); });

$('clearCache').addEventListener('click', async () => {
  await setLocal('cache', {});
  status('cacheStatus', '已清空');
});
