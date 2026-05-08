import test, { after } from 'node:test';
import assert from 'node:assert/strict';

const previousChrome = globalThis.chrome;

globalThis.chrome = {
  contextMenus: {
    onClicked: { addListener() {} },
    create() {},
    removeAll(callback) {
      callback();
    },
  },
  runtime: {
    onInstalled: { addListener() {} },
    onMessage: { addListener() {} },
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
