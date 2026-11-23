# Tabmason

Smart tab management for Chrome: group, tidy and park your tabs.

## Status

0.4.0 (Manifest V3, plain JavaScript, no build step):

- **Auto-grouping into your own groups**: when a tab finishes loading, Tabmason puts it into one of the groups *you* defined. It never invents groups.
  Decision order: rules learned from your manual drags → your group rules → cached AI answers → AI (DeepSeek / GLM / any OpenAI-compatible API).
  Low-confidence AI answers become suggestions in the popup instead of moves.
- **Define groups in words**: on the options page, describe your groups in plain text; the AI turns it into group profiles (name, color, description, rules) that you review and save. Or import the named groups of the current window.
- **Learns from you**: drag a tab into one of your groups and Tabmason remembers `host/first-path-segment → group`; drag it out and that rule is forgotten.
- **Popup**: auto on/off, organize ungrouped tabs in this window, AI suggestions, recent moves with undo.
- **Mark a tab**: from the popup, give the current tab a color and a one-line note (or an AI summary, which sends the page text only when you click). The tab's icon gets a colored ring and, optionally, its title a colored dot, so you can spot it even when tabs shrink to icons. Marks are keyed by URL and survive restarts.
- **Overview page** (popup button or `Alt+Shift+O`): every open tab as a thumbnail card, grouped like your tab strip, with search and marks/notes. Thumbnails are captured locally whenever you view a tab; "Fill in thumbnails" visits the rest once.
- **Snapshots**: all windows (tabs, groups, pinned) are saved every 10 minutes (skipped when nothing changed; the last 24 are kept), and on demand from the popup. Restore one after a restart or a crash; restored tabs load only when you click them.
- **AI usage**: real token counts per day and per purpose on the options page.
- **Chinese / English UI**, switchable on the options page (defaults to the browser language).
- **Group by domain** (`Alt+Shift+G`) and **Close duplicates**, as before.

Only tab title, host and path go to the AI (no query string, no page content); hosts in the "never send" list stay local.

## Run it locally

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. Pin Tabmason from the extensions menu and open the popup.

After editing a file, press the reload button on the Tabmason card.

## Layout

```
manifest.json          extension manifest (MV3)
src/background.js      service worker: message handlers, keyboard command
src/auto/engine.js     auto-grouping: tab events, batching, moving, learning from drags
src/auto/classifier.js rules / learned / cache / AI classification, text -> group plan
src/lib/llm.js         OpenAI-compatible chat client
src/sw/marks.js        ringed favicons, AI page summaries, content-script sync
src/sw/thumbnails.js   thumbnail capture and "fill in thumbnails"
src/sw/snapshots.js    snapshots: periodic and manual save, restore
src/content/mark.js    content script: shows a tab's mark (favicon ring, title dot)
src/overview/          tab overview page
src/lib/marks.js       tab marks storage
src/lib/thumbs.js      thumbnails in IndexedDB
src/lib/store.js       chrome.storage helpers and defaults
src/lib/i18n.js        zh / en strings
src/ui/theme.css       shared design tokens and components
src/popup/             toolbar popup
src/options/           groups, AI and learned-rule settings
icons/                 placeholder icons
```
