import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_TEMPLATE, getEffectiveTemplate, renderTemplate } from '../src/template.js';

test('renderTemplate replaces selection title and url', () => {
  const output = renderTemplate('Title: {{title}}\nURL: {{url}}\nBody: {{selection}}', {
    title: 'Example Page',
    url: 'https://example.com/article',
    selection: 'Selected text',
  });

  assert.equal(
    output,
    'Title: Example Page\nURL: https://example.com/article\nBody: Selected text'
  );
});

test('getEffectiveTemplate falls back to default when value is blank', () => {
  assert.equal(getEffectiveTemplate('   \n'), DEFAULT_TEMPLATE);
});

test('renderTemplate keeps empty selection as empty string', () => {
  const output = renderTemplate('Body:\n{{selection}}', {
    title: 'T',
    url: 'U',
    selection: '',
  });

  assert.equal(output, 'Body:\n');
});

test('renderTemplate replaces transcript for YouTube summary templates', () => {
  const output = renderTemplate('Video: {{title}}\nTranscript:\n{{transcript}}', {
    title: 'Example Video',
    transcript: 'First caption line.\nSecond caption line.',
  });

  assert.equal(output, 'Video: Example Video\nTranscript:\nFirst caption line.\nSecond caption line.');
});
