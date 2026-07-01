# ChatGPT Web Injector

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4)
![Status](https://img.shields.io/badge/status-v0.1--planning-blue)

A local-first Chrome extension that sends selected webpage content into ChatGPT with reusable prompt templates.

## Why this exists

If you often do this loop:

1. Select text on a webpage
2. Copy
3. Open ChatGPT
4. Paste
5. Add your analysis prompt manually

...this extension removes most of that friction.

## Core idea (v0.1)

- Select text on any webpage
- Right-click: **Send to ChatGPT**
- Extension composes: `template + selection + page context`
- Opens ChatGPT in a **new tab**
- Attempts auto inject + auto send
- If injection fails, shows a manual copy modal fallback

No backend, no API key, no database.

---

## Features (v0.1)

- Context menu trigger (`Send to ChatGPT`)
- Local template system (editable in Options)
- Template variables:
  - `{{selection}}`
  - `{{title}}`
  - `{{url}}`
- New-tab workflow
- Auto-send default behavior
- Manual copy fallback modal on injection failure

---

## YouTube Helper & Subtitle Downloader (v0.0.18)

A built-in suite that enables you to summarize YouTube videos, interact with transcript panels, and download subtitles directly from video player controls.

- **Zero-intrusive Native Buttons**: Minimalist icons and controls (AI Summary, Transcript, Download Subtitles) are injected right next to the YouTube player's `CC` button, blending perfectly with native player aesthetics.
- **Intelligent Button Visibility**: Automatically detects caption availability asynchronously upon video load. If a video does not have any captions (such as live streams or uploads without CC), all injected summary/download buttons are cleanly removed, preventing UI clutter and user frustration.
- **Robust Single-Page-App (SPA) Navigation**: Utilizes request tracking (`latestCaptionCheckId`) and video ID checks to prevent stale UI states and race conditions when users navigate continuously between multiple videos without reloading the page.
- **Dual Format Offline Download**: Clicking the download button displays a sleek popover menu providing two formats:
  - **`SRT`**: High-precision SubRip format with accurate millisecond timestamps (`00:00:12,345`), sorted chronologically.
  - **`TXT`**: Clean reader format with all timestamps and redundant linebreaks stripped, perfect for pasting directly into LLMs.
- **100% Robust Fallback Chain & Expanders**: Heavy-duty extraction workflow powered by the timedtext API, InnerTube API, and direct DOM segment extraction. Includes compatibility layers that automatically expand modern YouTube description elements (`ytd-text-inline-expander`) and guard structured panels to locate native subtitle endpoints reliably.
- **Memory Leak Protection**: Event listeners are carefully bound in the capture phase for reliability and automatically detached on menu closures, with FIFO limits applied to local states to keep long-running browser tabs lightweight.

---

## Product decisions (frozen)

- Auto-send: **ON**
- Variables: `selection + title + url`
- Open behavior: **always new tab**
- Multi-model: **reserved for future** (Gemini/Claude)
- Default template language: **English**
- Empty selection: **allowed**
- Injection failure fallback: **manual copy modal**
- Launch: **GitHub open-source first**

---

## Installation (Developer mode)

1. Clone this repository
2. Open Chrome -> `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select this project folder

---

## Usage

1. Open any webpage
2. Select any text (or none, if intentional)
3. Right-click -> **Send to ChatGPT**
4. Review/continue in ChatGPT

---

## Options

Open extension options to edit your default template.

Example template:

```text
You are a precise analysis assistant.

Source title: {{title}}
Source URL: {{url}}

Selected content:
{{selection}}

Please provide:
1) Key conclusion
2) Potential logic gaps
3) Confidence level
```

---

## Privacy

- Local-first design
- No custom server
- No analytics in v0.1
- Settings stored in `chrome.storage.sync`

---

## Known limitations

- ChatGPT DOM changes may break auto injection temporarily
- Browser security/permission constraints may affect behavior on some pages
- Auto-send reliability can vary with target UI changes

---

## Roadmap

### v0.2
- Multiple templates
- Optional keyboard shortcut
- Optional “inject only” mode
- Basic target switcher (ChatGPT / Gemini / Claude)

### v0.3
- Rich template variables
- Better target adapters
- Store-ready UX polishing

---

## Project docs

- Product requirements: `PRD.md`
- Technical specification: `TECH_SPEC.md`

---

## Contributing

Issues and PRs are welcome.

If you find a selector break due to UI updates, please open an issue with:
- browser version
- target page URL
- screenshot (if possible)
- expected vs actual behavior

---

## License

TBD (MIT recommended)
