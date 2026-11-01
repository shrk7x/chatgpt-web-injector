import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

for (const surface of ['popup', 'options']) {
  test(`${surface} saves target, synchronizes changes, disables temporary chat and recovers from save failure`, async () => {
    const html = await readFile(new URL(`../${surface}/${surface}.html`, import.meta.url), 'utf8');
    const dom = new JSDOM(html, { url: 'https://extension.test/' });
    const previous = { window: globalThis.window, document: globalThis.document, chrome: globalThis.chrome };
    const listeners = [];
    let rejectSave = false;
    const data = { templates: [{ id: 'default', name: 'Test', body: 'Test' }], activeTemplateId: 'default', targetProvider: 'chatgpt' };
    Object.assign(globalThis, {
      window: dom.window, document: dom.window.document,
      chrome: { storage: {
        sync: {
          async get() { return data; },
          async set(values) { if (rejectSave) throw new Error('quota'); Object.assign(data, values); },
        },
        local: { async get() { return {}; } },
        onChanged: { addListener(listener) { listeners.push(listener); } },
      } },
    });
    const flush = () => new Promise((resolve) => setImmediate(resolve));
    try {
      await import(`../${surface}/${surface}.js?target-ui-test`);
      await flush();
      const select = document.getElementById('target-provider');
      const temporary = document.getElementById(surface === 'popup' ? 'youtube-temp-chat-toggle' : 'youtube-temporary-chat');
      assert.equal(select.value, 'chatgpt');
      select.value = 'gemini';
      select.dispatchEvent(new dom.window.Event('change'));
      await flush();
      assert.equal(data.targetProvider, 'gemini');
      assert.equal(temporary.disabled, true);
      for (const listener of listeners) listener({ targetProvider: { newValue: 'chatgpt' } }, 'sync');
      assert.equal(select.value, 'chatgpt');
      assert.equal(temporary.disabled, false);
      rejectSave = true;
      select.value = 'gemini';
      select.dispatchEvent(new dom.window.Event('change'));
      await flush();
      assert.equal(select.value, 'chatgpt');
      assert.equal(select.disabled, false);
      assert.match(document.getElementById('target-status').textContent, /Could not save/);
    } finally { Object.assign(globalThis, previous); dom.window.close(); }
  });
}
