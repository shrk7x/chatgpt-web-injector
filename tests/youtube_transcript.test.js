import test from 'node:test';
import assert from 'node:assert/strict';

import {
  chooseCaptionTrack,
  parseTranscriptXml,
} from '../src/youtube_transcript.js';

test('chooseCaptionTrack prefers the active caption language', () => {
  const tracks = [
    { languageCode: 'en', baseUrl: 'https://example.com/en' },
    { languageCode: 'ko', baseUrl: 'https://example.com/ko' },
  ];

  assert.deepEqual(chooseCaptionTrack(tracks, { activeLanguageCode: 'ko' }), tracks[1]);
});

test('chooseCaptionTrack falls back to default and then first readable track', () => {
  const tracks = [
    { languageCode: 'en', baseUrl: 'https://example.com/en' },
    { languageCode: 'ja', baseUrl: 'https://example.com/ja', isDefault: true },
  ];

  assert.deepEqual(chooseCaptionTrack(tracks, { activeLanguageCode: 'de' }), tracks[1]);
  assert.deepEqual(chooseCaptionTrack([{ languageCode: 'en', baseUrl: 'https://example.com/en' }]), {
    languageCode: 'en',
    baseUrl: 'https://example.com/en',
  });
});

test('parseTranscriptXml decodes captions into timestamped text', () => {
  const xml = `
    <transcript>
      <text start="0.4" dur="1.2">Hello &amp; welcome</text>
      <text start="65.2" dur="2">Second line</text>
    </transcript>
  `;

  assert.equal(parseTranscriptXml(xml), '[00:00] Hello & welcome\n[01:05] Second line');
});
