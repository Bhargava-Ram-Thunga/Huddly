# Performance Targets and Observability Specification (ARCH-013)

This document establishes the measurable performance targets, telemetry instrumentation points, and observability standards for Huddly.

---

## 1. Performance Target Mapping Matrix

| Domain & Feature         | Spec Performance Target                | Concrete Metric                        | Measurement / Collection Point                                                 | Alerting / Degradation Threshold                                        |
| ------------------------ | -------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **Playback Sync**        | Playback drift < 150ms steady-state    | `huddly_sync_drift_ms` (p50, p95, p99) | Client sync loop in `@huddly/sync-engine` reported via periodic heartbeat ping | Drift > 500ms triggers nudge rate adjustment; > 1.0s triggers hard seek |
| **State Propagation**    | End-to-end command broadcast < 50ms    | `huddly_ws_event_delivery_latency_ms`  | WebSocket Gateway (`@huddly/realtime`) emit timestamp to client ack            | Gateway latency > 150ms flags network congestion                        |
| **Chat Message Latency** | Realtime message delivery < 200ms      | `huddly_chat_delivery_latency_ms`      | API gateway ingestion to broadcast fan-out in `@huddly/realtime`               | Ingestion lag > 500ms                                                   |
| **Room Join Speed**      | Room resolution and connection < 1.0s  | `huddly_room_join_duration_ms`         | Client click on `/join/:code` to WebSocket `ROOM_JOINED` ack                   | Join time > 2.5s                                                        |
| **Token Authentication** | JWT verification & ticket grant < 15ms | `huddly_auth_ticket_duration_ms`       | `POST /api/v1/realtime/ticket` handler execution time in `@huddly/api`         | API handler > 50ms                                                      |
| **Voice SFU Latency**    | Mouth-to-ear audio latency < 120ms     | `huddly_webrtc_rtt_ms` & `jitter_ms`   | LiveKit SFU client stats WebRTC getStats API                                   | RTT > 250ms triggers audio quality downgrade indicator                  |
| **Database Query SLA**   | Active room query < 10ms (p95)         | `huddly_db_query_duration_ms`          | Prisma query middleware in `@huddly/database`                                  | Query duration > 50ms                                                   |
| **Memory Footprint**     | Gateway server memory < 256MB idle     | `process_resident_memory_bytes`        | Node.js process metrics reported to Prometheus                                 | Memory leak warning at > 75% container limit                            |

---

## 2. Minimum Observability Architecture (MVP)

For personal and single-operator hosting, the observability pipeline is kept lightweight and operational without requiring heavy external SaaS subscriptions:

```text
[ @huddly/api & @huddly/realtime ]
         │ (Pino JSON logs)
         ├──────────────────────────────> Stdout / Docker Logs
         │ (OpenTelemetry / Prometheus)
         └──────────────────────────────> /metrics Endpoint (Prometheus scraper) -> Grafana Dashboard
```

### 2.1 Structured Logging Standards (Pino)

- All backend services (`@huddly/api`, `@huddly/realtime`) format logs as JSON containing structured context:

  ```json
  {
    "level": "info",
    "time": 1787050000000,
    "pid": 4120,
    "hostname": "huddly-server-01",
    "reqId": "req-9c858901",
    "roomId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "userId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "msg": "Client completed sync correction: seek to 23.4s"
  }
  ```

### 2.2 Telemetry Instrumentation Endpoints

- **`GET /health`**: Returns HTTP 200 with service readiness (`{ status: "ok", uptime: 3600 }`).
- **`GET /metrics`**: Prometheus-compatible metrics endpoint exposing counters, histograms, and memory gauges.

---

## 3. Data Minimization & "Do Not Collect" Policy

To preserve privacy for personal watch parties and minimize server storage overhead, the logging pipeline strictly enforces the following boundaries:

1. **Do NOT Log Chat Message Contents**:
   - Chat payloads are transmitted over WebSockets for display, but message strings are never printed into server logs. Only metadata (`roomId`, `userId`, `messageId`, `characterCount`) is recorded.
2. **Do NOT Store Raw IP Addresses Long-Term**:
   - IP addresses in HTTP/WebSocket headers are retained in memory for rate limiting and short-lived connection debugging, but are not stored in persistent database tables.
3. **Do NOT Capture Video Media or Stream URLs**:
   - Private media URLs (e.g. personal local streaming links) are kept in memory during the room session and pruned when the room closes.
4. **Do NOT Log Authentication Secrets**:
   - Passwords, raw JWTs, refresh tokens, and connection ticket secrets are redacted before log output (`[REDACTED]`).
