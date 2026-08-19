# ADR-003: LiveKit for WebRTC Media Plane Infrastructure

- **Status:** Accepted
- **Date:** 2026-08-17
- **Deciders:** Bhargava-Ram-Thunga
- **Issue:** [ARCH-006](https://github.com/Bhargava-Ram-Thunga/Huddly/issues/42)

## Context

Building on the decision to use a Selective Forwarding Unit (SFU) for voice (ADR-002), Huddly requires a production-grade WebRTC media server engine.

The media infrastructure must fulfill key operational requirements:

1. **Clean Architectural Decoupling:** Complete separation between the media plane (audio packet routing) and Huddly's application control plane (Fastify REST API, PostgreSQL database, and WebSocket sync engine).
2. **Zero Native C++ Node Addons:** Avoid embedding C++ WebRTC worker processes (`node-gyp`) directly into the Node.js application process, which complicates container builds, cross-compilation, and memory safety.
3. **Turnkey Client SDKs:** Modern TypeScript and React client SDKs with built-in connection recovery, adaptive bitrate management, and active speaker detection.
4. **Flexible Hosting:** Support for local Docker-based self-hosting during development and seamless migration to cloud or distributed edge clusters in production.

### Options considered

#### 1. mediasoup (Node.js + C++ Core)

- **Architecture:** mediasoup provides a Node.js module that spawns C++ worker subprocesses via Unix sockets.
- **Pros:** Extremely low-level control over WebRTC pipes, routers, and transports; battle-tested performance in Node.js ecosystems.
- **Cons:**
  - **Native Compilation Complexity:** Requires `node-gyp`, Python, and GCC/Clang in container builds, significantly slowing down CI pipelines and complicating deployment.
  - **No Turnkey Signaling or Room Protocol:** mediasoup provides media routing only. Developers must design and build the entire WebSocket signaling layer, room state machine, peer authentication, and reconnection handling from scratch.
  - **Client Maintenance Burden:** Requires building custom WebRTC client wrappers over raw `mediasoup-client`.
- **Outcome:** **Rejected.**

#### 2. Janus WebRTC Gateway (C Daemon)

- **Architecture:** Standalone C server with a plugin architecture (VideoRoom plugin).
- **Pros:** Proven track record in telecom; low memory footprint.
- **Cons:** C codebase with complex configuration syntax; JSON-RPC signaling over WebSocket requires custom client adapters; lacks modern React/TypeScript client integration.
- **Outcome:** **Rejected.**

#### 3. Pion (Go WebRTC Library)

- **Architecture:** Pure Go implementation of WebRTC stack.
- **Pros:** Memory safe; excellent performance; no native C/C++ dependencies.
- **Cons:** A low-level library rather than a turnkey server. Requires building an entire SFU routing engine, signaling server, and client SDKs from scratch.
- **Outcome:** **Rejected.**

#### 4. LiveKit (Go Standalone SFU)

- **Architecture:** Standalone, open-source Go media server built on Pion, exposing declarative gRPC/HTTP server APIs and WebRTC client SDKs.
- **Pros:**
  - **Standalone Process:** Runs as an independent Docker container or cluster; completely isolated from the Node.js monorepo process space.
  - **JWT Token-Based Authentication:** Fastify REST API generates signed HMAC-SHA256 JWT tokens containing room grant claims (`canPublish: true`, `canSubscribe: true`, `roomName`, `identity`). Clients connect directly to LiveKit using these tickets without LiveKit needing direct database access.
  - **Rich Client Ecosystem:** Official, maintained TypeScript and React components (`livekit-client`, `@livekit/components-react`) with automatic active-speaker detection, audio visualization, and network quality indicators.
  - **Observability:** Built-in Prometheus metrics, server-side audio level telemetry, and webhook support for participant join/leave events.
  - **Self-Hostable & Cloud Compatible:** 100% open-source Apache 2.0 server with optional managed LiveKit Cloud compatibility.
- **Cons:** Operates as a separate service requiring its own port allocation (`7880` HTTP/WS signaling, `7881` WebRTC TCP fallback, `50000-60000/udp` RTP media).
- **Outcome:** **Selected.**

---

## Decision

Adopt **LiveKit** as Huddly's official WebRTC media plane infrastructure when voice features are implemented in Phase 8 (`M7`):

1. **Deployment Architecture:**
   - Run LiveKit as an independent service in `docker-compose.yml` (`livekit/livekit-server`).
   - Media traffic connects directly between the client (Browser Extension / Web App) and LiveKit; Fastify never proxies RTP audio packets.
2. **Authentication Flow:**
   - Client requests a voice token from Fastify (`POST /api/v1/rooms/:id/voice-token`).
   - Fastify validates room membership in PostgreSQL, checks room audio permissions, and mints a short-lived signed LiveKit JWT token using `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.
   - Client initializes `Room` from `livekit-client` and connects directly to `LIVEKIT_URL`.
3. **Current State:**
   - Configuration placeholders (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) are defined in `@huddly/config`. No LiveKit dependencies are installed in Phase 0; dependencies (`livekit-client`, `livekit-server-sdk`) will be added in Phase 8.

---

## Consequences

### Positive

- Complete separation of concerns: media server crashes or restarts cannot take down the Fastify API or sync engine.
- Fastify stays lean and stateless with zero C++ compilation dependencies.
- Accelerates Phase 8 voice implementation via official React audio hooks and active-speaker detection components.
- Zero license risk: LiveKit server is licensed under Apache 2.0.

### Negative / Trade-offs

- Introduces a third infrastructure component in production deployment alongside PostgreSQL and Redis.
- Requires configuring UDP port ranges on host firewalls for WebRTC media transport.

---

## Revisit When

- Huddly scale requires globally distributed multi-region edge mesh routing that exceeds single-cluster LiveKit performance.
