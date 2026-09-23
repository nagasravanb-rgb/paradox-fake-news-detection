# PARADOX — Evidence-Driven Intelligent Engine

Production-oriented TypeScript monorepo: verification, research, situation, decision, PARADOX-FUSION, and Truth-Shift.

This is not a chatbot. Pipelines retrieve real evidence (Wikipedia by default), score sources deterministically, and refuse to invent citations or confidence.

## Quick start

```bash
cd paradox
copy .env.example .env   # Windows
npm install
cd apps/api
npx prisma generate
npx prisma db push
cd ../..
npm run dev:api
```

In another terminal:

```bash
npm run dev:web
```

- API: http://127.0.0.1:8787/health  
- UI: http://127.0.0.1:5173  

Optional: set `LLM_API_KEY` for OpenAI-compatible extraction/synthesis. Unset → heuristic extractors + `NOT_CONFIGURED` for model calls.

Optional: `WEB_SEARCH_PROVIDER=tavily` and `WEB_SEARCH_API_KEY` for extra search. Default web search is `none` (Wikipedia still runs).

```bash
npm test
```

## Principles

- No fake evidence, graphs, or evaluation scores.
- LLM output never drives routing, persistence, or verdict thresholds.
- Evidence strength ≠ model confidence.
- No evidence → `NONE` / `UNVERIFIED` / `INSUFFICIENT_EVIDENCE`.

See `docs/` and `implementation_plan.md`.
