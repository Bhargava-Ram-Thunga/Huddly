# Next Session — Handoff Document

Living handoff document for active development. **Update the "Now" section at the end of every session.**

Last updated: 19 Aug 2026, after completing M1 triage (#211), AUTH-004 OAuth framework (#213), and opening promotion PR to main (#214).

---

## 1. What Huddly is

Huddly is a real-time watch-together platform. Everyone watches in **their own browser**; the server synchronizes **playback state, not pixels**. Browser extension + Node/TypeScript backend. Read [ROADMAP.md](../../ROADMAP.md) and [release-plan.md](release-plan.md) before starting.

## 2. Repo state (as of this handoff)

|                |                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Repo           | `Bhargava-Ram-Thunga/Huddly` (Apache-2.0)                                                                      |
| Default branch | `dev`                                                                                                          |
| Branches       | `dev` → `main` → `prod` only. All three protected.                                                             |
| Stack          | pnpm workspaces + Turborepo + TypeScript strict + Vitest                                                       |
| Packages       | `@huddly/protocol`, `@huddly/sync-engine`, `@huddly/config`, `@huddly/database`, `@huddly/ui`                  |
| Services       | `services/api` (Fastify REST), `services/realtime` (Fastify WebSocket Gateway)                                 |
| Specs & Docs   | `ARCHITECTURE.md`, `docs/MVP.md`, `docs/protocol/v1.md`, `docs/database/schema-v1.md`, `docs/adr/ADR-010..013` |
| Board          | Project #3 "Huddly Roadmap" (4 columns: Backlog, In Progress, In Review, Done)                                 |
| Milestones     | M0…M12, due dates set. **M0 100% complete; M1 active.**                                                        |

## 3. Non-negotiable working rules

Branch protection **will** reject violations. Follow exactly:

1. **Never commit to `dev`, `main`, or `prod` directly.** Always a feature branch + PR.
2. **Branch name** must match:
   `^(feat|fix|docs|refactor|perf|test|build|ci|chore|hotfix)/[a-z0-9._-]+$`
   e.g. `docs/protocol-v1`, `feat/room-service`.
3. **PR title** must be conventional commits:
   `^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(scope\))?!?: .+`
4. **PR base is `dev`.** Never open a PR straight to `main`/`prod`; the "Merge target" check enforces `feature → dev → main → prod`.
5. **Link the issue** with `Closes #NN` in the PR body — board automation depends on it.
6. **No AI attribution in commits.** Do not add `Co-Authored-By:` trailers naming
   an AI tool (Claude, Copilot, Cursor, Antigravity, …), and do not set an AI as
   commit author. All commits are authored by the human maintainer. Agents:
   omit these trailers even if your default behaviour adds them.
7. Before pushing, these must pass locally:

   ```bash
   pnpm lint && pnpm typecheck && pnpm test
   npx markdownlint-cli2          # any .md change
   npx prettier@3 --write <files> # fixes most lint failures
   ```

8. **Squash-merge** PRs into `dev`. Delete the branch after.
9. Never approve or trigger the **production** deployment — human-only gate.

Required checks on every PR: `CI passed`, `Secret scan (gitleaks)`,
`Conventional PR title`, `Branch naming`, `Merge target`.

## 4. The board runs itself

Do **not** drag cards. Automation (see [board-automation.md](board-automation.md))
moves them: PR opened → In Review, merged to `dev` → Done.

## 5. NOW — Current Progress & Next Steps

### Completed Today:

- [x] **M0 Architecture Milestone Promotion**:
  - M0 is 100% complete (15/15).
  - Opened promotion PR [#214](https://github.com/Bhargava-Ram-Thunga/Huddly/pull/214) (`chore: promote M0 architecture and foundation work to main`). All CI checks pass; awaiting maintainer approving review to merge.
- [x] **M1 Milestone Triage & Gap Resolution**:
  - Triaged open M1 issues (#53, #54, #55, #58, #59).
  - Closed #53, #54, #58 with verified evidence comments.
  - Closed #55 and created follow-up issue [#212](https://github.com/Bhargava-Ram-Thunga/Huddly/issues/212) (`FOUND-016: VS Code editor configuration and type-aware ESLint rules`).
  - Added missing Turborepo `lint` & `dev` tasks and configured TypeScript composite project references across packages and services (PR [#211](https://github.com/Bhargava-Ram-Thunga/Huddly/pull/211) merged).
- [x] **AUTH-004: OAuth Integration Framework (#118)**:
  - Implemented provider-agnostic OAuth registry and handlers for Google and GitHub.
  - RFC 7636 PKCE (`S256`) and AES-256-GCM authenticated CSRF state tokens.
  - Added endpoints `GET /api/v1/auth/oauth/:provider/url` and `POST /api/v1/auth/oauth/callback` with verified email account linking.
  - Typed OAuth config in `@huddly/config`, `.env.example` placeholders, and 100% passing tests (PR [#213](https://github.com/Bhargava-Ram-Thunga/Huddly/pull/213) merged).

### Immediate Next Tasks (Next Session):

1. **Promote to `prod`**: After PR #214 merges to `main`, open PR from `main` to `prod` titled `chore: promote M0 architecture and foundation work to prod`. Do not approve the review or production deployment (maintainer human gates).
2. **`FOUND-008` (#59)**: Playwright E2E testing harness (multi-context two-client synchronization foundation).
3. **`FOUND-016` (#212)**: Editor workspace settings (`.vscode/settings.json`, `.vscode/extensions.json`) and type-aware ESLint rules.
4. **`DESIGN-003` (#84)**: UI kit — design tokens and shared React 19 cinema components in `packages/ui`.
5. **M2 & M3 Execution**: Next feature iterations on authentication, rooms, and sync engines.

### New Known Issues & Discoveries:

- **CodeQL Heuristics on State Hashes**: CodeQL flags HMAC operations if inputs/keys use sensitive names. CSRF state generation uses AES-256-GCM authenticated symmetric encryption, providing stronger integrity/confidentiality and passing all CodeQL scans cleanly.
- **TypeScript `exactOptionalPropertyTypes`**: Strict project references enforce explicit `| undefined` on optional interface properties when passing optional objects.

## 6. Human-only actions (never automate)

Approving production deployments · store submissions · account creation ·
buying domains · handling tokens/secrets · legal sign-off.

---

### End-of-session checklist

- [x] All PRs merged or explicitly parked
- [x] `dev` green
- [x] Board reflects reality (4 columns: Backlog, In Progress, In Review, Done)
- [x] **Section 5 "NOW" rewritten for the next session**
