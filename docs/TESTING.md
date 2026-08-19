# Huddly Testing Strategy & Guidelines

> **Target Code Coverage:** 80%+ across all packages  
> **Test Runner:** Vitest v4.1+

---

## 1. Test Pyramid & Methodology

```text
       ▲
      / \        E2E Tests (Playwright Browser Sync)
     /───\       Integration Tests (Fastify Route Injections & Database)
    /─────\      Unit Tests (Zod Envelopes, Drift Engine, Security Crypto)
   ─────────
```

- **Unit Tests:** Verify pure algorithmic and validation logic in `@huddly/protocol`, `@huddly/sync-engine`, `@huddly/ui`, and `@huddly/config`.
- **Integration Tests:** Test HTTP endpoints, JWT auth decorators, and Prisma delegate behavior in `@huddly/api` and `@huddly/database`.
- **Realtime Gateway Tests:** Validate WebSocket frame parsing, 25 msgs/sec rate limiting, and ticket single-use consumption in `@huddly/realtime`.

---

## 2. Running Tests

### Full Monorepo

```bash
pnpm test
```

### Package-Specific

```bash
pnpm --filter @huddly/api test
pnpm --filter @huddly/realtime test
pnpm --filter @huddly/sync-engine test
pnpm --filter @huddly/database test
```

### Coverage Report

```bash
pnpm test:coverage
```

---

## 3. Code Coverage Status & Goals

| Package               | Purpose                                | Target | Current Status                         |
| --------------------- | -------------------------------------- | ------ | -------------------------------------- |
| `@huddly/api`         | REST API, auth, rooms, tickets         | 80%+   | ✅ High coverage (21/21 tests passing) |
| `@huddly/database`    | Prisma schema, client delegates        | 80%+   | ✅ 100% delegate coverage              |
| `@huddly/protocol`    | Zod envelope schemas, validators       | 85%+   | ✅ 34/34 tests passing                 |
| `@huddly/sync-engine` | Drift measurement & tiered corrections | 85%+   | ✅ 21/21 tests passing                 |
| `@huddly/realtime`    | Fastify WS gateway, rate limiting      | 80%+   | ✅ 5/5 gateway tests passing           |
| `@huddly/config`      | Strict env validation                  | 80%+   | ✅ 5/5 env tests passing               |
| `@huddly/ui`          | Design tokens & swatches               | 80%+   | ✅ 4/4 token tests passing             |

---

## 4. Continuous Integration (CI)

Every pull request against `dev` or `main` runs automated GitHub Actions workflows:

- **Lint & Format:** `eslint . && prettier --check .`
- **Strict Typecheck:** `tsc -p tsconfig.json --noEmit` across all workspace packages
- **Matrix Unit Tests:** Node.js 22 & 24 runners
- **Secret Scanning:** `gitleaks`
- **CodeQL Analysis:** Static security vulnerability scanning
