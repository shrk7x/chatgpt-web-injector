import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

function loadYoutubeSummary(dom) {
  const previousChrome = globalThis.chrome;

  globalThis.chrome = {
    runtime: {
      sendMessage() {},
    },
  };

  const transcriptSource = readFileSync(new URL('../src/youtube_transcript.js', import.meta.url), 'utf8');
  const summarySource = readFileSync(new URL('../src/youtube_summary.js', import.meta.url), 'utf8');

  dom.window.eval(transcriptSource);
  dom.window.eval(summarySource);

  globalThis.chrome = previousChrome;
}

test('YouTube summary controls include a transcript panel button', () => {
  const dom = new JSDOM(`
    <html>
      <body>
        <div class="ytp-chrome-controls">
          <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
        </div>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'https://www.youtube.com/watch?v=test123',
  });

  loadYoutubeSummary(dom);

  const button = dom.window.document.getElementById('chatgpt-web-injector-youtube-transcript');

  assert.ok(button);
  assert.equal(button.getAttribute('aria-label'), 'Show YouTube transcript');
});

test('YouTube transcript panel button clicks the native transcript control', () => {
  const dom = new JSDOM(`
    <html>
      <body>
        <div class="ytp-chrome-controls">
          <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
        </div>
        <button aria-label="Show transcript">Show transcript</button>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'https://www.youtube.com/watch?v=test123',
  });

  let nativeTranscriptClicked = false;
  dom.window.document.querySelector('[aria-label="Show transcript"]').addEventListener('click', () => {
    nativeTranscriptClicked = true;
  });

  loadYoutubeSummary(dom);

  const button = dom.window.document.getElementById('chatgpt-web-injector-youtube-transcript');
  button.click();

  assert.equal(nativeTranscriptClicked, true);
});
