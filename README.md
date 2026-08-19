<div align="center">

  <img src="docs/design/brand/logo.svg" alt="Huddly Logo" width="140" height="140" />

# Huddly

**Watch together. Talk together. Stay on your own screen.**

A realtime layer for being together on the web.<br />
Huddly synchronizes the **playback experience**, not the pixels.

  <br />

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-F2BB31.svg?style=flat-square)](LICENSE)
[![CI](https://github.com/Bhargava-Ram-Thunga/Huddly/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/Bhargava-Ram-Thunga/Huddly/actions/workflows/ci.yml)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict-3178C6.svg?style=flat-square)](tsconfig.base.json)
[![Milestone: M0](https://img.shields.io/badge/Milestone-M0_Architecture-BF7118.svg?style=flat-square)](ROADMAP.md)
[![Turborepo](https://img.shields.io/badge/Monorepo-Turborepo-000000.svg?style=flat-square)](turbo.json)

  <br />

> 🚧 **Early development** — Nothing is installable yet. First alpha targeted for 12 Dec 2026; see the [Release Plan](docs/process/release-plan.md).

  <br />

<a href="#why-huddly"><strong>Why Huddly?</strong></a> •
<a href="#planned-for-mvp"><strong>Planned Features</strong></a> •
<a href="#architecture"><strong>Architecture</strong></a> •
<a href="#development"><strong>Development</strong></a> •
<a href="docs/MVP.md"><strong>MVP Scope</strong></a>

  <br />
  <hr />
</div>

## Overview

Screen sharing forces one person's computer to compress and re-stream heavy video streams over WebRTC — resulting in blurry video, stuttering frame rates, high bandwidth costs, and dead connections.

**Huddly takes a fundamentally different approach:** each person watches native video in their own browser on their own device. Huddly's lightweight server distributes only playback timestamps, revisions, and room events (<15 Kbps per user), ensuring pristine **4K / HDR playback** with **<200 ms synchronization drift**.

```text
┌────────────────┐      WebSocket Playback Commands (<15 Kbps)      ┌────────────────┐
│  Host Browser  │ ───────────────────────────────────────────────► │ Server Machine │
│ (Native 4K/HDR)│                                                  │ (Revision Log) │
└────────────────┘                                                  └────────┬───────┘
        ▲                                                                    │
        │                       NTP Clock Sync & Drift Correction            │
        └────────────────────────────────────────────────────────────────────┴───────► ┌──────────────────────┐
                                                                                       │ Participant Browser  │
                                                                                       │ (Native 4K/HDR Sync) │
                                                                                       └──────────────────────┘
```

---

## Why Huddly?

| Dimension              | Screen Sharing (Discord / Zoom) | Legacy Extensions      | **Huddly**                                      |
| :--------------------- | :------------------------------ | :--------------------- | :---------------------------------------------- |
| **Video Quality**      | Compressed 720p/1080p stream    | Site-dependent         | **Native 4K / HDR at display refresh rate**     |
| **Bandwidth Usage**    | 5–15 Mbps per viewer            | Moderate               | **<15 Kbps (State synchronization only)**       |
| **Playback Precision** | Laggy, choppy audio sync        | Naive hard seeks       | **<200 ms drift with tiered rate-nudging**      |
| **Site Support**       | Fragile capture                 | Whitelisted sites only | **Universal HTML5 video & audio engine**        |
| **Voice & Chat**       | Separate app required           | Text-only              | **Integrated LiveKit low-latency voice + chat** |
| **Privacy & Security** | Streams user screen/desktop     | Broad host permissions | **Zero pixel streaming; server-verified roles** |

---

## Planned for MVP

- 🍿 **Universal HTML5 Engine:** ⬜ Planned — Detects and controls any `<video>` element on the web.
- ⚡ **Server-Authoritative Sync Engine:** ✅ Built — Monotonic room revisions, NTP-style clock offset calculation, and tiered drift correction (<50ms pass → ±5% rate-nudge → hard seek) in `@huddly/sync-engine`.
- 📜 **Realtime Protocol v1:** ✅ Built — Strongly-typed EventEnvelope, Zod payload validators, and error registry in `@huddly/protocol`.
- ⚙️ **Typed Environment & Config:** ✅ Built — Zod runtime configuration schema in `@huddly/config`.
- 🗄️ **Relational Database & ERD:** ✅ Built — PostgreSQL 16 schema with Prisma client factory in `@huddly/database`.
- 🌐 **REST API Service:** 🚧 In progress — Fastify REST service with auth, room creation, and ticket minting in `services/api`.
- ⚡ **Realtime Sync Gateway:** 🚧 In progress — Fastify WebSocket server with Redis Pub/Sub cross-node fanout in `services/realtime`.
- 🎙️ **Low-Latency Voice:** ⬜ Planned — Low-latency voice chat powered by LiveKit SFU with active speaker detection.
- 💬 **Realtime Room Chat:** ⬜ Planned — Low-latency sanitized messaging with moderation tools.
- 🔒 **Zero-Trust Role Enforcement:** 🚧 In progress — Server-enforced permissions; client claims of host status are never trusted.
- 🧩 **Cross-Browser WebExtension:** ⬜ Planned — Multi-browser build targeting Chrome and Firefox via Manifest V3.
- 🎨 **Cinema-Themed Design System:** 🚧 In progress — Tailored color tokens, golden-angle participant colors, and accessible WCAG AA text pairings in `@huddly/ui`.

---

## Architecture

Huddly is architected as a modular monolith in a pnpm monorepo:

```text
huddly/
├── apps/
│   ├── extension/          # (planned) Chrome & Firefox WebExtension (MV3)
│   └── web/                # (planned) React / TypeScript companion web app
├── packages/
│   ├── config/             # Typed environment/config management with Zod
│   ├── database/           # PostgreSQL Prisma schema, client, and migrations
│   ├── protocol/           # Versioned EventEnvelope, Zod schemas, error registry
│   ├── sync-engine/        # Server-authoritative drift measurement & correction
│   └── ui/                 # Shared UI components and cinema design tokens
├── services/
│   ├── api/                # Fastify / Node.js REST API (Auth, Rooms, Invites)
│   └── realtime/           # Fastify WebSocket server + Redis pub/sub gateway
└── docs/                   # Specifications, ADRs, database ERD, and brand kit
```

---

## Development

### Prerequisites

- **Node.js**: >= 22.0.0
- **pnpm**: >= 11.0.0
- **Docker Compose**: For local PostgreSQL and Redis

### Setup & Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/Bhargava-Ram-Thunga/Huddly.git
cd Huddly

# 2. Install dependencies across all packages
pnpm install

# 3. Start local PostgreSQL & Redis
docker compose up -d

# 4. Run tests and typechecks across the monorepo
pnpm test
pnpm typecheck
pnpm lint
```

---

## Quick Start (once released)

### Watch in 3 Steps

1. **Install Extension:** Load the Huddly extension in Chrome or Firefox (or open the web client).
2. **Create Room:** Navigate to any video on the web, click the Huddly icon, and select **Create Room**.
3. **Share Link:** Copy the invite link to your friends. When the host plays, pauses, or seeks, everyone's browser stays in lockstep.

---

## Documentation Hub

| Document                                              | Description                                                                            |
| :---------------------------------------------------- | :------------------------------------------------------------------------------------- |
| **[Architecture Overview](ARCHITECTURE.md)**          | System-wide four-layer model, architecture diagrams, data ownership, and workflows.    |
| **[MVP Scope & DoD](docs/MVP.md)**                    | Frozen MVP feature boundaries, explicit non-goals, and Gherkin acceptance criteria.    |
| **[Realtime Protocol v1](docs/protocol/v1.md)**       | WebSocket envelope, event catalog, authorization matrix, and NTP clock sync formulas.  |
| **[Database Schema v1](docs/database/schema-v1.md)**  | PostgreSQL relational architecture, Mermaid ERD, hot queries, and GDPR erasure path.   |
| **[Brand Kit & Tokens](docs/design/brand/README.md)** | Logo assets, OKLCH popcorn palette, golden-angle participant colors, and WCAG ratings. |
| **[Release Plan](docs/process/release-plan.md)**      | Milestone schedule (M0–M12), release train targets, and the Slip Rule.                 |
| **[Architecture Decisions](docs/adr/)**               | Formal ADR records for all fundamental technical choices.                              |

---

## License

Distributed under the **Apache 2.0 License**. See [`LICENSE`](LICENSE) for more details.
