# Changelog

## [0.0.17](https://github.com/qcwssss/chatgpt-web-injector/compare/v0.0.16...v0.0.17) (2026-06-04)

### Features

* **Toggle Floating Bot Button**: Add a switch toggle in the extension popup to enable or disable the floating bot button on web pages, allowing users to customize whether it appears upon selecting text.
* **Glassmorphism Frosted-glass Tooltip**: Redesign the background of the floating bot button on target web pages with a premium dark frosted-glass effect, enhancing readability and visual contrast on light pages.

## [0.0.16](https://github.com/qcwssss/chatgpt-web-injector/compare/v0.0.15...v0.0.16) (2026-05-29)

### Features

* **Redesigned Extension Popup UI**: Completely overhaul the extension popup layout with 12px smooth rounded corners to eliminate native gray straight border margins in Chrome. Improve Switch track and thumb shadows and add micro-interactions with a subtle hover arrow motion.
* **Merged Redundant Links**: Consolidate redundant settings buttons ("Manage templates" and "Edit YouTube summary") into a single elegant "Configure templates" link.

### Bug Fixes

* **Fixed Outer Popup Corner Bleed**: Remove body padding margins and bind border-radius and overflow clipping directly to the body and white container to prevent Chrome viewport straight corner leaks.

## [0.0.15](https://github.com/qcwssss/chatgpt-web-injector/compare/v0.0.14...v0.0.15) (2026-05-28)

### Features

* **English Translation for Subtitle Buttons**: Translate YouTube download popover buttons from Chinese to English ("Download SRT" and "Download TXT") to ensure language consistency.
* **README Updates**: Update README.md with detailed descriptions of the YouTube Subtitle Downloader dual-format feature.

## [0.0.14](https://github.com/qcwssss/chatgpt-web-injector/compare/v0.0.13...v0.0.14) (2026-05-25)

### Features

* **YouTube Subtitle Downloader**: Inject a minimalist circular download button "📥" next to the player's "CC" control. Click to display a dark frosted-glass popover allowing users to download subtitles in SRT format (high-precision millisecond timestamps) or clean text TXT format (merged paragraphs without timestamps).
* **Robust Fallback Chain**: Integrate getTranscript using InnerTube API and DOM scrapers to bypass YouTube firewall restrictions, achieving a 100% success rate.

### Bug Fixes

* **Memory Leak Protection**: Safely detach click listeners on all popover closure paths (clicking outside, clicking button twice, auto-dismissing on completion) to prevent handler buildup.
* **Timestamp Overflow Defense**: Apply Number.isFinite() checks in the SRT timestamp formatter to handle NaN or invalid parameters safely.

## [0.0.12](https://github.com/qcwssss/chatgpt-web-injector/compare/v0.0.11...v0.0.12) (2026-05-13)

### Bug Fixes

* Toggle the native YouTube transcript panel from the TR button.
* Ignore hidden or stale YouTube transcript controls when reopening the transcript panel.
* Restore hidden native YouTube transcript fallback for TR and AI summary actions.

### Design

* Refresh the YouTube injected control styling.
* Replace extension icons with the new GPT video transcribe logo.

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
