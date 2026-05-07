(function initYoutubeSummaryContentScript() {
const YOUTUBE_SUMMARY_BUTTON_ID = 'chatgpt-web-injector-youtube-summary';
const YOUTUBE_SUMMARY_STATUS_ID = 'chatgpt-web-injector-youtube-status';
const YOUTUBE_WATCH_PATH = '/watch';
const BUTTON_RETRY_MS = 750;
const STATUS_TIMEOUT_MS = 2500;
const MOUNT_DEBOUNCE_MS = 150;
const OBSERVER_RETRY_MS = 500;
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

  const playerResponse = getPlayerResponseFromPageScripts() ||
    await fetchCurrentPlayerResponse().catch(() => null);
  const tracks = getCaptionTracks(playerResponse);
  const track = transcriptHelpers.chooseCaptionTrack(tracks, {
    activeLanguageCode: getActiveCaptionLanguageCode(),
  });

  if (!track) {
    throw new Error('no_caption_track');
  }

  const response = await fetch(transcriptHelpers.buildCaptionUrl(track.baseUrl), { credentials: 'include' });
  if (!response.ok) {
    throw new Error('caption_fetch_failed');
  }

  const transcript = transcriptHelpers.parseTranscript(await response.text());
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
