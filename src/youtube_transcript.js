(function initYoutubeTranscriptHelpers(globalScope) {
  function chooseCaptionTrack(tracks, options = {}) {
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return null;
    }

    const readableTracks = tracks.filter((track) => track?.baseUrl);
    if (readableTracks.length === 0) {
      return null;
    }

    const activeLanguageCode = options.activeLanguageCode;
    if (activeLanguageCode) {
      const activeTrack = readableTracks.find((track) => track.languageCode === activeLanguageCode);
      if (activeTrack) {
        return activeTrack;
      }
    }

    const browserLanguage = globalScope.navigator?.language?.split('-')[0];
    return readableTracks.find((track) => track.isDefault) ??
      readableTracks.find((track) => track.languageCode === browserLanguage) ??
      readableTracks[0];
  }

  function decodeHtmlEntities(text) {
    if (!text) {
      return '';
    }

    if (typeof globalScope.DOMParser !== 'undefined') {
      const doc = new globalScope.DOMParser().parseFromString(`<!doctype html><body>${text}`, 'text/html');
      return doc.body.textContent ?? '';
    }

    return text
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'");
  }

  function formatTimestamp(seconds) {
    const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    if (hours > 0) {
      return [
        String(hours).padStart(2, '0'),
        String(minutes).padStart(2, '0'),
        String(remainingSeconds).padStart(2, '0'),
      ].join(':');
    }

    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  function parseTimestamp(timestamp) {
    const parts = timestamp.split(':').map(Number);
    if (parts.length === 3) {
      return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    }
    if (parts.length === 2) {
      return (parts[0] * 60) + parts[1];
    }
    return Number(timestamp) || 0;
  }

  function parseTranscriptXml(xml) {
    if (!xml || typeof xml !== 'string') {
      return '';
    }

    const captions = [];
    const textNodePattern = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
    let match = textNodePattern.exec(xml);

    while (match) {
      const [, attrs, rawText] = match;
      const start = attrs.match(/\bstart="([^"]+)"/)?.[1] ?? '0';
      const text = decodeHtmlEntities(rawText.replaceAll('\n', ' ')).trim();

      if (text) {
        captions.push(`[${formatTimestamp(start)}] ${text}`);
      }

      match = textNodePattern.exec(xml);
    }

    return captions.join('\n');
  }

  function parseTranscriptJson(json) {
    let data;
    try {
      data = JSON.parse(json);
    } catch (_error) {
      return '';
    }

    if (!Array.isArray(data.events)) {
      return '';
    }

    return data.events
      .map((event) => {
        const text = Array.isArray(event.segs)
          ? event.segs.map((segment) => segment?.utf8 ?? '').join('').trim()
          : '';

        if (!text) {
          return '';
        }

        return `[${formatTimestamp((event.tStartMs ?? 0) / 1000)}] ${text}`;
      })
      .filter(Boolean)
      .join('\n');
  }

  function parseTranscriptVtt(vtt) {
    const lines = vtt.split(/\r?\n/);
    const captions = [];

    for (let i = 0; i < lines.length; i += 1) {
      const timing = lines[i].match(/^(\d{2}:\d{2}(?::\d{2})?\.\d{3})\s+-->/);
      if (!timing) {
        continue;
      }

      const textLines = [];
      i += 1;
      while (i < lines.length && lines[i].trim()) {
        const line = lines[i].trim();
        if (!line.startsWith('<')) {
          textLines.push(line.replace(/<[^>]+>/g, ''));
        }
        i += 1;
      }

      const text = decodeHtmlEntities(textLines.join(' ')).trim();
      if (text) {
        captions.push(`[${formatTimestamp(parseTimestamp(timing[1]))}] ${text}`);
      }
    }

    return captions.join('\n');
  }

  function textFromRuns(textObject) {
    if (Array.isArray(textObject?.runs)) {
      return textObject.runs.map((run) => run?.text ?? '').join('').trim();
    }
    return (textObject?.simpleText ?? '').trim();
  }

  function walkObject(value, visitor) {
    if (!value || typeof value !== 'object') {
      return;
    }

    visitor(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        walkObject(item, visitor);
      }
      return;
    }

    for (const item of Object.values(value)) {
      walkObject(item, visitor);
    }
  }

  function parseInnertubeTranscriptResponse(response) {
    const segments = [];

    walkObject(response, (node) => {
      const segment = node.transcriptSegmentRenderer;
      if (!segment) {
        return;
      }

      const text = textFromRuns(segment.snippet);
      if (!text) {
        return;
      }

      segments.push({
        startMs: Number(segment.startMs) || 0,
        text,
      });
    });

    return segments
      .sort((a, b) => a.startMs - b.startMs)
      .map((segment) => `[${formatTimestamp(segment.startMs / 1000)}] ${segment.text}`)
      .join('\n');
  }

  function parseModernTranscriptSegmentText(rawText) {
    const normalized = (rawText || '').trim().replace(/\s+/g, ' ');
    const match = normalized.match(/^(\d{1,2}:\d{2}(?::\d{2})?)(?:(?:\d+)?(?:秒钟|秒|second(?:s)?|分钟|minute(?:s)?))?(.*)$/i);
    if (!match) {
      return { timestamp: '', text: normalized };
    }

    return {
      timestamp: match[1],
      text: match[2].trim(),
    };
  }

  function parseTranscript(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    const trimmed = text.trim();
    if (trimmed.startsWith('{')) {
      return parseTranscriptJson(trimmed);
    }

    if (trimmed.startsWith('WEBVTT')) {
      return parseTranscriptVtt(trimmed);
    }

    return parseTranscriptXml(trimmed);
  }

  function buildCaptionUrl(baseUrl) {
    const url = new URL(baseUrl);
    url.searchParams.set('fmt', 'json3');
    return url.toString();
  }

  globalScope.ChatgptWebInjectorYoutubeTranscript = {
    buildCaptionUrl,
    chooseCaptionTrack,
    parseInnertubeTranscriptResponse,
    parseModernTranscriptSegmentText,
    parseTranscript,
    parseTranscriptXml,
  };
}(globalThis));
