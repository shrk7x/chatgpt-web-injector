# Changelog

## [0.0.17](https://github.com/qcwssss/chatgpt-web-injector/compare/v0.0.16...v0.0.17) (2026-06-04)

### Features

* **悬浮 BOT 按钮控制 (Toggle Floating Bot Button)**：在 popup 弹窗中增加了“显示/隐藏页面悬浮 BOT 按钮”的开关选项，允许用户按需自由选择是否开启网页选词悬浮按钮。
* **毛玻璃悬浮框效果 (Glassmorphism Frosted-glass Tooltip)**：将网页上取词后弹出的悬浮 BOT 按钮背景升级为更高级的毛玻璃（Frosted Glass）质感，并采用自适应暗色底图，确保在各类亮色网页上都具有出色的易读性和清晰度。

## [0.0.16](https://github.com/qcwssss/chatgpt-web-injector/compare/v0.0.15...v0.0.16) (2026-05-29)

### Features

* **扩展弹窗 UI 深度重塑 (Redesigned Extension Popup UI)**：完全重构了 Chrome 扩展弹窗样式，采用 12px 极为柔和饱满的苹果级圆角，彻底根除了 Chrome Popup 露底的生硬灰色直角边框。优化了开关 Switch 滑轨及滑块细节，并为各项选项增设了卡片悬浮浮动感。
* **操作菜单极致精炼 (Merged Redundant Links)**：将弹窗底部原先冗余的两个管理按钮（`"Manage templates"` 与 `"Edit YouTube summary"`）精简合并为了一个统一优雅的 `"Configure templates"` 按钮。

### Bug Fixes

* **弹窗边缘露底修复 (Fixed Outer Popup Corner Bleed)**：消除了外层 body 容器上的 padding 差值，并将大圆角裁切直接绑定在 body 标签及白色底上，确保在高低 DPI 屏上都不会露出任何 Chrome 原生直角灰色底框。

## [0.0.15](https://github.com/qcwssss/chatgpt-web-injector/compare/v0.0.14...v0.0.15) (2026-05-28)

### Features

* **极简下载按钮纯英文化 (English Translation for Subtitle Buttons)**：将 YouTube 字幕下载面板的中文按钮文字 `"SRT 字幕格式下载"` 和 `"TXT 纯文本格式下载"` 统一修改为了简洁优雅的英文标签 `"Download SRT"` 和 `"Download TXT"`，确保插件在不同语言的系统和浏览器中保持一致的纯英文界面。
* **文档更新 (README Updates)**：更新了英文版的 `README.md`，加入了对 YouTube Subtitle Downloader 双格式一键离线下载特征的全面文档支持。

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
