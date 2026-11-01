import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishExtension } from '../scripts/chrome_webstore.js';

const config = {
  CHROME_ACCESS_TOKEN: 'short-lived-token',
  CHROME_PUBLISHER_ID: 'publisher',
  CHROME_EXTENSION_ID: 'a'.repeat(32)
};

function api(responses) {
  const calls = [];
  return {
    calls,
    fetch: async (url, options) => {
      calls.push({ url, ...options });
      const next = responses.shift();
      assert.ok(next, `Unexpected request: ${url}`);
      return new Response(JSON.stringify(next.body ?? next), { status: next.status ?? 200 });
    }
  };
}

async function run(mock, env = config) {
  return publishExtension({
    env, zip: Buffer.from('zip'), version: '0.1.2',
    fetch: mock.fetch, sleep: async () => {}, log: () => {}
  });
}

test('missing configuration fails before making network requests', async () => {
  const mock = api([]);
  await assert.rejects(run(mock, {}), /CHROME_ACCESS_TOKEN/);
  assert.equal(mock.calls.length, 0);
});

test('expired or unauthorized token stops before upload without logging response secrets', async () => {
  const mock = api([{ status: 401, body: { error: 'invalid_token', privateValue: 'private-token' } }]);
  await assert.rejects(run(mock), (error) => {
    assert.match(error.message, /Status.*401/);
    assert.doesNotMatch(error.message, /private-token/);
    return true;
  });
  assert.equal(mock.calls.length, 1);
});

test('uploads through v2 and requests automatic publication after review', async () => {
  const mock = api([{}, { uploadState: 'SUCCEEDED', crxVersion: '0.1.2' }, { state: 'PENDING_REVIEW' }]);
  assert.equal(await run(mock), 'PENDING_REVIEW');
  assert.match(mock.calls[1].url, /\/upload\/v2\/publishers\/publisher\/items\/a{32}:upload$/);
  assert.equal(mock.calls[1].method, 'POST');
  assert.deepEqual(JSON.parse(mock.calls[2].body), { publishType: 'DEFAULT_PUBLISH' });
});

test('waits for asynchronous upload before submitting', async () => {
  const mock = api([{}, { uploadState: 'IN_PROGRESS' }, { lastAsyncUploadState: 'IN_PROGRESS' }, { lastAsyncUploadState: 'SUCCEEDED' }, { state: 'PENDING_REVIEW' }]);
  assert.equal(await run(mock), 'PENDING_REVIEW');
  assert.match(mock.calls[2].url, /:fetchStatus$/);
  assert.match(mock.calls[4].url, /:publish$/);
});

for (const state of ['FAILED', 'NOT_FOUND', 'UPLOAD_STATE_UNSPECIFIED']) {
  test(`does not publish an upload in state ${state}`, async () => {
    const mock = api([{}, { uploadState: state }]);
    await assert.rejects(run(mock), /Upload/);
    assert.equal(mock.calls.length, 2);
  });
}

test('async upload failure stops publication', async () => {
  const mock = api([{}, { uploadState: 'IN_PROGRESS' }, { lastAsyncUploadState: 'FAILED' }]);
  await assert.rejects(run(mock), /Upload/);
  assert.equal(mock.calls.length, 3);
});

test('async processing has a bounded wait', async () => {
  const mock = api([{}, { uploadState: 'IN_PROGRESS' }, ...Array.from({ length: 30 }, () => ({ lastAsyncUploadState: 'IN_PROGRESS' }))]);
  await assert.rejects(run(mock), /Upload/);
  assert.equal(mock.calls.length, 32);
});

test('wrong uploaded version is never submitted', async () => {
  const mock = api([{}, { uploadState: 'SUCCEEDED', crxVersion: '0.1.1' }]);
  await assert.rejects(run(mock), /version/);
  assert.equal(mock.calls.length, 2);
});

test('HTTP upload failures fail the operation', async () => {
  const mock = api([{}, { status: 403, body: { error: { message: 'Permission denied' } } }]);
  await assert.rejects(run(mock), /Upload.*403/);
});

for (const state of ['REJECTED', 'STAGED', 'ITEM_STATE_UNSPECIFIED']) {
  test(`submission state ${state} is not reported as success`, async () => {
    const mock = api([{}, { uploadState: 'SUCCEEDED', crxVersion: '0.1.2' }, { state }]);
    await assert.rejects(run(mock), /Publish/);
  });
}

for (const [key, state] of [['publishedItemRevisionStatus', 'PUBLISHED'], ['submittedItemRevisionStatus', 'PENDING_REVIEW']]) {
  test(`retry skips a matching version already ${state}`, async () => {
    const mock = api([{ [key]: { state, distributionChannels: [{ crxVersion: '0.1.2' }] } }]);
    assert.equal(await run(mock), state);
    assert.equal(mock.calls.length, 1);
  });
}

test('does not overwrite a different version awaiting review', async () => {
  const mock = api([{ submittedItemRevisionStatus: { state: 'PENDING_REVIEW', distributionChannels: [{ crxVersion: '0.1.1' }] } }]);
  assert.equal(await run(mock), 'DEFERRED');
  assert.equal(mock.calls.length, 1);
});

test('accepts a short-lived service-account token without OAuth client secrets', async () => {
  const mock = api([{}, { uploadState: 'SUCCEEDED', crxVersion: '0.1.2' }, { state: 'PENDING_REVIEW' }]);
  const env = { CHROME_ACCESS_TOKEN: 'short-lived-token', CHROME_PUBLISHER_ID: config.CHROME_PUBLISHER_ID, CHROME_EXTENSION_ID: config.CHROME_EXTENSION_ID };
  assert.equal(await run(mock, env), 'PENDING_REVIEW');
  assert.equal(mock.calls[0].headers.Authorization, 'Bearer short-lived-token');
});

test('a deferred release can be submitted on the next run after the old review clears', async () => {
  const firstWeek = api([{ submittedItemRevisionStatus: {
    state: 'PENDING_REVIEW', distributionChannels: [{ crxVersion: '0.1.1' }]
  } }]);
  assert.equal(await run(firstWeek), 'DEFERRED');
  assert.equal(firstWeek.calls.length, 1);

  const nextWeek = api([
    { publishedItemRevisionStatus: {
      state: 'PUBLISHED', distributionChannels: [{ crxVersion: '0.1.1' }]
    } },
    { uploadState: 'SUCCEEDED', crxVersion: '0.1.2' },
    { state: 'PENDING_REVIEW' }
  ]);
  assert.equal(await run(nextWeek), 'PENDING_REVIEW');
  assert.equal(nextWeek.calls.length, 3);
});
