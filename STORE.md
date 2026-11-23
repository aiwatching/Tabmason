# Chrome Web Store submission kit

Everything needed to publish Tabmason, field by field as the Developer Dashboard asks for it.

## 1. Package

```bash
scripts/package.sh          # → dist/tabmason-<version>.zip (manifest.json, src/, icons/*.png)
```

Bump `version` in `manifest.json` before every new upload; the store rejects a version it has seen.

## 2. Store listing tab

| Field | Value |
|---|---|
| Name | Tabmason (from the manifest) |
| Summary | from the manifest `description` (≤ 132 chars) |
| Category | Productivity → Workflow & Planning |
| Language | English (default); add Chinese (Simplified) as a localized listing |
| Store icon | `icons/icon128.png` (96 px artwork, 16 px transparent padding) |
| Screenshots (1280×800) | `store/en/screenshot-1…4-*.png` (Chinese listing: `store/zh/…`) |
| Small promo tile (440×280) | `store/<lang>/promo-small-440x280.png` |
| Marquee (1400×560, optional) | `store/<lang>/promo-marquee-1400x560.png` |
| Homepage URL | https://github.com/aiwatching/Tabmason |
| Support URL | https://github.com/aiwatching/Tabmason/issues |

### Detailed description (English)

```
Tabmason keeps your Chrome tabs in the groups you define — automatically.

SORT TABS INTO YOUR OWN GROUPS
• Describe your groups in plain words ("Work: boards, repos, docs…") and let AI draft them, or import the groups you already have.
• New and reloaded tabs go into those groups. Tabmason never invents a group.
• It decides by your rules first, then by what it learned when you dragged a tab into a group, and only then asks an AI model you choose. Unsure answers become suggestions instead of moves.
• Every automatic move can be undone from the popup.

MARK TABS WITH COLORS AND NOTES
• Give any tab a color and a one-line note — or an AI summary of the page.
• The tab's icon gets a colored ring (and optionally a colored dot in the title), so you can spot it even when tabs shrink to icons. Notes can be shown in Chrome's tab hover card.

SEE EVERY TAB AT A GLANCE
• The overview page (Alt+Shift+O) shows all open tabs as thumbnails, grouped like your tab strip, with search across titles, URLs and notes.

SNAPSHOTS
• All windows, tabs and groups are saved every 10 minutes, and whenever you click "Save now".
• Restore after a restart or a crash; groups and pinned tabs come back, and tabs load only when you open them.

AI ON YOUR TERMS
• Works without AI: rules and learned rules do most of the sorting.
• Bring your own key: DeepSeek, Zhipu GLM, OpenAI or any OpenAI-compatible endpoint.
• Only tab titles and hosts are sent for sorting — never page content, unless you ask for a summary. Hosts you list are never sent.
• Token usage is tracked per day on the settings page.

PRIVATE BY DESIGN
• No account, no server, no tracking. Everything stays in your browser; requests go straight from your browser to the AI provider you configured.

Chinese and English interface.
```

### Detailed description (中文)

```
Tabmason 把 Chrome 标签页自动放进你定义的分组。

按你的分组自动归类
• 用一句话描述你的分组（“工作：看板、代码仓库、文档……”），让 AI 生成；或直接导入现有的组。
• 新开和刷新的标签页自动进入这些组，绝不自己新建组。
• 先按你的规则，再按你拖拽时学到的习惯，最后才问你选的 AI；没把握的只给建议，不乱动。
• 每次自动移动都可以在弹窗里撤销。

给标签页加颜色和备注
• 任何标签页都能加颜色和一句备注，也可以让 AI 生成页面概要。
• 网站图标外会加一圈颜色（可选在标题前加彩色圆点），标签窄到只剩图标也能一眼认出；备注可以显示在鼠标悬停卡片里。

所有标签页一目了然
• 概览页（Alt+Shift+O）把所有标签页按组排成缩略图，可以搜索标题、网址和备注。

快照
• 每 10 分钟自动保存所有窗口的标签页和分组，也可以随时手动保存。
• 重启或崩溃后一键恢复，分组和固定标签都会还原，未打开的标签页点开才加载。

AI 由你掌控
• 不用 AI 也能用：规则和学到的习惯能完成大部分归类。
• 使用你自己的 key：DeepSeek、智谱 GLM、OpenAI 或任何 OpenAI 兼容接口。
• 归类只发送标签页标题和域名，不发页面内容（除非你点 AI 概要）；指定的域名永远不发送。
• 设置页按天统计 token 用量。

隐私
• 无账号、无服务器、无追踪。数据都在你的浏览器里，AI 请求直接从浏览器发给你配置的服务商。

支持中文和英文界面。
```

## 3. Privacy tab

**Single purpose**

> Tabmason organizes the user's browser tabs: it sorts them into user-defined tab groups, lets the user mark tabs with colors and notes, shows an overview of open tabs, and saves/restores snapshots of open windows.

**Permission justifications**

| Permission | Justification |
|---|---|
| `tabs` | Read tab URLs and titles to sort tabs into the user's groups, list them in the overview and save snapshots. |
| `tabGroups` | Create, find and update the user's tab groups when sorting tabs and restoring snapshots. |
| `storage` | Keep the user's groups, rules, marks, snapshots and settings locally. |
| `scripting` | Read a page's visible text when the user clicks "AI summary", and add the mark display to tabs that were open before installation. |
| `favicon` | Show site icons in the overview and draw the colored mark ring around a tab's icon. |
| `unlimitedStorage` | Store tab thumbnails and snapshots locally without hitting the default quota. |
| `alarms` | Save a snapshot of open windows every 10 minutes. |
| Host permission `<all_urls>` | Show the user's mark on any page's tab (favicon ring, title), capture thumbnails of pages the user views for the overview, fetch site icons, and reach the AI endpoint the user configures. Pages are not read or changed for any other purpose. |

**Remote code:** No, I am not using remote code.

**Data usage** — check:
- **Web history** (tab titles and URLs are sent to the AI provider the user configures, for sorting)
- **Website content** (page text is sent to that provider when the user asks for an AI summary)

Certify all three: not sold to third parties; not used or transferred for purposes unrelated to the single purpose; not used to determine creditworthiness or for lending.

**Privacy policy URL:** https://github.com/aiwatching/Tabmason/blob/main/PRIVACY.md

## 4. Submit

1. Register at https://chrome.google.com/webstore/devconsole (one-time USD 5 fee).
2. **New item** → upload `dist/tabmason-<version>.zip`.
3. Fill the Store listing and Privacy tabs from this file; Distribution: Public, all regions.
4. **Submit for review.** Extensions with access to all sites usually get a longer, manual review (days rather than hours).

## Regenerating graphics

- Icons: `node scripts/render-icons.mjs <chrome-binary> <dir containing node_modules/puppeteer>` renders `icons/icon.svg` (and the pixel-tuned `icons/icon16.svg`) to `icons/icon{16,32,48,128}.png`.
- Screenshots and promo tiles in `store/` were captured from the packaged extension running on demo pages, then framed at 1280×800, 440×280 and 1400×560.
