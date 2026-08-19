# Threat Model v1 (ARCH-005)

This threat model identifies attack surfaces, vulnerabilities, and mitigations for Huddly using the **STRIDE** methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege).

---

## 1. Operating Context & Threat Perspective

Huddly is operated as a personal, self-hosted platform shared with friends and small invited groups. This modifies typical consumer web application threat likelihoods:

- **Attacker Profile 1 (Invited Guests & Accidental Abuse)**: High trust baseline. Risks center around unintended playback spam, accidental invite link leaks, or excessive connection volumes.
- **Attacker Profile 2 (Malicious Third-Party Websites)**: Zero trust. Websites visited while the extension is active may attempt to exploit content script bridges or postMessage channels.
- **Attacker Profile 3 (Internet Network Attackers)**: Opportunistic scanning, replay attacks, or dictionary attacks against public server ports.

---

## 2. STRIDE Analysis by Attack Surface

| Surface & STRIDE Category                                | Threat Description                                                                                    | Impact | Personal Likelihood | Concrete Mitigation                                                                                                                                        | Spec / Protocol Trace                                              | Owner Phase           |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------- |
| **1. WebSocket Events**<br>(Tampering / Replay)          | Attacker captures or forges a `PLAYBACK_PLAY` or `SEEK` event to desync room.                         | High   | Low                 | Monotonic server revision assignment (`revision: bigint`) + 60-second single-use connection tickets tied to user UUID. Reject events with stale revisions. | `docs/protocol/v1.md` §3 (Envelope Revision & Authoritative State) | Phase 4 (Sync Engine) |
| **2. Room Links**<br>(Info Disclosure / Enumeration)     | Attacker guesses 8-character invite codes to eavesdrop on private room chat/voice.                    | High   | Low                 | 8-character Base62 CSPRNG generation (~47.6 bits entropy) + optional host room lock + 10 req/s rate limiting on `/join`.                                   | `docs/protocol/v1.md` §2 (Invite Entropy & Rate Limits)            | Phase 3 (Rooms)       |
| **3. Privilege Escalation**<br>(Elevation of Privilege)  | Regular participant sends host-only commands (`LOCK_ROOM`, `KICK_USER`, `UPDATE_SETTINGS`).           | High   | Low                 | Server-side role validation in gateway and REST handlers. All mutative routes check `member.role === 'HOST'`.                                              | `packages/protocol/src/schemas.ts` (Role-based Guards)             | Phase 3 (Rooms)       |
| **4. Chat XSS**<br>(Tampering / Information Disclosure)  | Malicious script payload injected via chat text (`<script>...`).                                      | High   | Medium              | Strict plain-text message escaping in React UI + DOMPurify sanitization. Disallow raw HTML rendering in client.                                            | `docs/protocol/v1.md` §5 (Chat Schema & Sanitization)              | Phase 7 (Chat)        |
| **5. Malicious Link Metadata**<br>(Tampering / SSRF)     | User posts link to internal IP (`127.0.0.1`, `169.254.169.254`) causing server SSRF on preview fetch. | Medium | Low                 | Block internal IP ranges (RFC 1918, link-local, loopback) in server-side metadata scrapers with strict 2-second timeout.                                   | `docs/SECURITY.md` (SSRF Mitigation)                               | Phase 7 (Chat)        |
| **6. Malicious Host Site Attacks**<br>(Tampering)        | Third-party streaming site attempts to inject messages into extension content script.                 | High   | Medium              | Isolate extension content scripts using `isolatedWorld`. Validate sender origin via `chrome.runtime.id` checks on message passing.                         | `docs/adr/ADR-010-extension-architecture.md`                       | Phase 6 (Extension)   |
| **7. Compromised Extension**<br>(Information Disclosure) | Malicious extension on client tries to steal user JWT tokens from storage.                            | High   | Low                 | Store JWT in memory only (short-lived 15 min); refresh tokens stored hashed in server database with single-use rotation.                                   | `docs/SECURITY.md` (Token Security)                                | Phase 2 (Auth)        |
| **8. Abusive Media Flooding**<br>(Denial of Service)     | Invited friend repeatedly spams rapid seek/pause commands (e.g. 50 calls/sec).                        | Medium | Medium              | Token-bucket rate limiting on WebSocket gateway (25 events/sec per connection; burst cap 50). Drop excess frames.                                          | `docs/protocol/v1.md` §2 (Rate Limits)                             | Phase 4 (Realtime)    |

---

## 3. Defense-in-Depth Summary

1. **Identity & Ephemeral Boundaries**:
   - Short-lived JSON Web Tokens (15 minutes).
   - Single-use 256-bit cryptographically secure Refresh Token Rotation (RTR).
   - 60-second single-use connection tickets for WebSocket authentication.
2. **Server Authority**:
   - The server is the single source of truth for clock time, room membership, and playback position. Clients propose actions; the server validates and broadcasts state transitions with monotonic revision numbers.
3. **Data Minimization**:
   - No decrypted audiovisual streams or frame data are ever captured, transmitted, or logged.
