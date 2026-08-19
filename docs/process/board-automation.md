# Board Automation — Scenarios

The "Huddly Roadmap" project board is driven by automation. A card's **Status**
should never need to be dragged by hand: work events (labels, PRs, reviews,
merges, deployments) move it.

This document is the specification. `.github/workflows/project-automation.yml`
implements it; `.github/scripts/board-sync.sh` and `board-sweep.sh` do the work.

## Status columns

`Backlog → In Progress → In Review → Done`

## Scenario matrix

| #   | Trigger (what happens)      | Board reaction                           |
| --- | --------------------------- | ---------------------------------------- |
| S1  | Issue opened                | Added to board → **Backlog**             |
| S2  | Issue assigned to developer | → **In Progress**                        |
| S3  | Draft PR opened             | PR + its linked issues → **In Progress** |
| S4  | PR marked ready for review  | PR + linked issues → **In Review**       |
| S5  | Review requests changes     | → **In Progress**                        |
| S6  | PR converted back to draft  | → **In Progress**                        |
| S7  | PR closed without merging   | → **Backlog**                            |
| S8  | PR merged into `dev`        | PR + linked issues → **Done**            |
| S9  | Issue closed                | → **Done**                               |
| S10 | Issue reopened              | → **Backlog**                            |

## Flow through the pipeline

```text
issue opened ──→ Backlog ──(assign / start work)──→ In Progress
                                                       │
                                           draft PR ───┘
                                                       │
                                     ready for review ──→ In Review
                                                       │
                                         merge to dev ──→ Done
```

## Setup requirement — `PROJECT_TOKEN`

The default `GITHUB_TOKEN` **cannot write to user-owned Projects v2**. The
automation therefore needs a Personal Access Token stored as the repository
secret `PROJECT_TOKEN`:

1. Create a classic PAT with the `repo` and `project` scopes (or a fine-grained
   token with read/write on Projects + Issues + Pull requests).
2. Add it at **Settings → Secrets and variables → Actions → New repository
   secret**, named `PROJECT_TOKEN`.

Without the secret every automation job **skips with a warning** instead of
failing, so CI stays green until it is configured.

## Built-in project workflows (enable in the project UI)

These GitHub-native automations complement the Actions above and cost nothing:

- **Auto-add to project** — filter `is:issue,pr is:open` (belt-and-braces for S1).
- **Item closed** → set Status **Done**.
- **Auto-archive items** — archive `is:closed updated:<@today-2w`.

## Board field conventions

- **Status** — owned by automation (this document).
- **Phase / Priority / Difficulty** — set at triage; never automated.
- Labels remain the source of truth for `type:*` and `area:*`; the board mirrors
  them for filtering.
