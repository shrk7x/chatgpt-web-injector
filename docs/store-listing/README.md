# Chrome Web Store listing refresh

Prepared for version 0.1.1 on 2026-11-01. The public listing still shows 0.0.17;
0.1.1 was submitted and is pending Google review.

## Fields

- Name: keep `ChatGPT Web Injector`.
- Detailed description: `description-en-US.txt` (plain text, ready to paste).
- Chinese reference: `description-zh-CN-reference.txt`; do not add a Chinese locale unless intentionally supported by the listing.
- Package summary: `summary-en-US.txt`, 111 characters. This field comes from `manifest.json`; it changes only with a new package release.
- Homepage, support, privacy policy, source license: `links.json`.
- Keep existing category and default language.
- Keep the existing promotional video until a replacement has been reviewed.

## Screenshots

Upload the five files in numeric order from `screenshots/`. Each is a 1280 × 800,
24-bit RGB PNG without an alpha channel. Do not include developer-dashboard
captures, account settings, or private user pages.

| File | Demonstrates |
|---|---|
| 01-youtube-tools.png | Actual extension controls on a public YouTube video |
| 02-subtitle-download.png | Actual SRT/TXT download menu |
| 03-youtube-template.png | Video prompt customization and Temporary Chat setting |
| 04-selection-templates.png | Example reusable prompts and template editor |
| 05-web-selection.png | Actual floating selection button on an authored example article |

## Capture provenance

All screenshots were taken in a new isolated, signed-out browser context named
`store-assets-anonymous`. No cookies, accounts, saved templates, browsing history,
or conversations were copied from the owner's browser. Only public video content,
example prompts, and a freshly authored example article were used.

Options screenshots render the repository's actual HTML/CSS/JS with an in-memory
Chrome storage adapter populated with example templates. The selection screenshot
runs the actual selection content script and stylesheet on the example article.
The YouTube shots render the actual repository controls on the public video
https://www.youtube.com/watch?v=aircAruvnKk . The capture harness provides a no-op
runtime transport and uses a page-local Trusted Types wrapper for the extension's
static markup, because the signed-out inspection browser has no unpacked extension
installed. The player is cued/paused and its controls are shown for capture.
These screenshots demonstrate the interface; they are not evidence of a live
ChatGPT submission, subtitle download, or successful media playback. No generated
ChatGPT answer was invented or used in the screenshots.

## Changes from the old listing

- Replace the public "will be open sourced soon" claim with the public MIT source URL.
- Replace the ambiguous "no login required" claim with "no separate extension account or API key" and disclose ChatGPT requirements.
- Replace "no data stored" with accurate Chrome synchronized-settings and user-initiated transfer wording.
- Cover all current capabilities: YouTube prompts, transcript panel, SRT/TXT export,
  selection actions, optional floating button, multiple templates, and Temporary Chat.
- Replace the old owner alias in the privacy link with the canonical source owner.
- Fill the currently empty homepage and support fields with the repository and Issues page.

## Submission

The store editor was locked during the 0.1.1 review: description, images and links
were disabled. Save these changes when editing is available, then submit them for
Google review. Withdrawing the current review to edit and resubmit restarts that
review; decide this explicitly rather than assuming the existing submission can
be changed in place. Do not describe a saved draft as publicly published.

References:
- https://developer.chrome.com/docs/webstore/images
- https://developer.chrome.com/docs/webstore/best-listing
