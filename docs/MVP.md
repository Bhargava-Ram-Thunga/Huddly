# Huddly MVP Scope & Definition of Done

> **Status:** Frozen (ARCH-014) · **Target Milestone:** M0–M7 · **Target Release:** v1.0

This document defines the frozen scope, explicit non-goals, end-to-end acceptance criteria, Definition of Done, and scope-cut hierarchy for the Huddly Minimum Viable Product (MVP).

---

## 1. In Scope (Frozen)

The MVP delivers the minimal end-to-end slice required for two or more people to watch web video together in synchronized playback with low-latency text and voice communication.

| Area                     | MVP Capability                            | Notes                                                                                                                                                                                           |
| ------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Extension Platforms**  | Chrome & Firefox extensions               | Manifest V3 build target for Chrome; WebExtensions build for Firefox via shared platform abstraction (`packages/browser-platform`).                                                             |
| **Web Client**           | Lightweight web application               | Allows room creation, invite acceptance, guest onboarding, text chat, voice chat, and synchronized web player view.                                                                             |
| **Room System**          | Create & join via link                    | Instant room creation, short room codes, shareable invite URLs, expiration, guest access without mandatory account registration.                                                                |
| **Roles & Permissions**  | Basic roles (Host & Participant)          | Server-enforced role boundary: only Host can trigger playback mutations by default; Host can transfer host role or delegate control.                                                            |
| **Playback Sync Engine** | Generic HTML5 video/audio synchronization | Server-authoritative state machine (`packages/sync-engine`), clock synchronization (offset + RTT), drift measurement, tiered correction (< 200 ms target), dynamic DOM media element detection. |
| **Text Chat**            | Real-time messaging                       | Ordered message stream over WebSocket, pagination/backlog fetch, XSS-safe sanitized rendering, basic moderation (delete message, mute participant).                                             |
| **Voice Chat**           | Real-time audio via LiveKit               | Low-latency SFU voice room, mic permission and device selection, mute/unmute toggle, active speaker detection, participant audio state indicators.                                              |

---

## 2. Explicit Non-Goals for MVP

The following features are intentionally excluded from the MVP to protect quality, security, and the release timeline. Each item is deferred to post-v1.0 milestones (Phase 9+):

1. **Video Calling (Webcams / Video Tiles):** Not in MVP because SFU bandwidth management, multi-tile rendering layouts, and camera negotiation add significant complexity beyond voice-only synchronization (deferred to Phase 9 / M8).
2. **Mobile Apps (iOS / Android Native):** Not in MVP because mobile browser sandboxing prevents arbitrary web video injection, and building native media wrappers requires separate platform lifecycles (deferred to Phase 13 / M10).
3. **Granular Permission Matrix:** Not in MVP because simple binary Host/Participant roles satisfy 95% of watch-together sessions without the cognitive overhead of per-action ACLs (deferred to Phase 10 / M8–M9).
4. **Adapter SDK & Community Registry:** Not in MVP because generic HTML5 DOM synchronization must be proven stable before publishing public plugin contracts and security sandboxes (deferred to Phase 10 / M8–M9).
5. **100-Participant Large Rooms:** Not in MVP because MVP targets intimate co-watching groups (2–10 participants); large-room broadcast topologies and sharded Redis pub/sub are unnecessary premature optimizations (deferred to Phase 12 / M11).
6. **Threads, GIFs, and Rich Reactions:** Not in MVP because basic linear text chat delivers complete communication utility with minimal schema and state overhead (deferred to Phase 10 / M8–M9).
7. **Session Recording:** Not in MVP because server-side or client-side stream recording introduces severe storage, transcoding, and privacy/compliance burdens (deferred to post-beta).
8. **Screen Sharing:** Not in MVP because Huddly synchronizes shared web playback state rather than streaming video pixels over WebRTC (fundamentally contrary to the core architecture).
9. **Site-Specific Adapters (YouTube, Netflix, Disney+, etc.):** Not in MVP because bespoke player wrappers, custom iframe APIs, and DRM edge cases distract from hardening the universal HTML5 video engine (deferred to Phase 10 / M8–M9).

---

## 3. MVP Success Script (Given / When / Then)

The 14-step MVP script validates the complete user journey. These criteria are formulated for direct automation in Playwright E2E suites:

### Step 1: Install Extension

- **Given** a clean browser instance (Chrome or Firefox),
- **When** the user installs the Huddly extension,
- **Then** the extension background service worker initializes, the toolbar action icon becomes visible, and storage defaults are established.

### Step 2: Open a Supported Site

- **Given** a browser with the Huddly extension active,
- **When** the user navigates to any web page containing an HTML5 `<video>` element,
- **Then** the content script detects the media element and reports media availability (`READY`) to the extension runtime.

### Step 3: Create Room

- **Given** the user is on a supported video page,
- **When** the user opens the Huddly popup and clicks "Create Room",
- **Then** a new room is created on the backend, a unique room ID and invite code are issued, and the user is assigned the `HOST` role.

### Step 4: Share Link

- **Given** an active room created by the host,
- **When** the host clicks "Copy Invite Link",
- **Then** a valid URL containing the room code and target media URL is copied to the system clipboard.

### Step 5: Second Person Joins

- **Given** a second user with the extension installed (or using the web client),
- **When** the second user navigates to the shared invite link and enters a display name,
- **Then** the backend accepts the join request, assigns the `PARTICIPANT` role, and establishes WebSocket and LiveKit connections.

### Step 6: Both See Same Content

- **Given** the host and participant are connected to the same room,
- **When** the participant's client completes room attachment,
- **Then** both clients navigate to the identical media URL, attach to the corresponding `<video>` element, and display matching room metadata.

### Step 7: Host Presses Play

- **Given** both clients are in the room with media paused at position `0.00s`,
- **When** the host clicks play on the video player or extension controls,
- **Then** a `PLAY` playback event with the current server timestamp and updated revision is dispatched to the server.

### Step 8: Both Play in Sync

- **Given** the server broadcasts the `PLAY` event to all room members,
- **When** the participant's client processes the playback state update,
- **Then** the participant's video player begins playing, and the playback position difference (drift) between host and participant remains below 200 ms.

### Step 9: Host Seeks

- **Given** media is actively playing in sync,
- **When** the host scrubs the video timeline to a new timestamp (e.g., `120.00s`),
- **Then** a `SEEK` event with the target position and incremented revision is sent to the server.

### Step 10: Both Seek in Sync

- **Given** the server validates and broadcasts the `SEEK` state mutation,
- **When** both clients receive the updated state,
- **Then** both video players seek to `120.00s` and resume synchronized playback with drift below 200 ms.

### Step 11: Users Chat

- **Given** host and participant are connected in the room,
- **When** a user submits a text message in the chat input,
- **Then** the message is sanitized, stored, and broadcast in real time to all room members in deterministic chronological order without XSS vulnerabilities.

### Step 12: Users Talk

- **Given** both users have granted microphone permissions,
- **When** a user unmutes their microphone and speaks,
- **Then** low-latency audio is delivered through the LiveKit voice room, active speaker indicators update on both clients, and mute state toggles reliably.

### Step 13: User Disconnects and Reconnects

- **Given** active synchronized playback and voice connection,
- **When** the participant experiences a transient network drop (or refreshes the tab) and reconnects,
- **Then** the client automatically re-authenticates over WebSocket, rejoins the LiveKit audio room, and requests a state snapshot.

### Step 14: State Stays Synchronized

- **Given** the reconnected participant receives the latest room snapshot,
- **When** the sync engine applies the server-authoritative state,
- **Then** the participant's video timeline aligns with the host's current position without full event replay, and playback continues with drift below 200 ms.

---

## 4. Definition of Done (DoD)

An issue or PR is considered **Done** only when all eight criteria are satisfied:

1. **Implementation:** Clean, maintainable code matching architectural guidelines and strict TypeScript configurations with zero type suppressions (`any` / `@ts-ignore` forbidden without explicit ADR reference).
2. **Tests:**
   - Unit tests covering core logic, state transitions, and edge cases.
   - Integration / contract tests for API endpoints and WebSocket messages.
   - End-to-end tests for user-facing flows using mock media and headless browsers.
3. **Error Handling & Resilience:**
   - Explicit error codes and typed domain exceptions.
   - Graceful recovery on network disconnection, timeout, and unexpected DOM mutations.
   - User-friendly error messaging in the UI.
4. **Security Considerations:**
   - Server-side authorization on every endpoint and WebSocket event.
   - XSS sanitization on all user input and rendered text.
   - No sensitive data (passwords, tokens, PII) in logs or client-side storage.
   - Secret scan passing (Gitleaks).
5. **Documentation:**
   - Updated markdown documentation, ADRs, and schema specs where applicable.
   - JSDoc / TSDoc on public interfaces and domain methods.
6. **Telemetry & Observability:**
   - Structured logs for key lifecycle transitions (room create, join, leave, error).
   - Sync drift metrics and connection latency instrumentation where appropriate.
7. **Code Review:**
   - Peer review approved; all automated CI checks passing (`lint`, `typecheck`, `test`, `markdownlint`).
8. **Acceptance Criteria Met:**
   - Verifiable adherence to the Given/When/Then scenarios defined in the issue.

---

## 5. Scope Cut Triggers & Slip Rule Policy

Huddly follows the **Slip Rule** defined in [`docs/process/release-plan.md`](process/release-plan.md):

> **The Slip Rule:** If any phase runs more than **one weekend session** over its allocated budget, the maintainer must **cut scope, not quality**. Tests, security controls, and reliability are inviolable.

### Inviolable Core (Never Compressed or Cut)

1. **Playback Sync Engine (Phase 5 / M4):** Server-authoritative clock sync, drift correction, and state machine integrity are the fundamental identity of Huddly.
2. **Extension Platform & Generic HTML5 Adapter (Phase 6 / M5):** Cross-browser DOM video element detection and control are the core product surface.
3. **Automated Testing & Security Gates:** CI pipelines, unit/integration test coverage, and Gitleaks security scans are never bypassed or relaxed.

### Explicit Scope Cut Hierarchy

If a delivery deadline is threatened, features must be dropped in the following strict priority order:

```text
First to Cut (Lowest Risk)
  │
  ├─► Level 1: Voice Chat (Phase 8 / M7)
  │   Drop LiveKit audio integration; ship v1.0 as text-chat + video-sync only.
  │
  ├─► Level 2: Chat Depth & Moderation (Phase 7 / M6)
  │   Drop message persistence / historical pagination; retain ephemeral in-memory WebSocket chat.
  │
  ├─► Level 3: Guest Persistence & Custom Room Settings (Phase 2 & 3 / M1–M2)
  │   Drop custom room codes, lock toggles, and user profiles; retain ephemeral randomized room links.
  │
  ▼
Last to Cut (Protected Core)
```

When a scope cut is triggered:

1. Update this document (`docs/MVP.md`) and [`ROADMAP.md`](../ROADMAP.md) to record the dropped item.
2. Re-baseline the delivery schedule in [`docs/process/release-plan.md`](process/release-plan.md).
3. Do not carry unbudgeted technical debt into subsequent phases.
