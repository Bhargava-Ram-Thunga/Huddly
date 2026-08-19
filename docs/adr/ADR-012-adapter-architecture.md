# ADR-012: Video site adapter architecture and sync boundary

- **Status:** Accepted
- **Date:** 2026-08-16
- **Deciders:** Bhargava-Ram-Thunga
- **Issue:** [ARCH-009](https://github.com/Bhargava-Ram-Thunga/Huddly/issues/45)

## Context

Huddly synchronizes video playback across multiple clients by synchronizing state over WebSockets rather than re-streaming video pixels over WebRTC (spec §19, MVP Non-Goal #8). To control playback on client devices, client runtimes must interface with HTML5 media elements (`<video>`) and host web players.

Different video hosts implement fundamentally divergent player architectures: standard DOM `<video>` tags, Shadow DOM wrappers, custom iframe players (YouTube `#movie_player`), React state machines with proprietary internal APIs (Netflix Cadmium), Low-Latency HLS live streams (Twitch), and DRM-protected media pipelines.

We need a clean architectural boundary for `packages/site-adapters` that:

1. Establishes a stable interface contract matching ROADMAP Phase 10 SDK expectations.
2. Defines normative units for positions, timestamps, and drift across the monorepo.
3. Solves the infinite feedback loop ("echo storm") when programmatic actions trigger native media events.
4. Maintains sub-50ms synchronization without degradation when browser tabs are hidden or throttled.
5. Preserves strict package boundaries (no extension or platform globals in the core adapter package).
6. Upholds the MVP scope freeze (generic HTML5 only for MVP; site-specific adapters in Phase 10) and legal boundaries (never bypass DRM).

### Options considered

#### 1. Interface design: Monolithic adapter vs. unified verb contract

- **Option A (Ad-hoc site wrappers):** Write bespoke scripts per site with custom methods.
  - _Rejected:_ Breaks `@huddly/sync-engine` reusability, prevents automated capability negotiation, and requires rewriting adapters when the Phase 10 SDK ships.
- **Option B (Standardized verb contract with capability metadata):** Define a universal `IVideoAdapter` interface exposing nine uniform verbs (`detect`, `getMedia`, `getState`, `play`, `pause`, `seek`, `setRate`, `navigate`, `destroy`) accompanied by capability flags (`SUPPORTED`, `PARTIAL`, `UNSUPPORTED`).
  - _Selected:_ Allows the sync engine and UI to operate against a uniform abstraction regardless of the underlying site or player architecture.

#### 2. Anti-echo detection: `event.isTrusted` vs. multi-gate programmatic mutex

- **Option A (Relying on `event.isTrusted`):** Check `event.isTrusted` in media event handlers to ignore programmatic actions.
  - _Rejected with critical reasoning:_ In modern browser engines (Blink, Gecko, WebKit), `event.isTrusted` is `false` **only** for synthetic events manually created and dispatched via `element.dispatchEvent(new Event('play'))`. When JavaScript invokes the native media method `video.play()` or sets `video.currentTime = target`, the browser engine processes the command asynchronously and emits a **genuine, trusted (`isTrusted === true`)** `play` or `seeking` event. Relying on `event.isTrusted` fails completely and causes immediate infinite feedback loops.
- **Option B (Multi-gate stack with programmatic mutex counter and expected-state reconciliation):** Use an execution counter mutex (`lockCount`), event-driven unlock with timeout backstop, expected-state comparison, and monotonic protocol revision filtering.
  - _Selected:_ Reliably isolates human user interactions from programmatic sync adjustments.

#### 3. Timing and position sampling: `timeupdate` vs. `requestVideoFrameCallback` + Web Worker clock

- **Option A (Standard `timeupdate` + `setInterval`):** Sample position on `timeupdate` events.
  - _Rejected:_ `timeupdate` fires indeterminately (every 15–250 ms), causing jitter. Furthermore, Chrome and Firefox aggressively throttle `setInterval` to ~1 execution per minute in background/hidden tabs. A once-per-minute loop cannot maintain a 50 ms sync band.
- **Option B (`requestVideoFrameCallback` + Web Worker ticker):** Sample position using `requestVideoFrameCallback` (`mediaTime`) when active, fall back to `currentTime`, and drive the background synchronization heartbeat via a dedicated Web Worker timer (which is immune to tab throttling), accompanied by a hard resync on `visibilitychange`.
  - _Selected:_ Guarantees microsecond-accurate video frame timing and prevents background desynchronization.

---

## Decision

### 1. Unified Adapter Interface Contract

`packages/site-adapters` defines the canonical `IVideoAdapter` interface matching the ROADMAP Phase 10 specification:

```typescript
export type CapabilitySupport = 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED';

export interface AdapterCapabilities {
  play: CapabilitySupport;
  pause: CapabilitySupport;
  seek: CapabilitySupport;
  playbackRate: CapabilitySupport;
  navigate: CapabilitySupport;
  fullscreen: CapabilitySupport;
}

export interface MediaIdentity {
  mediaId: string;
  mediaUrl: string;
  title: string | null;
  duration: number; // in seconds (NaN or Infinity for live streams)
  isLive: boolean;
}

export interface AdapterPlaybackState {
  media: MediaIdentity;
  position: number; // in seconds
  playing: boolean;
  playbackRate: number;
  buffering: boolean;
}

export interface IVideoAdapter {
  readonly id: string;
  readonly capabilities: Readonly<AdapterCapabilities>;

  // Lifecycle
  detect(element: Element | Document): Promise<boolean>;
  destroy(): void;

  // State inspection
  getMedia(): MediaIdentity | null;
  getState(): AdapterPlaybackState | null;

  // Actions
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionSeconds: number): Promise<void>;
  setRate(rate: number): Promise<void>;
  navigate(mediaUrl: string): Promise<void>;

  // Event observation (User-initiated mutations only)
  onStateChange(listener: (state: AdapterPlaybackState) => void): () => void;
  onError(listener: (error: Error) => void): () => void;
}
```

### 2. Normative Units

To prevent conversion errors across packages:

1. **Positions (`position`, `seekTo`, `duration`):** **Seconds** (`number`, floating point, $\ge 0$). Matches `PlaybackSnapshot.position`, `PlaybackPlayPayload.position`, and `expectedPosition()`.
2. **Drift & Latency (`driftMs`, thresholds, RTT, offsets):** **Milliseconds** (`number`, floating point). Matches `DriftDecision.driftMs`, `DEFAULT_THRESHOLDS`, and NTP calculations.
3. **Timestamps (`serverTimestamp`, `createdAt`, `joinedAt`):** **Epoch Milliseconds** (`number`, non-negative integer). Matches protocol v1 envelopes and Prisma schema integer timestamps.

### 3. Anti-Echo Multi-Gate Stack

To eliminate infinite ping-pong feedback loops, all adapters inherit a strict four-gate filter stack:

```text
[DOM Media Event: play / pause / seeking / ratechange]
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Gate 0: Controller Authority Check                          │
│ Is this client authorized to control playback (HOST / auth)?│
└──────────────────────────────┬──────────────────────────────┘
                               │ Pass
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Gate 1: Programmatic Mutex Counter (lockCount > 0)          │
│ Was this event triggered by a local sync command?           │
└──────────────────────────────┬──────────────────────────────┘
                               │ Pass (lockCount === 0)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Gate 1b: Expected-State Reconciler                          │
│ Does local state already match room authoritative state?     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Pass (State diverged)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Gate 2: Event Hygiene Check (isTrusted !== false)           │
│ Reject synthetic script-dispatched events.                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Pass
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Protocol Filter: shouldApply() Revision Monotonicity        │
│ Reject stale or lower revisions from network broadcast.     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
               [Emit User Mutation to Network]
```

- **Mutex Implementation:** `programmaticLockCounter` increments before executing any remote command (`play()`, `pause()`, `seek()`, `setRate()`). It decrements upon receiving the expected native event or after a 150 ms timeout backstop.
- **`isTrusted` Role:** `isTrusted` is retained as defensive hygiene against third-party page scripts dispatching synthetic events, but the primary defense remains the programmatic mutex counter and expected-state reconciler.

### 4. Precision Timing & Background Tab Execution

1. **Position Source:** Adapters use `HTMLVideoElement.requestVideoFrameCallback()` (`now, metadata.mediaTime`) when available, providing exact presentation timestamps synchronized with the compositor. Fallback is `video.currentTime`.
2. **Web Worker Ticker:** Because `requestAnimationFrame` and `requestVideoFrameCallback` pause when the tab is in the background, and `setInterval` is throttled to 1 minute, the client runtime spawns an inline Web Worker ticker (`Worker` with `setInterval(100ms)`) to drive background drift checks.
3. **Visibility Resync:** On `document.addEventListener('visibilitychange')`, when `document.visibilityState === 'visible'`, the adapter executes an immediate hard drift calculation and reconciles local playback.

### 5. Architectural & Package Boundaries

1. **DOM-Only:** `packages/site-adapters` must remain strictly platform-agnostic and DOM-only. It must contain **no references** to `chrome.*`, `browser.*`, or extension service worker APIs.
2. **Browser Platform Delegation:** Any execution requiring page-context escalation (such as Chrome MV3 `world: "MAIN"` or Firefox script bridge) is encapsulated in `packages/browser-platform`.
3. **Cross-Browser Parity:** Chrome and Firefox are both Tier 1 MVP targets. Because Firefox WebExtensions lack `world: "MAIN"`, all MVP adapter logic must operate through standard DOM access, further reinforcing the universal generic approach.

### 6. Scope Freeze & Legal Posture

1. **MVP Scope:** Generic HTML5 video (`GenericHTML5Adapter`) is the sole adapter for MVP (Phases 1–8 / M0–M7). Site-specific adapters (YouTube, Vimeo, Netflix, etc.) are explicitly deferred to Phase 10 / M8–M9 (MVP Non-Goal #9).
2. **DRM Sites & Legal Boundary:** Huddly synchronizes state, not pixels. Huddly drives standard media player controls and never accesses, intercepts, decrypts, or tampers with Encrypted Media Extensions (EME) or DRM pipelines (ROADMAP constraint). Sites with protected players degrade gracefully to manual sync confirmation if automated DOM hooks are unavailable.

---

## Consequences

### Positive

- **Future-Proof SDK:** The interface verbs match ROADMAP Phase 10, ensuring community adapters will build upon a finalized contract without breaking changes.
- **Zero Echo Storms:** The multi-gate mutex counter and state reconciler eliminate feedback loops deterministically across all browser engines.
- **Background Synchronization:** Web Worker clocking prevents desync when users switch tabs or minimize the browser window.
- **Clean Architecture:** `packages/site-adapters` remains pure TypeScript and DOM-testable with Vitest and JSDOM/HappyDOM.

### Negative / Accepted Trade-offs

- **Background Worker Overhead:** Spawning a Web Worker ticker introduces a minor memory overhead per active session tab (~15 KB).
- **Generic-Only MVP Experience:** On sites with heavy custom player overlays, users on the MVP build rely on the generic fallback, which requires clicking the media element or using the Huddly HUD controls.

### Follow-through Required

- Create `packages/site-adapters` with `IVideoAdapter`, `AbstractBaseAdapter`, and `GenericHTML5Adapter`.
- Wire `GenericHTML5Adapter` with `@huddly/sync-engine`'s `decideCorrection()` function.
- Add comprehensive Vitest test suite with mocked `HTMLMediaElement` verifying the multi-gate anti-echo state machine.

---

## Revisit when

- Phase 10 (M8–M9) begins, to implement bespoke site adapters (YouTube, Vimeo) and publish the community Adapter SDK.
- Browser vendors introduce standardized background timer policies or cross-browser `world: "MAIN"` support in WebExtensions.

---

## Open Questions & Follow-Up Issues

The following architectural questions cannot be resolved in this ADR alone and are tracked for subsequent milestone issues:

1. **Ad-Divergence Policy:** When one participant encounters a client-side ad, should the room automatically pause for all participants ("wait-for-all") or should the room continue while the affected client pauses sync and fast-forwards/converges on ad exit ("converge-on-exit")?
2. **Buffering Cascade Policy:** When a participant with poor network bandwidth stalls in buffering state, should the host/room automatically pause to wait, or should the slow client be allowed to fall behind and recover via tiered drift seeks?
3. **`controllerId` Schema Alignment:** `ROADMAP.md` and `sync-engine`'s `PlaybackState` include `controllerId: string | null`, whereas `PlaybackSnapshotSchema` in `@huddly/protocol` currently omits it. Should `controllerId` be formally added to `PlaybackSnapshotSchema`, or is control authority strictly derived from `role === 'HOST'`?
4. **Live Stream Position Semantics:** For live low-latency streams (Twitch/YouTube Live), how should `position` be represented in snapshots (sliding DVR buffer seconds vs. live edge latency target vs. wall-clock epoch ms)?
