# ADR-008: Modular Monolith Architecture with Domain-Driven Package Boundaries

- **Status:** Accepted
- **Date:** 2026-08-17
- **Deciders:** Bhargava-Ram-Thunga
- **Issue:** [ARCH-008](https://github.com/Bhargava-Ram-Thunga/Huddly/issues/44)

## Context

Huddly requires an architectural foundation supporting rapid feature development, strict domain separation, and low operational overhead (spec §36, MVP §1).

Early-stage architectures often face a dilemma:

- **Distributed Microservices:** Introduce network latency hops, distributed transaction coordination (two-phase commits / sagas), complex service discovery, and high deployment overhead before product-market fit or team scale demands it.
- **Unstructured Monolith ("Big Ball of Mud"):** Allows cross-domain spaghetti dependencies where database queries, WebSocket handling, and UI concerns leak into one another, making future refactoring impossible.

The architecture must provide strict domain boundaries, fast local development, simple single-command deployment, and seamless code sharing without the operational complexity of distributed microservices.

### Options considered

#### 1. Distributed Microservices

- **Architecture:** Break every domain (Auth Service, Room Service, Sync Service, Chat Service, Voice Service) into separate repositories and deployable containers communicating via gRPC/HTTP.
- **Pros:** Independent service scaling and deployment pipelines.
- **Cons:**
  - Extreme operational complexity for a small engineering team (orchestrating multiple databases, network mesh, distributed tracing).
  - Cross-service database joins become impossible, requiring eventual consistency sagas for simple operations like room creation.
  - Multiplies local development friction and CI test execution time.
- **Outcome:** **Rejected.**

#### 2. Classic Unstructured Monolith

- **Architecture:** Single monolithic application with all code organized in generic directories (`controllers/`, `models/`, `views/`).
- **Pros:** Simple initial setup.
- **Cons:**
  - Inevitable architectural decay and tight coupling across unrelated domain concerns.
  - Inability to reuse core protocol and sync logic across backend services and browser extension clients.
- **Outcome:** **Rejected.**

#### 3. Modular Monolith with Domain-Driven Workspace Packages

- **Architecture:** Single codebase structured into decoupled, domain-specific packages (`packages/*`) and lightweight service endpoints (`services/*`), all co-located in one repository.
- **Pros:**
  - **Clean Domain Boundaries:** Each package owns a single responsibility (e.g. `@huddly/protocol` owns event contracts; `@huddly/sync-engine` owns drift math).
  - **Zero Network Hop Overhead:** Services import shared libraries directly as internal workspace dependencies without network latency or serialization overhead.
  - **Single-Command Local Development:** One `pnpm dev` or `docker compose up` starts the entire system locally.
  - **Evolutionary Architecture:** If a specific domain (e.g. Realtime Gateway) needs dedicated autoscaling in the future, its isolated package boundary makes extraction straightforward.
- **Outcome:** **Selected.**

---

## Decision

Adopt a **Modular Monolith** architecture with strict domain boundaries enforced via workspace packages:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      Modular Monolith Architecture                     │
│                                                                        │
│   Applications (Planned for M1 & M5 per ROADMAP.md)                    │
│   ├── apps/extension          (Planned: Chrome & Firefox WebExtension) │
│   └── apps/web                (Planned: React 19 companion web app)    │
│                                                                        │
│   Deployable Services (Current Monolith Services)                      │
│   ├── services/api            (Fastify REST: Auth, Rooms, Tickets)     │
│   └── services/realtime       (Fastify WebSocket Gateway + Redis)      │
│                                                                        │
│   Shared Domain Packages (Current Shipped Foundation)                  │
│   ├── packages/protocol       (Event envelopes, Zod schemas, errors)   │
│   ├── packages/sync-engine    (NTP sync formulas, drift ladder, math)  │
│   ├── packages/database       (Prisma client, PostgreSQL 16 schema)    │
│   ├── packages/config         (Zod runtime environment configuration)  │
│   └── packages/ui             (Cinema design tokens, React components) │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. Bounded Domain Packages

1. **`@huddly/protocol`:** Pure domain event envelopes, message schemas, and error definitions. Zero external I/O or database dependencies.
2. **`@huddly/sync-engine`:** Pure mathematical clock synchronization, continuous projection $P(t)$, and 4-tier drift ladder logic.
3. **`@huddly/database`:** Encapsulates Prisma ORM, PostgreSQL schema models, and database client factory.
4. **`@huddly/config`:** Validates and exposes typed environment variables to services.
5. **`@huddly/ui`:** Design tokens (OKLCH cinema palette, golden-angle participant colors) and reusable UI primitives.

### 2. Service Separation

- **`services/api`:** Fastify REST API handling stateless operations: user authentication, session refresh, room CRUD, invite links, and connection ticket minting.
- **`services/realtime`:** Fastify WebSocket gateway handling stateful, high-frequency room event broadcasting and Redis pub/sub distribution.

---

## Consequences

### Positive

- Enables atomic cross-package refactoring and synchronized PR verification across all packages.
- Zero distributed transaction overhead: database operations leverage native PostgreSQL ACID transactions.
- Rapid developer onboarding: entire system runs locally via standard pnpm tooling.

### Negative / Trade-offs

- Requires continuous enforcement of dependency rules to prevent circular references between packages.

---

## Revisit When

- Individual service scaling profiles diverge so drastically (e.g. WebSocket gateway memory saturation vs. CPU-intensive video processing) that separate container deployment and independent autoscaling groups are required.
