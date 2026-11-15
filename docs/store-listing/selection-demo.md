# Selection demo review record

The live English video for [#86](https://github.com/shrk7x/chatgpt-web-injector/issues/86) shows the selection workflow from the sample article through the first reply on ChatGPT. The MP4 is delivered locally. The first, simulated draft remains available locally for comparison.

The recording uses the unmodified [v0.2.1 release ZIP](https://github.com/shrk7x/chatgpt-web-injector/releases/tag/chatgpt-web-injector-v0.2.1), SHA-256 `74562c5a095449a14c90244344e34e718aab36e295516d093699cba388e810ab`. The demo ran signed out in a fresh, isolated Chrome for Testing profile. A visible incognito probe reached the ChatGPT composer, but the floating BOT did not appear on text selection in the incognito capture setup.

To reproduce, load the release ZIP unpacked in an isolated profile and enable **Show floating BOT button on text selection** in Options. Leave the destination and selection template at their defaults. Open an article containing nonpersonal sample text, select a sentence and click the sparkle button. The extension opens ChatGPT in a new tab and submits the prompt. Verify that the user message contains the title, URL and selected sentence and that the assistant starts replying.

For independent review, open the delivered MP4 and watch the full recording. Verify the selection, BOT click, submitted prompt and start of the reply. The sample page draws a blue ring when the pointer is pressed so the click is visible in the page capture. Confirm the capture is continuous across the tab change, plays cleanly and contains only page content and synthetic test data. Confirm the released build, live submission and file hash against the capture evidence. Check track metadata to confirm that the recording is silent.
