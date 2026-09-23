# API

Base: `/api/v1`

| Method | Path | Notes |
|---|---|---|
| POST | `/verify` | `{ text, modality?, asOf? }` |
| POST | `/research` | `{ question }` |
| POST | `/situation` | `{ description }` |
| POST | `/decision` | `{ objective, options, constraints, context? }` |
| GET | `/executions` | recent |
| GET | `/executions/:id` | full payload + steps |
| GET | `/claims/:id` | |
| GET | `/evidence/:id` | |
| GET | `/graphs/:id` | |
| GET | `/fusion` | in-process knowledge snapshot |
| GET | `/truth-shift` | |
| GET | `/evaluation` | nulls if unlabeled |
| GET | `/calibration` | nulls if no outcomes |
| POST | `/outcomes` | `{ executionId, predicted, observed: 0\|1 }` |
| GET | `/settings` | no secrets |
| POST | `/auth/register` | |
| POST | `/auth/login` | |

Errors: `{ error: { code, message } }` with codes such as `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`.

When `AUTH_REQUIRED=true`, JWT is required except `/health` and `/auth/*`.
