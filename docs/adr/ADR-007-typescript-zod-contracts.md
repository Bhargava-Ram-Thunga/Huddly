# ADR-007: Strict TypeScript & Shared Zod Contract Validation

- **Status:** Accepted
- **Date:** 2026-08-17
- **Deciders:** Bhargava-Ram-Thunga
- **Issue:** [ARCH-008](https://github.com/Bhargava-Ram-Thunga/Huddly/issues/44)

## Context

Huddly is an end-to-end realtime distributed system spanning browser extension content scripts, popup UI, React companion applications, REST microservices, WebSocket gateways, and database layers (spec §36, §37).

In such systems, type drift between client and server is a leading source of runtime bugs, silent synchronization failures, and security vulnerabilities. When the server changes an event envelope field name or payload structure, client applications must either catch the incompatibility at compile time or fail predictably with structured validation errors at runtime.

The type system and contract validation layer must guarantee:

1. **Zero Type Drift:** Single source of truth for domain models, event envelopes, and REST payloads shared directly across all monorepo packages.
2. **Runtime Contract Enforcement:** Static TypeScript types are erased at runtime; all external untrusted inputs (network payloads, WebSocket messages, environment variables) must be validated at the system boundary before reaching business logic.
3. **Rigorous Compiler Safety:** Enforce strict type checking across the monorepo to eliminate subtle runtime errors (`undefined` index lookups, accidental optional property mutations, unhandled switch cases).

### Options considered

#### 1. JSON Schema + Code Generation (Quicktype / openapi-generator)

- **Pros:** Language-agnostic schema definitions; broad tooling support.
- **Cons:**
  - Code generation step required on every schema change, slowing down local development loops.
  - Generated TypeScript types often lack nuanced union inference and branded types.
  - Disconnected developer experience compared to native TypeScript declarations.
- **Outcome:** **Rejected.**

#### 2. TypeScript Interfaces Only (No Runtime Validation)

- **Pros:** Zero runtime bundle overhead; native TypeScript syntax.
- **Cons:**
  - **No Boundary Safety:** TypeScript types provide zero runtime protection against malformed JSON, corrupted WebSocket frames, or malicious client payloads.
  - Requires writing manual type guards (`isPlaybackEvent(data)`) for every network interaction, resulting in repetitive, bug-prone code.
- **Outcome:** **Rejected.**

#### 3. Strict TypeScript + Shared Zod Contract Schemas

- **Pros:**
  - **Single Source of Truth:** Author schema once using Zod (`PlaybackUpdatePayloadSchema`); derive the static TypeScript type automatically via `type PlaybackUpdatePayload = z.infer<typeof PlaybackUpdatePayloadSchema>`.
  - **Runtime & Static Safety:** Validates raw JSON inputs at system boundaries with comprehensive error reporting while providing 100% strict compile-time types.
  - **Ecosystem Integration:** Works out of the box with Fastify schema validation, Prisma models, and React forms.
- **Cons:** Minor bundle size overhead (~12 KB minified); easily absorbed by modern bundlers in both WebExtension and web apps.
- **Outcome:** **Selected.**

---

## Decision

Adopt **Strict TypeScript (ES2022 / ESNext)** and **Zod** as the universal language and contract validation standard across all Huddly packages:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Single Source of Truth Contract Flow                 │
│                                                                        │
│                    `packages/protocol` (Zod Schema)                    │
│                                    │                                   │
│              ┌─────────────────────┴─────────────────────┐             │
│              ▼                                           ▼             │
│   Runtime Parser Function                     Static TypeScript Type   │
│   `PlaybackUpdateSchema.parse(raw)`           `z.infer<typeof Schema>` │
│              │                                           │             │
│       ┌──────┴──────┐                             ┌──────┴──────┐      │
│       ▼             ▼                             ▼             ▼      │
│  Fastify API   WebSocket Gateway             WebExtension   Web App    │
│ (Input Guard)  (Event Guard)                 (Type Safety) (Type Safe) │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. Compiler Configuration (`tsconfig.base.json`)

All workspace packages inherit from root `tsconfig.base.json`, enforcing advanced strict compiler flags:

- **`"strict": true`:** Enables all strict type-checking options (`noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`).
- **`"noUncheckedIndexedAccess": true`:** Treats array and dictionary index lookups as `T | undefined`, preventing out-of-bounds runtime crashes.
- **`"exactOptionalPropertyTypes": true`:** Differentiates between a property being omitted (`{ key?: string }`) versus explicitly set to `undefined` (`{ key: string | undefined }`).
  - _Interaction with Zod:_ Schemas with `z.string().optional()` infer properties that may be omitted, perfectly aligning with exact optional property rules.
- **`"noImplicitOverride": true`:** Forces explicit `override` keyword on overridden class methods.
- **`"verbatimModuleSyntax": true`:** Enforces unambiguous `import type` syntax, guaranteeing clean tree-shaking and preventing type imports from polluting runtime JS bundles.
- **`"isolatedModules": true`:** Guarantees that every file can be safely transpiled in isolation by fast bundlers (esbuild / Turbopack / Vite).

### 2. Contract Sharing Architecture

1. **`@huddly/protocol`:** Single source of truth for versioned event envelopes (`EventEnvelope<T>`), room state snapshots, playback commands, chat messages, and error codes.
2. **`@huddly/config`:** Zod runtime validation for all process environment variables (`ConfigSchema.parse(process.env)`), failing fast on server startup if required credentials or URLs are missing.

---

## Consequences

### Positive

- Zero contract drift between frontend clients and backend services.
- Invalid network payloads and WebSocket messages are rejected at the edge with structured `ERR_INVALID_PAYLOAD` errors before reaching business logic.
- Advanced TypeScript flags eliminate an entire class of undefined property access and mutation bugs.

### Negative / Trade-offs

- `exactOptionalPropertyTypes` requires disciplined object construction (cannot pass `{ optField: undefined }` when an optional field is absent; must omit the key or use spread operators).

---

## Revisit When

- A higher-performance binary serialization format with native schema compilers (e.g. Protocol Buffers / Cap'n Proto) is required for high-throughput media telemetry.
