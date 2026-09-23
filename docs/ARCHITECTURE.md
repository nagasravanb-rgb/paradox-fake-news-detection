# Architecture

Layers: Presentation (Vite/React) → API (Fastify) → Orchestrator (`@paradox/core`) → engines → providers → Prisma.

Engines never call each other except through documented composition:

- Situation **uses** Research results (explicit call, not a hidden cycle).
- Decision **uses** Situation results.
- Fusion **consumes events** after each engine returns.
- Truth-Shift **records** claim evolution from verification rounds.

```
INPUT → normalize/modality
     → Verification | Research | Situation | Decision
     → Fusion event
     → persist execution/claims/evidence/graph
     → UI
```

Deterministic modules: verdict, confidence formulas, SSRF, rate limits, independence, numerical contradiction, CSI.

Optional modules: LLM JSON extraction, Tavily search.

SQLite is the default store so development needs no hosted database. The Prisma schema is the source of truth for later PostgreSQL.
