# PARADOX Implementation Plan

## Repository inspection (2026-09-06)

- Workspace started in the user home directory, not a PARADOX codebase.
- `C:\Users\HP\ParadoxAI` contains only a Vercel project stub (`paradox-ai`), not this engine.
- An older Codex “Paradox AI” console under Documents is a different product (chat/agent UI). It is not reused.
- **Decision:** greenfield TypeScript monorepo at `C:\Users\HP\Projects\paradox`.

## Stack (chosen)

| Layer | Choice | Why |
|---|---|---|
| Monorepo | npm workspaces | Zero extra toolchain on Windows |
| API | Fastify + TypeScript (`tsx` in dev) | Fast, typed, plugins for rate-limit/auth |
| Web | React 18 + Vite + Tailwind + React Router | Stable, accessible, no paid UI kit |
| Data | Prisma + SQLite locally (`DATABASE_URL`) | No paid infra; PostgreSQL-compatible schema for later |
| Validation | Zod | Shared request/domain contracts |
| Tests | Vitest | Same toolchain as Vite |
| Graphs | API-owned nodes/edges + SVG renderer | Graphs = persisted state, never decorative |
| LLM | OpenAI-compatible HTTP client | Optional; `NOT_CONFIGURED` if unset |
| Search | Wikipedia API (default, real) + optional web search | Evidence without paid keys |

## Architecture

Deterministic orchestration in `@paradox/core`. Engines are packages with explicit interfaces. Fusion consumes events; engines do not call each other directly.

```
Input → Orchestrator → Engine → Evidence/Providers → Verdict/Report
                 ↓
           Fusion events → Knowledge graph + Truth-Shift
                 ↓
           Persistence + API + UI
```

## Non-negotiable behavior

- No fabricated search hits, citations, confidence, or verdicts.
- Missing providers → machine-readable `NOT_CONFIGURED` / `NO_EVIDENCE` / `TOOL_FAILURE`.
- Heuristic claim extraction (when LLM unset) is labeled `HEURISTIC`, not “verified.”
- Wikipedia retrieval is real HTTP; failed fetch does not invent content.
- Confidence formulas are **PARADOX system metrics**, not statistical guarantees.

## Build sequence

1. Shared types, IDs, error states, config
2. Providers (LLM, Wikipedia search, SSRF-safe fetch)
3. Evidence, source reliability/independence, contradiction, temporal
4. Verification engine + self-verify bounds
5. Research / Situation / Decision
6. Fusion, Truth-Shift, graphs, calibration, evaluation, multimodal adapters
7. API + Prisma + auth/rate-limit
8. Web UI
9. Tests + docs

## Dependencies

Runtime: Node 20+, npm. Optional: `OPENAI_API_KEY` or compatible base URL, `WEB_SEARCH_API_KEY`. SQLite file created by Prisma migrate.

## Out of scope for v1 (interfaces only)

- Full image/audio/video understanding → `UNSUPPORTED_MODALITY`
- Empirically calibrated probability (needs outcome data)
- Paid search/news firehoses
