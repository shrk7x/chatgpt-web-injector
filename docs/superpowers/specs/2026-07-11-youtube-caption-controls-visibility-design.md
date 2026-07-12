# YouTube Caption Controls Visibility Design

## Goal

Prevent the extension's YouTube summary, transcript, and subtitle download controls from appearing until the current video is confirmed to have caption tracks. Videos without captions must never show these controls, even briefly.

## Scope

This change is limited to the existing YouTube control mounting and caption-detection flow in `src/youtube_summary.js` and its tests. It does not change permissions, dependencies, button behavior, transcript fetching, or the visual design of controls after they become visible.

## Design

`mountButton()` will continue creating the three controls in their current positions so the existing DOM presence checks prevent duplicate mounts and duplicate caption checks. Each newly created control will initially use the native `hidden` state.

The existing asynchronous `hasCaptionTracks(videoId)` check remains responsible for detecting caption availability. Its result becomes tri-state: `true` when caption tracks are present, `false` when a matching player response confirms there are no tracks, and `null` when the fallback request fails or does not return a matching player response. After it completes, the existing caption-check ID and URL guards must pass before the result can affect the controls:

- When captions are confirmed, all three controls become visible together.
- When captions are absent, all three controls are removed and the URL is added to the existing no-caption cache.
- When detection returns `null` or throws, the controls remain mounted but hidden. This prevents unusable controls from appearing and prevents the player MutationObserver from causing a repeated remove/remount detection loop.
- When navigation makes a result stale, that result does nothing; the navigation flow removes the old controls and mounts hidden controls for the new video.

This preserves the current SPA race protection while changing the user-visible default from “visible until disproven” to “hidden until confirmed.”

## Failure Handling

Caption detection already performs an HTML fallback request when page script data is stale. If all detection paths fail, it returns `null`, and the controls remain hidden rather than being shown speculatively. Navigation to another video removes the hidden controls through the existing navigation flow and starts a fresh check for the new URL.

## Tests

DOM-level regression tests will verify:

1. Controls are hidden immediately after mounting while caption detection is pending.
2. Controls become visible only after captions are confirmed.
3. Controls are removed when the current video has no caption tracks.
4. Controls remain hidden when caption availability cannot be determined.

The changed JavaScript file will receive a syntax check, and the full existing test suite will run after implementation.
