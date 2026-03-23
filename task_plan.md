# MVP Core Flow Task Plan

## Goal
Ship a test-backed MVP for issues #1-#3 so the extension can store a template, open ChatGPT in a new tab, inject a composed prompt, attempt auto-send, and fall back to a manual copy modal when automation fails.

## Current Context
- Branch: `feat/mvp-core-flow`
- Worktree: `/Users/qiuchen/Desktop/Workplace/chatgpt-web-injector/.worktrees/mvp-core-flow`
- Implementation style: pure JavaScript for MVP, with modular files to keep the later TypeScript migration straightforward.

## Phases
| Phase | Status | Notes |
| --- | --- | --- |
| 1. Local setup and repo baseline | complete | Repo cloned, worktree created, docs reviewed |
| 2. Planning docs and test harness | complete | Planning files created, Node test harness added |
| 3. Options page and template/storage modules | complete | Options UI, storage helpers, and template rendering implemented |
| 4. ChatGPT injection, send flow, and fallback modal | complete | Runtime open-tab injection flow and in-page fallback modal implemented |
| 5. Verification, docs, and commits | in_progress | Automated tests pass; manual browser verification still to run |

## Confirmed Decisions
- Use Chrome MV3 background service worker plus programmatic injection via `chrome.scripting.executeScript`.
- Keep host permissions minimal: `https://chatgpt.com/*` only.
- Use a lightweight Node test harness so shared logic and DOM helpers can follow TDD.
- Preserve the MVP scope: one template, new-tab ChatGPT flow, auto-send on by default, manual fallback modal on failure.

## Errors Encountered
| Error | Attempt | Resolution |
| --- | --- | --- |
| `git worktree add` appeared to do nothing because `.worktrees/` did not exist yet | 1 | Created `.worktrees/`, verified ignore rule, then re-ran `git worktree add` successfully |

## Next Action
Run final verification, sync progress docs, and commit the MVP implementation changes.
