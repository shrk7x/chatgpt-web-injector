import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tooltipCss = readFileSync(new URL('../src/selection_tooltip.css', import.meta.url), 'utf8');

test('selection tooltip uses an Ask AI label instead of BOT', () => {
  assert.match(tooltipCss, /content:\s*'AI'/);
  assert.match(tooltipCss, /content:\s*'Ask'/);
  assert.doesNotMatch(tooltipCss, /content:\s*'BOT'/);
});
