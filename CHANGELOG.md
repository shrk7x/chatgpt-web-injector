# Changelog

## [0.0.11](https://github.com/qcwssss/chatgpt-web-injector/compare/v0.0.10...v0.0.11) (2026-05-08)

### Features

* Add YouTube caption summary flow with an injected YouTube summary button.
* Add YouTube transcript panel shortcut button next to the player controls.
* Add a dedicated editable YouTube Summary prompt template.
* Add popup shortcut for editing the YouTube Summary template.
* Add configurable Temporary Chat behavior for YouTube summaries, enabled by default.

### Bug Fixes

* Preserve hour-level timestamps in long YouTube transcripts.
* Improve ChatGPT Temporary Chat send reliability.
* Avoid stale UI state when saving the YouTube Temporary Chat setting fails.
* Fail faster when a target ChatGPT tab disappears during send flow.

### Tests

* Add coverage for YouTube transcript parsing, summary controls, Temporary Chat behavior, storage settings, and service worker send retries.
