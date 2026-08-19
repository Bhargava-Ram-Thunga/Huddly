# ADR-006: Fastify WebSocket Control Plane and Connection Gating

- **Status:** Accepted
- **Date:** 2026-08-17
- **Deciders:** Bhargava-Ram-Thunga
- **Issue:** [ARCH-007](https://github.com/Bhargava-Ram-Thunga/Huddly/issues/43)

## Context

Huddly requires a high-performance, low-overhead realtime bidirectional control plane to synchronize playback commands (play, pause, seek, rate change), exchange NTP clock timestamps, broadcast presence, and deliver room chat (spec §24, §36, MVP §1).

The realtime gateway must satisfy strict architectural requirements:

1. **RFC 6455 Standard WebSocket Framing:** Use standard WebSocket protocol frames without custom client transport libraries, minimizing WebExtension content script and web client bundle footprint.
2. **Zero-Trust Connection Authentication:** Unauthenticated or unauthorized clients must never establish long-lived WebSocket connections or consume gateway memory.
3. **Seamless Fastify Integration:** Share server routing, request logging, error handling, and configuration management between REST API and realtime services.
4. **Resilient Multi-Node Scale:** Support horizontal scaling across multiple gateway processes via Redis Pub/Sub backplane (ADR-005).

### Options considered

#### 1. Socket.io

- **Mechanism:** Dual-layer transport utilizing HTTP long-polling with upgrade to WebSocket, wrapping messages in custom Engine.io packet frames.
- **Pros:** Built-in automatic reconnect, rooms, and HTTP fallback for ancient proxy networks.
- **Cons:**
  - **Proprietary Framing:** Requires bundling `@socket.io/client` (~45 KB) in the browser extension and web app.
  - **Connection Handshake Overhead:** Multi-step HTTP polling negotiation introduces latency on initial room connection.
  - **Fastify Friction:** Operates outside standard Fastify request pipelines.
- **Outcome:** **Rejected.**

#### 2. uWebSockets.js

- **Mechanism:** High-performance C++ WebSocket server with Node.js bindings.
- **Pros:** Raw throughput and low memory footprint (~5 KB per idle socket).
- **Cons:**
  - **Native C++ Compilation:** Heavy C++ addon complicates CI/CD Docker builds and cross-architecture compilation.
  - **Non-Standard API:** Lacks integration with Fastify's plugin architecture, route decorators, and lifecycle hooks.
- **Outcome:** **Rejected.**

#### 3. Fastify with `@fastify/websocket` (backed by `ws`)

- **Mechanism:** Fastify's official WebSocket plugin built on the standard, battle-tested `ws` library.
- **Pros:**
  - **Standard WebSocket Standard:** Uses standard RFC 6455 framing, allowing clients to connect using browser-native `new WebSocket(url)` with zero client bundle overhead.
  - **Unified Plugin Lifecycle:** Shares Fastify server hooks, route schemas, error handlers, and logger infrastructure.
  - **Predictable Memory Footprint:** ~15 KB per active socket connection.
  - **Atomic Handshake Gating:** Easily integrates with pre-upgrade ticket validation in request pre-handlers.
- **Outcome:** **Selected.**

---

## Decision

Adopt **Fastify with `@fastify/websocket`** (`services/realtime`) as Huddly's realtime synchronization control plane, secured via **pre-upgrade single-use tickets**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Pre-Upgrade Ticket Handshake Flow                    │
│                                                                        │
│   Client                   Fastify REST API           Redis State      │
│     │                             │                  (REDIS_STATE_URL) │
│     │  1. POST /realtime/ticket   │                         │          │
│     ├────────────────────────────►│                         │          │
│     │  (Auth Bearer + Room ID)    │  2. SETEX ticket:uuid   │          │
│     │                             ├────────────────────────►│          │
│     │                             │     (TTL: 60s)          │          │
│     │  3. Return ticket + wsUrl   │                         │          │
│     │◄────────────────────────────┤                         │          │
│     │                             │                         │          │
│     │                                                       │          │
│   Client                   Fastify Realtime Gateway                 │
│     │                             │                                    │
│     │  4. WS Connect ?ticket=uuid │                                    │
│     ├────────────────────────────►│  5. GETDEL ticket:uuid             │
│     │                             ├────────────────────────►│          │
│     │                             │  (Atomic single-use)    │          │
│     │  6. Valid: Snapshot sent    │◄────────────────────────┤          │
│     │◄────────────────────────────┤                                    │
│     │     Invalid: Close 4401     │                                    │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. Two-Step Ticket-Gated Authentication Flow

1. **Ticket Minting (`services/api/src/routes/tickets.ts`):**
   - Authenticated client calls `POST /api/v1/realtime/ticket` with `{ roomId }`.
   - Fastify validates JWT authentication, verifies active room membership in PostgreSQL (`prisma.roomMember`), and mints a cryptographically random UUID ticket.
   - Ticket metadata (`userId`, `displayName`, `roomId`, `memberId`, `role`) is stored in `REDIS_STATE_URL` with a **60-second TTL** (`redisState.setex(\`ticket:${ticket}\`, 60, ...)`).
2. **Atomic Verification & Upgrade (`services/realtime/src/gateway.ts`):**
   - Client connects via native WebSocket to `/ws?ticket=<ticket_uuid>`.
   - The gateway executes an atomic **`GETDEL ticket:<ticket>`** command against `REDIS_STATE_URL`.
   - **Rejection:** If the ticket is missing, expired, or previously consumed, the socket is immediately closed with WebSocket status code **`4401`** (`Unauthorized: Missing or invalid connection ticket`).
   - **Admission:** If valid, the gateway registers the socket in the room connection set and subscribes to `room:<roomId>` on `REDIS_PUBSUB_URL`.

### 2. Initial Snapshot & Envelope Framing

- Immediately upon successful connection admission, the gateway transmits the authoritative `ROOM_STATE_SNAPSHOT` envelope containing the current room revision, member roster, and active `PlaybackState`.
- All subsequent client-to-server messages are parsed against `@huddly/protocol` versioned Zod schemas before processing.

---

## Consequences

### Positive

- Standard browser `WebSocket` support means zero client-side library dependencies in the WebExtension or web companion app.
- Single-use, 60-second tickets eliminate long-lived JWT leakage over query parameters and prevent replay attacks.
- Atomic `GETDEL` ensures tickets cannot be used across multiple simultaneous connections.
- Native Fastify plugin integration maintains architectural consistency across API and Realtime microservices.

### Negative / Trade-offs

- Client must execute a REST roundtrip (`POST /realtime/ticket`) before establishing a WebSocket connection. Because tickets last 60 seconds, this adds negligible ($<50\text{ ms}$) overhead only on initial room entry or deliberate reconnection.

---

## Revisit When

- Concurrent connection density on a single node exceeds 100,000 active sockets, requiring low-level kernel event loop optimizations.
