import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

test('Selection tooltip behavior based on showSelectionTooltip preference', async () => {
  const dom = new JSDOM('<html><body><div id="text">Hello World, this is a test text selection.</div></body></html>', {
    url: 'https://example.com'
  });

  const store = {}; // Default is empty to test the disabled-by-default behavior
  const storageListeners = [];
  let currentSelectionText = '';

  const windowMock = new Proxy(dom.window, {
    get(target, prop) {
      if (prop === 'getSelection') {
        return () => ({
          toString() {
            return currentSelectionText;
          }
        });
      }
      const val = target[prop];
      if (typeof val === 'function') {
        return val.bind(target);
      }
      return val;
    }
  });

  const context = {
    chrome: {
      runtime: { sendMessage() {} },
      storage: {
        sync: {
          get(keys, callback) {
            const res = {};
            for (const key of keys) {
              res[key] = store[key];
            }
            if (callback) callback(res);
            return Promise.resolve(res);
          },
          set(values) {
            Object.assign(store, values);
            return Promise.resolve();
          }
        },
        onChanged: {
          addListener(listener) {
            storageListeners.push(listener);
          }
        }
      }
    },
    console,
    document: dom.window.document,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    globalThis: null,
    setTimeout(callback, delay) {
      // Execute synchronously to eliminate latency for tests
      callback();
      return 1;
    },
    clearTimeout() {},
    window: windowMock,
  };

  context.globalThis = context;

  // Read and execute the content script
  const source = readFileSync(new URL('../src/selection_tooltip.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, context);

  // Helper function to trigger selection events
  function triggerSelection(text) {
    currentSelectionText = text;

    const mouseupEvent = new dom.window.MouseEvent('mouseup', { clientX: 100, clientY: 100 });
    dom.window.document.dispatchEvent(mouseupEvent);

    const selChangeEvent = new dom.window.Event('selectionchange');
    dom.window.document.dispatchEvent(selChangeEvent);
  }

  // 1. By default (unset / no preference saved), selecting text should NOT show the tooltip button
  triggerSelection('selected text');
  let tooltipBtn = dom.window.document.getElementById('chatgpt-web-injector-tooltip');
  assert.equal(tooltipBtn, null, 'Tooltip button should not appear by default when preference is unset');

  // 2. When preference is enabled (set to true), selecting text should show the tooltip button
  for (const listener of storageListeners) {
    listener({ showSelectionTooltip: { newValue: true } }, 'sync');
  }
  triggerSelection('another selected text');
  tooltipBtn = dom.window.document.getElementById('chatgpt-web-injector-tooltip');
  assert.ok(tooltipBtn, 'Tooltip button should appear when preference is enabled');

  // 3. When preference is disabled dynamically, any existing tooltip button should be removed instantly
  for (const listener of storageListeners) {
    listener({ showSelectionTooltip: { newValue: false } }, 'sync');
  }
  tooltipBtn = dom.window.document.getElementById('chatgpt-web-injector-tooltip');
  assert.equal(tooltipBtn, null, 'Tooltip button should be removed instantly when preference is disabled');

  // 4. When preference is disabled, selecting new text should NOT show the tooltip button
  triggerSelection('yet another selected text');
  tooltipBtn = dom.window.document.getElementById('chatgpt-web-injector-tooltip');
  assert.equal(tooltipBtn, null, 'Tooltip button should not appear when preference is disabled');
});
