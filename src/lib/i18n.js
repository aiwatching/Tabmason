// Tiny i18n: Chinese and English, switchable at runtime (chrome.i18n can't switch without changing the browser language).
// Markup uses data-i18n="key" (text), data-i18n-ph="key" (placeholder), data-i18n-title="key" (tooltip).

const zh = {
  appTagline: '把标签页自动放进你定义的分组',
  lang: '语言', langAuto: '跟随浏览器',

  // popup
  tabs: '{n} 个标签页',
  auto: '自动归类',
  noGroups: '还没有定义分组。',
  setUp: '去设置',
  organize: '整理当前窗口',
  organizeHint: '把未分组的标签页放进你的分组',
  groupByDomain: '按域名分组',
  closeDuplicates: '关闭重复',
  working: '处理中…',
  resultOrganize: '移动 {moved} 个 · 待确认 {suggested} 个 · 未处理 {skipped} 个',
  resultAIError: 'AI 出错：{e}',
  resultGroups: '建了 {n} 个组',
  resultDupes: '关闭了 {n} 个重复标签页',
  suggestions: '建议',
  suggestionsHint: 'AI 不太确定，需要你确认',
  accept: '放入', dismiss: '忽略',
  recentMoves: '最近自动移动',
  undo: '撤销',
  src_learned: '学习', src_rule: '规则', src_cache: '缓存', src_ai: 'AI',
  settings: '设置',
  untitled: '（无标题）',

  // options
  optionsTitle: 'Tabmason 设置',
  secGroups: '我的分组',
  secGroupsSub: 'AI 只会把标签页放进这里定义的组，绝不自己新建组。组名要和 Chrome 里的组名一致。',
  planLabel: '用文字描述你想怎么分组',
  planHint: '已填好一份默认描述，按你的习惯改。每行一个组。',
  planPh: '组名：什么样的标签页属于它',
  plan: 'AI 生成分组',
  importGroups: '从当前窗口导入',
  addGroup: '添加组',
  planning: 'AI 分析中…',
  planEmpty: '先写一段描述',
  planDone: '生成了 {n} 个组，检查后点“保存分组”',
  importDone: '导入了 {n} 个组，补上描述后保存',
  importNone: '当前窗口没有新的已命名组',
  noGroupsYet: '还没有分组。用上面的描述让 AI 生成，或从当前窗口导入。',
  groupName: '组名',
  groupDesc: '什么样的标签页属于这个组（给 AI 看）',
  groupRules: '规则（可选，每行一条）',
  rulesPh: 'host:gitlab.com\nurl:/merge_requests\ntitle:关键词',
  rulesHint: 'host: 域名（含子域名） · url: 网址片段 · title: 标题关键词',
  linked: '已对应 Chrome 中的组',
  willCreate: '当前窗口没有这个组，需要时会新建',
  remove: '删除',
  saveGroups: '保存分组',
  saved: '已保存',
  savedGroups: '已保存 {n} 个组',
  dupName: '组名重复：{name}',
  unsaved: '有未保存的修改',

  secAI: 'AI 连接',
  secAISub: '规则和学习都判断不了时才调用。DeepSeek、智谱 GLM 和任何 OpenAI 兼容接口都可以。',
  provider: '服务商', custom: '自定义（OpenAI 兼容）', glm: '智谱 GLM',
  baseURL: 'Base URL', model: '模型', apiKey: 'API key',
  threshold: '置信度阈值',
  thresholdHint: '低于阈值不自动移动，放进弹窗的“建议”里',
  neverSend: '不发给 AI 的域名',
  neverSendPh: '每行一个，含子域名',
  privacy: '发给 AI 的只有标签页标题、域名和路径，不含参数和页面内容。API key 只存在本机。',
  save: '保存', test: '测试连接', testing: '测试中…',
  testOk: '连接正常', testBad: '有返回，但格式不对',
  noPermission: '没有拿到访问该 Base URL 的权限',

  secBehavior: '行为',
  enabledLabel: '自动归类新开和刷新的标签页',
  enabledHint: '判断顺序：你拖拽学到的规则 → 分组规则 → AI 判断缓存 → AI',
  regroupLabel: '已在组里的标签页刷新时也重新判断',
  regroupHint: '默认关闭：已经在组里的标签页不动',

  secLearned: '学到的规则',
  secLearnedSub: '你把标签页手动拖进组时自动记下（域名 + 第一级路径 → 组），拖出来就删掉。',
  learnedEmpty: '还没有。手动拖几个标签页进组就会出现在这里。',
  clearCache: '清空 AI 判断缓存',
  cleared: '已清空',

  defaultPlan: `Agent (Stable)：AI 工具和 agent 平台，比如 Claude、ChatGPT、DeepSeek、GLM、Forge 控制台、本地 localhost 上的 agent 页面
Processing：手上正在处理的事情，比如正在跟的 Mantis bug 单、正在 review 或修改的 GitLab MR、当前排查问题时打开的日志和文档
Works：日常工作相关但不是当前紧急处理的，比如 GitLab 项目和代码、Jira、Confluence、公司内部系统和工具文档
Pesonal：个人用途，比如 Gmail、YouTube、购物、新闻、社交网站`,
};

const en = {
  appTagline: 'Sorts tabs into the groups you define',
  lang: 'Language', langAuto: 'Browser default',

  tabs: '{n} tabs',
  auto: 'Auto-sort',
  noGroups: 'No groups defined yet.',
  setUp: 'Set up',
  organize: 'Sort this window',
  organizeHint: 'Put ungrouped tabs into your groups',
  groupByDomain: 'Group by domain',
  closeDuplicates: 'Close duplicates',
  working: 'Working…',
  resultOrganize: 'Moved {moved} · to confirm {suggested} · left {skipped}',
  resultAIError: 'AI error: {e}',
  resultGroups: '{n} group(s) made',
  resultDupes: '{n} duplicate(s) closed',
  suggestions: 'Suggestions',
  suggestionsHint: 'The AI is not sure — your call',
  accept: 'Add', dismiss: 'Dismiss',
  recentMoves: 'Recent moves',
  undo: 'Undo',
  src_learned: 'learned', src_rule: 'rule', src_cache: 'cache', src_ai: 'AI',
  settings: 'Settings',
  untitled: '(untitled)',

  optionsTitle: 'Tabmason settings',
  secGroups: 'Your groups',
  secGroupsSub: 'Tabs only ever go into the groups defined here; the AI never invents a group. Names must match your Chrome group names.',
  planLabel: 'Describe how you want tabs grouped',
  planHint: 'A starting description is filled in; adapt it to your habits. One group per line.',
  planPh: 'Group name: which tabs belong in it',
  plan: 'Generate with AI',
  importGroups: 'Import from this window',
  addGroup: 'Add group',
  planning: 'Asking the AI…',
  planEmpty: 'Write a description first',
  planDone: '{n} groups drafted — review, then Save groups',
  importDone: 'Imported {n} group(s) — add descriptions, then save',
  importNone: 'No new named groups in this window',
  noGroupsYet: 'No groups yet. Generate them from the description above, or import from this window.',
  groupName: 'Group name',
  groupDesc: 'Which tabs belong in this group (read by the AI)',
  groupRules: 'Rules (optional, one per line)',
  rulesPh: 'host:gitlab.com\nurl:/merge_requests\ntitle:keyword',
  rulesHint: 'host: domain incl. subdomains · url: URL fragment · title: title keyword',
  linked: 'Matches a Chrome group',
  willCreate: 'Not in this window yet — created when needed',
  remove: 'Remove',
  saveGroups: 'Save groups',
  saved: 'Saved',
  savedGroups: 'Saved {n} group(s)',
  dupName: 'Duplicate group name: {name}',
  unsaved: 'Unsaved changes',

  secAI: 'AI connection',
  secAISub: 'Only called when your rules and learned rules can\'t decide. DeepSeek, Zhipu GLM or any OpenAI-compatible API.',
  provider: 'Provider', custom: 'Custom (OpenAI-compatible)', glm: 'Zhipu GLM',
  baseURL: 'Base URL', model: 'Model', apiKey: 'API key',
  threshold: 'Confidence threshold',
  thresholdHint: 'Below this, tabs are not moved but shown as suggestions in the popup',
  neverSend: 'Never send to AI',
  neverSendPh: 'One host per line, subdomains included',
  privacy: 'Only tab title, host and path are sent — no query string, no page content. Your API key stays on this machine.',
  save: 'Save', test: 'Test connection', testing: 'Testing…',
  testOk: 'Connected', testBad: 'Got a reply, but not in the expected format',
  noPermission: 'Permission to reach that Base URL was not granted',

  secBehavior: 'Behavior',
  enabledLabel: 'Auto-sort new and reloaded tabs',
  enabledHint: 'Order: rules learned from your drags → group rules → cached AI answers → AI',
  regroupLabel: 'Re-sort tabs already in a group when they reload',
  regroupHint: 'Off by default: grouped tabs stay where they are',

  secLearned: 'Learned rules',
  secLearnedSub: 'Recorded when you drag a tab into a group (host + first path segment → group); dragging it out removes the rule.',
  learnedEmpty: 'Nothing yet. Drag a few tabs into your groups and they show up here.',
  clearCache: 'Clear cached AI answers',
  cleared: 'Cleared',

  defaultPlan: `Agent (Stable): AI tools and agent platforms, e.g. Claude, ChatGPT, DeepSeek, GLM, the Forge console, agent pages on localhost
Processing: what I'm working on right now, e.g. Mantis bugs I'm on, GitLab MRs I'm reviewing or changing, logs and docs open for the current investigation
Works: day-to-day work that isn't urgent, e.g. GitLab projects and code, Jira, Confluence, internal company systems and tool docs
Pesonal: personal stuff, e.g. Gmail, YouTube, shopping, news, social sites`,
};

const DICTS = { zh, en };

export function resolveLang(pref) {
  if (pref === 'zh' || pref === 'en') return pref;
  return (navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function makeT(lang) {
  const dict = DICTS[lang] || en;
  return (key, vars = {}) => String(dict[key] ?? en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

/** Fill data-i18n* attributes under `root`. */
export function applyI18n(t, lang, root = document) {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
}

export const DEFAULT_PLANS = { zh: zh.defaultPlan, en: en.defaultPlan };
