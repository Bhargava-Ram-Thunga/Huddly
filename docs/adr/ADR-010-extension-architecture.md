# ADR-010: Extension architecture, runtime contexts, and HUD isolation

- **Status:** Accepted
- **Date:** 2026-08-16
- **Deciders:** Bhargava-Ram-Thunga
- **Issue:** [ARCH-009](https://github.com/Bhargava-Ram-Thunga/Huddly/issues/45)

## Context

Huddly requires a browser extension (`apps/extension`) supporting both Chrome (Manifest V3) and Firefox (WebExtensions) to detect HTML5 video playback, coordinate room events, and render an interactive watch-party HUD directly on streaming websites (spec §19, MVP §1).

The extension runtime operates across four execution environments:

1. **Popup / Sidepanel:** Ephemeral UI for room creation, joining, and audio device selection.
2. **Background Service Worker (Chrome MV3) / Event Page (Firefox):** Central coordination plane.
3. **Content Script:** Injected into target tabs to observe DOM media elements and inject UI.
4. **In-Page Watch Party HUD:** Live floating UI (chat, participant avatars, sync indicators, controls).

Building a robust extension across modern browser engines presents three critical architectural hurdles:

1. **Manifest V3 Service Worker Lifecycle:** In Chromium MV3, background service workers terminate after 30 seconds of idle time or 5 minutes of synchronous execution. Standard WebSocket connections do not reset the idle timer. An unmanaged service worker will abruptly disconnect users mid-movie.
2. **CSS & DOM Isolation:** Third-party streaming websites apply complex global stylesheets (Tailwind, Bootstrap, resets). Huddly's HUD must render consistently without inheriting host page styles or leaking its own styles into the host player. Furthermore, when host players enter native fullscreen mode (`video.requestFullscreen()`), the browser compositor hides everything outside the fullscreen DOM subtree.
3. **Cross-Browser Parity:** Chrome MV3 relies on background service workers and `chrome.scripting.executeScript({ world: 'MAIN' })`, whereas Firefox WebExtensions support background event pages and lack `world: 'MAIN'` support.

### Options considered

#### 1. WebSocket host location: Content script vs. background service worker vs. offscreen document

- **Option A (Content-Script WebSocket):** Open the WebSocket directly in the tab's content script.
  - _Rejected:_ Drops connections on in-tab page navigation or refresh, prevents multi-tab coordination, and terminates background LiveKit voice streams when navigating between video pages.
- **Option B (Background Service Worker with Port-Backed Keep-Alive):** Maintain the central WebSocket in the Background Service Worker. Content scripts connect via long-lived `chrome.runtime.Port`. A 20-second heartbeat exchange between the active tab and the worker keeps the worker alive during active watch sessions.
  - _Selected:_ Preserves room connectivity across page transitions, centralizes state, and prevents 30-second idle termination.
- **Option C (`chrome.offscreen` Document):** Spawn an offscreen document to host the WebSocket and audio context.
  - _Deferred to Phase 8 (Voice):_ Offscreen documents require explicit permissions (`"offscreen"`), are unavailable in Firefox, and add unnecessary complexity for text/playback sync.

#### 2. In-page HUD isolation: IFrame vs. Closed Shadow DOM vs. Open Shadow DOM

- **Option A (Injected IFrame):** Render the HUD inside a floating iframe.
  - _Rejected:_ Heavy memory overhead per tab, complicated modal focus trapping, and awkward resizing when chat drawers expand.
- **Option B (Closed Shadow DOM):** `element.attachShadow({ mode: 'closed' })`.
  - _Rejected:_ Prevents React 19 root attachments and developer tooling without providing meaningful security against host page scripts (which can override `Element.prototype.attachShadow` if malicious).
- **Option C (Open Shadow DOM with `all: initial` CSS reset):** Render the HUD inside a custom element `<huddly-hud-host>` with `attachShadow({ mode: 'open' })` and scoped design tokens.
  - _Selected:_ Provides 100% style isolation, clean React component tree mounting, and zero style leakage.

---

## Decision

### 1. Centralized Background Service Worker Hub

`apps/extension` implements a centralized background architecture:

1. **Central WebSocket Gateway Connection:** The Background Service Worker owns the authoritative WebSocket connection to `@huddly/realtime`.
2. **Keep-Alive Port Chaining:**
   - Active watch-party content scripts establish a dedicated port connection (`chrome.runtime.connect({ name: 'huddly-session-channel' })`).
   - Content script and worker exchange heartbeat packets every 20 seconds while a room is active, preventing Chromium's 30-second idle shutdown.
3. **Fast Session Recovery:** Session tokens and active room metadata are mirrored in `chrome.storage.session`. If OS memory pressure terminates the worker, port reconnection instantly wakes the worker and re-authenticates in $<100\text{ ms}$.

### 2. In-Page HUD Injection & Fullscreen Reparenting

1. **Open Shadow DOM Host:** All in-page UI is mounted inside `<huddly-hud-host id="huddly-hud-host">` with an Open Shadow Root.
2. **Style Isolation Boundary:**

   ```css
   :host {
     all: initial;
     contain: layout style paint;
     font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
     position: fixed;
     z-index: 2147483647;
     pointer-events: none;
   }
   .huddly-interactive {
     pointer-events: auto;
   }
   ```

3. **Dynamic Fullscreen Reparenting:**
   - The content script listens for `document.addEventListener('fullscreenchange', ...)`.
   - When `document.fullscreenElement` is active, `<huddly-hud-host>` is reparented directly inside `document.fullscreenElement` with `position: absolute; inset: 0;`.
   - On exiting fullscreen, `<huddly-hud-host>` is reparented back to `document.body` with `position: fixed;`.

### 3. Inter-Context Message Bus

Communication between extension contexts uses strict tagged unions defined in `packages/browser-platform`:

```typescript
export type ExtensionMessage =
  | { type: 'EXT_ROOM_JOIN'; payload: { roomCode: string; token: string } }
  | { type: 'EXT_ROOM_LEAVE'; payload: { roomId: string } }
  | { type: 'EXT_PLAYBACK_COMMAND'; payload: PlaybackPlayPayload | PlaybackPausePayload }
  | { type: 'EXT_SYNC_STATE'; payload: RoomStateSnapshotPayload }
  | { type: 'EXT_ADAPTER_MUTATION'; payload: { action: string; position: number } };
```

- **Popup ↔ Background:** `chrome.runtime.sendMessage` for one-off requests (create room, authenticate).
- **Content Script ↔ Background:** `chrome.runtime.Port` for real-time bidirectional sync streaming.
- **Content Script ↔ Page Bridge:** `window.postMessage` protected by a per-tab cryptographic nonce to prevent third-party page spoofing.

### 4. Package & Platform Boundaries

1. **`packages/browser-platform`:** Encapsulates all `chrome.*` and `browser.*` APIs behind unified Promise-based interfaces (`BrowserRuntime`, `BrowserStorage`, `BrowserTabs`).
2. **Purity of `@huddly/site-adapters` and `@huddly/sync-engine`:** These packages must contain **zero** extension platform dependencies and execute purely against the standard DOM and Web Worker APIs.

---

## Consequences

### Positive

- **Uninterrupted Sessions:** Port keep-alive prevents service worker termination during long movies.
- **Visual Stability:** Open Shadow DOM and CSS resets guarantee that Huddly's cinema aesthetic renders identically on every website.
- **Fullscreen Support:** Fullscreen reparenting keeps chat and video controls accessible when videos are maximized.
- **Cross-Browser Code Sharing:** Over 90% of extension code is shared identically between Chrome and Firefox targets.

### Negative / Accepted Trade-offs

- **DOM Reparenting Edge Cases:** Reparenting the React HUD on fullscreen changes can trigger minor component re-renders if not memoized.
- **Port Management Overhead:** Requires defensive reconnection handlers to handle tab crashes or forced worker GC.

### Follow-through Required

- Implement `packages/browser-platform` with unified runtime, storage, and port wrappers.
- Implement `apps/extension` Manifest V3 structure for Chrome and Firefox.
- Add Playwright multi-context tests verifying port keep-alive and Shadow DOM injection.

---

## Revisit when

- Google Chrome or WebExtensions Community Group (WECG) standardizes long-lived WebSocket support in Manifest V3 service workers.
- Firefox introduces native `world: "MAIN"` scripting support.
