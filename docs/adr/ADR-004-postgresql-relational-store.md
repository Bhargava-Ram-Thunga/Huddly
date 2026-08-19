# ADR-004: PostgreSQL 16 & Prisma ORM as Primary Relational Store

- **Status:** Accepted
- **Date:** 2026-08-17
- **Deciders:** Bhargava-Ram-Thunga
- **Issue:** [ARCH-007](https://github.com/Bhargava-Ram-Thunga/Huddly/issues/43)

## Context

Huddly requires a durable data store for identity, room hierarchies, membership status, authentication tokens, invites, chat history, and audit trails (spec §37, MVP §1).

The storage layer must provide:

1. **Strict Relational Integrity:** Enforce foreign key constraints and cascade rules (e.g. deleting a user cleanly cascades sessions and devices; closing a room archives memberships).
2. **ACID Transactional Guarantees:** Room creation, host transfers, and invite code redemption must execute atomically without partial failure or race conditions.
3. **Type-Safe Access in TypeScript:** Schema definitions must generate compile-time TypeScript types without manual DTO synchronization.
4. **Structured & Semi-Structured Data Handling:** Support relational schemas alongside JSONB columns for flexible room settings and audit metadata.

### Options considered

#### 1. Document / NoSQL Store (MongoDB / DynamoDB)

- **Pros:** Flexible schemaless documents; easy horizontal sharding.
- **Cons:**
  - Lacks native relational foreign key integrity across users, rooms, memberships, and permissions.
  - Multi-document transactions introduce performance overhead and complex rollback handling.
  - Higher risk of data anomalies and orphaned records in multi-tenant room hierarchies.
- **Outcome:** **Rejected.**

#### 2. Pure SQL Query Builder (Knex / Kysely / Drizzle) on PostgreSQL

- **Pros:** Fine-grained SQL query optimization; minimal runtime abstraction.
- **Cons:**
  - Requires manual migration tooling and boilerplate relational hydration code.
  - Lacks the automated declarative schema migrations and cohesive client generation provided by Prisma.
- **Outcome:** **Rejected.**

#### 3. PostgreSQL 16 with Prisma ORM

- **Pros:**
  - **Relational Integrity & ACID:** Battle-tested SQL engine with robust transaction management (`prisma.$transaction`).
  - **Prisma Client Generation:** Single declarative `schema.prisma` generates strongly-typed client bindings with full TypeScript autocompletion and type-safe query builders.
  - **Native JSONB Support:** Provides indexed JSONB columns for flexible room settings and audit payload metadata.
  - **Ecosystem Tooling:** Broad database migration management (`prisma migrate`), seeding, and introspection tooling.
- **Cons:** Prisma query engine introduces minor query abstraction overhead compared to raw SQL; mitigated by explicit connection pooling and targeted indexes.
- **Outcome:** **Selected.**

---

## Decision

Adopt **PostgreSQL 16** as Huddly's primary relational database engine and **Prisma ORM** (`@huddly/database`) as the unified data access client:

1. **Package Architecture:**
   - Define database models in `packages/database/prisma/schema.prisma`.
   - Export a singleton `prisma` client instance from `@huddly/database` with automatic client instantiation.
2. **Current Shipped Models (Phase 0 / M0):**
   - **`User` / `UserDevice`:** User identity, authentication, guest status, devices, and refresh tokens.
   - **`Room` / `RoomSettings`:** Room metadata, 8-character unique alphanumeric room codes (`room_code`), and JSONB settings.
   - **`RoomMember`:** Membership status (`JOINED`, `LEFT`, `KICKED`) and core roles (`HOST`, `PARTICIPANT`).
   - **`RoomInvite`:** Secure token-based invite links with max-use and expiration controls.
   - **`MediaSession` / `PlaybackState` / `PlaybackEvent`:** Historical and active playback tracking.
   - **`ChatMessage` / `MessageReaction`:** Room messaging and reaction persistence.
   - **`AuditEvent`:** Append-only security and moderation audit log.
3. **Database Connection Configuration:**
   - Fastify services configure PostgreSQL via `DATABASE_URL` managed by `@huddly/config`.

---

## Consequences

### Positive

- Strong referential integrity prevents data corruption and orphaned entities across rooms and users.
- 100% end-to-end type safety between Prisma models and Fastify route handlers.
- Declarative schema migrations keep local development Docker environments and CI pipelines in sync.

### Negative / Trade-offs & Known Schema Drift

- **Schema Drift Notice relative to `docs/database/schema-v1.md`:**
  - The specification document `docs/database/schema-v1.md` documents future planned extensions: `room_permissions`, `navigation_states`, `moderation_actions` tables, `controller_user_id` on playback states, and expanded roles (`MODERATOR`, `OBSERVER`).
  - The shipped `packages/database/prisma/schema.prisma` implements the focused MVP core subset needed for Phase 1–5 (`User`, `Room`, `RoomMember`, `PlaybackState`, `ChatMessage`, etc.).
  - **Action Tracked:** A dedicated follow-up issue will track formal schema migration when Phase 3 (Room System) and Phase 10 (Granular Permissions) begin.

---

## Revisit When

- Read/write transaction throughput requires read-replica routing or distributed sharding (e.g. via Citus or PgBouncer multi-cluster routing).
