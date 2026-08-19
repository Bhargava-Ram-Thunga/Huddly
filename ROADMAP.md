# Huddly Roadmap

> **Huddly is a realtime layer for being together on the web.**
> It synchronizes the experience, not the screen.

This roadmap turns the master specification into an ordered, end-to-end execution plan. Each phase has a goal, key deliverables, and an exit gate. Phases map to GitHub milestones (M0–M12).

---

## Guiding constraints

- **Lean foundation** — modular monolith, one repo, no premature microservices.
- **State, not pixels** — the server distributes playback commands, timestamps, and room state; never the media itself.
- **Graceful degradation** — DRM/uncontrollable sites degrade to manual sync or (later) fallback modes; never bypass protections.
- **Every phase ships something testable.** A feature is done only with tests, error handling, docs, and acceptance criteria met.

---

## MVP definition (the line we build toward)

Chrome + Firefox extension, web client, room create/join via link, generic HTML5 video sync, text chat, basic roles (host/participant), and basic voice. Everything else comes after the MVP gate.

---

## Phase 0 — Architecture & Decisions `M0`

**Goal:** eliminate unknowns before writing product code.

- Audit the master spec: contradictions, impossible assumptions, browser limitations, legal risks.
- Research spikes: WebExtensions (Chrome/Firefox/Safari), browser media APIs, LiveKit vs mediasoup, sync algorithms, extension-store policies, DRM constraints.
- Write ADRs 001–012 (WebRTC, SFU, LiveKit, PostgreSQL, Redis, WebSockets, TypeScript, modular monolith, monorepo, extension architecture, sync algorithm, adapter architecture).
- Design the canonical **protocol v1**: event envelope (`eventId`, `eventType`, `roomId`, `actorId`, `revision`, `serverTimestamp`, `payload`), REST surface, error codes, versioning.
- Design the **database schema** (users, rooms, room_settings, room_members, room_permissions, media_sessions, playback_states/events, navigation_states, chat_messages, message_reactions, room_invites, moderation_actions, audit_events) + ERD, indexes, lifecycle rules.
- Threat model + legal/platform constraints research issue.
- License decision (Apache 2.0 default candidate; separate analysis).
- UX wireframes for room UI, join flow, extension popup.

**Exit gate:** ADRs merged, protocol spec v1 and ERD reviewed, MVP scope frozen.

## Phase 1 — Repository Foundation `M1`

**Goal:** clone → install → run → test in under 15 minutes.

- Monorepo scaffold: `apps/` (extension, web), `packages/` (core, protocol, sync-engine, site-adapters, browser-platform, chat, permissions, ui, testing), `services/` (api, realtime), `infrastructure/`, `docs/`.
- Tooling: pnpm workspaces, Turborepo, TypeScript strict, ESLint, Prettier, commit hooks, conventional commits.
- CI (GitHub Actions): lint, typecheck, unit tests, build on every PR.
- Vitest + Playwright harnesses; Docker Compose for Postgres + Redis; env management.
- Core documentation: README, ARCHITECTURE, SECURITY.

**Exit gate:** green CI on a trivial end-to-end "hello room" package graph.

## Phase 2 — Auth & Accounts `M1`

**Goal:** identity without friction.

- User + session + device schemas and migrations.
- Email/password auth, session refresh, logout; OAuth abstraction with Google + GitHub first.
- Guest access model (join a room without an account) — first-class, not an afterthought.
- Auth/authorization middleware; security tests.

## Phase 3 — Room System `M2`

**Goal:** rooms as the central domain object.

- Room CRUD, room codes, invite links with expiry/max-uses.
- Membership: join/leave, roles (OWNER/HOST/MODERATOR/PARTICIPANT/OBSERVER), capacity, locking, waiting room.
- Room lifecycle + cleanup jobs; audit events.
- Basic permission evaluator (ALLOW/DENY/INHERIT) — granular matrix comes in Phase 10.

**Exit gate:** create a room via REST, join via invite link, roles enforced server-side.

## Phase 4 — Realtime Protocol `M3`

**Goal:** the WebSocket backbone every other feature rides on.

- WebSocket server with connection auth, room subscriptions, heartbeats, reconnect + backoff.
- Versioned event envelope, validation, server-side authorization of every event.
- Presence (ONLINE/IDLE/AWAY/RECONNECTING/OFFLINE), room broadcast, error protocol.
- Redis-backed room state + pub/sub for multi-instance readiness; initial load tests.

**Exit gate:** two clients see each other's presence and receive ordered, authorized room events.

## Phase 5 — Playback Sync Engine `M4`

**Goal:** the core product magic. Server-authoritative playback state machine.

- `PlaybackState { mediaId, position, playing, playbackRate, serverTimestamp, revision, controllerId }`.
- Server clock sync (offset + RTT estimation), server-assigned revisions, conflict resolution (server ordering wins, clients never decide final state).
- Drift measurement + tiered correction (ignore < 50ms → rate-nudge → hard seek), thresholds configurable and tuned experimentally.
- Late-join snapshot sync and reconnect resync (revision compare, no event replay).
- Sync telemetry (drift distribution) from day one.

**Exit gate:** two headless clients hold < 200ms drift through play/pause/seek/rate changes and reconnects.

## Phase 6 — Extension + Generic HTML5 Adapter `M5`

**Goal:** Huddly works on real websites.

- Extension foundation: MV3 manifest, service worker, content scripts, popup, storage, minimal permissions, `BrowserAdapter` compatibility layer (`src/platform/browser/{chrome,firefox,shared}`).
- Site Adapter interface + capability model (SUPPORTED/PARTIAL/UNSUPPORTED per capability).
- Generic adapter: detect `HTMLVideoElement`/`HTMLAudioElement` (including dynamically created), capture and perform play/pause/seek/rate, handle SPA navigation and player replacement.
- Fallback ladder for unknown sites (detect → generic sync → URL observation → manual confirm).
- Chrome and Firefox builds in CI.

**Exit gate:** two people on different browsers watch a generic HTML5 video in sync via a shared link.

## Phase 7 — Chat `M6`

**Goal:** chat as a first-class product, not a widget.

- Message schema + REST + realtime delivery, ordering, pagination.
- Emoji, reactions, replies; typing indicator, unread state; edit/delete.
- Moderation basics: delete, mute, slow mode, report; sanitized rendering (no raw HTML — XSS-safe by construction).
- GIFs via provider references (never store binaries); threads land in Phase 10.

## Phase 8 — Voice `M6→M7`

**Goal:** talking while watching.

- LiveKit (self-hostable SFU) integration; WebRTC client in `packages/media`.
- Mic permission handling, device selection, mute/unmute, active-speaker detection, participant audio state, reconnect.
- Join muted by default; audio quality metrics.

### ★ MVP GATE

Everything above = MVP (spec §103). Run the 14-step MVP success script (§104) as an automated E2E suite. Ship a private alpha before continuing.

## Phase 9 — Video & Layouts `M8`

- Camera permission/preview/selection/toggle; publish + subscribe via SFU.
- Layouts (Grid/Speaker/Focus/Theater/Floating/Minimal), pin participant, tiles.
- Simulcast + bandwidth adaptation so weak networks don't degrade the room.

## Phase 10 — Governance, Rich Chat & Adapter SDK `M8→M9`

Three parallelizable tracks:

- **Permissions:** full granular matrix (`canControlPlayback`, `canSeek`, `canChangeMedia`, …), per-capability host transfer, permission audit log.
- **Chat depth:** threads, mentions, link previews, GIF search, richer moderation (blocked words, room-wide delete).
- **Adapter SDK:** stable `detect/getMedia/getState/play/pause/seek/setRate/navigate/destroy` interface, capability metadata, test harness + simulator, adapter docs. First-party adapters as separate epics: YouTube, Vimeo (each: detection, playback, seeking, routes, edge cases, regression tests). Registry design with review/signing — never execute unreviewed community JS.

## Phase 11 — Browser & Platform Expansion `M9`

- Edge build (Tier 1 complete), Chromium family verification (Brave/Opera/Vivaldi).
- Safari WebExtensions research → go/no-go ADR.
- Web app parity for users without the extension (view + chat + voice at minimum).
- Generated browser compatibility matrix, continuously verified in CI.

## Phase 12 — Scale & Hardening `M11` _(runs alongside 9–11)_

- Load tests: 25 → 50 → 100 participants; WebSocket, chat, DB, Redis, SFU load; join/leave/reconnect storms.
- Subscription optimization (subscribe only to displayed tracks), CPU/memory/bandwidth profiling.
- **Security:** dependency + secret scanning in CI from Phase 1; here add XSS/CSRF suites, WebSocket authz testing, privilege-escalation and replay testing, rate limiting, invite attack testing, extension permission review, external pentest.
- **Observability:** structured logging, metrics (rooms, sync drift, WebRTC, SFU, API), dashboards, alerts, tracing, error reporting — with a privacy review.

## Phase 13 — Mobile `M10`

- Shared protocol consumed by native clients (extension APIs must never leak into the protocol — enforced from Phase 0).
- Android first: auth, join, room state, playback, chat, voice, deep links, reconnect, background handling. Then iOS with the same breakdown.

## Phase 14 — Public Beta & Ecosystem `M12`

- Self-hosting guide + one-command Docker deployment.
- Full documentation set (architecture, adapter development, sync protocol, API, WebSocket events, self-hosting, troubleshooting).
- Landing page ("Be together on the web"), extension store listings, launch.
- Ecosystem: adapter development kit with automated validation.

---

## Dependency graph

```text
Phase 0 (Architecture)
   ↓
Phase 1 (Foundation)
   ↓
Phase 2 (Auth) ──→ Phase 3 (Rooms) ──→ Phase 4 (Realtime)
                                            ↓
                                     Phase 5 (Sync Engine)
                                            ↓
                                Phase 6 (Extension + Generic Adapter)
                                       ↓           ↓
                              Phase 7 (Chat)   Phase 8 (Voice)
                                       ↓           ↓
                                      ★ MVP GATE ★
                                            ↓
              ┌───────────────┬─────────────┼──────────────┐
        Phase 9 (Video)  Phase 10      Phase 11        Phase 12
                         (Gov/SDK)    (Browsers)      (Scale/Sec)
              └───────────────┴─────────────┼──────────────┘
                                            ↓
                                    Phase 13 (Mobile)
                                            ↓
                                Phase 14 (Public Beta)
```

**Parallel tracks after the realtime backbone (Phase 4):** UI work, database evolution, extension platform, and testing infrastructure can proceed concurrently with feature phases. Security and observability are continuous tracks, not phases — they start in Phase 1 and deepen in Phase 12.

## Milestones

| Milestone | Name              | Phases |
| --------- | ----------------- | ------ |
| M0        | Architecture      | 0      |
| M1        | Foundation        | 1–2    |
| M2        | Rooms             | 3      |
| M3        | Realtime          | 4      |
| M4        | Playback Sync     | 5      |
| M5        | Generic Web Video | 6      |
| M6        | Chat              | 7–8    |
| M7        | Voice             | 8      |
| M8        | Video             | 9–10   |
| M9        | Browser Expansion | 10–11  |
| M10       | Mobile            | 13     |
| M11       | Scale             | 12     |
| M12       | Public Beta       | 14     |

## Definition of Done (every issue)

Implementation + tests + error handling + security consideration + documentation + telemetry where appropriate + code review + acceptance criteria met.

## North-star metrics

Activation (create/join success), time-to-first-playback, sync drift (median/p95), reconnect success rate, room stability, chat/voice/video engagement, retention, adapter count.
