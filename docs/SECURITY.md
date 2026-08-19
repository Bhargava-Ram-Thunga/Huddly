# Huddly Security Architecture & Threat Model

> **Last Updated:** 17 August 2026  
> **Status:** M1 Foundation Specification

---

## 1. Authentication & Credential Storage

### Argon2id Password Hashing

- **Algorithm:** Argon2id (v13)
- **Parameters:** Memory Cost: 64 MiB (`65536 KiB`), Time Cost: 3 iterations, Parallelism: 4 threads.
- **Payload Limits:** Minimum 8 characters, maximum 128 characters to prevent long-string CPU exhaustion (DoS).
- **Sanitization Invariant:** `passwordHash` is never selected or serialized in API responses.

### User Enumeration & Timing-Attack Mitigation

- When `POST /api/v1/auth/login` receives a non-existent email or guest account, it invokes `dummyVerify()`, verifying against a static Argon2id hash.
- Authentication responses maintain uniform response times (~50ms) regardless of whether an account exists.

### Email Normalization

- All incoming emails are canonicalized via `email.trim().toLowerCase()` prior to database query or persistence, preventing case-variance account duplicates.

---

## 2. Session & Token Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                       Token Lifecycles                      │
├─────────────────────────────────────────────────────────────┤
│ Access Token:  Short-lived JWT (15 minutes)                 │
│                Claims: sub, email, displayName, isGuest     │
├─────────────────────────────────────────────────────────────┤
│ Refresh Token: High-entropy 256-bit random hex string       │
│                Stored as SHA-256 hash in user_devices       │
├─────────────────────────────────────────────────────────────┤
│ WS Ticket:     Single-use UUID, 60s TTL in Redis (DB 1)     │
│                Consumed atomically via GETDEL on WS connect │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Realtime & Network Threat Mitigations

| Threat Vector                      | Mitigation Strategy                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **WebSocket Connection Hijacking** | Single-use tickets minted via authenticated REST endpoint, stored in Redis with 60s TTL, consumed atomically with `GETDEL`.        |
| **Gateway Message Flooding**       | Per-connection rolling rate limiter enforcing a maximum of 25 messages per 1,000ms window with instant `RATE_LIMITED` termination. |
| **Unauthorized Playback Control**  | Host-only authorization gate on all `PLAYBACK_*` mutation events.                                                                  |
| **Cross-Site Scripting (XSS)**     | Text content sanitization and plain text rendering in chat interfaces.                                                             |
| **Session Fixation**               | Unique session device and refresh token hash generated per authentication event.                                                   |

---

## 4. Reporting Security Vulnerabilities

Please report potential security vulnerabilities privately via GitHub Security Advisories or by contacting the repository maintainers directly.
