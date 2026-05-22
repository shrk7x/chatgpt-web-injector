import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

test('Options page exposes a YouTube Temporary Chat toggle', () => {
  const html = readFileSync(new URL('../options/options.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html);
  const checkbox = dom.window.document.getElementById('youtube-temporary-chat');

  assert.ok(checkbox);
  assert.equal(checkbox.tagName, 'INPUT');
  assert.equal(checkbox.getAttribute('type'), 'checkbox');
});

test('Options page exposes a Selection Tooltip visibility toggle', () => {
  const html = readFileSync(new URL('../options/options.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html);
  const checkbox = dom.window.document.getElementById('show-selection-tooltip');

  assert.ok(checkbox);
  assert.equal(checkbox.tagName, 'INPUT');
  assert.equal(checkbox.getAttribute('type'), 'checkbox');
});
