# ChatGPT Web Injector

![Version](https://img.shields.io/badge/version-0.0.18-blue)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4)

A Chrome extension that brings AI tooling directly into your browser — from YouTube video summaries to quick ChatGPT prompts.

---

## Features

### 🎬 YouTube AI Helper

Injected controls appear next to the YouTube player's CC button — no extra clicks needed.

- **AI Summary**: Opens a ChatGPT tab pre-loaded with the full video transcript, ready to summarize or ask questions.
- **Transcript Panel**: Toggles the native YouTube transcript sidebar.
- **Download Subtitles**: Choose your format from a popover:
  - **SRT** — precise SubRip format with millisecond timestamps (`00:00:12,345`), sorted chronologically. Good for subtitle editors or archiving.
  - **TXT** — timestamps stripped, clean plain text. Ideal for pasting directly into LLMs.
- Buttons auto-hide when a video has no captions (live streams, uncaptioned uploads), so there's never UI clutter.
- Handles YouTube's single-page navigation — no stale buttons or race conditions when switching between videos.

### 📋 Prompt Templates

Edit your default prompt template from the extension's Options page.

Available variables:

| Variable | Description |
|---|---|
| `{{selection}}` | The text you selected |
| `{{title}}` | Page title |
| `{{url}}` | Page URL |

Example template:

```
You are a precise analysis assistant.

Source: {{title}}
URL: {{url}}

Selected content:
{{selection}}

Please provide:
1) Key conclusion
2) Potential logic gaps
3) Confidence level
```

### 🖱️ Send Selection to ChatGPT

Two ways to trigger:

- **Right-click** any selected text → **Send to ChatGPT**
- **Hover button** (BOT): appears near your cursor when you select text on any page

Both open ChatGPT in a new tab, inject the composed prompt, and auto-send. If injection fails, a manual copy modal appears as a fallback.

---

## Installation

1. Clone this repository
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select this project folder

---

## Privacy

- No backend, no API key, no analytics
- Settings stored locally via `chrome.storage.sync`
- Nothing leaves your browser except what you send to ChatGPT

---

## Contributing

Issues and PRs are welcome.

If a selector breaks due to a YouTube or ChatGPT UI update, please open an issue with:
- Browser version
- Page URL
- Screenshot (if possible)
- Expected vs actual behavior

---

## License

MIT
