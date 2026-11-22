import { COLORS, PROVIDERS, getLocal, getSettings, sameName, saveSettings, setLocal } from '../lib/store.js';
import { DEFAULT_PLANS, applyI18n, makeT, resolveLang } from '../lib/i18n.js';

const $ = (id) => document.getElementById(id);
const win = await chrome.windows.getCurrent();
let settings = await getSettings();
let lang = resolveLang(settings.lang);
let t = makeT(lang);
let chromeGroups = []; // named groups open in this window, for the "matches a Chrome group" badge

function status(id, text, kind = '') {
  const el = $(id);
  el.textContent = text;
  el.className = `status ${kind}`;
}

async function send(action, extra = {}) {
  const res = await chrome.runtime.sendMessage({ action, windowId: win.id, ...extra });
  if (!res?.ok) throw new Error(res?.error || 'Unknown error');
  return res.n;
}

function setColorClass(el, color) {
  for (const c of COLORS) el.classList.remove(`c-${c}`);
  el.classList.add(`c-${color}`);
}

// ---------- language ----------

$('lang').value = settings.lang;
$('lang').addEventListener('change', async () => {
  const before = lang;
  settings = { ...(await getSettings()), lang: $('lang').value };
  await saveSettings(settings);
  lang = resolveLang(settings.lang);
  t = makeT(lang);
  // Swap the starter description too, unless the user already edited it.
  if ($('planText').value.trim() === DEFAULT_PLANS[before].trim()) $('planText').value = DEFAULT_PLANS[lang];
  applyAll();
});

function applyAll() {
  applyI18n(t, lang);
  document.title = t('optionsTitle');
  for (const card of document.querySelectorAll('#groups .group')) card.refresh();
  renderLearned();
}

// ---------- groups ----------

function groupCard(g = { name: '', color: 'grey', description: '', rules: [] }) {
  const node = $('groupTpl').content.firstElementChild.cloneNode(true);
  applyI18n(t, lang, node);
  const name = node.querySelector('.name');
  const desc = node.querySelector('.description');
  const rules = node.querySelector('.rules');
  const preview = node.querySelector('.preview');
  const linkState = node.querySelector('.link-state');
  const rulesCount = node.querySelector('.rules-count');
  const colors = node.querySelector('.colors');

  name.value = g.name;
  desc.value = g.description || '';
  rules.value = (g.rules || []).join('\n');
  node.dataset.color = COLORS.includes(g.color) ? g.color : 'grey';

  for (const c of COLORS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `c-${c}`;
    b.setAttribute('role', 'radio');
    b.title = c;
    b.addEventListener('click', () => { node.dataset.color = c; node.refresh(); markDirty(); });
    colors.append(b);
  }

  node.refresh = () => {
    const color = node.dataset.color;
    setColorClass(node, color);
    setColorClass(preview, color);
    for (const b of colors.children) b.setAttribute('aria-checked', String(b.title === color));
    preview.textContent = name.value.trim() || t('groupName');
    const linked = chromeGroups.some((cg) => sameName(cg.name, name.value));
    linkState.textContent = name.value.trim() ? t(linked ? 'linked' : 'willCreate') : '';
    linkState.className = `link-state ${linked ? 'ok' : 'new'}`;
    const n = rules.value.split('\n').filter((s) => s.trim()).length;
    rulesCount.textContent = n ? `(${n})` : '';
  };
  name.addEventListener('input', node.refresh);
  rules.addEventListener('input', node.refresh);
  node.querySelector('.remove').addEventListener('click', () => { node.remove(); updateEmpty(); markDirty(); });
  node.refresh();
  return node;
}

function updateEmpty() {
  $('groupsEmpty').hidden = document.querySelectorAll('#groups .group').length > 0;
}

function renderGroups(groups) {
  $('groups').replaceChildren(...groups.map(groupCard));
  updateEmpty();
}

function readGroups() {
  return [...document.querySelectorAll('#groups .group')]
    .map((n) => ({
      name: n.querySelector('.name').value.trim(),
      color: n.dataset.color,
      description: n.querySelector('.description').value.trim(),
      rules: n.querySelector('.rules').value.split('\n').map((s) => s.trim()).filter(Boolean),
    }))
    .filter((g) => g.name);
}

function markDirty() { status('groupsStatus', t('unsaved')); }
$('groups').addEventListener('input', markDirty);

$('plan').addEventListener('click', async () => {
  const text = $('planText').value.trim();
  if (!text) return status('planStatus', t('planEmpty'), 'error');
  $('plan').disabled = true;
  status('planStatus', t('planning'));
  try {
    await setLocal('planText', text);
    const groups = await send('planGroups', { text });
    renderGroups(groups);
    status('planStatus', t('planDone', { n: groups.length }), 'ok');
    markDirty();
  } catch (e) {
    status('planStatus', e.message, 'error');
  } finally {
    $('plan').disabled = false;
  }
});

$('import').addEventListener('click', async () => {
  try {
    chromeGroups = await send('currentGroups');
    const existing = readGroups();
    const added = chromeGroups
      .filter((g) => !existing.some((e) => sameName(e.name, g.name)))
      .map((g) => ({ name: g.name, color: g.color, description: '', rules: [] }));
    renderGroups([...existing, ...added]);
    status('planStatus', added.length ? t('importDone', { n: added.length }) : t('importNone'), added.length ? 'ok' : '');
    if (added.length) markDirty();
  } catch (e) {
    status('planStatus', e.message, 'error');
  }
});

$('addGroup').addEventListener('click', () => {
  const card = groupCard();
  $('groups').append(card);
  updateEmpty();
  card.querySelector('.name').focus();
});

$('saveGroups').addEventListener('click', async () => {
  const groups = readGroups();
  const dup = groups.find((g, i) => groups.findIndex((x) => sameName(x.name, g.name)) !== i);
  if (dup) return status('groupsStatus', t('dupName', { name: dup.name }), 'error');
  await setLocal('groups', groups);
  status('groupsStatus', t('savedGroups', { n: groups.length }), 'ok');
});

// ---------- AI ----------

function fillAI() {
  $('provider').value = settings.llm.provider;
  $('baseURL').value = settings.llm.baseURL;
  $('model').value = settings.llm.model;
  $('apiKey').value = settings.llm.apiKey;
  $('threshold').value = settings.threshold;
  $('thresholdOut').textContent = Number(settings.threshold).toFixed(2);
  $('neverSend').value = settings.neverSendHosts.join('\n');
}

$('threshold').addEventListener('input', () => { $('thresholdOut').textContent = Number($('threshold').value).toFixed(2); });
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
    threshold: Number($('threshold').value) || 0.7,
    neverSendHosts: $('neverSend').value.split('\n').map((s) => s.trim()).filter(Boolean),
  };
}

// Custom endpoints need a host permission; request it first thing in the click so Chrome sees a user gesture.
function ensureHostPermission(baseURL) {
  let origin;
  try { origin = `${new URL(baseURL).origin}/*`; } catch { return Promise.resolve(false); }
  return chrome.permissions.request({ origins: [origin] });
}

$('saveAI').addEventListener('click', async () => {
  const ai = readAI();
  if (!(await ensureHostPermission(ai.llm.baseURL))) return status('aiStatus', t('noPermission'), 'error');
  settings = { ...(await getSettings()), ...ai };
  await saveSettings(settings);
  status('aiStatus', t('saved'), 'ok');
});

$('testAI').addEventListener('click', async () => {
  const ai = readAI();
  if (!(await ensureHostPermission(ai.llm.baseURL))) return status('aiStatus', t('noPermission'), 'error');
  $('testAI').disabled = true;
  status('aiStatus', t('testing'));
  try {
    const ok = await send('testLLM', { llm: ai.llm });
    status('aiStatus', t(ok ? 'testOk' : 'testBad'), ok ? 'ok' : 'error');
  } catch (e) {
    status('aiStatus', e.message, 'error');
  } finally {
    $('testAI').disabled = false;
  }
});

// ---------- behavior ----------

for (const id of ['enabled', 'regroupOnRefresh']) {
  $(id).checked = settings[id];
  $(id).addEventListener('change', async () => {
    settings = { ...(await getSettings()), [id]: $(id).checked };
    await saveSettings(settings);
  });
}

// ---------- learned ----------

async function renderLearned() {
  const learned = Object.entries(await getLocal('learned', {}));
  const profiles = await getLocal('groups', []);
  $('learnedEmpty').hidden = learned.length > 0;
  $('learned').replaceChildren(...learned.map(([key, group]) => {
    const li = document.createElement('li');
    const color = profiles.find((p) => p.name === group)?.color || 'grey';
    const del = Object.assign(document.createElement('button'), { className: 'btn btn-ghost btn-sm btn-danger', textContent: t('remove') });
    del.addEventListener('click', async () => {
      const l = await getLocal('learned', {});
      delete l[key];
      await setLocal('learned', l);
    });
    li.append(
      Object.assign(document.createElement('span'), { className: 'key', textContent: key, title: key }),
      Object.assign(document.createElement('span'), { className: 'arrow', textContent: '→' }),
      Object.assign(document.createElement('span'), { className: `pill c-${color}`, textContent: group }),
      del,
    );
    return li;
  }));
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.learned || changes.groups)) renderLearned();
});

$('clearCache').addEventListener('click', async () => {
  await setLocal('cache', {});
  status('cacheStatus', t('cleared'), 'ok');
});

// ---------- boot ----------

chromeGroups = await send('currentGroups').catch(() => []);
$('planText').value = await getLocal('planText', DEFAULT_PLANS[lang]);
renderGroups(await getLocal('groups', []));
fillAI();
applyAll();
