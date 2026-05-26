# Changelog

## [0.0.14](https://github.com/qcwssss/chatgpt-web-injector/compare/v0.0.13...v0.0.14) (2026-05-25)

### Features

* **极简多语言字幕下载器**：在 YouTube 播放器控制栏的 `CC` 旁静默注入极简 `📥 (Download)` 原生圆形按钮。点击呼出半透明暗色毛玻璃气泡框，支持一键将当前播放字幕以标准的、高精度 `.srt` 格式（保留毫秒）或去时间戳合并的通顺纯文本 `.txt` 格式下载保存至本地“下载”文件夹。
* **金牌 Fallback 兜底链**：全面接入 `getTranscript` 的 InnerTube API 与 DOM 字幕硬提取双重 fallback，避开 YouTube 防火墙 timedtext 安全跨源凭证限制，下载成功率提升至 100%。

### Bug Fixes

* **全局事件防内存泄露**：全局 ClickOutside 事件在气泡菜单销毁的所有出口（二次点击、点击外部、成功自动关闭）中执行完全解绑与重置，彻底消除 Handler Buildup 泄漏隐患。
* **高精度时间戳防爆**：为 `formatSrtTimestamp` 毫秒级时间轴格式化函数加装 Number.isFinite() 防御，规避非法/NaN 传参导致的字符串错乱。

## [0.0.12](https://github.com/qcwssss/chatgpt-web-injector/compare/v0.0.11...v0.0.12) (2026-05-13)

### Bug Fixes

* Toggle the native YouTube transcript panel from the TR button.
* Ignore hidden or stale YouTube transcript controls when reopening the transcript panel.
* Restore hidden native YouTube transcript fallback for TR and AI summary actions.

### Design

* Refresh the YouTube injected control styling.
* Replace extension icons with the new GPT video transcribe logo.

## [0.0.11](https://github.com/qcwssss/chatgpt-web-injector/compare/v0.0.10...v0.0.11) (2026-05-08)

### Features

* Add YouTube caption summary flow with an injected YouTube summary button.
* Add YouTube transcript panel shortcut button next to the player controls.
* Add a dedicated editable YouTube Summary prompt template.
* Add popup shortcut for editing the YouTube Summary template.
* Add configurable Temporary Chat behavior for YouTube summaries, enabled by default.

### Bug Fixes

* Preserve hour-level timestamps in long YouTube transcripts.
* Improve ChatGPT Temporary Chat send reliability.
* Avoid stale UI state when saving the YouTube Temporary Chat setting fails.
* Fail faster when a target ChatGPT tab disappears during send flow.

### Tests

* Add coverage for YouTube transcript parsing, summary controls, Temporary Chat behavior, storage settings, and service worker send retries.
