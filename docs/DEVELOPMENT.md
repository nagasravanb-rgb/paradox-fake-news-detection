# Development

Node 20+. npm workspaces.

```
npm install
npx prisma generate --schema apps/api/prisma/schema.prisma
npx prisma db push --schema apps/api/prisma/schema.prisma
npm test
npm run typecheck
npm run dev:api
npm run dev:web
```

Do not commit `.env`. Copy `.env.example`.

SQLite file: `apps/api/prisma/dev.db` after `db push` from `apps/api` (DATABASE_URL `file:./prisma/dev.db`).
