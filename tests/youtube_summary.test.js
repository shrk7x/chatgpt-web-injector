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
  assert.equal(dom.window.document.getElementById('chatgpt-web-injector-youtube-status'), null);
});

test('YouTube transcript panel button clicks the nested native button inside renderer wrappers', async () => {
  const dom = new JSDOM(`
    <html>
      <body>
        <div class="ytp-chrome-controls">
          <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
        </div>
        <ytd-button-renderer>
          Show transcript
          <button aria-label="Show transcript">Show transcript</button>
        </ytd-button-renderer>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'https://www.youtube.com/watch?v=test123',
  });

  let wrapperClicked = false;
  let nativeTranscriptClicked = false;
  dom.window.document.querySelector('ytd-button-renderer').addEventListener('click', (event) => {
    wrapperClicked = event.target.tagName === 'YTD-BUTTON-RENDERER';
  });
  dom.window.document.querySelector('ytd-button-renderer button').addEventListener('click', () => {
    nativeTranscriptClicked = true;
  });

  loadYoutubeSummary(dom);

  const button = dom.window.document.getElementById('chatgpt-web-injector-youtube-transcript');
  button.click();
  await Promise.resolve();

  assert.equal(wrapperClicked, false);
  assert.equal(nativeTranscriptClicked, true);
});

test('YouTube transcript panel button opens when stale transcript DOM is hidden', async () => {
  const dom = new JSDOM(`
    <html>
      <body>
        <div class="ytp-chrome-controls">
          <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
        </div>
        <ytd-engagement-panel-section-list-renderer visibility="ENGAGEMENT_PANEL_VISIBILITY_HIDDEN">
          <ytd-transcript-segment-renderer>
            <span class="segment-timestamp">0:01</span>
            <span class="segment-text">Stale closed transcript</span>
          </ytd-transcript-segment-renderer>
          <button aria-label="Show transcript">Hidden show transcript</button>
        </ytd-engagement-panel-section-list-renderer>
        <button aria-label="Show transcript">Show transcript</button>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'https://www.youtube.com/watch?v=test123',
  });

  let nativeTranscriptClicked = false;
  let hiddenTranscriptClicked = false;
  dom.window.document.querySelector('ytd-engagement-panel-section-list-renderer button').addEventListener('click', () => {
    hiddenTranscriptClicked = true;
  });
  dom.window.document.body.lastElementChild.addEventListener('click', () => {
    nativeTranscriptClicked = true;
  });

  loadYoutubeSummary(dom);

  const button = dom.window.document.getElementById('chatgpt-web-injector-youtube-transcript');
  button.click();
  await Promise.resolve();

  assert.equal(nativeTranscriptClicked, true);
  assert.equal(hiddenTranscriptClicked, false);
  assert.equal(dom.window.document.getElementById('chatgpt-web-injector-youtube-status'), null);
});

test('YouTube transcript panel button falls back to a hidden native transcript control', async () => {
  const dom = new JSDOM(`
    <html>
      <body>
        <div class="ytp-chrome-controls">
          <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
        </div>
        <ytd-engagement-panel-section-list-renderer visibility="ENGAGEMENT_PANEL_VISIBILITY_HIDDEN">
          <button aria-label="Show transcript">Stale panel transcript</button>
        </ytd-engagement-panel-section-list-renderer>
        <div hidden>
          <button aria-label="Show transcript">Native transcript</button>
        </div>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'https://www.youtube.com/watch?v=test123',
  });

  let staleTranscriptClicked = false;
  let nativeTranscriptClicked = false;
  dom.window.document.querySelector('ytd-engagement-panel-section-list-renderer button').addEventListener('click', () => {
    staleTranscriptClicked = true;
  });
  dom.window.document.querySelector('div[hidden] button').addEventListener('click', () => {
    nativeTranscriptClicked = true;
  });

  loadYoutubeSummary(dom);

  const button = dom.window.document.getElementById('chatgpt-web-injector-youtube-transcript');
  button.click();
  await Promise.resolve();

  assert.equal(staleTranscriptClicked, false);
  assert.equal(nativeTranscriptClicked, true);
  assert.equal(dom.window.document.getElementById('chatgpt-web-injector-youtube-status'), null);
});

test('YouTube transcript panel button closes an open transcript panel', async () => {
  const dom = new JSDOM(`
    <html>
      <body>
        <div class="ytp-chrome-controls">
          <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
        </div>
        <ytd-engagement-panel-section-list-renderer>
          <button aria-label="Close transcript">Close</button>
          <ytd-transcript-segment-renderer>
            <span class="segment-timestamp">0:01</span>
            <span class="segment-text">Open transcript</span>
          </ytd-transcript-segment-renderer>
        </ytd-engagement-panel-section-list-renderer>
        <button aria-label="Show transcript">Show transcript</button>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'https://www.youtube.com/watch?v=test123',
  });

  let closeClicked = false;
  dom.window.document.querySelector('[aria-label="Close transcript"]').addEventListener('click', () => {
    closeClicked = true;
  });

  loadYoutubeSummary(dom);

  const button = dom.window.document.getElementById('chatgpt-web-injector-youtube-transcript');
  button.click();
  await Promise.resolve();

  assert.equal(closeClicked, true);
  assert.equal(dom.window.document.getElementById('chatgpt-web-injector-youtube-status'), null);
});

test('YouTube transcript panel button closes panel when ytd-transcript-renderer wraps segments', async () => {
  // Mirrors real YouTube DOM where ytd-transcript-renderer is an intermediate
  // layer between the engagement panel and transcript segments. The close button
  // sits outside this inner renderer, so the search must expand to the outer panel.
  const dom = new JSDOM(`
    <html>
      <body>
        <div class="ytp-chrome-controls">
          <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
        </div>
        <ytd-engagement-panel-section-list-renderer>
          <button aria-label="Close">Close</button>
          <ytd-transcript-renderer>
            <ytd-transcript-segment-renderer>
              <span class="segment-timestamp">0:05</span>
              <span class="segment-text">Hello world</span>
            </ytd-transcript-segment-renderer>
          </ytd-transcript-renderer>
        </ytd-engagement-panel-section-list-renderer>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'https://www.youtube.com/watch?v=test123',
  });

  let closeClicked = false;
  dom.window.document.querySelector('[aria-label="Close"]').addEventListener('click', () => {
    closeClicked = true;
  });

  loadYoutubeSummary(dom);

  const button = dom.window.document.getElementById('chatgpt-web-injector-youtube-transcript');
  button.click();
  await Promise.resolve();

  assert.equal(closeClicked, true, 'Close button outside ytd-transcript-renderer should be found and clicked');
  assert.equal(dom.window.document.getElementById('chatgpt-web-injector-youtube-status'), null);
});

test('YouTube transcript panel button closes an open transcript panel with an unlabeled dismiss button', async () => {
  const dom = new JSDOM(`
    <html>
      <body>
        <div class="ytp-chrome-controls">
          <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
        </div>
        <ytd-engagement-panel-section-list-renderer visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED">
          <button id="dismiss-button"></button>
          <button aria-label="0:05 transcript segment">Transcript segment</button>
        </ytd-engagement-panel-section-list-renderer>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'https://www.youtube.com/watch?v=test123',
  });

  let closeClicked = false;
  let segmentClicked = false;
  dom.window.document.getElementById('dismiss-button').addEventListener('click', () => {
    closeClicked = true;
  });
  dom.window.document.querySelector('[aria-label="0:05 transcript segment"]').addEventListener('click', () => {
    segmentClicked = true;
  });

  loadYoutubeSummary(dom);

  const button = dom.window.document.getElementById('chatgpt-web-injector-youtube-transcript');
  button.click();
  await Promise.resolve();

  assert.equal(closeClicked, true);
  assert.equal(segmentClicked, false);
  assert.equal(dom.window.document.getElementById('chatgpt-web-injector-youtube-status'), null);
});

test('YouTube transcript panel button does not click transcript segment buttons when panel is open', async () => {
  const dom = new JSDOM(`
    <html>
      <body>
        <div class="ytp-chrome-controls">
          <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
        </div>
        <ytd-engagement-panel-section-list-renderer visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED">
          <button aria-label="0:05 transcript segment">Transcript segment</button>
        </ytd-engagement-panel-section-list-renderer>
        <button aria-label="Show transcript">Show transcript</button>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'https://www.youtube.com/watch?v=test123',
  });

  let segmentClicked = false;
  let showClicked = false;
  dom.window.document.querySelector('[aria-label="0:05 transcript segment"]').addEventListener('click', () => {
    segmentClicked = true;
  });
  dom.window.document.body.lastElementChild.addEventListener('click', () => {
    showClicked = true;
  });

  loadYoutubeSummary(dom);

  const button = dom.window.document.getElementById('chatgpt-web-injector-youtube-transcript');
  button.click();
  await Promise.resolve();

  assert.equal(segmentClicked, false);
  assert.equal(showClicked, false);
  assert.equal(dom.window.document.getElementById('chatgpt-web-injector-youtube-status')?.textContent, 'Transcript unavailable');
});

test('YouTube transcript panel button ignores visible non-transcript engagement panels', async () => {
  const dom = new JSDOM(`
    <html>
      <body>
        <div class="ytp-chrome-controls">
          <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
        </div>
        <ytd-engagement-panel-section-list-renderer visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED">
          <button aria-label="Open comments">Comments</button>
        </ytd-engagement-panel-section-list-renderer>
        <button aria-label="Show transcript">Show transcript</button>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'https://www.youtube.com/watch?v=test123',
  });

  let commentsClicked = false;
  let showClicked = false;
  dom.window.document.querySelector('[aria-label="Open comments"]').addEventListener('click', () => {
    commentsClicked = true;
  });
  dom.window.document.body.lastElementChild.addEventListener('click', () => {
    showClicked = true;
  });

  loadYoutubeSummary(dom);

  const button = dom.window.document.getElementById('chatgpt-web-injector-youtube-transcript');
  button.click();
  await Promise.resolve();

  assert.equal(commentsClicked, false);
  assert.equal(showClicked, true);
  assert.equal(dom.window.document.getElementById('chatgpt-web-injector-youtube-status'), null);
});

test('YouTube transcript panel button expands description once before opening transcript', async () => {
  const dom = new JSDOM(`
    <html>
      <body>
        <div class="ytp-chrome-controls">
          <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
        </div>
        <ytd-watch-metadata>
          <button id="expand" aria-expanded="false">Show more</button>
        </ytd-watch-metadata>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'https://www.youtube.com/watch?v=test123',
  });

  let expandClicks = 0;
  let nativeTranscriptClicked = false;
  const expandButton = dom.window.document.getElementById('expand');
  expandButton.addEventListener('click', () => {
    expandClicks += 1;
    expandButton.setAttribute('aria-expanded', 'true');
    setTimeout(() => {
      const transcriptButton = dom.window.document.createElement('button');
      transcriptButton.setAttribute('aria-label', 'Show transcript');
      transcriptButton.textContent = 'Show transcript';
      transcriptButton.addEventListener('click', () => {
        nativeTranscriptClicked = true;
      });
      dom.window.document.body.append(transcriptButton);
    }, 300);
  });

  loadYoutubeSummary(dom);

  const button = dom.window.document.getElementById('chatgpt-web-injector-youtube-transcript');
  button.click();
  await new Promise((resolve) => { setTimeout(resolve, 2200); });

  assert.equal(expandClicks, 1);
  assert.equal(nativeTranscriptClicked, true);
  assert.equal(dom.window.document.getElementById('chatgpt-web-injector-youtube-status'), null);
});

test('YouTube transcript panel button expands Chinese collapsed description before using hidden controls', async () => {
  const dom = new JSDOM(`
    <html>
      <body>
        <div class="ytp-chrome-controls">
          <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
        </div>
        <ytd-watch-metadata>
          <tp-yt-paper-button id="expand">...更多</tp-yt-paper-button>
          <div hidden>
            <button aria-label="内容转文字">Hidden transcript</button>
          </div>
        </ytd-watch-metadata>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'https://www.youtube.com/watch?v=test123',
  });

  let hiddenTranscriptClicked = false;
  let visibleTranscriptClicked = false;
  const expandButton = dom.window.document.getElementById('expand');
  dom.window.document.querySelector('[aria-label="内容转文字"]').addEventListener('click', () => {
    hiddenTranscriptClicked = true;
  });
  expandButton.addEventListener('click', () => {
    const transcriptButton = dom.window.document.createElement('button');
    transcriptButton.setAttribute('aria-label', '内容转文字');
    transcriptButton.textContent = '内容转文字';
    transcriptButton.addEventListener('click', () => {
      visibleTranscriptClicked = true;
    });
    dom.window.document.body.append(transcriptButton);
  });

  loadYoutubeSummary(dom);

  const button = dom.window.document.getElementById('chatgpt-web-injector-youtube-transcript');
  button.click();
  await new Promise((resolve) => { setTimeout(resolve, 250); });

  assert.equal(hiddenTranscriptClicked, false);
  assert.equal(visibleTranscriptClicked, true);
});

test('YouTube transcript panel button reopens after closing the transcript panel', async () => {
  const dom = new JSDOM(`
    <html>
      <body>
        <div class="ytp-chrome-controls">
          <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
        </div>
        <ytd-engagement-panel-section-list-renderer>
          <button aria-label="Close transcript">Close</button>
          <ytd-transcript-segment-renderer>
            <span class="segment-timestamp">0:01</span>
            <span class="segment-text">Open transcript</span>
          </ytd-transcript-segment-renderer>
        </ytd-engagement-panel-section-list-renderer>
        <button aria-label="Show transcript">Show transcript</button>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'https://www.youtube.com/watch?v=test123',
  });

  const panel = dom.window.document.querySelector('ytd-engagement-panel-section-list-renderer');
  let closeClicked = false;
  let showClicked = false;

  dom.window.document.querySelector('[aria-label="Close transcript"]').addEventListener('click', () => {
    closeClicked = true;
    panel.setAttribute('visibility', 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN');
  });
  dom.window.document.body.lastElementChild.addEventListener('click', () => {
    showClicked = true;
    panel.setAttribute('visibility', 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED');
  });

  loadYoutubeSummary(dom);

  const button = dom.window.document.getElementById('chatgpt-web-injector-youtube-transcript');
  button.click();
  await Promise.resolve();
  button.click();
  await Promise.resolve();

  assert.equal(closeClicked, true);
  assert.equal(showClicked, true);
  assert.equal(dom.window.document.getElementById('chatgpt-web-injector-youtube-status'), null);
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

test('YouTube summary reads transcript after opening a hidden native transcript control', async () => {
  const messages = [];
  const dom = new JSDOM(`
    <html>
      <body>
        <h1 class="ytd-watch-metadata">Fallback video</h1>
        <div class="ytp-chrome-controls">
          <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
        </div>
        <div hidden>
          <button aria-label="Show transcript">Native transcript</button>
        </div>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'https://www.youtube.com/watch?v=test123',
  });

  dom.window.fetch = async () => {
    throw new Error('network unavailable');
  };
  dom.window.document.querySelector('[aria-label="Show transcript"]').addEventListener('click', () => {
    const panel = dom.window.document.createElement('ytd-engagement-panel-section-list-renderer');
    panel.innerHTML = `
      <ytd-transcript-segment-renderer>
        <span class="segment-timestamp">0:05</span>
        <span class="segment-text">Fallback transcript line</span>
      </ytd-transcript-segment-renderer>
    `;
    dom.window.document.body.append(panel);
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
  await new Promise((resolve) => { setTimeout(resolve, 250); });

  assert.equal(messages[0].payload.transcript, '[00:05] Fallback transcript line');
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

test('YouTube transcript panel button closes an open transcript panel and ignores transcript segments containing close keywords like closed', async () => {
  const dom = new JSDOM(`
    <html>
      <body>
        <div class="ytp-chrome-controls">
          <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
        </div>
        <ytd-engagement-panel-section-list-renderer visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED">
          <button aria-label="Close transcript">Close</button>
          <ytd-transcript-segment-renderer>
            <button class="segment-text">we have open weight models that are approaching closed models</button>
          </ytd-transcript-segment-renderer>
        </ytd-engagement-panel-section-list-renderer>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'https://www.youtube.com/watch?v=test123',
  });

  let closeClicked = false;
  let segmentClicked = false;

  dom.window.document.querySelector('[aria-label="Close transcript"]').addEventListener('click', () => {
    closeClicked = true;
  });
  dom.window.document.querySelector('.segment-text').addEventListener('click', () => {
    segmentClicked = true;
  });

  loadYoutubeSummary(dom);

  const button = dom.window.document.getElementById('chatgpt-web-injector-youtube-transcript');
  button.click();
  await Promise.resolve();

  assert.equal(closeClicked, true, 'The close button should be clicked');
  assert.equal(segmentClicked, false, 'The transcript segment containing closed should NOT be clicked');
});
