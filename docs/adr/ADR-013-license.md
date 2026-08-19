# ADR-013: Project license — Apache License 2.0

- **Status:** Accepted
- **Date:** 2026-08-15
- **Deciders:** Bhargava-Ram-Thunga
- **Issue:** [ARCH-015](https://github.com/Bhargava-Ram-Thunga/Huddly/issues/51)

_(Amended: rationale reworded to reflect self-hosting flexibility and patent protections independent of contributor model)_

## Context

Huddly is a real-time watch-together platform built on WebSockets, WebRTC, and media synchronization. The software license must satisfy three primary engineering and operational goals:

1. **Self-Hosting & Deployment Freedom:** Users and organizations must be able to deploy, configure, and self-host their own backend infrastructure without burdensome network-copyleft restrictions.
2. **Patent Protection & Risk Mitigation:** The platform operates in the WebRTC, streaming media, and codec transport domain — an area with active patent filings. An explicit patent grant and patent retaliation clause are essential defensive safeguards.
3. **Dependency Stack Compatibility:** The core media engine depends on LiveKit (Apache-2.0), mediasoup (ISC), and Fastify (MIT). The project license must align seamlessly with this dependency tree.

### Options considered

**MIT** — Highly permissive and simple, but grants no explicit patent license. In a media/WebRTC-adjacent system, MIT leaves the project and its users exposed to patent assertion risks.

**Apache License 2.0** — Permissive like MIT, but provides critical legal protections:

- An **express patent grant** (§3),
- A **patent retaliation clause**: if any entity initiates patent litigation against the software, their patent license terminates immediately,
- Explicit trademark and attribution handling (§6, §4).

_Trade-off:_ Slightly more structured compliance ceremony (NOTICE conventions, copyright headers) than MIT.

**AGPL 3.0** — Prevents closed-source network deployments. However, AGPL's network copyleft provisions attach strict source-disclosure obligations to anyone running or embedding self-hosted instances. This imposes unnecessary legal overhead on self-hosters and creates friction when integrating with standard cloud deployment toolchains.

## Decision

**Huddly is licensed under the Apache License 2.0.**

The `LICENSE` file at the repository root carries the full Apache-2.0 text, ensuring clear and permissive terms for deployment, self-hosting, and use.

## Consequences

**Positive**

- Explicit patent grants and retaliation protection safeguard the WebRTC and real-time media synchronization surface.
- Unrestricted self-hosting: operators can run Huddly on private servers or cloud infrastructure without triggering AGPL network copyleft obligations.
- Clean license compatibility with key dependencies (LiveKit, Fastify, Prisma, Vitest).
- Apache-2.0 is compatible with GPLv3 in one direction, ensuring maximum integration flexibility.

**Negative / accepted trade-offs**

- Permissive terms allow third parties to run downstream modified builds without contributing changes upstream.
- Slightly more compliance ceremony than MIT (NOTICE file conventions).

**Follow-through required**

- Ensure `"license": "Apache-2.0"` is maintained in every `package.json`.
- Audit third-party dependency licenses prior to any public release to prevent accidental copyleft contamination.

## Revisit when

- The project's architecture, commercial deployment strategy, or platform access model changes materially, necessitating an updated licensing review.
