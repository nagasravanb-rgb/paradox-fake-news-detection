import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ParadoxOrchestrator, configFromEnv } from "@paradox/core";
import { fusionGraph, fusionSnapshot } from "@paradox/fusion";
import { calibrationSummary } from "@paradox/calibration";
import { evaluationDashboard } from "@paradox/evaluation";
import {
  decisionRequestSchema,
  newId,
  researchRequestSchema,
  situationRequestSchema,
  verifyRequestSchema,
} from "@paradox/shared";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

loadDotEnv();

const prisma = new PrismaClient();
const orchestrator = new ParadoxOrchestrator(configFromEnv(process.env), process.env);
const authRequired = (process.env.AUTH_REQUIRED ?? "false") === "true";
const productAuthRequired = (process.env.PRODUCT_AUTH_REQUIRED ?? "false") === "true";
const jwtSecret = process.env.JWT_SECRET || "dev-only-insecure";

const app = Fastify({ logger: { level: process.env.PARADOX_LOG_LEVEL || "info" } });

await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, { origin: true });
await app.register(rateLimit, {
  max: Number(process.env.RATE_LIMIT_MAX ?? 60),
  timeWindow: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
});
await app.register(jwt, { secret: jwtSecret });

app.addHook("onRequest", async (req, reply) => {
  (req as { requestId?: string }).requestId = req.id;
  if (!authRequired && !productAuthRequired) return;
  if (req.url.startsWith("/api/v1/auth") || req.url === "/health") return;
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
  }
});

app.get("/health", async () => ({ ok: true, service: "paradox-api" }));
type AuthRequest = typeof app extends never ? never : { user?: { sub?: string } };
function currentUserId(req: { user?: { sub?: string } }): string | null {
  return req.user?.sub ?? null;
}

async function requireMembership(req: { user?: { sub?: string } }, organizationId: string, roles?: string[]) {
  const userId = currentUserId(req);
  if (!userId) return null;
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!membership) return null;
  if (roles && !roles.includes(membership.role)) return null;
  return membership;
}

function auditId() {
  return newId("audit");
}

async function writeAudit(input: {
  organizationId?: string;
  caseId?: string;
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditEvent.create({
    data: {
      id: auditId(),
      organizationId: input.organizationId,
      caseId: input.caseId,
      actorUserId: input.actorUserId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: JSON.stringify(input.metadata ?? {}),
    },
  });
}


app.post("/api/v1/auth/register", async (req, reply) => {
  const body = req.body as { email?: string; password?: string };
  if (!body.email || !body.password || body.password.length < 10) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "email and password (>=10) required" } });
  }
  const hash = await bcrypt.hash(body.password, 12);
  try {
    const user = await prisma.user.create({
      data: { id: newId("usr"), email: body.email.toLowerCase(), passwordHash: hash },
    });
    const token = await reply.jwtSign({ sub: user.id, email: user.email });
    return { token };
  } catch {
    return reply.code(409).send({ error: { code: "CONFLICT", message: "email exists" } });
  }
});

app.post("/api/v1/auth/login", async (req, reply) => {
  const body = req.body as { email?: string; password?: string };
  const user = await prisma.user.findUnique({ where: { email: (body.email ?? "").toLowerCase() } });
  if (!user || !(await bcrypt.compare(body.password ?? "", user.passwordHash))) {
    return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "invalid credentials" } });
  }
  const token = await reply.jwtSign({ sub: user.id, email: user.email });
  return { token };
});
app.get("/api/v1/me", async (req, reply) => {
  const userId = currentUserId(req);
  if (!userId) return reply.code(401).send({ error: { code: "UNAUTHORIZED" } });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, createdAt: true, memberships: { select: { role: true, organization: { select: { id: true, name: true, slug: true, plan: true } } } } },
  });
  if (!user) return reply.code(404).send({ error: { code: "NOT_FOUND" } });
  return user;
});

app.post("/api/v1/organizations", async (req, reply) => {
  const userId = currentUserId(req);
  if (!userId) return reply.code(401).send({ error: { code: "UNAUTHORIZED" } });
  const body = req.body as { name?: string; slug?: string; plan?: string };
  const name = body.name?.trim();
  const slug = body.slug?.trim().toLowerCase();
  if (!name || !slug || !/^[a-z0-9-]{3,48}$/.test(slug)) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "name and slug are required; slug must be 3-48 lowercase letters, numbers or hyphens" } });
  }
  try {
    const organization = await prisma.organization.create({
      data: {
        id: newId("org"),
        name,
        slug,
        plan: body.plan === "ENTERPRISE" ? "ENTERPRISE" : "TEAM",
        memberships: { create: { id: newId("mem"), userId, role: "OWNER" } },
        workspaces: { create: { id: newId("wsp"), name: "Default workspace", slug: "default" } },
      },
      include: { workspaces: true },
    });
    await writeAudit({ organizationId: organization.id, actorUserId: userId, action: "ORGANIZATION_CREATED", resourceType: "ORGANIZATION", resourceId: organization.id });
    return reply.code(201).send(organization);
  } catch {
    return reply.code(409).send({ error: { code: "CONFLICT", message: "organization slug exists" } });
  }
});

app.get("/api/v1/organizations/:id", async (req, reply) => {
  const id = (req.params as { id: string }).id;
  if (!await requireMembership(req, id)) return reply.code(403).send({ error: { code: "FORBIDDEN" } });
  const organization = await prisma.organization.findUnique({
    where: { id },
    include: { workspaces: true, memberships: { select: { id: true, userId: true, role: true, createdAt: true } } },
  });
  if (!organization) return reply.code(404).send({ error: { code: "NOT_FOUND" } });
  return organization;
});

app.post("/api/v1/organizations/:id/workspaces", async (req, reply) => {
  const organizationId = (req.params as { id: string }).id;
  const membership = await requireMembership(req, organizationId, ["OWNER", "ADMIN"]);
  if (!membership) return reply.code(403).send({ error: { code: "FORBIDDEN" } });
  const body = req.body as { name?: string; slug?: string };
  const name = body.name?.trim();
  const slug = body.slug?.trim().toLowerCase();
  if (!name || !slug || !/^[a-z0-9-]{2,48}$/.test(slug)) return reply.code(400).send({ error: { code: "VALIDATION_ERROR" } });
  try {
    const workspace = await prisma.workspace.create({ data: { id: newId("wsp"), organizationId, name, slug } });
    await writeAudit({ organizationId, actorUserId: currentUserId(req) ?? undefined, action: "WORKSPACE_CREATED", resourceType: "WORKSPACE", resourceId: workspace.id });
    return reply.code(201).send(workspace);
  } catch {
    return reply.code(409).send({ error: { code: "CONFLICT", message: "workspace slug exists" } });
  }
});

app.post("/api/v1/organizations/:id/cases", async (req, reply) => {
  const organizationId = (req.params as { id: string }).id;
  const membership = await requireMembership(req, organizationId, ["OWNER", "ADMIN", "ANALYST"]);
  if (!membership) return reply.code(403).send({ error: { code: "FORBIDDEN" } });
  const body = req.body as { title?: string; description?: string; workspaceId?: string };
  const title = body.title?.trim();
  if (!title) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "title is required" } });
  if (body.workspaceId) {
    const workspace = await prisma.workspace.findFirst({ where: { id: body.workspaceId, organizationId } });
    if (!workspace) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "workspace does not belong to organization" } });
  }
  const caseRow = await prisma.case.create({
    data: { id: newId("case"), organizationId, workspaceId: body.workspaceId, createdById: currentUserId(req)!, title, description: body.description?.trim() ?? "" },
  });
  await writeAudit({ organizationId, caseId: caseRow.id, actorUserId: currentUserId(req)!, action: "CASE_CREATED", resourceType: "CASE", resourceId: caseRow.id });
  return reply.code(201).send(caseRow);
});

app.get("/api/v1/organizations/:id/cases", async (req, reply) => {
  const organizationId = (req.params as { id: string }).id;
  if (!await requireMembership(req, organizationId)) return reply.code(403).send({ error: { code: "FORBIDDEN" } });
  return prisma.case.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" }, take: 100 });
});

app.get("/api/v1/organizations/:id/audit", async (req, reply) => {
  const organizationId = (req.params as { id: string }).id;
  if (!await requireMembership(req, organizationId, ["OWNER", "ADMIN", "REVIEWER"])) return reply.code(403).send({ error: { code: "FORBIDDEN" } });
  return prisma.auditEvent.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 200 });
});


app.post("/api/v1/verify", async (req, reply) => {
  const parsed = verifyRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } });
  }
  const result = await orchestrator.verify(parsed.data.text, parsed.data.modality, parsed.data.asOf);
  await persist("VERIFICATION", result);
  return result;
});

app.post("/api/v1/research", async (req, reply) => {
  const parsed = researchRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } });
  }
  const result = await orchestrator.research(parsed.data.question);
  await persist("RESEARCH", result);
  return result;
});

app.post("/api/v1/situation", async (req, reply) => {
  const parsed = situationRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } });
  }
  const result = await orchestrator.situation(parsed.data.description);
  await persist("SITUATION", result);
  return result;
});

app.post("/api/v1/decision", async (req, reply) => {
  const parsed = decisionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } });
  }
  const result = await orchestrator.decision(parsed.data);
  await persist("DECISION", result);
  return result;
});

app.get("/api/v1/executions/:id", async (req, reply) => {
  const id = (req.params as { id: string }).id;
  const row = await prisma.execution.findUnique({ where: { id } });
  if (!row) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "execution not found" } });
  return JSON.parse(row.payload);
});

app.get("/api/v1/executions", async () => {
  const rows = await prisma.execution.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return rows.map((r: typeof rows[number]) => ({ id: r.id, engine: r.engine, status: r.status, createdAt: r.createdAt }));
});

app.get("/api/v1/claims/:id", async (req, reply) => {
  const id = (req.params as { id: string }).id;
  const row = await prisma.claimRow.findUnique({ where: { id } });
  if (!row) return reply.code(404).send({ error: { code: "NOT_FOUND" } });
  return JSON.parse(row.json);
});

app.get("/api/v1/evidence/:id", async (req, reply) => {
  const id = (req.params as { id: string }).id;
  const row = await prisma.evidenceRow.findUnique({ where: { id } });
  if (!row) return reply.code(404).send({ error: { code: "NOT_FOUND" } });
  return JSON.parse(row.json);
});

app.get("/api/v1/graphs/:id", async (req, reply) => {
  const id = (req.params as { id: string }).id;
  const row = await prisma.graphRow.findUnique({ where: { id } });
  if (!row) return reply.code(404).send({ error: { code: "NOT_FOUND" } });
  return JSON.parse(row.json);
});

app.get("/api/v1/fusion", async () => ({
  snapshot: fusionSnapshot(orchestrator.state),
  graph: fusionGraph(orchestrator.state),
}));

app.get("/api/v1/truth-shift", async () => orchestrator.shifts);

app.post("/api/v1/outcomes", async (req, reply) => {
  const body = req.body as { executionId?: string; predicted?: number; observed?: number };
  if (!body.executionId || typeof body.predicted !== "number" || typeof body.observed !== "number") {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR" } });
  }
  if (body.observed !== 0 && body.observed !== 1) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "observed must be 0 or 1" } });
  }
  const row = await prisma.outcomeRow.create({
    data: {
      id: newId("out"),
      executionId: body.executionId,
      predicted: body.predicted,
      observed: body.observed,
    },
  });
  return row;
});

app.get("/api/v1/evaluation", async () => {
  const outcomes = await prisma.outcomeRow.findMany();
  const labels = await prisma.evalLabel.findMany();
  const execs = await prisma.execution.findMany();
  const failures = execs.filter((e: typeof execs[number]) => ["TOOL_FAILURE", "MODEL_FAILURE", "TIMEOUT"].includes(e.status)).length;
  const retrievalSuccesses =execs.filter((e: typeof execs[number]) => e.status === "SUCCESS" || e.status === "PARTIAL_SUCCESS").length;
  return evaluationDashboard({
    labeled: labels,
    outcomes: outcomes.map((o: typeof outcomes[number]) => ({
      id: o.id,
      executionId: o.executionId,
      predicted: o.predicted,
      observed: o.observed,
      recordedAt: o.recordedAt.toISOString(),
    })),
    retrievalAttempts: execs.length,
    retrievalSuccesses,
    failures,
    total: execs.length,
    latencies: [],
  });
});

app.get("/api/v1/calibration", async () => {
  const outcomes = await prisma.outcomeRow.findMany();
  return calibrationSummary(
    outcomes.map((o: typeof outcomes[number])  => ({
      id: o.id,
      executionId: o.executionId,
      predicted: o.predicted,
      observed: o.observed,
      recordedAt: o.recordedAt.toISOString(),
    })),
  );
});

app.get("/api/v1/settings", async () => ({
  authRequired: authRequired || productAuthRequired,
  productAuthRequired,
  llmConfigured: Boolean(process.env.LLM_API_KEY),
  webSearchProvider: process.env.WEB_SEARCH_PROVIDER ?? "none",
  maxVerificationRounds: Number(process.env.MAX_VERIFICATION_ROUNDS ?? 2),
  selfVerifyThreshold: Number(process.env.SELF_VERIFY_THRESHOLD ?? 0.7),
  wikipediaEnabled: true,
}));

async function persist(engine: string, result: { executionId: string; requestId?: string; status?: string; claims?: unknown[]; evidence?: unknown[]; graph?: { id: string } }) {
  const payload = JSON.stringify(result);
  await prisma.execution.create({
    data: {
      id: result.executionId,
      requestId: result.requestId ?? result.executionId,
      engine,
      status: result.status ?? "UNKNOWN",
      payload,
    },
  });
  for (const c of result.claims ?? []) {
    const claim = c as { id: string };
    await prisma.claimRow.create({ data: { id: claim.id, executionId: result.executionId, json: JSON.stringify(c) } });
  }
  for (const e of result.evidence ?? []) {
    const ev = e as { id: string };
    await prisma.evidenceRow.create({ data: { id: ev.id, executionId: result.executionId, json: JSON.stringify(e) } });
  }
  if (result.graph?.id) {
    await prisma.graphRow.create({
      data: { id: result.graph.id, executionId: result.executionId, json: JSON.stringify(result.graph) },
    });
  }
}

function loadDotEnv() {
  const candidates = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 0) continue;
      const k = line.slice(0, i).trim();
      let v = line.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  }
}

const port = Number(process.env.PORT ?? process.env.PARADOX_API_PORT ?? 8787);
const host = process.env.PARADOX_API_HOST ?? "0.0.0.0";

try {
  await prisma.$connect();
} catch (err) {
  app.log.warn({ err }, "Prisma connect failed — run prisma db push");
}

await bootstrapUser();

await app.listen({ port, host });
app.log.info(`PARADOX API http://${host}:${port}`);

async function bootstrapUser() {
  const email = process.env.AUTH_BOOTSTRAP_EMAIL;
  const password = process.env.AUTH_BOOTSTRAP_PASSWORD;
  if (!email || !password) return;
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return;
  await prisma.user.create({
    data: {
      id: newId("usr"),
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
}
