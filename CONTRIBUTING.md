# Contributing to Fluid

Thank you for your interest in contributing to Fluid.

## Repository Layout

```
fluid/
├── fluid-server/   Rust signing engine (primary production backend)
├── server/         Node.js parity server and admin API
├── admin-dashboard/ Next.js admin UI
├── client/         TypeScript client library
├── fluid-cli/      Rust CLI tool
├── fluid-py/       Python SDK
├── fluid-go/       Go client library
├── proto/          Protocol Buffer definitions (gRPC contract)
└── docs/           Documentation and Architecture Decision Records
```

## Architecture Decisions

Major architectural choices are documented as [Architecture Decision Records](docs/adr/README.md) in `docs/adr/`. Before proposing a significant change to the tech stack or internal protocols, check whether an existing ADR covers the area and, if the decision is new, open a discussion or draft ADR alongside your pull request.

## Development Setup

### Prerequisites

- Rust toolchain (`cargo`)
- Node.js 18+ and `npm` or `pnpm`
- Docker and Docker Compose

### Start the full local stack

```bash
docker compose up
```

Services exposed:

| Service | URL |
|---------|-----|
| Rust engine | http://localhost:3000 |
| Node API | http://localhost:3001 |
| Admin dashboard | http://localhost:3002 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

### Run tests

```bash
# Rust
cd fluid-server && cargo test

# Node API
cd server && npm test

# Parity check (Node vs Rust)
cd server && npm run parity:rust
```

## Pull Request Guidelines

1. Reference the issue number in your PR description (`closes #NNN`).
2. Keep commits focused; one logical change per commit.
3. All new environment variables must be documented in `.env.example`.
4. Update or add ADRs in `docs/adr/` for any significant architectural decision.
5. Provide evidence (screenshot, log, or test output) that the feature works as described.

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values. Never commit secrets.
All new variables introduced by a PR must have a matching entry in `.env.example` with a comment explaining their purpose.

## Code Style

- **Rust**: `cargo fmt` and `cargo clippy --all-targets` must pass with no warnings.
- **TypeScript**: follow the ESLint configuration in `server/` and `admin-dashboard/`.
- **Comments**: only add comments when the *why* is non-obvious from the code itself.
