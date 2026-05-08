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
