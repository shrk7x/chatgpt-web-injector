import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_YOUTUBE_SUMMARY_TEMPLATE,
  loadYoutubeSummaryTemplate,
  resetYoutubeSummaryTemplate,
  saveYoutubeSummaryTemplate,
} from '../src/storage.js';

function installChromeStorage(initialData = {}) {
  const previousChrome = globalThis.chrome;
  const store = { ...initialData };

  globalThis.chrome = {
    storage: {
      sync: {
        async get(keys) {
          const result = {};
          for (const key of keys) {
            if (Object.hasOwn(store, key)) {
              result[key] = store[key];
            }
          }
          return result;
        },
        async set(values) {
          Object.assign(store, values);
        },
      },
    },
  };

  return {
    store,
    restore() {
      globalThis.chrome = previousChrome;
    },
  };
}

test('loadYoutubeSummaryTemplate falls back to the default template', async () => {
  const chromeStorage = installChromeStorage();

  try {
    const template = await loadYoutubeSummaryTemplate();

    assert.equal(template, DEFAULT_YOUTUBE_SUMMARY_TEMPLATE);
  } finally {
    chromeStorage.restore();
  }
});

test('loadYoutubeSummaryTemplate treats a blank saved template as the YouTube default', async () => {
  const chromeStorage = installChromeStorage({ youtubeSummaryTemplate: '   \n' });

  try {
    const template = await loadYoutubeSummaryTemplate();

    assert.equal(template, DEFAULT_YOUTUBE_SUMMARY_TEMPLATE);
  } finally {
    chromeStorage.restore();
  }
});

test('saveYoutubeSummaryTemplate persists a separate YouTube template', async () => {
  const chromeStorage = installChromeStorage();

  try {
    await saveYoutubeSummaryTemplate('Summarize {{transcript}}');
    const template = await loadYoutubeSummaryTemplate();

    assert.equal(template, 'Summarize {{transcript}}');
    assert.equal(chromeStorage.store.youtubeSummaryTemplate, 'Summarize {{transcript}}');
  } finally {
    chromeStorage.restore();
  }
});

test('resetYoutubeSummaryTemplate restores the default YouTube template', async () => {
  const chromeStorage = installChromeStorage({ youtubeSummaryTemplate: 'Custom {{transcript}}' });

  try {
    const template = await resetYoutubeSummaryTemplate();

    assert.equal(template, DEFAULT_YOUTUBE_SUMMARY_TEMPLATE);
    assert.equal(chromeStorage.store.youtubeSummaryTemplate, DEFAULT_YOUTUBE_SUMMARY_TEMPLATE);
  } finally {
    chromeStorage.restore();
  }
});
