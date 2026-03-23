# AGENTS Guide

## Scope
- This repository is a small Chrome Extension (Manifest V3) project.
- Current implemented files are minimal: `manifest.json`, `src/service_worker.js`, `options/options.html`, and product docs.
- `PRD.md` and `TECH_SPEC.md` describe planned components that do not all exist yet. Treat those docs as intent, not proof of implementation.
- Make the smallest safe change that satisfies the current request.

## Repository Map
- `manifest.json` - extension entrypoint, permissions, service worker, options page.
- `src/service_worker.js` - current runtime logic for context menu registration and click payload logging.
- `options/options.html` - placeholder options UI.
- `README.md` - manual install and product overview.
- `PRD.md` - product requirements and acceptance scenarios.
- `TECH_SPEC.md` - planned architecture, runtime flow, and manual test checklist.

## Source of Truth
- Use actual code and `manifest.json` to determine current behavior.
- Use `README.md`, `PRD.md`, and `TECH_SPEC.md` to understand intended behavior and acceptance expectations.
- If docs and code disagree, call out the mismatch in your response instead of silently "fixing" both.

## Build / Run / Test Commands
- There is currently no `package.json`, lockfile, Makefile, CI workflow, linter config, formatter config, or automated test runner in this repository.
- There is no build step today. The extension is loaded directly into Chrome as an unpacked extension.
- Start manual verification with Chrome: open `chrome://extensions`, enable Developer mode, click `Load unpacked`, and select the repo root.
- Reload the unpacked extension after code changes from the Extensions page.
- Open the service worker console from the extension details page to inspect logs from `src/service_worker.js`.

## Command Reference
- `open -a "Google Chrome" chrome://extensions` - open the Extensions page on macOS.
- `node --check src/service_worker.js` - optional syntax check for the service worker if Node is installed.
- `python3 -m http.server` - optional static file server only if you need to inspect local HTML/CSS assets outside Chrome extension flow.
- There is no repository-native lint command.
- There is no repository-native automated test command.

## Single Test Guidance
- There is no configured unit or integration test harness, so there is no true "run one test" command yet.
- For a single manual scenario, use the checklist in `TECH_SPEC.md` and validate one scenario at a time.
- Example single-scenario manual test: load the unpacked extension, open any webpage, select text, right-click, choose `Send to ChatGPT`, and confirm the service worker logs the expected payload.
- When documenting or adding tests later, prefer naming scenarios after the acceptance cases in `PRD.md` and `TECH_SPEC.md`.

## Manual Verification Checklist
- Confirm the extension loads without manifest errors.
- Confirm the context menu item appears on page and selection contexts.
- Confirm clicking the menu logs payload fields for `selectionText`, `pageTitle`, `pageUrl`, `tabId`, and `timestamp`.
- Confirm the options page opens and renders the placeholder content.
- If you implement planned features, also verify the matching acceptance scenarios from `PRD.md`.

## Current Architecture Notes
- `manifest.json` declares MV3 with a module service worker.
- Background logic currently lives only in `src/service_worker.js`.
- The service worker currently creates the context menu and logs click payload data.
- The options page exists but is still a placeholder.
- Planned files like `content_script.js`, `options.js`, selector utilities, and fallback modal assets are documented but not yet present.

## Editing Rules
- Preserve Manifest V3 compatibility.
- Keep permissions minimal. Do not add new permissions or host permissions unless the task requires them.
- If you add a new runtime file, wire it through `manifest.json` explicitly.
- Keep implementation changes local; do not invent a build system or dependency stack unless the user asks for it.
- Do not convert the project to TypeScript, a bundler, or a framework without explicit instruction.

## JavaScript Style
- Use 2-space indentation.
- Use semicolons.
- Use single quotes in JavaScript unless escaping would be worse.
- Prefer `const` by default; use `let` only when reassignment is required.
- Keep stable identifiers in clear uppercase constants, e.g. `MENU_ID`.
- Use camelCase for variables and functions.
- Prefer small functions with one responsibility.
- Use early returns for guard clauses.

## HTML Style
- Keep simple static HTML readable and lightly structured.
- Use lowercase tags and standard double-quoted attributes.
- Preserve the existing `<!doctype html>` and minimal head metadata style.
- Avoid inline scripts unless the task is intentionally tiny and extension-safe.

## JSON and Manifest Style
- Keep `manifest.json` formatted with standard JSON double quotes.
- Preserve existing key names and MV3-required structure.
- Re-check relative paths after any manifest edit.
- Do not add permissions, host permissions, or extension pages speculatively.

## Imports and Modules
- `src/service_worker.js` is treated as an ES module because `manifest.json` sets `"type": "module"` for the background worker.
- Prefer relative ESM imports if you split logic into additional JS files.
- Keep import paths explicit and local.
- Avoid introducing dynamic imports or nonstandard module resolution unless there is a clear need.

## Naming Conventions
- Use descriptive camelCase for runtime values: `createContextMenu`, `payload`, `selectionText`.
- Use uppercase snake case for stable constants only.
- Match Chrome event naming to the platform API rather than inventing aliases.
- Name new files by responsibility: `content_script.js`, `template.js`, `selectors.js`, `options.js`.

## Types and Data Shape
- This repo is plain JavaScript today; there is no TypeScript setup.
- When passing structured data, keep object shapes explicit and stable.
- Prefer constructing payload objects in one place so fields are easy to inspect.
- If a value may be absent, follow the existing defensive style with optional chaining and nullish coalescing.
- If richer typing becomes necessary, prefer JSDoc typedefs before introducing a full TS toolchain.

## Error Handling and Logging
- Favor defensive checks around Chrome APIs, tab data, storage reads, and DOM-dependent logic.
- Keep failure handling user-safe and local-first.
- Preserve or extend the documented fallback philosophy from `TECH_SPEC.md`: if automation fails, fall back to a manual recovery path.
- Use clear log prefixes such as `[ChatGPT Web Injector]` so extension logs stay searchable.
- Do not leave noisy debug logging in place unless it helps the current feature and is intentionally scoped.

## Chrome Extension Conventions
- Verify any new file referenced by the manifest actually exists.
- Keep `permissions` and `host_permissions` narrowly scoped.
- When adding content scripts or injected logic, remember that target-site DOMs are brittle and should use defensive selectors.
- Any storage-backed setting should default safely if the stored value is missing or invalid.
- Changes that affect injection behavior should be checked against the failure and fallback notes in `TECH_SPEC.md`.

## Testing Strategy for Future Work
- If you add automated tests, keep them lightweight and repo-local.
- Prefer adding a documented command in this file and `README.md` when introducing test tooling.
- Prefer one manual acceptance scenario per user-visible behavior until a real test harness exists.
- If you add a single-test runner later, document the exact command pattern here immediately.

## Documentation Rules
- Keep `README.md` aligned with actual setup and implemented behavior.
- Keep `PRD.md` and `TECH_SPEC.md` as planning/design docs unless the task specifically asks to update them.
- If you implement a planned component from `TECH_SPEC.md`, note whether the repo has now caught up to the spec.

## Git and Change Scope
- Expect a possibly dirty working tree and avoid reverting unrelated user changes.
- Keep file touch count low and prefer local edits over broad rewrites.
- Do not add dependencies or generated files unless the task requires them.
- When behavior changes, mention whether the change is implemented code, documentation only, or both.

## Cursor / Copilot Rules
- No `.cursor/rules/` directory exists at the time of writing.
- No `.cursorrules` file exists at the time of writing.
- No `.github/copilot-instructions.md` file exists at the time of writing.
- If any of these files are added later, merge their instructions into future agent behavior and update this guide.

## Good First Checks Before Finishing
- Re-read `manifest.json` for path and permission accuracy.
- Re-read `src/service_worker.js` for syntax and logging consistency.
- Re-run the relevant manual scenario in Chrome when behavior changes.
- State clearly whether your change affects current implementation, planned architecture, or both.
