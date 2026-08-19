# Release Plan — weekend cadence

Huddly is built on weekends by one maintainer (with AI assistance). This plan
converts the [roadmap](../../ROADMAP.md) phases into dated milestones and
releases under that constraint.

**Baseline:** Saturday 15 Aug 2026.

## The unit of work: one session

The build window is **Friday evening → Saturday 17:30**.

|                      |                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| **Budget**           | ~11 focused hours (Fri ~4h, Sat ~7h)                                                                     |
| **Friday evening**   | Build. One phase-slice on a feature branch; open the PR before stopping.                                 |
| **Saturday morning** | Finish the slice, write the tests, get CI green.                                                         |
| **Saturday ~16:30**  | Land it: merge to `dev`, confirm staging is green, tidy the board. Promote only at milestone boundaries. |

Leaving a PR open overnight is deliberate — CI runs while you sleep, so Saturday
starts with feedback already waiting.

Estimates below are in **sessions (WE)**, one per week, not calendar weeks. Dates assume no
skipped weekends; see [Slip rule](#slip-rule).

## Schedule to MVP

| Phase                              |  WE | Target weekend  | Milestone | Ships                                   |
| ---------------------------------- | --: | --------------- | --------- | --------------------------------------- |
| 0 — Architecture                   |   2 | **29 Aug 2026** | M0        | ADRs, protocol v1, schema, MVP freeze   |
| 1 — Foundation (finish)            |   1 | **5 Sep 2026**  | M1        | `apps/`, `services/`, testing pkg       |
| 2 — Auth + guest access            |   2 | **19 Sep 2026** | M1        | Sessions, OAuth, guest join             |
| 3 — Rooms                          |   2 | **3 Oct 2026**  | M2        | Create/join, codes, invites, roles      |
| 4 — Realtime backbone              |   3 | **24 Oct 2026** | M3        | WebSocket, events, presence             |
| 5 — Playback sync engine           |   3 | **14 Nov 2026** | M4        | Server-authoritative sync, drift        |
| 6 — Extension + generic adapter    |   4 | **12 Dec 2026** | M5        | 🚀 **v0.1 Sync Alpha (unpacked)**       |
| 7 — Chat                           |   2 | **9 Jan 2027**  | M6        | 🚀 **v0.2 Store submission (unlisted)** |
| 8 — Voice (LiveKit)                |   3 | **30 Jan 2027** | M7        | 🚀 **v0.3 Voice Beta**                  |
| MVP hardening + E2E success script |   2 | **13 Feb 2027** | M7        | 14-step MVP script automated            |
| Store review + launch prep         |   2 | **27 Feb 2027** | M12       | 🚀 **v1.0 Public MVP**                  |

Two weekends of slack are absorbed around the late-December holidays (already
reflected in the 12 Dec → 9 Jan gap).

**Total: ~26 weekends ≈ 6.5 months.**

## When is there a Chrome extension?

Three different answers, because "released" means three different things:

| Stage                                       | When            | What you can do                                                              |
| ------------------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| **Loadable dev build**                      | ~10 Oct 2026    | `chrome://extensions` → Load unpacked. Popup + room join; sync not finished. |
| **v0.1 Sync Alpha** (unpacked)              | **12 Dec 2026** | Two real people watch an HTML5 video in sync. Shared as a zip with friends.  |
| **v0.2 in the Chrome Web Store** (unlisted) | **9 Jan 2027**  | Installable by link. Invited testers only.                                   |
| **v1.0 public listing**                     | **27 Feb 2027** | Anyone can install it.                                                       |

The first date that feels like a product is **12 December 2026**.

### Store realities that affect these dates

- **Review latency is not in our control.** Chrome Web Store review is typically
  days but can stretch to weeks; a new developer account requesting broad host
  permissions attracts extra scrutiny. Budget 1–3 weeks, and submit the unlisted
  build early (v0.2) specifically to get the account through review before v1.0
  matters.
- **Register the developer accounts by October 2026** — Chrome ($5 one-time) and
  Firefox AMO. Do not leave this to launch week.
- **A published privacy policy is required** before listing.
- Store assets (icons, screenshots, description) are a real half-weekend of work,
  budgeted inside the launch-prep block.

## Release train

| Version  | Gate                                                   | Audience        |
| -------- | ------------------------------------------------------ | --------------- |
| **v0.1** | Two clients hold <200 ms drift through play/pause/seek | You + friends   |
| **v0.2** | Chat works; extension passes store review (unlisted)   | Invited testers |
| **v0.3** | Voice works; reconnect is clean                        | Invited testers |
| **v1.0** | Full 14-step MVP script green on Chrome + Firefox      | Public          |

Each version is a `prod` promotion, so the board sweeps to **Done** on release.

## Slip rule

If a phase runs more than **one weekend** over budget:

1. **Cut scope, not quality.** The MVP scope freeze (ARCH-014) names what is
   droppable; tests and security are never the thing that gets dropped.
2. **Do not compress the sync engine (Phase 5) or the extension (Phase 6).**
   These are the product. Everything else is negotiable.
3. Re-baseline the dates below this line and move on — do not silently carry
   invisible debt into the next phase.

Deliberately deferred until after v1.0: video calling, mobile, granular
permissions, the adapter SDK/registry, and 100-participant scale.

## Assumptions

- ~11 productive hours per session (Fri evening + Sat until 17:30), most weeks attended.
- Heavy drafting (specs, code, tests) is AI-assisted; review and decisions are not.
- LiveKit Cloud free tier for voice, not self-hosted (self-hosting adds ~2 WE).
- No paid infrastructure blockers; hosting chosen by Phase 2.

**These are targets for planning, not commitments.** The single biggest risk to
the dates is store review latency, which is why v0.2 exists.
