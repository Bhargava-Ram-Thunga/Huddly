# Legal and Platform Constraints (ARCH-003)

This document establishes the technical, operational, and legal boundaries for operating Huddly as a personal-use, self-hosted media synchronization platform.

---

## 1. Core Operating Posture

Huddly functions strictly as a real-time state synchronization coordinator. The platform:

1. **Never hosts or re-transmits media streams**: All video data flows directly from the original content provider (e.g. streaming site, video host, or local media server) to each participant's individual browser.
2. **Requires independent user access**: Every participant must have legitimate personal access to the content being watched (e.g., authenticated account session or accessible web URL).
3. **Operates on observe-only principles**: Browser extensions only inspect standard DOM timing metadata to synchronize clock positions.

---

## 2. Hard Technical Constraints

Engineering implementation across all Huddly packages must adhere to the following non-negotiable constraints:

1. **Observe-Only DRM and EME Boundaries**:
   - The browser extension must never hook, intercept, decrypt, dump, or bypass Encrypted Media Extensions (EME), Widevine, PlayReady, or FairPlay CDM interfaces.
   - Observation is strictly limited to public `HTMLMediaElement` properties (`currentTime`, `paused`, `playbackRate`, `duration`, `ended`) and top-level page metadata (`window.location.href`, `document.title`).
   - Frame buffers, canvas rendering pipelines, and decrypted audio/video chunks are never accessed or serialized.

2. **Graceful Degradation for Protected and Unsupported Environments**:
   - If a target site uses cross-origin iframe sandboxing or closed Shadow DOM that prevents script inspection of the video element, the system must not attempt invasive exploit techniques.
   - Instead, the UI gracefully falls back to Manual Sync Mode, presenting a synchronized timing timeline so users can adjust their players independently.

3. **No Automatic Account Sharing or Credential Bypassing**:
   - Huddly never synchronizes HTTP cookies, session tokens, authorization headers, or login state across participants. Each user maintains their own authenticated session with the media provider.

---

## 3. Platform Interaction Patterns

### 3.1 Website Terms of Service (ToS) Interaction

- **Mechanism**: Running a browser extension content script to observe DOM events on personal browsing sessions is standard user-agent behavior (similar to ad blockers, accessibility tools, or custom playback speed controllers).
- **Risk Profile**: Low for personal usage. The extension sends no automated scraping queries or flood requests to third-party media servers. Playback commands are translated into standard DOM method calls (`video.play()`, `video.pause()`, `video.currentTime = X`).

### 3.2 Extension Distribution and Sideloading

- **Personal Development Mode**:
  - For personal daily use across personal machines, the extension is loaded unpacked via Chromium Developer Mode (`chrome://extensions` -> Load Unpacked) or Firefox Temporary Add-on debugging (`about:debugging`).
- **Unlisted Store Packaging**:
  - If store installation is desired for personal convenience across multiple devices without developer warnings, the extension can be submitted as an unlisted add-on (restricted link) complying with standard MV3 privacy permission disclosures (limiting host permissions to active tabs).

### 3.3 Copyright and Content Liability

- **Hosting Model**: Huddly stores only room configurations, user nicknames, and playback timestamps ($t \in \mathbb{R}$) in its PostgreSQL/Redis databases.
- **Liability**: Because no copyrighted media or audiovisual buffers pass through or reside on the Huddly server, the server operates purely as an ephemeral signaling channel.

### 3.4 Communications and Privacy

- **Voice Recording Consent**:
  - Huddly voice chat routes peer audio through the self-hosted LiveKit SFU in real time and does not record or store audio streams to disk. If server-side recording is ever explored in the future, explicit UI consent indicators will be required.
- **Personal Data Protection**:
  - To protect the operator and invited guests:
    - Passwords are hashed with Argon2id.
    - Refresh tokens are stored hashed (SHA-256) in `user_devices`.
    - IP addresses in server connection logs are retained only transiently for connection debugging and rate limiting, not permanently tracked.
