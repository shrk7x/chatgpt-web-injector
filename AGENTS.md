# AGENTS Guide

## Scope
- Chrome Extension (Manifest V3), plain JavaScript, no bundler, no TypeScript.
- Make the smallest safe change that satisfies the current request.
- Do not add permissions, dependencies, or files unless the task explicitly requires them.

## Repository Map
```
manifest.json               - Extension entrypoint, permissions, service worker, content scripts
src/service_worker.js       - Background: context menu, message routing, open-tab + inject flow
src/chatgpt_content.js      - Injected into chatgpt.com: text injection + auto-send logic
src/selection_tooltip.js    - Content script on all pages: floating BOT button on text selection
src/selection_tooltip.css   - Styles for the floating tooltip button
src/storage.js              - chrome.storage.sync helpers: load/save/reset templates
src/template.js             - Template rendering: DEFAULT_TEMPLATE, renderTemplate, getEffectiveTemplate
options/options.html        - Options page UI
options/options.js          - Options page logic: load/save/reset template via storage.js
options/options.css         - Options page styles
tests/template.test.js      - Unit tests for template.js
tests/chatgpt_content.test.js - Unit tests for chatgpt_content.js (DOM-level via jsdom)
package.json                - Test runner only (node --test), devDependency: jsdom
```

## Build / Run / Test Commands
- **No build step.** Load the repo root as an unpacked extension directly in Chrome.
- **Run all tests:** `npm test`
- **Run a single test file:** `node --test tests/template.test.js`
- **Syntax check any JS file:** `node --check src/service_worker.js`
- **Open Extensions page (macOS):** `open -a "Google Chrome" chrome://extensions`
- No lint command exists. No formatter config exists.

## Release Process
- This project uses **release-please** to automate releases.
- **When to release:** Merging a feature PR to `main` updates a "Release PR". Merging the Release PR triggers the full release.
- **Changelog:** Automatically generated from commit messages (use Conventional Commits like `feat:`, `fix:`).
- **Artifacts:** A `.zip` file of the extension is automatically generated and attached to each GitHub Release.
- **Version Bumping:** `manifest.json` and `package.json` are automatically updated by the release workflow.
- **Manual Publish:** Currently, publishing to the Chrome Web Store is done manually using the generated zip artifact.

## Manual Verification Checklist
After any code change, reload the unpacked extension then verify:
1. Extension loads with no errors in `chrome://extensions`.
2. Select text on any page → BOT button appears near mouse cursor.
3. Click BOT button → ChatGPT opens in a new tab, prompt is injected, message is sent automatically.
4. Right-click selected text → "Send to ChatGPT" context menu item appears and works.
5. Options page opens and saves/resets templates correctly.
- **Important:** After reloading the extension, refresh any open tabs before testing content script behavior. Old tabs have an invalidated extension context and `chrome.runtime.sendMessage` will throw.

## Architecture Notes
- Service worker (`src/service_worker.js`) is an ES module (`"type": "module"` in manifest).
- Content scripts (`selection_tooltip.js`) are NOT ES modules — they cannot use `import`. They run in an isolated world but share the page DOM.
- `chatgpt_content.js` is injected programmatically via `chrome.scripting.executeScript` by the service worker — it is not declared as a content script in the manifest.
- Event listeners in content scripts use **capture phase** (`true` as 3rd arg) for reliable detection on React/framework pages.
- `chrome.runtime` is `undefined` or throws `Extension context invalidated` in orphaned content scripts (tab open before extension reload). Always guard with `chrome?.runtime?.sendMessage` and wrap calls in `try/catch`.

## Editing Rules
- Preserve MV3 compatibility. Do not use MV2 APIs.
- Keep `permissions` and `host_permissions` minimal. Current: `contextMenus`, `storage`, `tabs`, `scripting`, `activeTab`, `https://chatgpt.com/*`, `<all_urls>`.
- Any new JS file wired via manifest must physically exist before committing.
- Do not introduce a bundler, TypeScript, or framework without explicit instruction.
- After any manifest edit, re-verify all referenced paths exist.

## JavaScript Style
- **Indentation:** 2 spaces.
- **Semicolons:** always.
- **Quotes:** single quotes in JS; double quotes in JSON/HTML attributes.
- **Variables:** `const` by default; `let` only when reassignment is needed. No `var`.
- **Constants:** `UPPER_SNAKE_CASE` for stable module-level identifiers (e.g. `TOOLTIP_ID`, `MENU_ID`).
- **Functions/variables:** `camelCase` (e.g. `createTooltip`, `selectionText`).
- **Files:** named by responsibility (`storage.js`, `template.js`, `chatgpt_content.js`).
- **Functions:** small, single responsibility. Use early returns for guard clauses.
- **Arrow functions:** preferred for callbacks and short helpers.
- **Async:** `async/await` over raw Promise chains. Always `await` before accessing results.

## Imports and Modules
- Service worker and `src/*.js` shared modules use ESM (`import`/`export`).
- Content scripts declared in manifest cannot use `import` — keep them self-contained.
- Use relative paths: `import { foo } from './template.js'`.
- No dynamic imports unless there is a clear need.

## Error Handling and Logging
- Wrap all `chrome.runtime.sendMessage` calls in `try/catch` — it throws synchronously when the extension context is invalidated.
- Handle Promise rejections from Chrome APIs (storage, tabs, scripting) with `.catch()` or `try/catch` in async functions.
- Log prefix: `[ChatGPT Web Injector]` for all `console.log/warn/error` calls so logs are searchable.
- Debug logging must be gated behind a `DEBUG` constant (default `false`). Never merge with `DEBUG = true`.
- Fallback philosophy: if automation fails (injection, send button), show the manual copy modal — never silently fail.

## Types and Data Shape
- Plain JavaScript only. No TypeScript.
- Use JSDoc `@param`/`@returns` for exported functions (see `storage.js` for examples).
- Use optional chaining (`?.`) and nullish coalescing (`??`) for potentially absent values.
- Keep payload objects explicit:
  ```js
  { selectionText, pageTitle, pageUrl }   // tooltip → service worker
  { selection, title, url }               // service worker → renderTemplate
  { id, name, body }                      // template entry shape
  ```

## CSS Style
- Scope all extension styles under the unique ID `#chatgpt-web-injector-tooltip` to avoid colliding with host page styles.
- Use `position: fixed` and high `z-index` (2147483646) for injected UI elements.
- Keep `::after` pseudo-elements for icon/label content (avoids `chrome.runtime.getURL` which fails in content scripts).

## Chrome Extension Conventions
- `chrome.storage.sync` for user settings (templates). Storage keys: `templates`, `activeTemplateId`.
- `chrome.scripting.executeScript` requires the `scripting` permission and appropriate host permissions.
- Always filter `chrome.tabs.onUpdated` by `tabId` to avoid acting on unrelated tab events.
- `chrome.runtime.getURL()` does NOT work in content scripts — use pure CSS/inline assets instead.
- `document.execCommand('insertText')` is required for React `contenteditable` inputs; setting `.value` or `.textContent` alone does not trigger React state updates.

## Testing
- Test runner: Node built-in (`node --test`), no external framework.
- DOM tests use `jsdom` (only devDependency).
- Run all: `npm test`
- Run one file: `node --test tests/template.test.js`
- Tests live in `tests/`. Name files `<module>.test.js`.
- Tests use `import` from `node:test` and `node:assert/strict`.
- When adding tests, mock `chrome.*` APIs manually — no mocking library is used.

## Git and PR Discipline
- One PR per concern. Do not bundle unrelated fixes.
- PR description must include `closes #N` for any issue it resolves (GitHub auto-closes on merge).
- Squash merge to `main`. Delete branch after merge.
- After merging, run `git checkout main && git pull origin main` to sync.
- Two automated reviewers active: **CodeRabbit** and **Gemini Code Assist**.
- Address `valid` and `high/medium` severity review comments before merging. Nits are optional.

## Good First Checks Before Finishing
- `node --check src/<file>.js` passes for every changed JS file.
- `npm test` passes with no failures.
- `manifest.json` paths all resolve to existing files.
- `DEBUG = false` in `selection_tooltip.js` before any commit to main.
- Reload extension + refresh test tab before manual verification.
