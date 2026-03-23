import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { runChatgptSendFlow } from '../src/chatgpt_content.js';

function withDom(dom, callback) {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousEvent = globalThis.Event;
  const previousMouseEvent = globalThis.MouseEvent;

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      globalThis.window = previousWindow;
      globalThis.document = previousDocument;
      globalThis.Event = previousEvent;
      globalThis.MouseEvent = previousMouseEvent;
    });
}

test('runChatgptSendFlow inserts prompt and clicks send button', async () => {
  const dom = new JSDOM(`
    <html>
      <body>
        <textarea id="composer"></textarea>
        <button data-testid="send-button">Send</button>
      </body>
    </html>
  `);

  const { document, Event } = dom.window;
  const textarea = document.querySelector('#composer');
  const send = document.querySelector('[data-testid="send-button"]');

  let inputFired = 0;
  let clicked = false;

  textarea.addEventListener('input', () => {
    inputFired += 1;
  });

  send.addEventListener('click', (event) => {
    event.preventDefault();
    clicked = true;
  });

  const result = await withDom(dom, () =>
    runChatgptSendFlow('hello world', { maxAttempts: 1, intervalMs: 1 })
  );

  assert.equal(result.ok, true);
  assert.equal(textarea.value, 'hello world');
  assert.equal(inputFired > 0, true);
  assert.equal(clicked, true);
});

test('runChatgptSendFlow retries until composer appears', async () => {
  const dom = new JSDOM(`
    <html>
      <body>
        <div id="mount"></div>
      </body>
    </html>
  `);

  const { document } = dom.window;

  setTimeout(() => {
    const textarea = document.createElement('textarea');
    const send = document.createElement('button');
    send.setAttribute('data-testid', 'send-button');
    document.body.append(textarea, send);
  }, 12);

  const result = await withDom(dom, () =>
    runChatgptSendFlow('delayed hello', { maxAttempts: 8, intervalMs: 5 })
  );

  const textarea = document.querySelector('textarea');
  assert.equal(result.ok, true);
  assert.equal(textarea.value, 'delayed hello');
});

test('runChatgptSendFlow shows fallback modal when send control is missing', async () => {
  const dom = new JSDOM(`
    <html>
      <body>
        <textarea id="composer"></textarea>
      </body>
    </html>
  `);

  const result = await withDom(dom, () =>
    runChatgptSendFlow('hello world', { maxAttempts: 2, intervalMs: 1 })
  );
  const modal = dom.window.document.getElementById('chatgpt-web-injector-fallback');

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'send_not_found');
  assert.equal(Boolean(modal), true);
});
