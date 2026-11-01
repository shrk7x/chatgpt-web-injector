import test from 'node:test';
import assert from 'node:assert/strict';
import { findReleasePullRequest, mergeReleasePullRequest } from '../scripts/weekly_release.js';

const context = { repo: { owner: 'owner', repo: 'extension' } };
const pending = {
  number: 76,
  draft: false,
  user: { login: 'github-actions[bot]' },
  head: {
    ref: 'release-please--branches--main--components--chatgpt-web-injector',
    sha: 'tested-head',
    repo: { full_name: 'owner/extension' }
  },
  labels: [{ name: 'autorelease: pending' }]
};
const find = (pulls) => findReleasePullRequest({
  context,
  github: { rest: { pulls: { list: 'list' } }, paginate: async () => pulls }
});

test('an empty week has no release', async () => {
  assert.equal(await find([]), null);
});

test('selects the pending release PR', async () => {
  assert.deepEqual(await find([pending]), pending);
});

for (const [name, changes] of [
  ['draft', { draft: true }],
  ['human author', { user: { login: 'someone' } }],
  ['missing release label', { labels: [] }],
  ['unrelated branch', { head: { ...pending.head, ref: 'feature' } }],
  ['fork', { head: { ...pending.head, repo: { full_name: 'fork/extension' } } }]
]) {
  test(`does not auto-merge a PR with ${name}`, async () => {
    assert.equal(await find([{ ...pending, ...changes }]), null);
  });
}

test('ambiguous releases fail instead of picking one', async () => {
  await assert.rejects(find([pending, { ...pending, number: 77 }]), /Multiple/);
});

test('squash merges only the revision that passed tests', async () => {
  let request;
  await mergeReleasePullRequest({
    context, number: 76, sha: 'tested-head',
    github: { rest: { pulls: { merge: async (input) => {
      request = input;
      return { data: { merged: true } };
    } } } }
  });
  assert.deepEqual(request, {
    owner: 'owner', repo: 'extension', pull_number: 76,
    sha: 'tested-head', merge_method: 'squash'
  });
});

test('merge refusal stops publication', async () => {
  await assert.rejects(mergeReleasePullRequest({
    context, number: 76, sha: 'tested-head',
    github: { rest: { pulls: { merge: async () => ({
      data: { merged: false, message: 'blocked' }
    }) } } }
  }), /not merged: blocked/);
});

test('a changed head or API failure stops publication', async () => {
  await assert.rejects(mergeReleasePullRequest({
    context, number: 76, sha: 'tested-head',
    github: { rest: { pulls: { merge: async () => { throw new Error('SHA mismatch'); } } } }
  }), /SHA mismatch/);
});
