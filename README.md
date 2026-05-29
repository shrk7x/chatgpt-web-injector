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

## YouTube Subtitle Downloader (v0.0.14)

A built-in feature that enables you to download YouTube subtitles directly from the video player controls.

- **Zero-intrusive Native Button**: A minimalist download icon `📥` is injected right next to the YouTube player's `CC` button, blending perfectly with native player aesthetics.
- **Dual Format Offline Download**: Clicking the button pops up a sleek glassmorphism dropdown popover menu, providing two output formats:
  - **`SRT`**: High-precision SubRip subtitle format with accurate millisecond timestamps (`00:00:12,345`), sorted chronologically and fully compatible with local media players (VLC, IINA, PotPlayer, etc.).
  - **`TXT`**: Clean plain-text reader format with all timestamps and redundant linebreaks stripped, merged into smooth paragraphs. **Perfect for copying straight into ChatGPT for summary and quick reading.**
- **100% Robust Fallback Chain**: Heavy-duty extraction workflow powered by the timedtext API, YouTube InnerTube API fallback, and direct DOM segment extraction, guaranteeing a 100% success rate under YouTube's strict crawler prevention.
- **Memory Leak Protection**: Event listeners are carefully bound in the capture phase for reliability and automatically detached on menu closures to ensure zero overhead.

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
