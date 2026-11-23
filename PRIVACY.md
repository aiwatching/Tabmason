# Tabmason Privacy Policy

_Last updated: 2026-11-22_

Tabmason is a Chrome extension that sorts tabs into groups you define, lets you mark tabs with colors and notes, shows an overview of your open tabs, and saves snapshots of your windows. This policy explains what data it handles and where that data goes.

## Summary

- Tabmason has **no server**. The developer does not receive, collect, sell or share any of your data.
- Everything Tabmason stores stays **in your browser**, on your device.
- Data leaves your device only when **you** configure an AI provider, and only to **that provider**, as described below.

## Data stored on your device

Kept in Chrome's local extension storage and IndexedDB, never uploaded by Tabmason:

| Data | Why |
|---|---|
| Your group definitions (names, colors, descriptions, rules) | To sort tabs into your groups |
| Rules learned from your drags (host + first path segment → group) and cached AI answers | So the same kind of page is sorted without asking the AI again |
| Tab marks (page URL, color, note) | To show your marks and notes |
| Tab thumbnails (small JPEG screenshots of pages you viewed) | For the overview page; deleted after 7 days once the page is closed |
| Snapshots (URLs, titles, groups and pinned state of your open tabs) | So you can restore your windows; the newest 24 automatic ones are kept |
| AI settings, including your API key | To call the AI provider you chose |
| AI token usage per day | To show you how much AI you use |

You can remove all of it by removing the extension, or individually from the extension's settings and popup.

## Data sent to an AI provider (optional)

AI features are **off until you enter an API key** for a provider you choose (for example DeepSeek, Zhipu GLM, OpenAI, or any OpenAI-compatible endpoint). Requests go **directly from your browser to that provider**; Tabmason's developer never sees them. The provider's own privacy policy applies to what it receives.

- **Auto-sorting a tab** (only when your own rules and learned rules can't decide): the tab's **title, host and path** (no query string, no page content), plus the names and descriptions of your groups and the titles/hosts of a few tabs already in them as examples.
- **Generating groups from your description** (when you click the button): your description text, and the names and a few tab titles/hosts of your current groups.
- **AI summary of a page** (only when you click "AI summary" for that tab): the page's title, URL without query string, meta description and up to 4,000 characters of its visible text.

Hosts you list under **"Never send to AI"** are never sent for auto-sorting or summaries (by default `localhost` and `127.0.0.1`).

## Permissions

Tabmason asks for access to all websites so it can show your mark on a page's tab (favicon ring and title), capture thumbnails of pages you view for the overview, and read a page's text when you ask for an AI summary. It does not read or change pages for any other purpose.

## Changes

Changes to this policy are published in this file in the project repository: https://github.com/aiwatching/Tabmason/blob/main/PRIVACY.md

## Contact

Questions or requests: open an issue at https://github.com/aiwatching/Tabmason/issues

---

# Tabmason 隐私政策（中文）

Tabmason 是一个 Chrome 扩展：把标签页自动放进你定义的分组、给标签页加颜色和备注、概览所有标签页、保存窗口快照。

- **Tabmason 没有服务器**。开发者不会收到、收集、出售或分享你的任何数据。
- Tabmason 保存的所有数据都**只在你的浏览器里**（分组定义、学到的规则、标记和备注、缩略图、快照、AI 设置和 API key、token 用量）。卸载扩展即全部删除。
- **只有在你填写了 AI 服务商的 API key 之后**，数据才会离开你的设备，并且**直接从浏览器发给你选的服务商**（如 DeepSeek、智谱 GLM、OpenAI 或其他兼容接口），开发者看不到：
  - 自动归类（规则判断不了时）：标签页的标题、域名和路径（不含参数和页面内容），以及你的分组名称、描述和组内几个标签页的标题/域名作为示例；
  - AI 生成分组（你点按钮时）：你写的描述，以及当前分组的名称和几个标签页的标题/域名；
  - AI 概要（你对某个标签页点按钮时）：该页面的标题、不含参数的网址、描述和最多 4000 字的正文。
- “不发给 AI 的域名”里的网站永远不会发送（默认 `localhost`、`127.0.0.1`）。
- 访问所有网站的权限只用于：在标签上显示你的标记、为概览页截取你看过的页面缩略图、在你要求时读取页面正文生成概要。

问题和请求请在 https://github.com/aiwatching/Tabmason/issues 提出。
