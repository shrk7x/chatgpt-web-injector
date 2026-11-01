import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { runGeminiSendFlow } from '../src/gemini_content.js';

async function scenario({ editor = true, accepted = false, send = true, blocks = false } = {}) {
  const dom = new JSDOM(`<rich-textarea><div class="ql-clipboard" contenteditable="true"></div>${editor ? '<div class="ql-editor" contenteditable="true" role="textbox"></div>' : ''}</rich-textarea>${send ? '<button aria-label="发送">Send</button>' : ''}`);
  const previous = { document: globalThis.document, Event: globalThis.Event };
  Object.assign(globalThis, { document: dom.window.document, Event: dom.window.Event });
  const prompt = 'first\n\n第二行 😀';
  let clicks = 0;
  dom.window.document.execCommand = (_command, _ui, text) => {
    const input = dom.window.document.querySelector('.ql-editor');
    if (blocks) {
      for (const line of text.split('\n')) {
        const p = dom.window.document.createElement('p');
        if (line) p.textContent = line;
        else p.append(dom.window.document.createElement('br'));
        input.append(p);
      }
    } else input.textContent = text;
    return true;
  };
  dom.window.document.querySelector('button')?.addEventListener('click', () => {
    clicks += 1;
    if (accepted) {
      const query = dom.window.document.createElement('user-query');
      query.textContent = prompt;
      dom.window.document.body.append(query);
    }
  });
  try {
    const result = await runGeminiSendFlow(prompt, { maxAttempts: 2, intervalMs: 1 });
    assert.equal(dom.window.document.querySelector('.ql-clipboard').textContent, '');
    if (editor && !blocks) assert.equal(dom.window.document.querySelector('.ql-editor').textContent, prompt);
    return { result, clicks };
  } finally { Object.assign(globalThis, previous); dom.window.close(); }
}

test('Gemini preserves Unicode and multiline prompt and verifies actual submission', async () => {
  const { result, clicks } = await scenario({ accepted: true });
  assert.equal(result.ok, true);
  assert.equal(clicks, 1);
});
test('Gemini does not claim success or click twice on unconfirmed submission', async () => {
  const { result, clicks } = await scenario();
  assert.equal(result.ok, false);
  assert.equal(clicks, 1);
});
test('Gemini ignores clipboard editor and handles missing send controls', async () => {
  assert.equal((await scenario({ editor: false })).clicks, 0);
  assert.equal((await scenario({ send: false })).result.ok, false);
});

test('Gemini accepts actual paragraph DOM including blank lines', async () => {
  assert.equal((await scenario({ accepted: true, blocks: true })).result.ok, true);
});
