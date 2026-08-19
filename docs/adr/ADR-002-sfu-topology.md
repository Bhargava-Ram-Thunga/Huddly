# ADR-002: Selective Forwarding Unit (SFU) vs. Mesh vs. MCU Topology

- **Status:** Accepted
- **Date:** 2026-08-17
- **Deciders:** Bhargava-Ram-Thunga
- **Issue:** [ARCH-006](https://github.com/Bhargava-Ram-Thunga/Huddly/issues/42)

## Context

Building on the decision to use WebRTC for voice streaming (ADR-001), Huddly must select a multi-party WebRTC topology for watch-party rooms accommodating between 2 and 50+ simultaneous participants (spec §1, MVP §1, Phase 8).

Multi-party WebRTC architectures fall into three topological models:

1. **Full Mesh (Peer-to-Peer):** Every participant connects directly to every other participant.
2. **MCU (Multipoint Control Unit):** A central media server decodes, mixes, and re-encodes audio into a single composite stream sent back to each participant.
3. **SFU (Selective Forwarding Unit):** A central media server receives a single audio stream from each participant and selectively forwards encrypted packets to other room participants without decoding or mixing.

The topology must support individual participant volume adjustments, client-side spatial audio positioning, low server operational costs, and scalability up to large watch rooms without saturating participant uplink bandwidth.

### Options considered

#### 1. Full Mesh (P2P) Topology

- **Mechanism:** Each participant creates $N - 1$ separate peer connections. For an $N$-person room, there are $N(N - 1) / 2$ total connections across the swarm.
- **Bandwidth:**
  - Upstream per client: $(N - 1) \times 32\text{ kbps}$. For a 10-person room, each user must upload $288\text{ kbps}$ of duplicate audio data.
  - Downstream per client: $(N - 1) \times 32\text{ kbps}$.
- **Pros:** Zero media server hosting cost; end-to-end encryption by default; lowest theoretical latency for 2-person calls ($30-60\text{ ms}$).
- **Cons:**
  - **Uplink Bottleneck:** Fails rapidly when room size exceeds 4–5 participants due to residential asymmetric uplink constraints.
  - **Connection Mesh Complexity:** High CPU load on participant devices handling $N - 1$ WebRTC peer connections, renegotiations, and ICE handshakes.
  - **NAT Traversal Fragility:** High failure rate when multiple participants reside behind restrictive corporate or symmetric NATs.
- **Outcome:** **Rejected.**

#### 2. Multipoint Control Unit (MCU) Topology

- **Mechanism:** All participants upload a single audio stream to a central server. The server decodes all incoming Opus streams, mixes them into a single custom audio stream per participant (subtracting the recipient's own voice), re-encodes to Opus, and transmits 1 downlink stream back to each participant.
- **Bandwidth:** Upstream: $O(1)$ ($32\text{ kbps}$); Downstream: $O(1)$ ($32\text{ kbps}$).
- **Pros:** Minimal client downstream bandwidth regardless of room size.
- **Cons:**
  - **Prohibitive Server CPU Overhead:** Audio decoding and re-encoding across multiple rooms requires heavy server CPU compute ($5-10\text{x}$ cost of an SFU).
  - **Loss of Client Audio Control:** Because audio is mixed server-side, individual participant volume sliders, selective muting, and spatial audio positioning become impossible on the client.
  - **Added Processing Latency:** Mixing buffers introduce $50-150\text{ ms}$ of additional glass-to-glass delay.
- **Outcome:** **Rejected.**

#### 3. Selective Forwarding Unit (SFU) Topology

- **Mechanism:** Each participant uploads exactly one audio stream ($O(1)$ uplink) to a central SFU server. The SFU inspects RTP packet headers and selectively routes/relays packets to other participants in the room without decoding or re-encoding the Opus payload.
- **Bandwidth:** Upstream: $O(1)$ ($24-32\text{ kbps}$); Downstream: $O(N - 1)$ ($24-32\text{ kbps} \times \text{active speakers}$).
- **Pros:**
  - **Uplink Efficiency:** Constant $O(1)$ upload bandwidth regardless of room size.
  - **Minimal Server CPU Overhead:** Packet forwarding without audio transcoding allows a single modest server instance to serve thousands of concurrent audio channels.
  - **Independent Client Tracks:** Each participant receives separate audio tracks, enabling per-user volume controls, local muting, active speaker detection, and spatial audio positioning.
  - **Dynamic Subscriptions:** The SFU automatically pauses forwarding silent tracks using Opus DTX (Discontinuous Transmission), keeping downstream bandwidth minimal during typical conversation.
- **Cons:** Requires running/hosting a scalable SFU server infrastructure (resolved in ADR-003).
- **Outcome:** **Selected.**

---

## Decision

Adopt the **Selective Forwarding Unit (SFU)** topology as Huddly's multi-party voice architecture for Phase 8 (`M7`):

1. **Uplink Standard:** Each client transmits a single Opus audio track over a single `RTCPeerConnection` to the SFU ($24-32\text{ kbps}$).
2. **Downlink Standard:** Each client subscribes to individual remote participant tracks from the SFU.
3. **Bandwidth Optimization:**
   - Enable Opus DTX (Discontinuous Transmission) and Voice Activity Detection (VAD). When a participant is silent, zero packets are transmitted.
   - Limit active downstream audio track subscriptions to the top 5 loudest active speakers in rooms exceeding 20 participants.

---

## Consequences

### Positive

- Scales gracefully from 2-person private watch parties up to 50+ participant community screening rooms.
- Keeps client upstream bandwidth capped at $<32\text{ kbps}$, preserving residential network capacity for 4K video playback.
- Empowers users with individual volume adjustments for each room member in the Huddly HUD.
- Server CPU overhead remains negligible because media packets are forwarded without transcoding.

### Negative / Trade-offs

- Downstream bandwidth scales linearly with the number of concurrent active speakers ($O(K)$ where $K$ is active speakers). In practice, human conversation rarely exceeds 2–3 simultaneous speakers.
- Requires dedicated SFU media routing infrastructure (selected in ADR-003).

---

## Revisit When

- Decentralized P2P relay protocols (e.g. WHIP/WHEP or WebTransport P2P relays) mature and provide reliable $O(1)$ uplink capabilities without central servers.
