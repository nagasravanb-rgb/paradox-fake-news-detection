# Security

- Secrets only in environment variables.
- Helmet, CORS, rate limiting.
- JWT when `AUTH_REQUIRED=true`.
- Passwords hashed with bcrypt (cost 12).
- SSRF: http(s) only, block localhost/private IPs, DNS resolution check, no automatic redirect follow.
- Zod validation on mutating routes.
- Logs must not include API keys or prompts (orchestrator stores stage metadata only).
- Error payloads are structured codes, not stack traces to clients.
