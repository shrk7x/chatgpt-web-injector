# YouTube Caption Summary Implementation Plan

**Goal:** Add a YouTube-only caption summary button that uses a dedicated editable prompt template and sends the rendered prompt to ChatGPT automatically.

**Architecture:** Add a small YouTube content script for button placement and caption extraction, then reuse the existing service worker ChatGPT send flow. Keep the YouTube Summary template separate from the existing selection templates so normal selection behavior is unchanged.

**Tech Stack:** Chrome Extension Manifest V3, plain JavaScript ESM where supported, DOM APIs, `chrome.storage.sync`, `chrome.scripting.executeScript`, Node built-in test runner, jsdom.

### Task 1: Template Rendering

**Files:**
- Modify: `src/template.js`
- Test: `tests/template.test.js`

**Steps:**
1. Write failing tests for rendering `{{transcript}}` while preserving existing `{{selection}}`, `{{title}}`, and `{{url}}`.
2. Run `node --test tests/template.test.js` and confirm the new test fails because `{{transcript}}` is not replaced.
3. Add minimal transcript variable replacement to `renderTemplate`.
4. Run `node --test tests/template.test.js` and confirm it passes.

### Task 2: YouTube Summary Template Storage

**Files:**
- Modify: `src/storage.js`
- Test: `tests/storage.test.js`

**Steps:**
1. Write failing tests for loading, saving, and resetting a dedicated YouTube Summary template.
2. Run `node --test tests/storage.test.js` and confirm exports are missing.
3. Implement `DEFAULT_YOUTUBE_SUMMARY_TEMPLATE`, `loadYoutubeSummaryTemplate`, `saveYoutubeSummaryTemplate`, and `resetYoutubeSummaryTemplate`.
4. Run `node --test tests/storage.test.js` and confirm it passes.

### Task 3: YouTube Transcript Helpers

**Files:**
- Create: `src/youtube_transcript.js`
- Test: `tests/youtube_transcript.test.js`

**Steps:**
1. Write failing tests for caption track selection and XML transcript cleanup.
2. Run `node --test tests/youtube_transcript.test.js` and confirm module/export failure.
3. Implement defensive helpers for choosing the active/default caption track and parsing transcript XML.
4. Run `node --test tests/youtube_transcript.test.js` and confirm it passes.

### Task 4: Service Worker Message Flow

**Files:**
- Modify: `src/service_worker.js`
- Test: syntax check only unless message flow is refactored into testable pure functions.

**Steps:**
1. Add `YOUTUBE_SUMMARY_SEND` handling that renders the dedicated YouTube Summary template.
2. Reuse the existing ChatGPT open-tab and injection flow.
3. Run `node --check src/service_worker.js`.

### Task 5: YouTube Content Script UI

**Files:**
- Create: `src/youtube_summary.js`
- Create: `src/youtube_summary.css`
- Modify: `manifest.json`

**Steps:**
1. Add a YouTube-specific content script matched to `https://www.youtube.com/*`.
2. Insert a compact summary button near player controls on watch pages.
3. On click, extract title, URL, and transcript, then send `YOUTUBE_SUMMARY_SEND`.
4. Show a short failure message when captions are unavailable.
5. Run `node --check src/youtube_summary.js` and verify manifest paths exist.

### Task 6: Options UI

**Files:**
- Modify: `options/options.html`
- Modify: `options/options.js`
- Modify: `options/options.css`

**Steps:**
1. Add a separate YouTube Summary Template editor.
2. Wire save and reset to dedicated storage helpers.
3. Run `node --check options/options.js`.

### Task 7: Verification and PR

**Steps:**
1. Run `npm test`.
2. Run `node --check` for every changed JavaScript file.
3. Commit with a Conventional Commit message.
4. Push the branch.
5. Open a PR with `closes #26`.
