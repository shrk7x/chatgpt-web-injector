import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

function loadYoutubeSummary(dom, options = {}) {
  const previousChrome = globalThis.chrome;
  const previousWindowChrome = dom.window.chrome;
  const chromeMock = {
    runtime: {
      sendMessage: options.sendMessage ?? (() => {}),
    },
  };

  globalThis.chrome = chromeMock;
  dom.window.chrome = chromeMock;

  try {
    const transcriptSource = readFileSync(new URL('../src/youtube_transcript.js', import.meta.url), 'utf8');
    const summarySource = readFileSync(new URL('../src/youtube_summary.js', import.meta.url), 'utf8');

    dom.window.eval(transcriptSource);
    dom.window.eval(summarySource);
  } finally {
    globalThis.chrome = previousChrome;
    dom.window.chrome = previousWindowChrome;
  }
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

test('YouTube transcript panel button clicks the native transcript control', async () => {
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
  await Promise.resolve();

  assert.equal(nativeTranscriptClicked, true);
});

test('YouTube summary keeps hour timestamps when reading visible transcript DOM', async () => {
  const messages = [];
  const dom = new JSDOM(`
    <html>
      <body>
        <h1 class="ytd-watch-metadata">Long video</h1>
        <div class="ytp-chrome-controls">
          <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
        </div>
        <ytd-transcript-segment-renderer>
          <span class="segment-timestamp">1:05:30</span>
          <span class="segment-text">Past the first hour</span>
        </ytd-transcript-segment-renderer>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'https://www.youtube.com/watch?v=test123',
  });

  const chromeMock = {
    runtime: {
      sendMessage(message) {
        messages.push(message);
      },
    },
  };

  loadYoutubeSummary(dom, { sendMessage: chromeMock.runtime.sendMessage });
  dom.window.chrome = chromeMock;

  dom.window.document.getElementById('chatgpt-web-injector-youtube-summary').click();
  await new Promise((resolve) => { setTimeout(resolve, 20); });

  assert.equal(messages[0].payload.transcript, '[01:05:30] Past the first hour');
});

test('loadYoutubeSummary restores chrome when script loading fails', () => {
  const dom = new JSDOM('<html><body></body></html>', {
    runScripts: 'outside-only',
    url: 'https://www.youtube.com/watch?v=test123',
  });
  const previousEval = dom.window.eval;
  const previousChrome = globalThis.chrome;

  dom.window.eval = () => {
    throw new Error('load failed');
  };

  assert.throws(() => loadYoutubeSummary(dom), /load failed/);
  assert.equal(globalThis.chrome, previousChrome);

  dom.window.eval = previousEval;
});
