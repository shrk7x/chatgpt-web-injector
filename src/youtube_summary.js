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
const TRANSCRIPT_PANEL_SELECTOR = [
  'ytd-transcript-renderer',
  'ytd-transcript-search-panel-renderer',
].join(', ');
const TRANSCRIPT_SEGMENT_SELECTOR = [
  'ytd-transcript-segment-renderer',
  'transcript-segment-view-model',
].join(', ');
const DEBUG = false;

let lastUrl = '';
let mountTimer = null;
let statusTimer = null;
let observerTimer = null;
let observerRetryTimer = null;
let latestCaptionCheckId = 0;
const noCaptionUrls = new Set();
const NO_CAPTION_CACHE_LIMIT = 100;

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
  document.getElementById(YOUTUBE_DOWNLOAD_BUTTON_ID)?.remove();
  if (downloadMenuClickOutsideHandler) {
    document.removeEventListener('click', downloadMenuClickOutsideHandler, true);
    downloadMenuClickOutsideHandler = null;
  }
  document.getElementById(YOUTUBE_DOWNLOAD_MENU_ID)?.remove();
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

// SPA 导航后 <script> 标签可能不包含当前视频数据，以下函数从 HTML 字符串中提取
function getInnertubeValueFromHtml(html, name) {
  const pattern = new RegExp(`"${name}"\\s*:\\s*"([^"]+)"`);
  const match = html.match(pattern);
  return match ? match[1] : '';
}

function getTranscriptParamsFromHtml(html) {
  const match = html.match(/"getTranscriptEndpoint"\s*:\s*\{"params"\s*:\s*"([^"]+)"/);
  return match ? match[1] : '';
}

function normalizeTimestamp(timestamp) {
  const parts = timestamp.trim().split(':');
  if (parts.length >= 2) {
    return parts.map((part) => part.padStart(2, '0')).join(':');
  }
  return '00:00';
}

function isElementVisible(element) {
  if (!element || !element.isConnected) {
    return false;
  }

  let current = element;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    if (
      current.hidden ||
      current.getAttribute('aria-hidden') === 'true'
    ) {
      return false;
    }

    const youtubeVisibility = current.getAttribute('visibility') || '';
    if (
      youtubeVisibility.includes('HIDDEN') ||
      youtubeVisibility.includes('COLLAPSED')
    ) {
      return false;
    }

    const style = window.getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    current = current.parentElement;
  }

  return true;
}

function readTranscriptFromDom() {
  const segmentNodes = Array.from(document.querySelectorAll('ytd-transcript-segment-renderer'));
  const lines = [];

  for (const segment of segmentNodes) {
    if (!isElementVisible(segment)) {
      continue;
    }

    const timestamp = segment.querySelector('.segment-timestamp')?.textContent?.trim() || '';
    const text = segment.querySelector('.segment-text')?.textContent?.trim() || '';

    if (text) {
      lines.push(`[${normalizeTimestamp(timestamp)}] ${text}`);
    }
  }

  const modernSegmentNodes = Array.from(document.querySelectorAll('transcript-segment-view-model'));
  const transcriptHelpers = window.ChatgptWebInjectorYoutubeTranscript;

  for (const segment of modernSegmentNodes) {
    if (!isElementVisible(segment)) {
      continue;
    }

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

function findVisibleTranscriptSegment() {
  return Array.from(document.querySelectorAll(TRANSCRIPT_SEGMENT_SELECTOR))
    .find((segment) => isElementVisible(segment)) || null;
}

function getButtonLabel(button) {
  return [
    button.getAttribute('aria-label') || '',
    button.getAttribute('title') || '',
    button.textContent || '',
  ].join(' ');
}

function isTranscriptSegmentControl(button) {
  return /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(getButtonLabel(button));
}

function panelHasTranscriptContent(panel) {
  if (!panel) {
    return false;
  }

  const targetId = panel.getAttribute('target-id');
  if (targetId === 'engagement-panel-transcript') {
    return true;
  }

  if (targetId && !targetId.includes('transcript')) {
    return false;
  }

  if (
    panel.matches(TRANSCRIPT_PANEL_SELECTOR) ||
    panel.querySelector([
      TRANSCRIPT_PANEL_SELECTOR,
      TRANSCRIPT_SEGMENT_SELECTOR,
    ].join(', '))
  ) {
    return true;
  }

  return Array.from(panel.querySelectorAll('button, [role="button"]'))
    .some((button) => isTranscriptSegmentControl(button));
}

function findTranscriptPanel() {
  const segment = findVisibleTranscriptSegment();
  if (!segment) {
    return Array.from(document.querySelectorAll('ytd-engagement-panel-section-list-renderer'))
      .find((panel) => isElementVisible(panel) && panelHasTranscriptContent(panel)) || null;
  }

  return segment.closest([
    'ytd-engagement-panel-section-list-renderer',
    'ytd-transcript-renderer',
    'ytd-transcript-search-panel-renderer',
  ].join(', ')) || segment.parentElement;
}

function isTranscriptPanelButton(button) {
  const transcriptContainer = button.closest(TRANSCRIPT_PANEL_SELECTOR);
  if (transcriptContainer) {
    return true;
  }

  const panel = button.closest('ytd-engagement-panel-section-list-renderer');
  if (panel) {
    const targetId = panel.getAttribute('target-id');
    // 绝对不能误过滤普通结构化描述容器（其 target-id 为 engagement-panel-structured-description）中的“显示字幕”按钮
    if (targetId === 'engagement-panel-structured-description') {
      return false;
    }

    if (!isElementVisible(panel)) {
      return true;
    }
  }

  return panelHasTranscriptContent(panel);
}

function getActionableTranscriptButton(button) {
  if (button.tagName !== 'YTD-BUTTON-RENDERER') {
    return button;
  }

  return button.querySelector('button, tp-yt-paper-button, [role="button"]') || button;
}

function findTranscriptButton({ allowHidden = false } = {}) {
  const labelPattern = /show transcript|transcript|文字稿|转录|轉錄|逐字稿|转写文稿|內容轉文字|内容转文字/i;
  // Expand search scope: include standard button tags and common YouTube custom button elements
  const buttons = Array.from(document.querySelectorAll('button, tp-yt-paper-button, ytd-button-renderer, [role="button"]'));

  for (const button of buttons) {
    const actionableButton = getActionableTranscriptButton(button);
    if (
      actionableButton.id === YOUTUBE_SUMMARY_BUTTON_ID ||
      actionableButton.id === YOUTUBE_TRANSCRIPT_BUTTON_ID ||
      isTranscriptPanelButton(actionableButton) ||
      (!allowHidden && !isElementVisible(actionableButton))
    ) {
      continue;
    }

    if (labelPattern.test(getButtonLabel(actionableButton))) {
      return actionableButton;
    }
  }

  return null;
}

function expandDescription() {
  const container = document.querySelector('ytd-watch-metadata') || document.querySelector('ytd-video-secondary-info-renderer');
  if (!container) {
    return false;
  }

  const expandPattern = /\.\.\.(?:more|更多)|show more|展开|展開|顯示更多|显示更多/i;

  // 优先尝试点击新版 YouTube 中的描述展开组件以激活结构化内容
  const inlineExpander = container.querySelector('ytd-text-inline-expander');
  if (inlineExpander) {
    const expandBtn = inlineExpander.querySelector('#expand');
    // 如果存在 #expand 且它没有被 hidden（表示还未展开），只点击 expandBtn 避免双击切换
    if (expandBtn && !expandBtn.hasAttribute('hidden') && expandBtn.getAttribute('aria-hidden') !== 'true') {
      expandBtn.click();
      return true;
    }
  }

  const divDesc = container.querySelector('div#description');
  if (divDesc) {
    if (expandPattern.test(divDesc.textContent || '')) {
      divDesc.click();
      return true;
    }
  }

  const expandElements = container.querySelectorAll('tp-yt-paper-button, button, [id="expand"], ytd-button-renderer, [role="button"]');

  for (const el of expandElements) {
    const text = (el.textContent || '').trim();
    if (
      expandPattern.test(text) &&
      isElementVisible(el) &&
      el.getAttribute('aria-expanded') !== 'true'
    ) {
      el.click();
      return true;
    }
  }

  return false;
}

function findTranscriptCloseButton(panel = findTranscriptPanel()) {
  if (!panel) {
    return null;
  }

  const closePattern = /close|dismiss|关闭|關閉/i;
  const buttons = Array.from(panel.querySelectorAll([
    'button',
    '[role="button"]',
    'yt-icon-button',
    'tp-yt-paper-icon-button',
  ].join(', ')));

  return buttons.find((button) => {
    // Skip our injected buttons, hidden elements, and buttons inside transcript segments.
    // Also guard against long text containing 'close' (e.g. 'closed models') matching incorrectly.
    if (
      button.id === YOUTUBE_SUMMARY_BUTTON_ID ||
      button.id === YOUTUBE_TRANSCRIPT_BUTTON_ID ||
      button.closest(TRANSCRIPT_SEGMENT_SELECTOR) ||
      !isElementVisible(button)
    ) {
      return false;
    }

    const textContent = (button.textContent || '').trim();
    const label = [
      button.id || '',
      button.className || '',
      button.getAttribute('aria-label') || '',
      button.getAttribute('title') || '',
      textContent.length <= 15 ? textContent : '',
    ].join(' ');
    return closePattern.test(label);
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
  const descriptionExpanded = expandDescription();

  if (!transcriptButton && !descriptionExpanded) {
    transcriptButton = findTranscriptButton({ allowHidden: true });
  }

  while (!transcriptButton && Date.now() - startedAt < TRANSCRIPT_DOM_WAIT_MS) {
    await new Promise((resolve) => { setTimeout(resolve, TRANSCRIPT_DOM_POLL_MS); });

    transcriptButton = findTranscriptButton();
  }

  return transcriptButton || findTranscriptButton({ allowHidden: true });
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

async function toggleTranscriptPanel() {
  const panel = findTranscriptPanel();
  if (panel) {
    // findTranscriptPanel() may return an inner element (e.g. ytd-transcript-renderer)
    // whose scope does not include the close button. Expand to the outermost engagement
    // panel so the close button is always within the search range.
    const outerPanel = panel.closest('ytd-engagement-panel-section-list-renderer') || panel;
    const closeButton = findTranscriptCloseButton(outerPanel);
    if (!closeButton) {
      showStatus('Transcript unavailable');
      return;
    }

    closeButton.click();
    return;
  }

  const transcriptButton = await waitForTranscriptButton();
  if (!transcriptButton) {
    showStatus('Transcript unavailable');
    return;
  }

  transcriptButton.click();
}

async function fetchCurrentPlayerResponse() {
  const response = await fetch(window.location.href, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('watch_page_fetch_failed');
  }

  return getPlayerResponseFromHtml(await response.text());
}

async function fetchInnertubeTranscript() {
  let key = getInnertubeValue('INNERTUBE_API_KEY');
  let clientVersion = getInnertubeValue('INNERTUBE_CLIENT_VERSION');
  let visitorData = getInnertubeValue('VISITOR_DATA');
  let hl = getInnertubeValue('HL') || document.documentElement.lang || 'en';
  let gl = getInnertubeValue('GL') || 'US';
  let params = getTranscriptParamsFromPageScripts();

  // SPA 导航后 <script> 标签可能不包含当前视频的 params，从重新拉取的 HTML 中提取
  if (!key || !clientVersion || !params) {
    let html = '';
    try {
      const r = await fetch(window.location.href, { credentials: 'include' });
      html = r.ok ? await r.text() : '';
    } catch {
      html = '';
    }
    if (html) {
      key = key || getInnertubeValueFromHtml(html, 'INNERTUBE_API_KEY');
      clientVersion = clientVersion || getInnertubeValueFromHtml(html, 'INNERTUBE_CLIENT_VERSION');
      visitorData = visitorData || getInnertubeValueFromHtml(html, 'VISITOR_DATA');
      params = params || getTranscriptParamsFromHtml(html);
    }
  }

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

/**
 * 轮询等待 playerResponse 中的 captionTracks 数据，最多等待 TRANSCRIPT_DOM_WAIT_MS 毫秒。
 * @param {string} videoId - 当前视频的 ID，用于校验 playerResponse 是否匹配当前视频
 * 返回 true 表示视频有可用字幕；返回 false 表示无字幕；返回 null 表示无法判断。
 */
async function hasCaptionTracks(videoId) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < TRANSCRIPT_DOM_WAIT_MS) {
    // SPA 路由切换时提前终止轮询，避免无效 CPU 消耗
    const currentVideoId = new URLSearchParams(window.location.search).get('v');
    if (videoId !== currentVideoId) {
      return false;
    }
    const playerResponse = getPlayerResponseFromPageScripts();
    // 校验 playerResponse 的 videoId 是否匹配，避免读到上一个视频的过期数据
    if (playerResponse && playerResponse.videoDetails?.videoId === videoId) {
      return getCaptionTracks(playerResponse).length > 0;
    }
    await new Promise((resolve) => { setTimeout(resolve, TRANSCRIPT_DOM_POLL_MS); });
  }

  // 超时仍未找到匹配的 playerResponse（SPA 导航后 <script> 标签数据过期），
  // 主动 fetch 当前页面 HTML 获取最新数据，而非保守返回 true 导致无字幕视频仍显示按钮
  try {
    const freshResponse = await fetchCurrentPlayerResponse();
    if (freshResponse && freshResponse.videoDetails?.videoId === videoId) {
      return getCaptionTracks(freshResponse).length > 0;
    }
  } catch {
    // fetch 失败时保持未知状态，避免显示不可用的按钮
  }
  return null;
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
    toggleTranscriptPanel().catch((error) => {
      console.warn('[ChatGPT Web Injector] YouTube transcript panel failed:', error);
      showStatus('Transcript unavailable');
    });
  });
  return button;
}

/* ---- MVP Subtitle Downloader Functions ---- */

const YOUTUBE_DOWNLOAD_BUTTON_ID = 'chatgpt-web-injector-youtube-download';
const YOUTUBE_DOWNLOAD_MENU_ID = 'chatgpt-web-injector-youtube-download-menu';

// 模块级变量以在各个出口安全销毁全局 ClickOutside 监听 (防止 Buildup 内存泄漏)
let downloadMenuClickOutsideHandler = null;

function triggerFileDownload(content, filename, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function downloadCurrentSubtitleFlow(format, button) {
  const originalHtml = button.innerHTML;
  button.disabled = true;
  button.classList.add('is-loading');
  button.textContent = 'Loading...';

  try {
    // 重用拥有 100% 成功率 (API ➡️ InnerTube ➡️ DOM 提取) 的金牌 fallback 字幕链！
    const transcript = await getTranscript();
    const transcriptHelpers = window.ChatgptWebInjectorYoutubeTranscript;
    if (!transcriptHelpers) {
      throw new Error('transcript_helpers_unavailable');
    }

    let content = '';
    const rawTitle = document.querySelector('h1.ytd-watch-metadata')?.textContent?.trim() || document.title;
    const sanitizedTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '_').trim() || 'youtube_subtitle';
    const filename = `${sanitizedTitle}.${format}`;

    if (format === 'txt') {
      if (!transcriptHelpers.convertToTxt) {
        throw new Error('convertToTxt_unavailable');
      }
      content = transcriptHelpers.convertToTxt(transcript);
    } else {
      if (!transcriptHelpers.convertToSrt) {
        throw new Error('convertToSrt_unavailable');
      }
      content = transcriptHelpers.convertToSrt(transcript);
    }

    if (!content) {
      throw new Error('empty_converted_content');
    }

    triggerFileDownload(content, filename);

    button.textContent = 'Done!';
    setTimeout(() => {
      // 成功下载自动关闭气泡菜单并安全解绑全局 click 监听
      if (downloadMenuClickOutsideHandler) {
        document.removeEventListener('click', downloadMenuClickOutsideHandler, true);
        downloadMenuClickOutsideHandler = null;
      }
      document.getElementById(YOUTUBE_DOWNLOAD_MENU_ID)?.remove();
      
      button.innerHTML = originalHtml;
      button.disabled = false;
      button.classList.remove('is-loading');
    }, 1000);

  } catch (error) {
    console.warn(`[ChatGPT Web Injector] Failed to download subtitles (${format}):`, error);
    button.textContent = 'Error';
    setTimeout(() => {
      button.innerHTML = originalHtml;
      button.disabled = false;
      button.classList.remove('is-loading');
    }, 1500);
  }
}

async function toggleDownloadMenu(button) {
  const menu = document.getElementById(YOUTUBE_DOWNLOAD_MENU_ID);
  if (menu) {
    // 主动二次点击 📥 按钮关闭菜单时，安全解绑 click 监听并移除节点
    if (downloadMenuClickOutsideHandler) {
      document.removeEventListener('click', downloadMenuClickOutsideHandler, true);
      downloadMenuClickOutsideHandler = null;
    }
    menu.remove();
    return;
  }

  const container = document.querySelector('.ytp-chrome-controls');
  if (!container) {
    showStatus('Controls unavailable');
    return;
  }

  const menuDiv = document.createElement('div');
  menuDiv.id = YOUTUBE_DOWNLOAD_MENU_ID;

  menuDiv.innerHTML = `
    <div class="youtube-download-menu-header">Download Subtitles</div>
    <div class="youtube-download-menu-list" style="overflow: hidden; padding-bottom: 2px;">
      <button type="button" class="youtube-download-large-btn srt-btn" data-type="srt" style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 38px;
        margin-bottom: 8px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        color: #fff;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      ">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 6px; vertical-align: middle;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Download SRT
      </button>
      <button type="button" class="youtube-download-large-btn txt-btn" data-type="txt" style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 38px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        color: #fff;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      ">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 6px; vertical-align: middle;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Download TXT
      </button>
    </div>
  `;

  // 注入大按钮悬浮 Hover 样式
  menuDiv.querySelectorAll('.youtube-download-large-btn').forEach((btn) => {
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(46, 204, 113, 0.2)';
      btn.style.borderColor = '#2ecc71';
      btn.style.color = '#2ecc71';
      btn.style.boxShadow = '0 0 8px rgba(46, 204, 113, 0.4)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255, 255, 255, 0.08)';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      btn.style.color = '#fff';
      btn.style.boxShadow = 'none';
    });
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const format = btn.getAttribute('data-type');
      downloadCurrentSubtitleFlow(format, btn).catch((err) => {
        console.warn('[ChatGPT Web Injector] Subtitle download failed:', err);
      });
    }, true);
  });

  container.appendChild(menuDiv);

  // 动态定位计算
  const rect = button.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const leftOffset = rect.left - containerRect.left - (menuDiv.offsetWidth / 2) + (rect.width / 2);
  const safeLeft = Math.max(10, Math.min(leftOffset, containerRect.width - menuDiv.offsetWidth - 10));
  menuDiv.style.left = `${safeLeft}px`;

  // 建立新的 click outside 观察
  if (downloadMenuClickOutsideHandler) {
    document.removeEventListener('click', downloadMenuClickOutsideHandler, true);
  }

  downloadMenuClickOutsideHandler = (event) => {
    if (!menuDiv.contains(event.target) && !button.contains(event.target)) {
      menuDiv.remove();
      document.removeEventListener('click', downloadMenuClickOutsideHandler, true);
      downloadMenuClickOutsideHandler = null;
    }
  };
  document.addEventListener('click', downloadMenuClickOutsideHandler, true);
}

function createDownloadButton() {
  const button = document.createElement('button');
  button.id = YOUTUBE_DOWNLOAD_BUTTON_ID;
  button.type = 'button';
  button.title = 'Download subtitles';
  button.setAttribute('aria-label', 'Download subtitles');
  button.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleDownloadMenu(button).catch((error) => {
      console.warn('[ChatGPT Web Injector] YouTube download menu failed:', error);
      showStatus('Failed to load menu');
    });
  }, true);
  return button;
}

/* ---- Navigation and Observing ---- */

function mountButton() {
  clearTimeout(mountTimer);

  if (!isWatchPage()) {
    removeButton();
    return;
  }

  // 已知无字幕的视频，直接跳过挂载，防止 Observer 触发无限循环
  if (noCaptionUrls.has(window.location.href)) {
    return;
  }

  if (
    document.getElementById(YOUTUBE_SUMMARY_BUTTON_ID) &&
    document.getElementById(YOUTUBE_TRANSCRIPT_BUTTON_ID) &&
    document.getElementById(YOUTUBE_DOWNLOAD_BUTTON_ID)
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
  document.getElementById(YOUTUBE_DOWNLOAD_BUTTON_ID)?.remove();
  if (downloadMenuClickOutsideHandler) {
    document.removeEventListener('click', downloadMenuClickOutsideHandler, true);
    downloadMenuClickOutsideHandler = null;
  }
  document.getElementById(YOUTUBE_DOWNLOAD_MENU_ID)?.remove();

  const summaryButton = createButton();
  subtitlesButton.insertAdjacentElement('afterend', summaryButton);

  const transcriptButton = createTranscriptButton();
  summaryButton.insertAdjacentElement('afterend', transcriptButton);

  const downloadButton = createDownloadButton();
  transcriptButton.insertAdjacentElement('afterend', downloadButton);

  const controls = [summaryButton, transcriptButton, downloadButton];
  controls.forEach((control) => {
    control.hidden = true;
  });
  const revealControls = () => {
    controls.forEach((control) => {
      control.hidden = false;
    });
  };

  // 挂载后异步检测字幕可用性：仅在确认有字幕轨道后显示按钮
  const captionCheckId = ++latestCaptionCheckId;
  const mountUrl = window.location.href;
  const currentVideoId = new URLSearchParams(window.location.search).get('v');
  (async () => {
    try {
      const captionsAvailable = await hasCaptionTracks(currentVideoId);
      // 竞态保护：若检测期间已切换视频或触发了新一轮挂载，则丢弃过期结果
      if (captionCheckId !== latestCaptionCheckId) return;
      if (mountUrl !== window.location.href) return;
      if (captionsAvailable !== false) {
        revealControls();
        return;
      }
      if (captionsAvailable === false) {
        log('该视频没有可用的字幕轨道，移除已挂载的功能按钮。');
        // FIFO 策略限制缓存大小，防止 SPA 长时间使用导致内存泄漏
        if (noCaptionUrls.size >= NO_CAPTION_CACHE_LIMIT) {
          const oldest = noCaptionUrls.values().next().value;
          noCaptionUrls.delete(oldest);
        }
        noCaptionUrls.add(mountUrl);
        removeButton();
      }
    } catch {
      if (captionCheckId !== latestCaptionCheckId) return;
      if (mountUrl !== window.location.href) return;
      revealControls();
    }
  })();
}

function handleNavigation() {
  if (lastUrl === window.location.href) {
    mountButton();
    return;
  }

  lastUrl = window.location.href;
  // 切换视频时递增 captionCheckId，使前一次异步检测自动失效
  latestCaptionCheckId += 1;
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
