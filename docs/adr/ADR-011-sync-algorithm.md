# ADR-011: Playback synchronization algorithm and clock filtering

- **Status:** Accepted
- **Date:** 2026-08-16
- **Deciders:** Bhargava-Ram-Thunga
- **Issue:** [ARCH-009](https://github.com/Bhargava-Ram-Thunga/Huddly/issues/45)

## Context

In a distributed watch-party platform, client hardware clocks differ by seconds or minutes and cannot be trusted directly (spec §20). Furthermore, variable network transit delays and asymmetric queueing cause naive timestamp comparisons to produce erratic drift measurements.

To keep participants in lockstep ($< 200\text{ ms}$ target, spec §21, MVP §1), the synchronization engine (`packages/sync-engine`) requires:

1. A clock synchronization protocol to establish server-aligned time on client devices.
2. A jitter-filtering model to eliminate asymmetric queueing delays.
3. A continuous projection formula for expected playback position at variable playback rates ($0.25\times\dots4.0\times$).
4. A tiered drift correction model balancing imperceptible audio rate adjustments with rapid seek convergence.
5. A deterministic buffer cascade and authority resolution policy.

### Options considered

#### 1. Clock synchronization: Single ping vs. full NTP vs. NTP-Lite burst filtering

- **Option A (Single RTT measurement):** Take a single ping/pong round trip and set offset.
  - _Rejected:_ Highly vulnerable to transient Wi-Fi spikes and network queueing bursts.
- **Option B (Full NTP / PTP daemon):** Run complex clock drift statistical estimators with drift rate modeling.
  - _Rejected:_ Excessive computational complexity for browser tabs where clock frequency changes dynamically under CPU power management.
- **Option C (NTP-Lite with burst and best-sample window filtering):** Exchange 4-timestamp probe packets $(t_0, t_1, t_2, t_3)$, compute midpoint offset, burst on join, and filter over an 8-sample rolling window selecting the minimum RTT.
  - _Selected:_ Mathematically sound, resilient to asymmetric queueing, lightweight ($< 1\text{ KB}$ network overhead), and proven in gaming and audio networking.

#### 2. Drift correction: Continuous rate nudging vs. hard seek only vs. 4-tier hybrid ladder

- **Option A (Continuous Rate Nudging Only):** Never seek; always adjust speed by $\pm 5\%$.
  - _Rejected:_ A 900 ms drift would take ~18 seconds to converge, leaving users audibly out of sync for unacceptably long intervals.
- **Option B (Hard Seek Only):** Always seek when drift exceeds 100 ms.
  - _Rejected:_ Frequent hard seeks cause continuous audio crackling, video buffer flushes, and choppy playback.
- **Option C (4-Tier Decision Ladder):** Ignore imperceptible drift ($< 50\text{ ms}$), smoothly nudge rate for micro drift ($50\text{–}200\text{ ms}$), soft-seek for moderate drift ($200\text{–}500\text{ ms}$), and hard-seek for large jumps ($\ge 500\text{ ms}$).
  - _Selected:_ Yields pristine audio fidelity under normal network conditions while converging instantly when large drift occurs.

---

## Decision

### 1. NTP-Lite Clock Synchronization Model

Clients estimate clock offset ($\theta$) and Round-Trip Time ($\text{RTT}$) using four timestamps:

```text
Client (Local Clock)                   Server (Authoritative Clock)
   │                                               │
   ├── t0: Probe sent                              │
   │   │                                           │
   │   └──────────────────────────────────────────►│ t1: Probe received
   │                                               │ │
   │                                               │ └── t2: Response sent
   │   ┌───────────────────────────────────────────┤
   │   ▼                                           │
   └── t3: Response received                       │
```

$$\text{RTT} = (t_3 - t_0) - (t_2 - t_1)$$

$$\text{Clock Offset } (\theta) = \frac{(t_1 - t_0) + (t_2 - t_3)}{2}$$

$$\text{Server Authoritative Time: } T_{\text{server}}(t_{\text{local}}) = t_{\text{local}} + \theta$$

#### Sampling & Jitter Filtering Schedule:

- **Join Burst:** When joining a room or reconnecting, the client bursts 6 probe packets spaced 200 ms apart. The estimate with the **minimum RTT** is selected ($\min(\text{RTT})$ minimizes queueing delay error).
- **Steady-State Heartbeat:** During active playback, a single probe is sent every 15 seconds into an 8-sample ring buffer.
- **Median Filter:** When RTT variance exceeds $15\text{ ms}$, the engine computes the median offset of the three lowest-RTT samples.

### 2. Continuous Expected Position Projection

Given a room playback snapshot with base position $P_0$ (seconds), server timestamp $T_0$ (epoch ms), room playback rate $R_0$, and playback state $\text{playing} \in \{\text{true}, \text{false}\}$:

$$P_{\text{expected}}(t_{\text{local}}) = \begin{cases} P_0 + \left(\frac{(t_{\text{local}} + \theta) - T_0}{1000}\right) \times R_0, & \text{if } \text{playing} = \text{true} \\ P_0, & \text{if } \text{playing} = \text{false} \end{cases}$$

$$\text{Drift: } \Delta(t) = (P_{\text{local}}(t) - P_{\text{expected}}(t)) \times 1000 \quad (\text{ms})$$

### 3. 4-Tier Drift Decision Ladder (`DEFAULT_THRESHOLDS`)

```text
                           ┌────────────────────────────────────────────────────────┐
                           │                 Drift Magnitude (|Δ|)                  │
                           └───────────────────────────┬────────────────────────────┘
                                                       │
                  ┌────────────────────────────────────┼────────────────────────────────────┐
                  │ < 50ms                             │ 50ms - 200ms                       │ 200ms - 500ms      │ ≥ 500ms
                  ▼                                    ▼                                    ▼                    ▼
         ┌──────────────────┐                ┌──────────────────┐                ┌──────────────────┐ ┌──────────────────┐
         │      none        │                │    nudge-rate    │                │    soft-seek     │ │    hard-seek     │
         ├──────────────────┤                ├──────────────────┤                ├──────────────────┤ ├──────────────────┤
         │ In-sync buffer.  │                │ Adjust rate ±5%  │                │ Gentle seek to   │ │ Immediate flush  │
         │ Zero correction. │                │ clamped [0.25,4].│                │ expectedPosition │ │ & seek to        │
         │ Pristine audio.  │                │ Glides in ~1-2s. │                │ for quick catchup│ │ expectedPosition │
         └──────────────────┘                └──────────────────┘                └──────────────────┘ └──────────────────┘
```

- **Rate Dilation Physics:** At $R_0 = 1.0$, a $5\%$ dilation recovers drift at $v_{\text{rel}} = 50\text{ ms/second}$. A $150\text{ ms}$ drift reaches the $50\text{ ms}$ tolerance threshold in $2.0\text{ seconds}$ with zero audible pitch shift.
- **Rate Bounds:** `correctedRate` is strictly clamped to `[0.25, 4.0]` matching `PlaybackRatePayloadSchema`.

### 4. Buffer Cascade & Network Stall Policy

1. **Participant Stalls (Optimistic Progression):** When a non-host participant buffers (`waiting` event):
   - The participant's presence state updates to `BUFFERING`.
   - The room continues playback uninterrupted for all other participants (preventing a single slow connection from degrading the group).
   - Upon buffer recovery, the participant executes a soft or hard seek to realign with the live room timeline.
2. **Host Stalls (The Host Exception):** If the **Host** buffers continuously for $> 1.5\text{ seconds}$:
   - Host client transmits `PLAYBACK_PAUSE` with reason `BUFFER_STALL`.
   - Server transitions room playback state to `BUFFER_PAUSED`.
   - When the Host reaches `canplaythrough`, playback automatically resumes for all participants.

### 5. Monotonic Sequence Numbering & Authority Resolution

- All playback mutations are validated against the server-assigned monotonic `revision: number`.
- Client `decideCorrection()` only applies authoritative snapshots when `snapshot.revision >= localState.revision`.
- Conflicting participant commands are rejected by the server (`ERR_FORBIDDEN_MUTATION`).

---

## Consequences

### Positive

- **Sub-50ms Precision:** NTP-Lite clock filtering and presentation-timestamp math achieve reliable sub-50ms sync on typical residential broadband.
- **Audio Integrity:** Rate-nudging under 200 ms prevents audible audio artifacts (clicks, pitch shifts, stutters).
- **Resilience Against Lag:** Optimistic room progression prevents slow participants from interrupting the room.
- **Pure Math Independence:** `@huddly/sync-engine` is 100% pure TypeScript without DOM or WebSocket dependencies, making it exhaustively unit-testable.

### Negative / Accepted Trade-offs

- **Catch-up Jump for Slow Networks:** Participants on severely degraded connections will experience periodic seeks rather than pausing the entire room.

### Follow-through Required

- Implement NTP-Lite burst probe in `@huddly/sync-engine` client integration.
- Verify 4-tier thresholds in automated Playwright E2E sync simulation test suite.

---

## Revisit when

- Machine learning / Kalman filter clock estimators are considered for high-jitter mobile networks (Phase 13 / M10).
