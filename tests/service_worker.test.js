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
    async get(tabId) {
      return { id: tabId, status: 'complete' };
    },
    onUpdated: {
      addListener() {},
      removeListener() {},
    },
  },
};

const { getChatgptTargetUrl, waitForTabComplete } = await import('../src/service_worker.js');

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
