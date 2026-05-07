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
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
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

  function parseTranscript(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    const trimmed = text.trim();
    if (trimmed.startsWith('{')) {
      return parseTranscriptJson(trimmed);
    }

    return parseTranscriptXml(trimmed);
  }

  globalScope.ChatgptWebInjectorYoutubeTranscript = {
    chooseCaptionTrack,
    parseTranscript,
    parseTranscriptXml,
  };
}(globalThis));
