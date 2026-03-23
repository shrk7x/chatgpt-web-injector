# MVP Core Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the MVP flow for issues #1-#3 so the Chrome extension can store a reusable prompt template and send webpage context into a new ChatGPT tab with an auto-send attempt and fallback modal.

**Architecture:** Keep the MVP in JavaScript, but split the runtime into small shared modules: template rendering, storage, service-worker orchestration, ChatGPT page automation, and fallback modal UI. Add a minimal Node test harness so shared logic and DOM-facing helpers can be developed with failing tests first while the end-to-end browser flow is verified manually.

**Tech Stack:** JavaScript, Chrome Extension Manifest V3, Node test runner, lightweight DOM test support, `chrome.storage.sync`, `chrome.scripting`.

### Task 1: Establish the MVP test harness

**Files:**
- Create: `package.json`
- Create: `tests/template.test.js`
- Create: `tests/chatgpt_content.test.js`

**Step 1: Create the minimum test config**

Create `package.json` with a `test` script so tests can run consistently in the worktree.

**Step 2: Write the failing template test**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TEMPLATE, renderTemplate } from '../src/template.js';

test('renderTemplate substitutes selection title and url', () => {
  const output = renderTemplate('Title: {{title}}\nURL: {{url}}\nBody: {{selection}}', {
    title: 'Example',
    url: 'https://example.com',
    selection: 'Alpha',
  });

  assert.equal(output, 'Title: Example\nURL: https://example.com\nBody: Alpha');
});
```

**Step 3: Run test to verify it fails**

Run: `npm test -- tests/template.test.js`
Expected: FAIL because `src/template.js` does not exist yet.

**Step 4: Write the failing DOM helper test**

Add a test that proves the ChatGPT automation can find an input candidate and reports a fallback error when no send control exists.

**Step 5: Commit**

```bash
git add package.json tests/template.test.js tests/chatgpt_content.test.js
git commit -m "test: add MVP test harness"
```

### Task 2: Implement template and storage modules plus options page

**Files:**
- Create: `src/template.js`
- Create: `src/storage.js`
- Create: `options/options.js`
- Create: `options/options.css`
- Modify: `options/options.html`
- Test: `tests/template.test.js`

**Step 1: Write the failing storage/options test or extend template test**

Add a failing test for blank templates falling back to `DEFAULT_TEMPLATE` and for variable rendering preserving empty selection.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/template.test.js`
Expected: FAIL on missing exports or incorrect blank-template fallback behavior.

**Step 3: Write minimal implementation**

Implement:

```javascript
export const DEFAULT_TEMPLATE = `You are a precise analysis assistant.\n\nSource title: {{title}}\nSource URL: {{url}}\n\nSelected content:\n{{selection}}\n\nPlease provide:\n1) Key conclusion\n2) Potential logic gaps\n3) Confidence level`;
```

Add storage helpers that load from `chrome.storage.sync`, trim blank templates, and fall back to `DEFAULT_TEMPLATE`. Wire the options page to load the current template, save it, reset to default, and show variable help text.

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/template.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/template.js src/storage.js options/options.html options/options.js options/options.css tests/template.test.js
git commit -m "feat: add template storage and options UI"
```

### Task 3: Implement ChatGPT page automation and fallback modal

**Files:**
- Create: `src/chatgpt_content.js`
- Create: `src/selectors.js`
- Create: `src/fallback_modal.js`
- Test: `tests/chatgpt_content.test.js`

**Step 1: Write the failing content automation test**

Create tests for these behaviors:
- finds the first supported input candidate
- writes prompt text and dispatches input events
- clicks the send button when one is present
- returns a failure result that triggers fallback when controls are missing

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/chatgpt_content.test.js`
Expected: FAIL because the content automation files do not exist yet.

**Step 3: Write minimal implementation**

Implement selector fallback arrays, prompt insertion helpers, send-button discovery, and a lightweight in-page modal with `Copy` and `Close` buttons that exposes the full prompt text when automation fails.

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/chatgpt_content.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/chatgpt_content.js src/selectors.js src/fallback_modal.js tests/chatgpt_content.test.js
git commit -m "feat: add ChatGPT injection and fallback modal"
```

### Task 4: Wire the service worker to the end-to-end runtime flow

**Files:**
- Modify: `manifest.json`
- Modify: `src/service_worker.js`
- Test: `tests/template.test.js`
- Test: `tests/chatgpt_content.test.js`

**Step 1: Write the failing orchestration test or extend existing tests**

Add tests for any new pure helpers in the service worker, such as composing the prompt payload or determining whether fallback should run.

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL until the orchestration helpers and manifest wiring exist.

**Step 3: Write minimal implementation**

Update the service worker to:
- load the effective template
- compose the prompt from selection/title/url
- open ChatGPT in a new tab
- wait for the exact tab to finish loading
- inject the ChatGPT automation runtime
- trigger the send attempt and fallback modal when needed

Keep listener cleanup explicit so the background worker does not leak `tabs.onUpdated` handlers.

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

**Step 5: Commit**

```bash
git add manifest.json src/service_worker.js tests/template.test.js tests/chatgpt_content.test.js
git commit -m "feat: connect MV3 runtime send flow"
```

### Task 5: Verify manually, sync docs, and finalize

**Files:**
- Modify: `README.md`
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`

**Step 1: Run automated verification**

Run: `npm test`
Expected: PASS.

**Step 2: Run manual extension verification**

Load the unpacked extension in `chrome://extensions` and confirm:
- context menu appears on normal webpages
- options page saves and reloads template data
- selected text and empty selection both open ChatGPT in a new tab
- automation sends when the current ChatGPT DOM matches supported selectors
- fallback modal appears with copy support when automation cannot send

**Step 3: Update docs and progress files**

Record the final behavior, limitations, and verification notes.

**Step 4: Commit**

```bash
git add README.md task_plan.md findings.md progress.md docs/plans/2026-03-06-mvp-core-flow.md
git commit -m "docs: record MVP implementation progress"
```
