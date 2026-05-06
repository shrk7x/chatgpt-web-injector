export function chooseCaptionTrack(tracks, options = {}) {
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

  return readableTracks.find((track) => track.isDefault) ?? readableTracks[0];
}

function decodeHtmlEntities(text) {
  if (!text) {
    return '';
  }

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(`<!doctype html><body>${text}`, 'text/html');
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

export function parseTranscriptXml(xml) {
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
