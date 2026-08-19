# ADR-001: WebRTC for Realtime Voice & Audio Streaming

- **Status:** Accepted
- **Date:** 2026-08-17
- **Deciders:** Bhargava-Ram-Thunga
- **Issue:** [ARCH-006](https://github.com/Bhargava-Ram-Thunga/Huddly/issues/42)

## Context

Huddly provides synchronized watch rooms where participants watch video streams while conversing in realtime (spec §1, MVP §1, Phase 8). During synchronized movie playback, auditory conversational cues (laughter, spontaneous reactions, spoken interruptions) require conversational latency ($<150\text{ ms}$ glass-to-glass). If voice transmission latency exceeds $250\text{ ms}$, participants experience conversational collisions, speech overlap, and desynchronization between vocal commentary and video action.

Audio transmission must operate across varied network topologies (NATs, firewalls, mobile connections), maintain strict bandwidth efficiency ($<32\text{ kbps}$ per audio uplink) so it does not compete with host video streaming, and provide client-side acoustic echo cancellation (AEC) and noise suppression (NS) to prevent movie audio from feeding back into participant microphones.

### Options considered

#### 1. HTTP Live Streaming / MediaSource Extensions (MSE) Chunked Audio

- **Mechanism:** Audio captured from the microphone is chunked into small audio segments (e.g. fMP4 or WebM via MediaRecorder) and transferred over HTTP/2 or HTTP/3 chunked transfer.
- **Latency:** $1.5\text{ s} - 4.0\text{ s}$ glass-to-glass due to segment buffering, HTTP request handshakes, and decoder buffer watermarks.
- **Pros:** Trivial firewall traversal; leverages standard stateless HTTP caching infrastructure.
- **Cons:** Completely unusable for bidirectional conversation. Latency causes massive delay between spoken reaction and heard sound.
- **Outcome:** **Rejected.**

#### 2. WebSocket Binary Framing with Opus over TCP

- **Mechanism:** Capture PCM audio in an `AudioWorklet`, encode to Opus via WebAssembly or WebCodecs, and transmit binary frames over the existing `@huddly/realtime` WebSocket connection.
- **Latency:** $200\text{ ms} - 500\text{ ms}$ on optimal networks; degrades to $>1.5\text{ s}$ under packet loss.
- **Pros:** Reuses existing WebSocket connection infrastructure without additional ICE/STUN/TURN signaling; simple client implementation.
- **Cons:**
  - **TCP Head-of-Line Blocking:** A single dropped TCP packet stalls all subsequent audio and sync frames until retransmission succeeds, causing noticeable audio glitches and compounding delay.
  - **Lack of Native Processing:** Requires manual implementation of jitter buffers, dynamic packet loss concealment (PLC), acoustic echo cancellation, and automatic gain control.
- **Outcome:** **Rejected.**

#### 3. Native WebRTC (RTP/SRTP over UDP) with Opus Codec

- **Mechanism:** Establish peer/server RTP media sessions over UDP using browser-native WebRTC APIs (`RTCPeerConnection`, `getUserMedia`).
- **Latency:** $\mathbf{40\text{ ms} - 120\text{ ms}}$ glass-to-glass.
- **Pros:**
  - **Native Browser Audio DSP:** Automatic Acoustic Echo Cancellation (AEC), Noise Suppression (NS), and Automatic Gain Control (AGC) integrated into browser hardware audio pipelines.
  - **UDP Transport:** Packet loss results in frame concealment (PLC) rather than pipeline-blocking retransmissions.
  - **Opus Codec:** Dynamic bitrate scaling ($16-32\text{ kbps}$ per voice channel) with in-band forward error correction (FEC) and discontinuous transmission (DTX).
  - **Native Spatial Audio & Jitter Buffering:** Built-in WebRTC jitter buffers dynamically adapt to network jitter.
- **Cons:** Requires ICE/STUN/TURN infrastructure for NAT traversal and a dedicated WebRTC media server topology (addressed in ADR-002 and ADR-003).
- **Outcome:** **Selected.**

---

## Decision

Adopt **WebRTC (RTP/SRTP over UDP) with the Opus codec** as Huddly's exclusive voice and audio transmission architecture when voice capabilities land in Phase 8 (`M7`):

1. **Protocol & Codec Standards:**
   - Transport: SRTP (Secure Real-time Transport Protocol) over UDP with DTLS key exchange.
   - Codec: Opus audio codec operating in voice-optimized mode (`minptime=10`, `useinbandfec=1`, `usedtx=1`), targeting $24-32\text{ kbps}$ per participant.
2. **Audio Processing:**
   - Force native browser constraints on `getUserMedia`: `{ echoCancellation: true, noiseSuppression: true, autoGainControl: true }`.
3. **Architectural Separation:**
   - Keep the voice media plane strictly decoupled from the realtime synchronization control plane (`@huddly/protocol` over WebSocket). Playback sync and room control remain on WebSocket; voice streams travel over WebRTC RTP channels.

---

## Consequences

### Positive

- Delivers conversational latency ($<100\text{ ms}$) essential for natural watch-party interactions.
- Native echo cancellation prevents host movie sound from bleeding into microphone audio.
- Bandwidth-efficient ($<32\text{ kbps}$ per voice uplink), leaving user bandwidth dedicated to 4K/HDR video playback.
- Supported natively in 100% of target browsers (Chrome, Firefox, Safari, Edge) without plugins or WebAssembly audio decoders.

### Negative / Trade-offs

- Requires STUN and TURN server relays to guarantee connectivity across restrictive corporate symmetric NATs and firewalls.
- Introduces additional media server infrastructure requirements (evaluated and resolved in ADR-002 and ADR-003).

---

## Revisit When

- WebTransport with WebCodecs matures across all target browsers and provides standardized, hardware-accelerated AEC/NS capabilities comparable to WebRTC.
