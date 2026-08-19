# Competitive Analysis (ARCH-002)

This document evaluates existing synchronized media solutions to inform the architecture, feature boundaries, and technical trade-offs for building Huddly as a self-hosted personal platform.

---

## 1. Competitor Comparison Matrix

| Solution                               | Supported Sites                                                       | Participant Limits                                     | Sync Approach                                                        | Communications                              | Pricing / Hosting Model                                                          | Platform Coverage                                                 | Common User Complaints & Flaws                                                                                                               |
| -------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Teleparty (formerly Netflix Party)** | Major commercial streaming (Netflix, Disney+, Hulu, HBO Max, YouTube) | 50 (free), up to 100 on paid tier                      | Client extension polling + centralized WebSocket message relay       | Text chat and video reactions (paid)        | Freemium ($3.99/mo subscription for premium features); Closed proprietary cloud  | Chrome, Edge, Firefox (extension required for all participants)   | Extension frequently desyncs on video ads; aggressive upsell prompts; high CPU usage; breaks on minor streaming UI updates.                  |
| **Watch2Gether**                       | YouTube, Vimeo, Dailymotion, SoundCloud, direct MP4 URLs              | Unlimited (practical cap ~20 before UI lag)            | In-page embedded iframe API control                                  | Text chat, webcam, audio chat (WebRTC mesh) | Free with banner ads; $3.99/mo ad-free subscription; Closed hosted service       | Web application (no extension required for supported embed sites) | Does not support arbitrary web streaming sites; embedded iframes frequently blocked by copyright restrictions; heavy UI banner ads.          |
| **Metastream**                         | Generic web video via Chromium embedded browser / extension bridge    | ~10-20 recommended                                     | Extension content script DOM mutation + WebRTC P2P sync              | Text chat only                              | Free; Open-source client but largely unmaintained                                | Desktop app / Web extension (Firefox, Chrome)                     | Unmaintained codebase; high latency on P2P mesh; complex setup; extension breaks frequently on modern manifest updates.                      |
| **Hyperbeam (formerly Tuterial)**      | Any web page (remote virtual browser streaming via WebRTC video)      | Up to 100 (performance degrades above 20 on free tier) | Cloud virtual browser rendering + WebRTC video feed broadcast        | Text chat and voice chat                    | Freemium ($5-$10/mo for higher resolution and persistent sessions); Hosted cloud | Web application (browser-based client)                            | High cloud server costs; heavy bandwidth requirement for video downlinks; 720p/1080p stream compression artifacts; input lag for controller. |
| **Discord Watch Together**             | YouTube only (embedded Discord Activity)                              | Up to 25 per voice channel                             | Official YouTube IFrame Player API integration inside Discord client | Discord voice/video and text chat           | Free with Discord Nitro perks; Proprietary Discord cloud infrastructure          | Desktop client, Web, Mobile Discord apps                          | Strictly limited to YouTube content; unable to synchronize personal video files, anime sites, or custom streaming platforms.                 |

---

## 2. Personal Motivation and Differentiation

Building Huddly addresses specific frustrations encountered when using commercial or unmaintained third-party tools for personal watch parties with friends:

1. **Self-Hosted Infrastructure and Zero Advertisements**:
   - Commercial tools (Teleparty, Watch2Gether) insert disruptive banner ads and subscription paywalls into the viewing experience.
   - Huddly runs on personal self-hosted servers (Docker / VPS), ensuring full control, clean glassmorphic UI, and zero ad injection.

2. **Generic HTML5 Video Support across Arbitrary Sites**:
   - Tools like Watch2Gether and Discord are strictly locked to embedded YouTube or whitelisted APIs.
   - Huddly leverages a hybrid extension observer to synchronize standard HTML5 video elements across arbitrary personal streaming links, self-hosted media servers (Plex/Jellyfin), and independent web video players.

3. **High-Performance Centralized Voice SFU**:
   - Tools that use WebRTC full-mesh audio (such as Watch2Gether or Metastream) suffer from exponential uplink degradation as participant counts grow ($N \times (N-1)$ connections).
   - Huddly integrates a dedicated self-hosted LiveKit SFU, allowing clean, low-latency spatial/room voice communications without client bandwidth degradation.

4. **Frictionless Guest Access (No Signup Barrier)**:
   - Requiring friends to create third-party accounts or install heavy desktop applications creates friction before a watch session.
   - Huddly supports one-click instant guest tokens via room share links (`/join/hud-xxxx`), allowing friends to join immediately.

5. **Server-Authoritative Clock Synchronization**:
   - Most extension tools rely on naive client message passing, resulting in persistent multi-second drift and playback looping.
   - Huddly implements server-authoritative monotonic revisions and tiered drift correction (nudge vs seek).

---

## 3. Deliberately Excluded Capabilities (Scope Discipline)

To keep Huddly maintainable and achievable as a single-operator project, the following features are explicitly out of scope:

- **Remote Virtual Browser Streaming (Hyperbeam model)**:
  - Running remote headless Chromium instances in the cloud to capture and re-encode video feeds requires significant GPU/CPU server infrastructure and massive outbound bandwidth costs. Huddly uses lightweight client-side DOM synchronization instead.
- **Direct DRM Decryption / Stream Re-broadcasting**:
  - Huddly never decrypts or restreams protected media content. All participants must have independent legal access to the media source URL.
- **Complex Multi-Tenant Billing or Subscription Systems**:
  - Huddly is built for private and personal group use, eliminating the need for Stripe billing integrations, team plans, or usage metering tiers.
- **Mobile Native App Development**:
  - Native iOS and Android apps require separate codebases and App Store review pipelines. Mobile support is scoped strictly to responsive web viewing and Safari/Chrome mobile browser compatibility.
