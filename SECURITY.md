# Security Policy

## Current Status

Huddly is currently in early active development (pre-alpha) and is not deployed for public production use. Security hardening and architectural boundaries are implemented directly on the `dev` branch.

| Branch | Status             | Security Updates       |
| :----- | :----------------- | :--------------------- |
| `dev`  | Active Development | Continuous integration |
| `main` | Release Candidate  | Staged releases        |
| `prod` | Production         | Planned                |

---

## Automated Security Controls

The codebase implements continuous automated security enforcement across the development pipeline:

- **Secret Scanning**: Gitleaks runs on every pull request; push protection prevents credentials from entering history.
- **Dependency Auditing**: Automated dependency vulnerability scanning and regular automated patch integration.
- **Static Analysis (SAST)**: GitHub CodeQL security analysis runs on every pull request.
- **Input Validation**: Strict runtime schema validation using Zod on all WebSocket envelopes, REST payloads, and query parameters.
- **Data Protection**: Cryptographic room token verification, scoped Redis channel isolation, and GDPR-compliant soft-deletion architecture.
