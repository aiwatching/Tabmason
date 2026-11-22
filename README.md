# Tabmason

Smart tab management for Chrome: group, tidy and park your tabs.

## Status

0.1.0 skeleton (Manifest V3, plain JavaScript, no build step):

- **Group by domain**: tabs from the same site go into one collapsed group (popup, or `Alt+Shift+G`).
- **Close duplicates**: closes tabs with the same URL in the current window.

## Run it locally

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. Pin Tabmason from the extensions menu and open the popup.

After editing a file, press the reload button on the Tabmason card.

## Layout

```
manifest.json          extension manifest (MV3)
src/background.js      service worker: tab actions + keyboard command
src/popup/             toolbar popup
src/options/           options page (placeholder)
icons/                 placeholder icons
```
