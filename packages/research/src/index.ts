import { extractClaimsHeuristic, sourceFromHit, detectSourceRelationships, findContradictions, lexicalRelevance } from "@paradox/evidence";
import { wikipediaSearch, optionalWebSearch, ModelRouter } from "@paradox/providers";
import { newId, nowIso, type KnowledgeGraph, type Source, type TraceStep } from "@paradox/shared";

export interface ResearchReport {
  executionId: string;
  requestId: string;
  status: string;
  question: string;
  subquestions: string[];
  plan: string[];
  method: string;
  executiveSummary: string;
  sources: Source[];
  evidence: { id: string; sourceId: string; text: string; relevance: number }[];
  conflicts: string[];
  uncertainties: string[];
  findings: string[];
  conclusion: string;
  graph: KnowledgeGraph;
  steps: TraceStep[];
  searchNotes: string[];
}

function splitQuestion(question: string): string[] {
  const parts = question
    .split(/\?/)
    .map((s) => s.trim())
    .filter((s) => s.length > 6)
    .map((s) => (s.endsWith("?") ? s : `${s}?`));
  if (parts.length >= 2) return parts.slice(0, 6);
  const claims = extractClaimsHeuristic(question);
  const extra = claims.slice(0, 4).map((c) => `What independent sources say about: ${c.normalizedClaim}?`);
  return [question, ...extra].slice(0, 5);
}

export async function runResearch(input: {
  question: string;
  requestId: string;
  router: ModelRouter;
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
}): Promise<ResearchReport> {
  const executionId = newId("ex");
  const steps: TraceStep[] = [];
  const searchNotes: string[] = [];
  const add = (stage: string, status: TraceStep["status"], detail: string, ms: number) => {
    const t = nowIso();
    steps.push({ index: steps.length + 1, stage, status, detail, startedAt: t, endedAt: t, latencyMs: ms });
  };

  add("QUESTION", "OK", input.question.slice(0, 200), 0);
  let subquestions = splitQuestion(input.question);
  if (input.router.configured()) {
    const llm = await input.router.completeJson("synthesize", [
      {
        role: "system",
        content: "Decompose the research question into 3-6 subquestions as JSON {subquestions:string[]}. Do not invent facts.",
      },
      { role: "user", content: input.question },
    ]);
    if (llm.status === "OK" && llm.text) {
      try {
        const parsed = JSON.parse(llm.text) as { subquestions?: string[] };
        if (Array.isArray(parsed.subquestions) && parsed.subquestions.length) {
          subquestions = parsed.subquestions.slice(0, 6);
        }
      } catch {
        /* keep heuristic */
      }
    } else {
      searchNotes.push(`llm_decompose:${llm.status}`);
    }
  }
  add("QUESTION_DECOMPOSITION", "OK", `${subquestions.length} subquestions`, 0);
  const plan = [
    "Decompose the question",
    "Search Wikipedia (and optional web search if configured)",
    "Collect sources with provenance",
    "Compare overlap and contradictions",
    "Synthesize with explicit uncertainty",
  ];
  add("RESEARCH_PLAN", "OK", plan.join("; "), 0);

  const sources: Source[] = [];
  for (const q of subquestions) {
    const wiki = await wikipediaSearch(q, input.timeoutMs, 3);
    searchNotes.push(`wiki:${q.slice(0, 40)}:${wiki.status}:${wiki.hits.length}`);
    if (wiki.status === "OK") sources.push(...wiki.hits.map(sourceFromHit));
    const web = await optionalWebSearch(q, input.env, input.timeoutMs);
    if (web.status === "OK") sources.push(...web.hits.map(sourceFromHit));
  }
  detectSourceRelationships(sources);
  add("SOURCE_COLLECTION", sources.length ? "OK" : "UNAVAILABLE", `sources=${sources.length}`, 0);

  const evidence = sources.map((s) => ({
    id: newId("ev"),
    sourceId: s.id,
    text: s.snippet || s.title,
    relevance: lexicalRelevance(input.question, s.snippet || s.title),
  }));
  const asEvidence = evidence.map((e) => ({
    id: e.id,
    claimId: "research",
    sourceId: e.sourceId,
    content: e.text,
    extractedText: e.text,
    relevanceScore: e.relevance,
    supportScore: e.relevance,
    contradictionScore: 0,
    sourceReliability: sources.find((s) => s.id === e.sourceId)?.reliabilityScore ?? 0.4,
    independenceScore: sources.find((s) => s.id === e.sourceId)?.independenceScore ?? 1,
    publicationDate: sources.find((s) => s.id === e.sourceId)?.publishedAt ?? null,
    retrievalDate: nowIso(),
    validFrom: null,
    validUntil: null,
    temporalValidity: "UNKNOWN" as const,
    evidenceStatus: e.text ? ("ACTIVE" as const) : ("NONE" as const),
    provenance: {
      pipelineStage: "RESEARCH",
      producedAt: nowIso(),
      producer: "research_engine",
      model: null,
      modelVersion: null,
      transformation: "snippet",
      notes: null,
    },
  }));
  const contras = findContradictions(asEvidence);
  const conflicts = contras.map((c) => `${c.type}: ${c.explanation}`);
  const uncertainties = [
    sources.length ? "Encyclopedia/search snippets are incomplete vs full documents." : "No sources retrieved.",
    "Relevance uses lexical overlap unless an LLM judge is configured.",
  ];
  const findings = evidence
    .filter((e) => e.relevance > 0.08)
    .slice(0, 8)
    .map((e) => e.text.slice(0, 240));
  const conclusion =
    sources.length === 0
      ? "NO_EVIDENCE: research did not retrieve external sources. No findings are asserted."
      : `Collected ${sources.length} sources. Conflicts reported: ${conflicts.length}. This is a synthesis of retrieved snippets, not a verified verdict.`;

  const graph: KnowledgeGraph = {
    id: `g_${executionId}`,
    graphType: "RESEARCH",
    nodes: [
      { id: "q", kind: "QUESTION", label: input.question.slice(0, 80), refId: executionId },
      ...subquestions.map((s, i) => ({ id: `sq_${i}`, kind: "QUESTION" as const, label: s.slice(0, 80), refId: `sq_${i}` })),
      ...sources.map((s) => ({ id: s.id, kind: "SOURCE" as const, label: s.title.slice(0, 80), refId: s.id })),
      ...findings.map((_, i) => ({ id: `f_${i}`, kind: "FINDING" as const, label: `Finding ${i + 1}`, refId: `f_${i}` })),
    ],
    edges: [
      ...subquestions.map((_, i) => ({
        id: newId("edge"),
        from: "q",
        to: `sq_${i}`,
        kind: "DERIVED_FROM" as const,
        provenanceNote: "decomposition",
      })),
      ...sources.map((s) => ({
        id: newId("edge"),
        from: "q",
        to: s.id,
        kind: "RELATED_TO" as const,
        provenanceNote: "retrieved",
      })),
    ],
  };

  return {
    executionId,
    requestId: input.requestId,
    status: sources.length ? "SUCCESS" : "NO_EVIDENCE",
    question: input.question,
    subquestions,
    plan,
    method: "Bounded Wikipedia search per subquestion; optional web search; lexical comparison; no fabricated citations.",
    executiveSummary: conclusion,
    sources,
    evidence,
    conflicts,
    uncertainties,
    findings: findings.length ? findings : ["No on-topic snippets retrieved."],
    conclusion,
    graph,
    steps,
    searchNotes,
  };
}
