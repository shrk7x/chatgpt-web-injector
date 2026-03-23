# Findings

## 2026-03-06

### Repository Baseline
- Existing files already cover a thin MV3 scaffold: `manifest.json`, `src/service_worker.js`, and placeholder `options/options.html`.
- `src/service_worker.js` currently creates the context menu and only logs the selected text payload.
- No `package.json`, test runner, or automated verification exists yet.
- Options UI is still a placeholder and does not load or save template data.

### Product and Spec Findings
- `PRD.md` and `TECH_SPEC.md` both confirm the MVP scope: single default template, variables `{{selection}}`, `{{title}}`, `{{url}}`, always open ChatGPT in a new tab, auto-send by default, manual copy modal as fallback.
- Empty selection must still render and proceed.
- Built-in fallback template is English and should be used whenever the saved template is blank.

### Open Issues Snapshot
- Issue #1: MV3 scaffold plus context menu exists partially; logging works but the full runtime flow does not.
- Issue #2: options page, template storage, reset behavior, and variable help text are still missing.
- Issue #3: new-tab open, composed prompt injection, auto-send, and failure fallback are still missing.

### MV3 API Guidance
- Recommended runtime chain: `contextMenus.onClicked` -> `tabs.create` -> wait for the specific tab to reach `changeInfo.status === "complete"` -> `scripting.executeScript` -> `tabs.sendMessage` or injected function execution.
- `chrome.scripting.executeScript` requires the `scripting` permission and host access for `https://chatgpt.com/*`.
- `tabs.create()` does not require the `tabs` permission, though the current manifest already includes it.
- Main pitfalls to avoid: sending messages before the content script exists, failing to filter `tabs.onUpdated` by `tabId`, leaking listeners, relying on `activeTab` for the new ChatGPT tab, and over-requesting permissions.

### Implementation Findings (Current Branch)
- Added a lightweight Node test harness (`node --test`) plus `jsdom` for DOM-level unit tests.
- Introduced shared modules:
  - `src/template.js` for default template, blank fallback behavior, and variable rendering
  - `src/storage.js` for template load/save/reset via `chrome.storage.sync`
  - `src/chatgpt_content.js` for tested selector-based injection and send behavior
- Implemented options UI (`options/options.html`, `options/options.js`, `options/options.css`) with save/reset and variable hints.
- Extended service worker runtime to:
  - render prompt from source context
  - open ChatGPT in a new tab
  - wait for tab completion
  - execute in-page injection and send attempt
  - display manual fallback modal with copy support when needed
- Automated tests currently pass (`5/5`), covering template behavior and DOM injection helper behavior.
