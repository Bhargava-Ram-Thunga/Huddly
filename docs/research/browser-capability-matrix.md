# Browser Capability Matrix (ARCH-004)

This research document analyzes browser extension APIs, DOM media lifecycle behaviors, and WebRTC audio capabilities across major desktop browsers to support the implementation of Huddly's browser extension and web application.

This matrix directly feeds into the architecture documented in `docs/adr/ADR-010-extension-architecture.md`.

---

## 1. Browser Tiering Strategy (Personal Use)

For single-operator personal usage, development effort is prioritized by personal daily browser utility:

- **Tier 1 (Primary Daily Drivers)**: Chromium family (Google Chrome, Microsoft Edge, Brave). Full Manifest V3 service worker support and active testing target.
- **Tier 2 (Secondary Desktop)**: Mozilla Firefox (Gecko engine). Standard MV3 support with WebExtensions background scripts.
- **Tier 3 (Deferred / Unsupported)**: Apple Safari. Requires native Xcode macOS/iOS wrapper application build; deferred from initial personal build scope.

---

## 2. Technical Capability Comparison

| Capability Area              | Specific API / Feature                             | Chrome (Chromium)                                  | Microsoft Edge                      | Mozilla Firefox                                            | Apple Safari                                  | Blockers & Workarounds                                                                                                                                                                                                                            |
| ---------------------------- | -------------------------------------------------- | -------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manifest V3 Runtime**      | Background Service Worker                          | SUPPORTED                                          | SUPPORTED                           | PARTIAL (supports both background scripts and event pages) | SUPPORTED                                     | _Blocker_: Chromium MV3 terminates idle service workers after 30 seconds.<br>_Workaround_: Move long-lived WebSocket connection to the active web app tab; extension communicates via `runtime.sendMessage` port.                                 |
| **Content Script Injection** | `chrome.scripting.executeScript` & Dynamic Scripts | SUPPORTED                                          | SUPPORTED                           | SUPPORTED                                                  | PARTIAL (limited dynamic URL match filtering) | Supported across Tier 1 and Tier 2 using standard `content_scripts` declarations.                                                                                                                                                                 |
| **Storage APIs**             | `chrome.storage.local` & `session`                 | SUPPORTED                                          | SUPPORTED                           | SUPPORTED (`storage.session` in v115+)                     | SUPPORTED                                     | Use `chrome.storage.local` with fallback to in-memory cache for user preferences and active room state.                                                                                                                                           |
| **Permissions Model**        | Optional host permissions & `activeTab`            | SUPPORTED                                          | SUPPORTED                           | SUPPORTED                                                  | PARTIAL                                       | Request `activeTab` and optional broad host permissions (`<all_urls>`) explicitly enabled during room joining.                                                                                                                                    |
| **DOM Video Control**        | `HTMLMediaElement` Events & Properties             | SUPPORTED                                          | SUPPORTED                           | SUPPORTED                                                  | SUPPORTED                                     | Standard across all modern engines for `play()`, `pause()`, `currentTime`, `playbackRate`.                                                                                                                                                        |
| **Autoplay Policy**          | Programmatic `.play()` without direct user gesture | PARTIAL (requires media engagement or muted start) | PARTIAL (requires media engagement) | PARTIAL (configurable per-site permissions)                | UNSUPPORTED without explicit user interaction | _Blocker_: Browsers block un-muted `.play()` calls initiated from background WebSocket events.<br>_Workaround_: Display an overlay modal prompt ("Click to Sync Audio/Video") on initial room entry to satisfy browser user-gesture requirements. |
| **WebRTC Audio (SFU)**       | `RTCPeerConnection`, Opus, Audio Mixing            | SUPPORTED                                          | SUPPORTED                           | SUPPORTED                                                  | SUPPORTED                                     | Standard WebRTC 1.0 support across all browsers for LiveKit audio downlink and microphone publishing.                                                                                                                                             |
| **Shadow DOM Inspection**    | Traversal of custom player components              | SUPPORTED (open roots)                             | SUPPORTED (open roots)              | SUPPORTED (open roots)                                     | SUPPORTED (open roots)                        | _Blocker_: Closed Shadow DOM roots (`attachShadow({ mode: 'closed' })`) block external script traversal.<br>_Workaround_: Fall back to container element MutationObserver or manual sync.                                                         |

---

## 3. Key Findings and Recommendations for ADR-010

1. **Persistent WebSocket Gateway Separation**:
   - Because Chromium MV3 enforces strict background worker shutdown policies, the extension service worker must not be the primary WebSocket client.
   - The Huddly web application tab maintains the WebSocket connection to the API gateway, while the extension acts as a lightweight DOM observation bridge communicating with the web tab via `chrome.runtime.onMessageExternal` or content script postMessage.

2. **User Gesture Handling for Autoplay**:
   - Automatic play commands received over the wire will be blocked by modern browser autoplay heuristics if the user has not interacted with the video tab.
   - The UI must render an interactive "Sync with Room" banner on first load to trigger the required user gesture token.

3. **Multi-Target Build Scripting**:
   - Build scripts in Turborepo will compile a unified extension source into two distribution bundles: `dist/chrome` (standard MV3 with `service_worker`) and `dist/firefox` (MV3 with `scripts` array and Gecko settings).
