import test from 'node:test';
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
    onUpdated: {
      addListener() {},
      removeListener() {},
    },
  },
};

const { getChatgptTargetUrl } = await import('../src/service_worker.js');

globalThis.chrome = previousChrome;

test('getChatgptTargetUrl returns temporary URL only when enabled', () => {
  assert.equal(getChatgptTargetUrl(true), 'https://chatgpt.com/?temporary-chat=true');
  assert.equal(getChatgptTargetUrl(false), 'https://chatgpt.com/');
});
