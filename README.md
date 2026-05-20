# 🌐 DriveTranslate

> A premium Chrome extension that **automatically translates folder and file names inline** on Google Drive and Google Docs — in real time, with zero configuration.

![Extension Icon](icon128.png)

---

## ✨ Features

- **🔄 Auto-Translate on Load** — Translates Chinese (and other language) folder/file names the moment you open Google Drive, with no button to click.
- **🔍 Searchable Language Dropdowns** — Choose your source and target languages from fully searchable, glassmorphic dropdown menus. Just type to filter 100+ languages instantly.
- **🌏 Dynamic Source Language Selection** — Select exactly which language to translate *from* (e.g. Chinese Simplified, Japanese, Korean, Arabic, Russian) — or use **Detect Language** to let the extension auto-detect.
- **📂 SPA Directory Watcher** — Navigating into a subfolder in Google Drive triggers an immediate re-scan and re-translation of the new directory contents.
- **🎨 Premium Glassmorphic UI** — Ultra-sleek dark/light mode popup with smooth micro-animations, custom scrollbars, and a stunning AI-generated extension icon.
- **🔁 Instant Toggle & Restore** — Toggle auto-translate ON/OFF from the popup. Turning it OFF instantly reverts all folder names back to their original text.
- **🛡️ Manifest V3 Compliant** — Fully complies with Chrome's latest security model. No external network requests from the popup, no inline scripts.

---

## 📸 Preview

| Dark Mode | Light Mode |
|-----------|------------|
| Glassmorphic dark popup with searchable dropdowns | Clean light mode with same layout |

---

## 🚀 Installation (Developer Mode)

Since this extension is not yet published to the Chrome Web Store, load it manually:

1. Clone or download this repository:
   ```bash
   git clone https://github.com/buihieu1007/drive-translate.git
   ```

2. Open Google Chrome and navigate to:
   ```
   chrome://extensions/
   ```

3. Enable **Developer mode** using the toggle in the top-right corner.

4. Click **Load unpacked** and select the cloned folder:
   ```
   /path/to/drive-translate
   ```

5. 🎉 **DriveTranslate** will appear in your extensions list and toolbar!

---

## 🛠️ How It Works

### Translation Engine
The extension uses Google's free [translate.googleapis.com](https://translate.googleapis.com) endpoint (the same one powering Google Translate) via a background **Manifest V3 service worker**. Folder names are batched in groups of 25 and sent as a single multi-line request, minimizing API calls and avoiding rate limits.

### DOM Scanner
A `TreeWalker` walks every visible text node on the page and filters for nodes that match the selected source language using Unicode character range regex patterns:

| Language | Unicode Range |
|----------|---------------|
| Chinese (Simplified/Traditional) | `\u4e00–\u9fa5`, `\u3400–\u4dbf` |
| Japanese | `\u3040–\u30ff`, `\u31f0–\u31ff` |
| Korean | `\uac00–\ud7a3` |
| Cyrillic (Russian, Ukrainian…) | `\u0400–\u04ff` |
| Arabic | `\u0600–\u06ff` |
| Devanagari (Hindi…) | `\u0900–\u097f` |
| Greek | `\u0370–\u03ff` |
| Hebrew | `\u0590–\u05ff` |
| Detect Language | All of the above |

### SPA Navigation Watcher
Google Drive is a Single Page Application (SPA) — folder navigation changes the URL without a full page reload. DriveTranslate listens for:
- `popstate` and `hashchange` browser events
- A lightweight `500ms` interval polling `location.href`

When a URL change is detected, the old text node cache is cleared and a fresh translation scan runs immediately.

---

## 📁 File Structure

```
drive-translate/
├── manifest.json        # MV3 extension config, permissions & icon registration
├── background.js        # Service worker: translation proxy via Google Translate API
├── content.js           # Auto-translate engine: TreeWalker, MutationObserver, URL watcher
├── content.css          # Page-level injected styles
├── popup.html           # Extension popup UI markup
├── popup.css            # Glassmorphic dark/light styles, searchable dropdown design
├── popup.js             # Dropdown logic, search filter, storage sync, theme toggle
├── languages.js         # ISO language code → name database (100+ languages)
├── icon16.png           # 16×16 toolbar icon
├── icon32.png           # 32×32 icon
├── icon48.png           # 48×48 extension card icon
└── icon128.png          # 128×128 high-res icon
```

---

## ⚙️ Settings

All settings are persisted via `chrome.storage.local` and automatically sync across tabs:

| Setting | Default | Description |
|---------|---------|-------------|
| **Translate From** | Detect Language | Source language to scan for |
| **Translate To** | English | Target language to translate into |
| **Auto-Translate Folders** | ON | Enable/disable automatic inline translation |
| **Theme** | Dark | Dark or light mode popup |

---

## 🔧 Supported Sites

| Site | Support |
|------|---------|
| `drive.google.com` | ✅ Full support (all frames) |
| `docs.google.com` | ✅ Full support (all frames) |

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

## 🙏 Acknowledgements

- Translation powered by [Google Translate](https://translate.google.com)
- Extension icon generated with AI image generation
- Built with pure HTML, CSS, and JavaScript — zero external dependencies
