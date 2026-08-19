# ADR-009: Monorepo Build Topology with pnpm Workspaces and Turborepo

- **Status:** Accepted
- **Date:** 2026-08-17
- **Deciders:** Bhargava-Ram-Thunga
- **Issue:** [ARCH-008](https://github.com/Bhargava-Ram-Thunga/Huddly/issues/44)

## Context

Supporting Huddly's modular monolith architecture (ADR-008) requires a robust build and workspace management system (spec §36, MVP §1).

As the codebase spans multiple shared domain packages (`packages/*`), services (`services/*`), and future applications (`apps/*`), the build tooling must guarantee:

1. **Strict Dependency Isolation:** Prevent "phantom dependencies" where a package inadvertently imports an unlisted dependency hoisted to root `node_modules` by loose package managers.
2. **Deterministic & Fast Build Pipeline:** Execute typechecks, lints, tests, and builds across all packages in optimal topological order, caching unchanged package outputs locally and in CI.
3. **Disk & Network Efficiency:** Deduplicate identical dependency versions across packages using content-addressable storage.

### Options considered

#### 1. npm / Yarn Classic Workspaces

- **Pros:** Default tooling in Node.js ecosystem.
- **Cons:**
  - Flat/hoisted `node_modules` structure permits phantom dependencies (code compiles locally because a sibling package installed the dependency, then fails mysteriously in isolated production builds).
  - Slow `install` and lockfile resolution times compared to modern package managers.
  - Redundant disk space consumption due to multiple duplicate copies of packages.
- **Outcome:** **Rejected.**

#### 2. Nx Monorepo Tooling

- **Pros:** Advanced dependency graph visualization; automated code generators.
- **Cons:** Heavy plugin ecosystem and proprietary project configuration wrappers that introduce unnecessary abstraction for a focused TypeScript monorepo.
- **Outcome:** **Rejected.**

#### 3. pnpm Workspaces + Turborepo

- **Pros:**
  - **Strict Symlinked `node_modules`:** pnpm creates an isolated, symlinked dependency tree. A package can only import packages explicitly declared in its own `package.json`, completely eliminating phantom dependencies.
  - **Hard-Link Content Storage:** A single global content-addressable store hard-links files across projects, saving gigabytes of disk space and enabling sub-second installs.
  - **Turborepo Pipeline Orchestration:** Declarative dependency graph in `turbo.json` with multi-core parallel execution and fine-grained task caching.
- **Outcome:** **Selected.**

---

## Decision

Adopt **pnpm (v11) Workspaces** for dependency management and **Turborepo (v2)** for build and task orchestration across the Huddly monorepo:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Monorepo Workspace Topology                     │
│                                                                        │
│   Root Configuration                                                   │
│   ├── pnpm-workspace.yaml     (Declares packages/*, services/*, apps/*)│
│   ├── turbo.json              (Task pipeline: build, test, lint, check)│
│   ├── package.json            (Monorepo devDependencies & scripts)     │
│   └── tsconfig.base.json      (Strict base TypeScript compiler options)│
│                                                                        │
│   Workspace Packages                                                   │
│   ├── packages/config         (Exports typed runtime env with Zod)     │
│   ├── packages/database       (Exports Prisma client & schema)         │
│   ├── packages/protocol       (Exports event envelopes & Zod schemas)  │
│   ├── packages/sync-engine    (Exports NTP sync & drift correction)    │
│   └── packages/ui             (Exports cinema tokens & React 19 kit)   │
│                                                                        │
│   Services                                                             │
│   ├── services/api            (Fastify REST API service)               │
│   └── services/realtime       (Fastify WebSocket Gateway service)      │
│                                                                        │
│   Applications (Planned per ROADMAP.md for M1 & M5)                    │
│   ├── apps/extension          (Planned: Manifest V3 WebExtension)      │
│   └── apps/web                (Planned: React 19 companion web app)    │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. Workspace Configuration (`pnpm-workspace.yaml`)

```yaml
packages:
  - 'packages/*'
  - 'services/*'
  - 'apps/*'
```

- Inter-package dependencies use explicit workspace protocol declarations:
  - `"@huddly/protocol": "workspace:*"`
  - `"@huddly/config": "workspace:*"`
  - `"@huddly/database": "workspace:*"`

### 2. Turborepo Pipeline Graph (`turbo.json`)

- **`build`:** Builds upstream dependencies before downstream services (`dependsOn: ["^build"]`).
- **`typecheck`:** Executes `tsc --noEmit` across all workspace packages with project references.
- **`test`:** Runs package Vitest suites in parallel with code coverage collection.
- **`lint`:** Executes ESLint and Prettier format checks across modified files.

---

## Consequences

### Positive

- Zero phantom dependency bugs: if a dependency is omitted from a package's `package.json`, TypeScript and Node.js fail immediately during local development.
- Turborepo task caching yields sub-second incremental verification across unchanged packages.
- Fast, reproducible CI runs on GitHub Actions with automated pnpm store caching.

### Negative / Trade-offs

- Developers must use `pnpm` exclusively (enforced via `"packageManager": "pnpm@..."` in root `package.json`). Attempting to use `npm install` or `yarn` is blocked.

---

## Revisit When

- Monorepo package count expands beyond 50+ packages, justifying Turborepo Remote Caching infrastructure across distributed developer teams.
