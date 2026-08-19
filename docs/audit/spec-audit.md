# Specification Audit (ARCH-001)

This audit evaluates the technical feasibility, architectural assumptions, and scope constraints for building Huddly as a single-operator, personal-use synchronized media platform.

For legal and copyright boundaries, see the dedicated analysis in `docs/research/legal-platform-constraints.md`.

---

## 1. Specification Findings Matrix

| Finding                                               | Severity | Spec Section             | Recommendation                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------- | -------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-01: Universal DOM Video Control**                 | High     | Architecture / Extension | Do not assume every website exposes standard `<video>` elements directly accessible in top-level DOM. Custom WebGL players, Canvas renderers, cross-origin iframes, and closed shadow DOM roots break naive observation. Adopt a 3-tier fallback ladder (native adapter -> generic HTML5 observer -> manual sync override). |
| **F-02: 100-Participant Voice SFU Limits**            | Medium   | Voice Architecture       | A single self-hosted LiveKit SFU instance handles 100 concurrent listeners easily, but 100 simultaneous active unmuted speakers introduces massive bandwidth and client mixing CPU overhead. Enforce active-speaker limits and default-muted participants for rooms exceeding 25 members.                                   |
| **F-03: Cross-Browser Manifest V3 Parity**            | High     | Extension Architecture   | Chrome, Firefox, and Safari have divergent MV3 lifecycles. Firefox maintains persistent background scripts and differs on `declarativeNetRequest`, while Safari requires native Xcode wrapper bundling. Target Chrome/Brave/Edge as Tier 1 personal daily drivers and support Firefox as Tier 2.                            |
| **F-04: Monotonic Clock Assumption**                  | High     | Sync Algorithm           | Client system clocks drift and cannot be trusted for absolute time comparisons. Implement Cristian's algorithm / NTP ping-pong offsets during WebSocket heartbeat to establish a server-synchronized reference clock.                                                                                                       |
| **F-05: DRM and Encrypted Media Extensions (EME)**    | High     | Media Playback           | Widevine/FairPlay encrypted streams prevent raw frame inspection or buffer mutation. Enforce observe-only semantics via standard HTMLMediaElement timing properties (`currentTime`, `paused`, `playbackRate`) without touching EME decryptors.                                                                              |
| **F-06: Ephemeral vs Persistent State Split**         | Medium   | Database / Redis         | Storing sub-second playback heartbeats in PostgreSQL introduces write amplification. Delegate active room playback ticks and presence to Redis RAM structures with write-behind snapshots to Postgres on room close.                                                                                                        |
| **F-07: Single-Point-of-Failure Controller Election** | Medium   | Playback Control         | When the host leaves or disconnects, playback can stall without clear authority. Define deterministic host handoff and controller election policies based on room seniority.                                                                                                                                                |
| **F-08: Token Entropy and Session Fixation**          | Medium   | Authentication           | URL invite parameters and refresh tokens require high-entropy cryptographic generation (CSPRNG) with single-use rotation and SHA-256 database hashing.                                                                                                                                                                      |
| **F-09: Unbounded Chat Replay Buffers**               | Low      | Chat Service             | Loading entire chat history into memory during room connection degrades client performance. Enforce cursor-based reverse pagination (50 messages per page).                                                                                                                                                                 |
| **F-10: WebSocket Reconnection Storms**               | Medium   | Realtime Gateway         | Simultaneous client reconnection after transient network drop can overwhelm the gateway. Require randomized exponential backoff with jitter on client reconnect logic.                                                                                                                                                      |

---

## 2. Verdicts on High-Risk Technical Claims

### 2.1 Universal Site Control

- **Claim:** The platform can synchronize playback on any arbitrary website on the internet.
- **Technical Reality:** False for arbitrary video players without fallback. While standard HTML5 `<video>` elements cover approximately 85% to 90% of streaming websites, several major platforms isolate players inside nested cross-origin iframes, closed Shadow DOM boundaries, or canvas-based custom decoders.
- **Verdict: CONDITIONAL PASS (Tiered Fallback).**
  - Tier 1: Dedicated platform adapters (custom DOM traversal and event listeners for known sites).
  - Tier 2: Generic HTML5 video observer (MutationObserver + standard `HTMLMediaElement` hooks).
  - Tier 3: Manual sync control (host controls a floating timing reference bar; participants adjust local video manually if DOM binding is blocked).

### 2.2 100-Participant Target

- **Claim:** A single room supports 100 participants with real-time sync, chat, and voice.
- **Technical Reality:** Realistic for state synchronization (WebSocket JSON broadcasts at 1-2 Hz consume <50 KB/s per client). Realistic for LiveKit SFU audio distribution if only active speakers publish audio tracks. Unrealistic if all 100 participants publish unmuted audio concurrently on a modest self-hosted VPS.
- **Verdict: PASS WITH CAPACITY CONSTRAINTS.**
  - Realtime state and chat: Verified for 100 participants.
  - Voice audio: Max 5 concurrent publishers (dominant speaker switching); remaining participants receive mixed downlink streams.

### 2.3 Cross-Browser Manifest V3 Parity

- **Claim:** A single extension codebase runs identically across Chrome, Firefox, and Safari.
- **Technical Reality:** False without browser-specific build targets. Safari requires a macOS/iOS app container compiled via Xcode, while Firefox has distinct permissions models and WebExtensions polyfills.
- **Verdict: SCOPED FOR PERSONAL USE.**
  - Tier 1 Primary: Chromium-based browsers (Chrome, Edge, Brave) using standard MV3 Service Workers.
  - Tier 2 Secondary: Firefox MV3 via WebExtensions build config.
  - Tier 3 Deferred: Safari (omitted from immediate personal build plan to avoid Apple developer provisioning overhead).

---

## 3. Top 10 Risks for Scope Freeze

The following risks are evaluated for the single-operator build scope, tracking whether existing Architectural Decision Records (ADRs) have already resolved them:

1. **Drift Divergence from Network Jitter (Resolved by ADR-011)**: Addressed via tiered correction thresholds (ignore under 150ms, nudge rate between 150ms-1s, seek jump above 1s).
2. **Database Write Saturation from Playback Ticks (Resolved by ADR-004 & ADR-005)**: Addressed by keeping sub-second playback state exclusively in Redis memory and persisting only lifecycle boundaries to PostgreSQL.
3. **Audio Bandwidth and CPU Exhaustion (Resolved by ADR-001, ADR-002, ADR-003)**: Addressed by adopting a centralized LiveKit SFU topology instead of full-mesh P2P.
4. **Service Worker Termination in Chromium MV3 (Resolved by ADR-010)**: Addressed by offloading persistent WebSocket connections to the web app tab and utilizing offscreen documents / tab messaging for extension bridging.
5. **Schema Contract Drift between Backend and Client (Resolved by ADR-007)**: Addressed by sharing `@huddly/protocol` Zod schemas across all packages in the Turborepo monorepo.
6. **Cross-Site Scripting (XSS) via Chat and Link Previews (Open - Phase 7 Chat)**: Requires strict DOMPurify rendering, markdown plain-text restrictions, and sanitized OpenGraph preview parsers.
7. **Host Disconnection Freezing Playback State (Open - Phase 3 Rooms)**: Requires controller auto-delegation to next senior participant when host heartbeats expire.
8. **Stale Playback Commands Replaying Out of Order (Resolved by ADR-011)**: Addressed by server-authoritative monotonic revision numbers (`revision: bigint`) on all playback events.
9. **Extension Content Script Injection Failures on SPAs (Open - Phase 6 Extension)**: Requires `webNavigation.onHistoryStateUpdated` listeners to re-attach observers during dynamic client-side page transitions.
10. **Replay Attacks and Session Hijacking (Resolved by ADR-006 & AUTH-003/007)**: Addressed via 60-second single-use realtime connection tickets, short-lived JWTs (15 min), and rotating refresh tokens.
