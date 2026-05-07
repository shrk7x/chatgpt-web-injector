import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

test('YouTube summary content scripts do not collide with selection tooltip globals', () => {
  const dom = new JSDOM('<html><body></body></html>', { url: 'https://www.youtube.com/watch?v=abc123' });
  const context = {
    chrome: { runtime: { sendMessage() {} } },
    console,
    document: dom.window.document,
    globalThis: null,
    localStorage: dom.window.localStorage,
    location: dom.window.location,
    MutationObserver: class {
      disconnect() {}
      observe() {}
    },
    navigator: dom.window.navigator,
    setTimeout() {
      return 0;
    },
    clearTimeout() {},
    window: dom.window,
  };

  context.globalThis = context;
  context.window = context;

  for (const path of [
    '../src/youtube_transcript.js',
    '../src/youtube_summary.js',
    '../src/selection_tooltip.js',
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotThrow(() => {
      vm.runInNewContext(source, context);
    });
  }
});
