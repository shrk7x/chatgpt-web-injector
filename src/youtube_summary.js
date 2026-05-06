const YOUTUBE_SUMMARY_BUTTON_ID = 'chatgpt-web-injector-youtube-summary';
const YOUTUBE_SUMMARY_STATUS_ID = 'chatgpt-web-injector-youtube-status';
const YOUTUBE_WATCH_PATH = '/watch';
const BUTTON_RETRY_MS = 750;
const STATUS_TIMEOUT_MS = 2500;
const DEBUG = false;

let lastUrl = '';
let mountTimer = null;
let statusTimer = null;

function log(...args) {
  if (DEBUG) {
    console.log('[ChatGPT Web Injector - YouTube]', ...args);
  }
}

function isWatchPage() {
  return window.location.hostname.endsWith('youtube.com') && window.location.pathname === YOUTUBE_WATCH_PATH;
}

function removeButton() {
  document.getElementById(YOUTUBE_SUMMARY_BUTTON_ID)?.remove();
  document.getElementById(YOUTUBE_SUMMARY_STATUS_ID)?.remove();
}

function showStatus(message) {
  const button = document.getElementById(YOUTUBE_SUMMARY_BUTTON_ID);
  if (!button) {
    return;
  }

  clearTimeout(statusTimer);
  document.getElementById(YOUTUBE_SUMMARY_STATUS_ID)?.remove();

  const status = document.createElement('span');
  status.id = YOUTUBE_SUMMARY_STATUS_ID;
  status.textContent = message;
  status.setAttribute('role', 'status');

  button.insertAdjacentElement('afterend', status);
  statusTimer = setTimeout(() => {
    status.remove();
  }, STATUS_TIMEOUT_MS);
}

function setButtonLoading(isLoading) {
  const button = document.getElementById(YOUTUBE_SUMMARY_BUTTON_ID);
  if (!button) {
    return;
  }

  button.disabled = isLoading;
  button.classList.toggle('is-loading', isLoading);
  button.setAttribute('aria-busy', String(isLoading));
}

function decodeHtmlEntities(text) {
  if (!text) {
    return '';
  }

  const doc = new DOMParser().parseFromString(`<!doctype html><body>${text}`, 'text/html');
  return doc.body.textContent ?? '';
}

function formatTimestamp(seconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function parseTranscriptXml(xml) {
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

function extractBalancedJson(text, marker) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const start = text.indexOf('{', markerIndex + marker.length);
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function getPlayerResponseFromHtml(html) {
  const json = extractBalancedJson(html, 'ytInitialPlayerResponse');
  if (!json) {
    return null;
  }

  try {
    return JSON.parse(json);
  } catch (error) {
    log('Failed to parse player response:', error);
    return null;
  }
}

function getPlayerResponseFromPageScripts() {
  for (const script of document.scripts) {
    const response = getPlayerResponseFromHtml(script.textContent || '');
    if (response) {
      return response;
    }
  }
  return null;
}

async function fetchCurrentPlayerResponse() {
  const response = await fetch(window.location.href, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('watch_page_fetch_failed');
  }

  return getPlayerResponseFromHtml(await response.text());
}

function getCaptionTracks(playerResponse) {
  return playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
}

function getActiveCaptionLanguageCode() {
  const subtitlesButton = document.querySelector('.ytp-subtitles-button');
  const isPressed = subtitlesButton?.getAttribute('aria-pressed') === 'true';
  if (!isPressed) {
    return '';
  }

  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    const value = key ? window.localStorage.getItem(key) : '';
    const languageCode = value?.match(/"languageCode"\s*:\s*"([^"]+)"/)?.[1];
    if (languageCode) {
      return languageCode;
    }
  }

  return '';
}

function chooseCaptionTrack(tracks, activeLanguageCode) {
  const readableTracks = tracks.filter((track) => track?.baseUrl);
  if (readableTracks.length === 0) {
    return null;
  }

  if (activeLanguageCode) {
    const activeTrack = readableTracks.find((track) => track.languageCode === activeLanguageCode);
    if (activeTrack) {
      return activeTrack;
    }
  }

  const browserLanguage = navigator.language?.split('-')[0];
  return readableTracks.find((track) => track.isDefault) ??
    readableTracks.find((track) => track.languageCode === browserLanguage) ??
    readableTracks[0];
}

async function getTranscript() {
  const playerResponse = await fetchCurrentPlayerResponse().catch(() => getPlayerResponseFromPageScripts());
  const tracks = getCaptionTracks(playerResponse);
  const track = chooseCaptionTrack(tracks, getActiveCaptionLanguageCode());

  if (!track) {
    throw new Error('no_caption_track');
  }

  const response = await fetch(track.baseUrl, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('caption_fetch_failed');
  }

  const transcript = parseTranscriptXml(await response.text());
  if (!transcript) {
    throw new Error('empty_transcript');
  }

  return transcript;
}

async function sendYoutubeSummary() {
  setButtonLoading(true);

  try {
    const transcript = await getTranscript();
    const payload = {
      title: document.querySelector('h1.ytd-watch-metadata')?.textContent?.trim() || document.title,
      url: window.location.href,
      transcript,
    };

    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      showStatus('Extension unavailable');
      return;
    }

    try {
      chrome.runtime.sendMessage({ type: 'YOUTUBE_SUMMARY_SEND', payload });
    } catch (err) {
      console.warn('[ChatGPT Web Injector] YouTube summary message failed:', err);
      showStatus('Refresh this tab');
      return;
    }

    showStatus('Sent to ChatGPT');
  } catch (error) {
    console.warn('[ChatGPT Web Injector] YouTube summary failed:', error);
    showStatus('No readable captions');
  } finally {
    setButtonLoading(false);
  }
}

function createButton() {
  const button = document.createElement('button');
  button.id = YOUTUBE_SUMMARY_BUTTON_ID;
  button.type = 'button';
  button.title = 'Summarize with ChatGPT';
  button.setAttribute('aria-label', 'Summarize with ChatGPT');
  button.textContent = 'AI';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    sendYoutubeSummary();
  });
  return button;
}

function mountButton() {
  clearTimeout(mountTimer);

  if (!isWatchPage()) {
    removeButton();
    return;
  }

  if (document.getElementById(YOUTUBE_SUMMARY_BUTTON_ID)) {
    return;
  }

  const subtitlesButton = document.querySelector('.ytp-subtitles-button');
  if (!subtitlesButton?.parentElement) {
    mountTimer = setTimeout(mountButton, BUTTON_RETRY_MS);
    return;
  }

  subtitlesButton.insertAdjacentElement('afterend', createButton());
}

function handleNavigation() {
  if (lastUrl === window.location.href) {
    mountButton();
    return;
  }

  lastUrl = window.location.href;
  removeButton();
  mountButton();
}

document.addEventListener('yt-navigate-finish', handleNavigation, true);
document.addEventListener('yt-page-data-updated', handleNavigation, true);

const observer = new MutationObserver(() => {
  mountButton();
});

observer.observe(document.documentElement, { childList: true, subtree: true });
handleNavigation();
