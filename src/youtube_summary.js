(function initYoutubeSummaryContentScript() {
const YOUTUBE_SUMMARY_BUTTON_ID = 'chatgpt-web-injector-youtube-summary';
const YOUTUBE_TRANSCRIPT_BUTTON_ID = 'chatgpt-web-injector-youtube-transcript';
const YOUTUBE_SUMMARY_STATUS_ID = 'chatgpt-web-injector-youtube-status';
const YOUTUBE_WATCH_PATH = '/watch';
const BUTTON_RETRY_MS = 750;
const STATUS_TIMEOUT_MS = 2500;
const MOUNT_DEBOUNCE_MS = 150;
const OBSERVER_RETRY_MS = 500;
const TRANSCRIPT_DOM_WAIT_MS = 3000;
const TRANSCRIPT_DOM_POLL_MS = 200;
const DEBUG = false;

let lastUrl = '';
let mountTimer = null;
let statusTimer = null;
let observerTimer = null;
let observerRetryTimer = null;

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
  document.getElementById(YOUTUBE_TRANSCRIPT_BUTTON_ID)?.remove();
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

function getInnertubeValue(name) {
  const pattern = new RegExp(`"${name}"\\s*:\\s*"([^"]+)"`);
  for (const script of document.scripts) {
    const match = (script.textContent || '').match(pattern);
    if (match) {
      return match[1];
    }
  }
  return '';
}

function getTranscriptParamsFromPageScripts() {
  for (const script of document.scripts) {
    const match = (script.textContent || '').match(/"getTranscriptEndpoint"\s*:\s*\{"params"\s*:\s*"([^"]+)"/);
    if (match) {
      return match[1];
    }
  }
  return '';
}

function normalizeTimestamp(timestamp) {
  const parts = timestamp.trim().split(':');
  if (parts.length >= 2) {
    return parts.map((part) => part.padStart(2, '0')).join(':');
  }
  return '00:00';
}

function readTranscriptFromDom() {
  const segmentNodes = Array.from(document.querySelectorAll('ytd-transcript-segment-renderer'));
  const lines = [];

  for (const segment of segmentNodes) {
    const timestamp = segment.querySelector('.segment-timestamp')?.textContent?.trim() || '';
    const text = segment.querySelector('.segment-text')?.textContent?.trim() || '';

    if (text) {
      lines.push(`[${normalizeTimestamp(timestamp)}] ${text}`);
    }
  }

  const modernSegmentNodes = Array.from(document.querySelectorAll('transcript-segment-view-model'));
  const transcriptHelpers = window.ChatgptWebInjectorYoutubeTranscript;

  for (const segment of modernSegmentNodes) {
    const timestamp = segment.querySelector('.ytwTranscriptSegmentViewModelTimestamp')?.textContent?.trim() || '';
    const text = Array.from(segment.querySelectorAll('span.ytAttributedStringHost'))
      .map((node) => node.textContent?.trim() || '')
      .filter(Boolean)
      .join(' ')
      .trim();

    if (timestamp && text) {
      lines.push(`[${normalizeTimestamp(timestamp)}] ${text}`);
      continue;
    }

    const parsed = transcriptHelpers?.parseModernTranscriptSegmentText(segment.textContent || '');
    if (parsed?.text) {
      lines.push(`[${normalizeTimestamp(parsed.timestamp)}] ${parsed.text}`);
    }
  }

  return lines.join('\n');
}

function findTranscriptButton() {
  const labelPattern = /show transcript|transcript|文字稿|转录|轉錄|逐字稿|转写文稿|內容轉文字|内容转文字/i;
  const buttons = Array.from(document.querySelectorAll('button'));

  return buttons.find((button) => {
    if (
      button.id === YOUTUBE_SUMMARY_BUTTON_ID ||
      button.id === YOUTUBE_TRANSCRIPT_BUTTON_ID
    ) {
      return false;
    }

    const label = [
      button.getAttribute('aria-label') || '',
      button.textContent || '',
    ].join(' ');
    return labelPattern.test(label);
  }) || null;
}

async function waitForTranscriptDom() {
  const startedAt = Date.now();
  let transcript = readTranscriptFromDom();

  while (!transcript && Date.now() - startedAt < TRANSCRIPT_DOM_WAIT_MS) {
    await new Promise((resolve) => { setTimeout(resolve, TRANSCRIPT_DOM_POLL_MS); });
    transcript = readTranscriptFromDom();
  }

  return transcript;
}

async function waitForTranscriptButton() {
  const startedAt = Date.now();
  let transcriptButton = findTranscriptButton();

  while (!transcriptButton && Date.now() - startedAt < TRANSCRIPT_DOM_WAIT_MS) {
    await new Promise((resolve) => { setTimeout(resolve, TRANSCRIPT_DOM_POLL_MS); });
    transcriptButton = findTranscriptButton();
  }

  return transcriptButton;
}

async function fetchTranscriptFromDom() {
  const visibleTranscript = readTranscriptFromDom();
  if (visibleTranscript) {
    return visibleTranscript;
  }

  const transcriptButton = await waitForTranscriptButton();
  if (!transcriptButton) {
    throw new Error('transcript_dom_button_not_found');
  }

  transcriptButton.click();
  const openedTranscript = await waitForTranscriptDom();
  if (!openedTranscript) {
    throw new Error('transcript_dom_empty');
  }

  return openedTranscript;
}

async function openTranscriptPanel() {
  if (readTranscriptFromDom()) {
    showStatus('Transcript open');
    return;
  }

  const transcriptButton = await waitForTranscriptButton();
  if (!transcriptButton) {
    showStatus('Transcript unavailable');
    return;
  }

  transcriptButton.click();
  showStatus('Transcript open');
}

async function fetchCurrentPlayerResponse() {
  const response = await fetch(window.location.href, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('watch_page_fetch_failed');
  }

  return getPlayerResponseFromHtml(await response.text());
}

async function fetchInnertubeTranscript() {
  const key = getInnertubeValue('INNERTUBE_API_KEY');
  const clientVersion = getInnertubeValue('INNERTUBE_CLIENT_VERSION');
  const visitorData = getInnertubeValue('VISITOR_DATA');
  const hl = getInnertubeValue('HL') || document.documentElement.lang || 'en';
  const gl = getInnertubeValue('GL') || 'US';
  const params = getTranscriptParamsFromPageScripts();

  if (!key || !clientVersion || !params) {
    throw new Error('innertube_missing_config');
  }

  const response = await fetch(`https://www.youtube.com/youtubei/v1/get_transcript?key=${key}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB',
          clientVersion,
          gl,
          hl,
          visitorData,
        },
      },
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`innertube_http_${response.status}`);
  }

  const transcript = window.ChatgptWebInjectorYoutubeTranscript
    .parseInnertubeTranscriptResponse(await response.json());
  if (!transcript) {
    throw new Error('innertube_empty_response');
  }

  return transcript;
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

  const captionStorageKeys = [
    'yt-player-caption-display-settings',
    'yt-player-caption-sticky-language',
    'yt-player-caption-language-preferences',
  ];

  for (const key of captionStorageKeys) {
    const value = window.localStorage.getItem(key) || '';
    const languageCode = value?.match(/"languageCode"\s*:\s*"([^"]+)"/)?.[1];
    if (languageCode) {
      return languageCode;
    }
  }

  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith('yt-player-caption')) {
      continue;
    }

    const value = window.localStorage.getItem(key) || '';
    const languageCode = value.match(/"languageCode"\s*:\s*"([^"]+)"/)?.[1];
    if (languageCode) {
      return languageCode;
    }
  }

  return '';
}

async function getTranscript() {
  const transcriptHelpers = window.ChatgptWebInjectorYoutubeTranscript;
  if (!transcriptHelpers) {
    throw new Error('transcript_helpers_unavailable');
  }

  const failures = [];
  const playerResponse = getPlayerResponseFromPageScripts() ||
    await fetchCurrentPlayerResponse().catch(() => null);
  const tracks = getCaptionTracks(playerResponse);
  const track = transcriptHelpers.chooseCaptionTrack(tracks, {
    activeLanguageCode: getActiveCaptionLanguageCode(),
  });

  if (!track) {
    failures.push('caption_track_missing');
  } else {
    try {
      const response = await fetch(transcriptHelpers.buildCaptionUrl(track.baseUrl), { credentials: 'include' });
      if (!response.ok) {
        failures.push(`timedtext_http_${response.status}`);
      } else {
        const transcript = transcriptHelpers.parseTranscript(await response.text());
        if (transcript) {
          return transcript;
        }
        failures.push('timedtext_empty');
      }
    } catch (error) {
      failures.push(error?.message ? `timedtext_error_${error.message}` : 'timedtext_error');
    }
  }

  try {
    return await fetchInnertubeTranscript();
  } catch (error) {
    failures.push(error?.message || 'innertube_error');
  }

  try {
    return await fetchTranscriptFromDom();
  } catch (error) {
    failures.push(error?.message || 'transcript_dom_error');
  }

  throw new Error(`empty_transcript: ${failures.join(', ')}`);
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
  button.innerHTML = `<span style="margin-right: 4px;">AI</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    sendYoutubeSummary();
  });
  return button;
}

function createTranscriptButton() {
  const button = document.createElement('button');
  button.id = YOUTUBE_TRANSCRIPT_BUTTON_ID;
  button.type = 'button';
  button.title = 'Show YouTube transcript';
  button.setAttribute('aria-label', 'Show YouTube transcript');
  button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg><span>Transcript</span>`;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openTranscriptPanel().catch((error) => {
      console.warn('[ChatGPT Web Injector] YouTube transcript panel failed:', error);
      showStatus('Transcript unavailable');
    });
  });
  return button;
}

function mountButton() {
  clearTimeout(mountTimer);

  if (!isWatchPage()) {
    removeButton();
    return;
  }

  if (
    document.getElementById(YOUTUBE_SUMMARY_BUTTON_ID) &&
    document.getElementById(YOUTUBE_TRANSCRIPT_BUTTON_ID)
  ) {
    return;
  }

  const subtitlesButton = document.querySelector('.ytp-subtitles-button');
  if (!subtitlesButton?.parentElement) {
    mountTimer = setTimeout(mountButton, BUTTON_RETRY_MS);
    return;
  }

  document.getElementById(YOUTUBE_SUMMARY_BUTTON_ID)?.remove();
  document.getElementById(YOUTUBE_TRANSCRIPT_BUTTON_ID)?.remove();

  const summaryButton = createButton();
  subtitlesButton.insertAdjacentElement('afterend', summaryButton);
  summaryButton.insertAdjacentElement('afterend', createTranscriptButton());
}

function handleNavigation() {
  if (lastUrl === window.location.href) {
    mountButton();
    return;
  }

  lastUrl = window.location.href;
  removeButton();
  mountButton();
  observePlayerControls();
}

document.addEventListener('yt-navigate-finish', handleNavigation, true);
document.addEventListener('yt-page-data-updated', handleNavigation, true);

const observer = new MutationObserver(() => {
  clearTimeout(observerTimer);
  observerTimer = setTimeout(() => {
    mountButton();
  }, MOUNT_DEBOUNCE_MS);
});

function observePlayerControls() {
  clearTimeout(observerRetryTimer);
  observer.disconnect();

  const controls = document.querySelector('.ytp-chrome-controls');
  if (!controls) {
    observerRetryTimer = setTimeout(observePlayerControls, OBSERVER_RETRY_MS);
    return;
  }

  observer.observe(controls, { childList: true, subtree: true });
}

observePlayerControls();
handleNavigation();
}());
