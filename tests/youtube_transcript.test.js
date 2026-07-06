import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadHelpers(options = {}) {
  const context = {
    DOMParser: options.DOMParser,
    navigator: options.navigator ?? { language: 'en-US' },
    URL,
  };

  context.globalThis = context;

  const source = readFileSync(new URL('../src/youtube_transcript.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, context);

  return context.ChatgptWebInjectorYoutubeTranscript;
}

test('chooseCaptionTrack prefers the active caption language', () => {
  const { chooseCaptionTrack } = loadHelpers();
  const tracks = [
    { languageCode: 'en', baseUrl: 'https://example.com/en' },
    { languageCode: 'ko', baseUrl: 'https://example.com/ko' },
  ];

  assert.deepEqual(chooseCaptionTrack(tracks, { activeLanguageCode: 'ko' }), tracks[1]);
});

test('chooseCaptionTrack falls back to default and then first readable track', () => {
  const { chooseCaptionTrack } = loadHelpers();
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

test('chooseCaptionTrack can fall back to the browser language before first track', () => {
  const { chooseCaptionTrack } = loadHelpers({ navigator: { language: 'ko-KR' } });
  const tracks = [
    { languageCode: 'en', baseUrl: 'https://example.com/en' },
    { languageCode: 'ko', baseUrl: 'https://example.com/ko' },
  ];

  assert.deepEqual(chooseCaptionTrack(tracks, { activeLanguageCode: 'de' }), tracks[1]);
});

test('parseTranscriptXml decodes captions into timestamped text', () => {
  const { parseTranscriptXml } = loadHelpers();
  const xml = `
    <transcript>
      <text start="0.4" dur="1.2">Hello &amp; welcome</text>
      <text start="65.2" dur="2">Second line</text>
    </transcript>
  `;

  assert.equal(parseTranscriptXml(xml), '[00:00] Hello & welcome\n[01:05] Second line');
});

test('parseTranscript decodes YouTube json3 captions into timestamped text', () => {
  const { parseTranscript } = loadHelpers();
  const json = JSON.stringify({
    events: [
      { tStartMs: 400, segs: [{ utf8: 'Hello ' }, { utf8: 'world' }] },
      { tStartMs: 65200, segs: [{ utf8: 'Second line' }] },
      { tStartMs: 70000 },
    ],
  });

  assert.equal(parseTranscript(json), '[00:00] Hello world\n[01:05] Second line');
});

test('parseTranscript keeps hour timestamps for long videos', () => {
  const { parseTranscript } = loadHelpers();
  const json = JSON.stringify({
    events: [
      { tStartMs: 3930000, segs: [{ utf8: 'Past the first hour' }] },
    ],
  });

  assert.equal(parseTranscript(json), '[01:05:30] Past the first hour');
});

test('parseTranscript decodes WebVTT captions into timestamped text', () => {
  const { parseTranscript } = loadHelpers();
  const vtt = `WEBVTT

00:00:00.400 --> 00:00:01.600
Hello world

00:01:05.200 --> 00:01:07.200
Second line
`;

  assert.equal(parseTranscript(vtt), '[00:00] Hello world\n[01:05] Second line');
});

test('buildCaptionUrl requests json3 format without dropping existing params', () => {
  const { buildCaptionUrl } = loadHelpers();

  assert.equal(
    buildCaptionUrl('https://example.com/api?lang=en&fmt=srv3'),
    'https://example.com/api?lang=en&fmt=json3'
  );
});

test('parseInnertubeTranscriptResponse decodes transcript panel segments', () => {
  const { parseInnertubeTranscriptResponse } = loadHelpers();
  const response = {
    actions: [
      {
        updateEngagementPanelAction: {
          content: {
            transcriptRenderer: {
              content: {
                transcriptSearchPanelRenderer: {
                  body: {
                    transcriptSegmentListRenderer: {
                      initialSegments: [
                        {
                          transcriptSegmentRenderer: {
                            startMs: '400',
                            snippet: { runs: [{ text: 'Hello ' }, { text: 'world' }] },
                          },
                        },
                        {
                          transcriptSegmentRenderer: {
                            startMs: '65200',
                            snippet: { simpleText: 'Second line' },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    ],
  };

  assert.equal(
    parseInnertubeTranscriptResponse(response),
    '[00:00] Hello world\n[01:05] Second line'
  );
});

test('parseModernTranscriptSegmentText separates new YouTube transcript segment text', () => {
  const { parseModernTranscriptSegmentText } = loadHelpers();

  assert.equal(
    JSON.stringify(parseModernTranscriptSegmentText('0:055秒钟You have to fight for the bill.')),
    JSON.stringify({ timestamp: '0:05', text: 'You have to fight for the bill.' })
  );
});

test('parseModernTranscriptSegmentText preserves hour timestamps', () => {
  const { parseModernTranscriptSegmentText } = loadHelpers();

  assert.equal(
    JSON.stringify(parseModernTranscriptSegmentText('1:23:45 Long-form point')),
    JSON.stringify({ timestamp: '1:23:45', text: 'Long-form point' })
  );
});

test('formatSrtTimestamp formats seconds to SRT time format', () => {
  const { formatSrtTimestamp } = loadHelpers();
  assert.equal(formatSrtTimestamp(0), '00:00:00,000');
  assert.equal(formatSrtTimestamp(12), '00:00:12,000');
  assert.equal(formatSrtTimestamp(12.345), '00:00:12,345');
  assert.equal(formatSrtTimestamp(65), '00:01:05,000');
  assert.equal(formatSrtTimestamp(3930), '01:05:30,000');
  // 防御性用例 (PR comments 覆盖)
  assert.equal(formatSrtTimestamp(-10), '00:00:00,000');
  assert.equal(formatSrtTimestamp(NaN), '00:00:00,000');
  assert.equal(formatSrtTimestamp('invalid'), '00:00:00,000');
});

test('convertToSrt converts transcript text with timestamps to SRT format', () => {
  const { convertToSrt } = loadHelpers();
  const transcript = '[00:12] Hello world\n[01:05] Next line\n[01:05:30] Third line';
  const expected = [
    '1',
    '00:00:12,000 --> 00:01:05,000',
    'Hello world',
    '',
    '2',
    '00:01:05,000 --> 01:05:30,000',
    'Next line',
    '',
    '3',
    '01:05:30,000 --> 01:05:33,000',
    'Third line',
    ''
  ].join('\n');

  assert.equal(convertToSrt(transcript), expected);
});

test('convertToSrt sorts unsorted segments before conversion', () => {
  const { convertToSrt } = loadHelpers();
  // 第二行时间戳 (00:05) 故意在第一行 (00:10) 之前，测试排序防御
  const transcript = '[00:10] First written line\n[00:05] Second written line';
  const expected = [
    '1',
    '00:00:05,000 --> 00:00:10,000',
    'Second written line',
    '',
    '2',
    '00:00:10,000 --> 00:00:13,000',
    'First written line',
    ''
  ].join('\n');

  assert.equal(convertToSrt(transcript), expected);
});

test('convertToSrt handles empty or invalid transcript gracefully', () => {
  const { convertToSrt } = loadHelpers();
  assert.equal(convertToSrt(''), '');
  assert.equal(convertToSrt(null), '');
  assert.equal(convertToSrt('invalid text'), '');
});

test('convertToTxt converts transcript text by keeping timestamps and splitting into lines', () => {
  const { convertToTxt } = loadHelpers();
  const transcript = '[00:12] Hello world\n[01:05] Next line\n[01:05:30] Third line';
  const expected = '[00:12] Hello world\n[01:05] Next line\n[01:05:30] Third line';
  assert.equal(convertToTxt(transcript), expected);
});

test('convertToTxt handles empty or invalid transcript gracefully', () => {
  const { convertToTxt } = loadHelpers();
  assert.equal(convertToTxt(''), '');
  assert.equal(convertToTxt(null), '');
});

test('parseTranscript handles wireCues json3 variant', () => {
  const { parseTranscript } = loadHelpers();
  const json = JSON.stringify({
    wireCues: [
      { tStartMs: 1000, cues: [{ utf8: 'Wire cue line' }] },
      { tStartMs: 65000, cues: [{ utf8: 'Second ' }, { utf8: 'wire' }] },
    ],
  });

  assert.equal(parseTranscript(json), '[00:01] Wire cue line\n[01:05] Second wire');
});

test('parseTranscript handles wpCues json3 variant', () => {
  const { parseTranscript } = loadHelpers();
  const json = JSON.stringify({
    wpCues: [
      { wpTStartMs: 2000, wpSegs: [{ utf8: 'WP cue line' }] },
      { wpTStartMs: 130000, wpSegs: [{ utf8: 'Another' }] },
    ],
  });

  assert.equal(parseTranscript(json), '[00:02] WP cue line\n[02:10] Another');
});

test('parseTranscript handles events with top-level utf8 field', () => {
  const { parseTranscript } = loadHelpers();
  const json = JSON.stringify({
    events: [
      { tStartMs: 500, utf8: 'Direct text' },
      { tStartMs: 3000, utf8: 'More text' },
    ],
  });

  assert.equal(parseTranscript(json), '[00:00] Direct text\n[00:03] More text');
});

test('parseTranscript returns empty for unknown json structure', () => {
  const { parseTranscript } = loadHelpers();
  const json = JSON.stringify({ unknownKey: [{ data: 'test' }] });
  assert.equal(parseTranscript(json), '');
});

