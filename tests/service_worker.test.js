import test, { after } from 'node:test';
import assert from 'node:assert/strict';

const listeners = {};
const previousChrome = globalThis.chrome;

globalThis.chrome = {
  action: { async setBadgeText() {}, async setTitle() {} },
  contextMenus: {
    onClicked: { addListener(fn) { listeners.context = fn; } },
    create() {},
    removeAll(callback) {
      callback();
    },
  },
  runtime: {
    onInstalled: { addListener() {} },
    onMessage: { addListener(fn) { listeners.message = fn; } },
  },
  storage: {
    onChanged: { addListener() {} },
  },
  tabs: {
    async create() {
      return { id: 123, status: 'complete' };
    },
    async get(tabId) {
      return { id: tabId, status: 'complete' };
    },
    onUpdated: {
      addListener() {},
      removeListener() {},
    },
  },
  scripting: {
    async executeScript() {
      return [{ result: { ok: true } }];
    },
  },
};

const {
  executeChatgptSendFlow,
  getChatgptTargetUrl,
  waitForTabComplete,
} = await import('../src/service_worker.js');

after(() => {
  globalThis.chrome = previousChrome;
});

test('getChatgptTargetUrl returns temporary URL only when enabled', () => {
  assert.equal(getChatgptTargetUrl(true), 'https://chatgpt.com/?temporary-chat=true');
  assert.equal(getChatgptTargetUrl(false), 'https://chatgpt.com/');
});

test('waitForTabComplete resolves when the tab is already complete', async () => {
  await waitForTabComplete(123, 1);
});

test('waitForTabComplete rejects when the tab cannot be read', async () => {
  const originalGet = globalThis.chrome.tabs.get;
  globalThis.chrome.tabs.get = async () => {
    throw new Error('No tab with id: 456');
  };

  try {
    await assert.rejects(() => waitForTabComplete(456, 100), /No tab with id: 456/);
  } finally {
    globalThis.chrome.tabs.get = originalGet;
  }
});

test('executeChatgptSendFlow retries when ChatGPT replaces the main frame', async () => {
  let attempts = 0;
  globalThis.chrome.scripting.executeScript = async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error('Frame with ID 0 was removed.');
    }
    return [{ result: { ok: true } }];
  };

  const result = await executeChatgptSendFlow(123, 'hello', {
    maxAttempts: 1,
    intervalMs: 1,
    injectAttempts: 2,
    injectRetryMs: 1,
  });

  assert.equal(attempts, 2);
  assert.deepEqual(result, { ok: true });
});

for (const entry of ['selection', 'context', 'youtube']) {
  test(`Gemini routes ${entry} to Gemini without temporary ChatGPT mode`, async () => {
    const calls = [];
    const records = {};
    let finish;
    const sent = new Promise((resolve) => { finish = resolve; });
    chrome.storage.sync = { async get() { return {
      targetProvider: 'gemini', templates: [{ id: 'default', name: 'Test', body: '{{selection}}' }],
      activeTemplateId: 'default', youtubeSummaryTemplate: '{{transcript}}',
    }; } };
    chrome.storage.local = {
      async set(values) { Object.assign(records, values); },
      async remove(key) { delete records[key]; finish(); },
    };
    chrome.tabs.create = async (properties) => { calls.push(properties); return { id: 123 }; };
    chrome.scripting.executeScript = async (details) => {
      assert.equal(details.func.name, 'runGeminiSendFlow');
      assert.equal(details.args[0], '全文\n😀');
      return [{ result: { ok: true } }];
    };
    if (entry === 'context') await listeners.context({ menuItemId: 'send-to-chatgpt-tpl-default', selectionText: '全文\n😀' }, {});
    else listeners.message(entry === 'youtube'
      ? { type: 'YOUTUBE_SUMMARY_SEND', payload: { transcript: '全文\n😀' } }
      : { type: 'SELECTION_SEND', payload: { selectionText: '全文\n😀' } }, {});
    await sent;
    assert.equal(calls[0].url, 'https://gemini.google.com/app');
    assert.deepEqual(records, {});
  });
}

for (const failure of ['navigation', 'injection', 'unconfirmed']) {
  test(`${failure} failure retains full prompt and opens recovery without prompt in URL`, async () => {
    const { sendPrompt } = await import('../src/service_worker.js');
    const prompt = 'private prompt 😀';
    const records = {};
    const calls = [];
    chrome.storage.sync = { async get() { return { targetProvider: 'gemini' }; } };
    chrome.storage.local = { async set(values) { Object.assign(records, values); }, async remove() {} };
    chrome.runtime.getURL = (path) => `chrome-extension://test/${path}`;
    chrome.tabs.create = async (properties) => {
      calls.push(properties);
      if (failure === 'navigation' && calls.length === 1) throw new Error('navigation failed');
      return { id: 123 };
    };
    chrome.scripting.executeScript = async () => {
      if (failure === 'injection') throw new Error('injection denied');
      return [{ result: { ok: false, reason: 'submission_unconfirmed' } }];
    };
    await sendPrompt(prompt);
    assert.equal(Object.values(records)[0].prompt, prompt);
    assert.match(calls[1].url, /options\/options.html#pendingPrompt_/);
    assert.equal(calls[1].url.includes(prompt), false);
  });
}

test('initial recovery storage failure shows full copy prompt without attempting submission', async () => {
  const { sendPrompt } = await import('../src/service_worker.js');
  const injections = [];
  chrome.storage.sync = { async get() { return { targetProvider: 'gemini' }; } };
  chrome.storage.local = { async set() { throw new Error('quota'); } };
  chrome.tabs.create = async () => ({ id: 123 });
  chrome.scripting.executeScript = async (details) => { injections.push(details); return []; };
  await sendPrompt('full\n提示 😀');
  assert.equal(injections.length, 1);
  assert.equal(injections[0].func.name, 'showPromptNotice');
  assert.equal(injections[0].args[0], 'full\n提示 😀');
});

test('confirmed submission cleanup failure does not open unconfirmed recovery', async () => {
  const { sendPrompt } = await import('../src/service_worker.js');
  const calls = [];
  const records = {};
  chrome.storage.sync = { async get() { return { targetProvider: 'gemini' }; } };
  chrome.storage.local = {
    async set(values) { Object.assign(records, values); },
    async remove() { throw new Error('cleanup unavailable'); },
  };
  chrome.tabs.create = async (properties) => { calls.push(properties); return { id: 123 }; };
  chrome.scripting.executeScript = async () => [{ result: { ok: true } }];
  await sendPrompt('already submitted');
  assert.equal(calls.length, 1);
  assert.equal(Object.values(records)[0].submitted, true);
  assert.equal(Object.values(records)[0].prompt, undefined);
});

test('unavailable storage and page fallback produce visible toolbar error', async () => {
  const { sendPrompt } = await import('../src/service_worker.js');
  const status = {};
  chrome.storage.sync = { async get() { return { targetProvider: 'gemini' }; } };
  chrome.storage.local = { async set() { throw new Error('storage unavailable'); } };
  chrome.tabs.create = async () => { throw new Error('tabs unavailable'); };
  chrome.action = {
    async setBadgeText(value) { status.badge = value.text; },
    async setTitle(value) { status.title = value.title; },
  };
  await sendPrompt('unrecoverable prompt');
  assert.equal(status.badge, '!');
  assert.match(status.title, /could not be saved or displayed/);
});

test('successful later send clears stale toolbar failure status', async () => {
  const { sendPrompt } = await import('../src/service_worker.js');
  const status = { badge: '!', title: 'Send failed' };
  chrome.action = {
    async setBadgeText(value) { status.badge = value.text; },
    async setTitle(value) { status.title = value.title; },
  };
  chrome.storage.sync = { async get() { return { targetProvider: 'gemini' }; } };
  chrome.storage.local = { async set() {}, async remove() {} };
  chrome.tabs.create = async () => ({ id: 123 });
  chrome.scripting.executeScript = async () => [{ result: { ok: true } }];
  await sendPrompt('new successful prompt');
  assert.equal(status.badge, '');
  assert.equal(status.title, 'ChatGPT Web Injector');
});
