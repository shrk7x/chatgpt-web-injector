# YouTube Caption Controls Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep YouTube summary, transcript, and subtitle-download controls hidden until the current video is confirmed to have caption tracks.

**Architecture:** Preserve the existing mount and SPA race-protection flow. Mount all three controls with their native `hidden` property set, then reveal them together when `hasCaptionTracks(videoId)` returns `true` or `null`; remove and cache them only for confirmed no-caption results.

**Tech Stack:** Manifest V3 Chrome extension, plain JavaScript, Node.js built-in test runner, jsdom.

## Global Constraints

- No new permissions, dependencies, files outside documentation/tests, bundler, TypeScript, or framework.
- Preserve MV3 compatibility and existing SPA navigation race guards.
- Use two-space indentation, semicolons, and single quotes in JavaScript.
- Unknown caption availability must not expose unusable controls and must remain retryable.

---

### Task 1: Hide Controls Until Caption Availability Is Confirmed

**Files:**
- Modify: `tests/youtube_summary.test.js`
- Modify: `src/youtube_summary.js:622-652`
- Modify: `src/youtube_summary.js:1052-1087`

**Interfaces:**
- Consumes: `hasCaptionTracks(videoId)` and the existing three control factory functions.
- Produces: `hasCaptionTracks(videoId) -> Promise<true | false | null>` and hidden controls that are revealed only for `true`.

- [ ] **Step 1: Write failing DOM regression tests**

Add a helper that embeds a matching `ytInitialPlayerResponse` and tests that all three controls are hidden synchronously, become visible after a caption-positive result, and are removed after a caption-negative result. Add an unknown-result test by advancing `Date.now()` beyond the polling window and rejecting `fetch()`, then verify the controls become visible.

```js
function createPlayerResponseScript(videoId, captionTracks) {
  return `<script>var ytInitialPlayerResponse = ${JSON.stringify({
    videoDetails: { videoId },
    captions: {
      playerCaptionsTracklistRenderer: { captionTracks },
    },
  })};</script>`;
}

test('YouTube caption controls stay hidden until captions are confirmed', async () => {
  // Load a watch page containing a matching caption track.
  // Assert each control has hidden === true immediately.
  // Await one microtask and assert each control has hidden === false.
});

test('YouTube caption controls are removed when captions are unavailable', async () => {
  // Load a matching player response with an empty captionTracks array.
  // Await one microtask and assert all three controls are absent.
});

test('YouTube caption controls are shown when availability is unknown', async () => {
  // Force polling to expire and fetch to reject.
  // Await the async check and assert all three controls become visible.
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test --test-name-pattern='caption controls' tests/youtube_summary.test.js`

Expected: the hidden-until-confirmed assertion fails because controls are currently visible immediately, and the unknown-result assertion fails because the fallback currently returns `true`.

- [ ] **Step 3: Implement the minimal visibility behavior**

Change `hasCaptionTracks()` to return `null` when its fallback cannot obtain a matching player response. Set all three newly mounted controls to `hidden = true`. After the existing stale-result guards, reveal all three for any result except `false`; cache and remove controls only for `false`; reveal controls for `null` or thrown errors.

```js
const controls = [summaryButton, transcriptButton, downloadButton];
controls.forEach((control) => {
  control.hidden = true;
});

if (captionsAvailable === true) {
  controls.forEach((control) => {
    control.hidden = false;
  });
  return;
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test --test-name-pattern='caption controls' tests/youtube_summary.test.js`

Expected: all matching caption-control tests pass.

- [ ] **Step 5: Run regression verification**

Run: `node --check src/youtube_summary.js`

Expected: exit code 0 with no output.

Run: `npm test`

Expected: all tests pass with no failures.

- [ ] **Step 6: Commit the implementation**

```bash
git add src/youtube_summary.js tests/youtube_summary.test.js docs/superpowers/plans/2026-07-11-youtube-caption-controls-visibility.md
git commit -m "fix: hide YouTube controls until captions are confirmed"
```
