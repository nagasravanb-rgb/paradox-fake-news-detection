import {
  type Claim,
  type ConfidenceRecord,
  type Contradiction,
  type Evidence,
  type Explanation,
  type KnowledgeGraph,
  type Provenance,
  type Source,
  type SourceRelationship,
  type TraceStep,
  type VerificationRound,
  type Verdict,
  newId,
  nowIso,
} from "@paradox/shared";
import {
  detectSourceRelationships,
  extractClaimsHeuristic,
  findContradictions,
  independentSourceCount,
  lexicalContradiction,
  lexicalRelevance,
  lexicalSupport,
  markExpired,
  parseLlmClaims,
  sourceFromHit,
  temporalValidity,
} from "@paradox/evidence";
import { ModelRouter, optionalWebSearch, wikipediaSearch, type SearchHit } from "@paradox/providers";
import { computeConfidence } from "./confidence.js";
import { shouldSelfVerify, selfVerificationDelta } from "./selfVerify.js";
import { decideVerdict } from "./verdict.js";

export interface VerificationConfig {
  maxRounds: number;
  selfVerifyThreshold: number;
  maxEvidence: number;
  timeoutMs: number;
  asOf?: string;
}

export interface VerificationOutput {
  executionId: string;
  requestId: string;
  status: "SUCCESS" | "PARTIAL_SUCCESS" | "NO_EVIDENCE" | "INSUFFICIENT_EVIDENCE" | "CONFLICTING_EVIDENCE" | "TOOL_FAILURE" | "MODEL_FAILURE" | "UNVERIFIED" | "UNSUPPORTED_MODALITY";
  claims: Claim[];
  skippedOpinions: Claim[];
  sources: Source[];
  sourceRelationships: SourceRelationship[];
  evidence: Evidence[];
  contradictions: Contradiction[];
  verdict: Verdict | null;
  confidence: ConfidenceRecord | null;
  explanation: Explanation | null;
  rounds: VerificationRound[];
  graph: KnowledgeGraph;
  steps: TraceStep[];
  searchNotes: string[];
}

export async function runVerification(input: {
  text: string;
  requestId: string;
  router: ModelRouter;
  config: VerificationConfig;
  env: NodeJS.ProcessEnv;
}): Promise<VerificationOutput> {
  const executionId = newId("ex");
  const steps: TraceStep[] = [];
  const searchNotes: string[] = [];
  const t0 = Date.now();

  const step = async <T,>(stage: string, fn: () => Promise<T> | T, unavailable?: string): Promise<T | undefined> => {
    const started = nowIso();
    const s0 = Date.now();
    try {
      const result = await fn();
      steps.push({
        index: steps.length + 1,
        stage,
        status: "OK",
        detail: unavailable ?? "completed",
        startedAt: started,
        endedAt: nowIso(),
        latencyMs: Date.now() - s0,
      });
      return result;
    } catch (err) {
      steps.push({
        index: steps.length + 1,
        stage,
        status: "FAILED",
        detail: err instanceof Error ? err.message : String(err),
        startedAt: started,
        endedAt: nowIso(),
        latencyMs: Date.now() - s0,
      });
      return undefined;
    }
  };

  await step("INPUT_RECEIVED", () => input.text.slice(0, 200));

  const claims = await extractClaims(input.router, input.text, step);
  const verifiable = claims.filter((c) => c.isVerifiable);
  const skippedOpinions = claims.filter((c) => !c.isVerifiable);
  const primary = verifiable[0];

  if (!primary) {
    const graph = emptyGraph(executionId);
    return {
      executionId,
      requestId: input.requestId,
      status: "UNVERIFIED",
      claims,
      skippedOpinions,
      sources: [],
      sourceRelationships: [],
      evidence: [],
      contradictions: [],
      verdict: "UNVERIFIED",
      confidence: computeConfidence({ evidence: [], independentSources: 0, contradictionCount: 0, rawModelConfidence: null }),
      explanation: explain("No factual claim extracted.", [], [], [], "UNVERIFIED", "Input contained only opinion/normative/unverifiable statements or empty text."),
      rounds: [],
      graph,
      steps,
      searchNotes: ["No verifiable claim"],
    };
  }

  let hits: SearchHit[] = [];
  const wiki = await wikipediaSearch(primary.normalizedClaim, input.config.timeoutMs, 5);
  if (wiki.status !== "OK") {
    searchNotes.push(`wikipedia:${wiki.status}:${wiki.error ?? ""}`);
    await step("EVIDENCE_SEARCH", () => wiki.status, wiki.error ?? wiki.status);
    steps[steps.length - 1].status = wiki.status === "TIMEOUT" ? "FAILED" : "UNAVAILABLE";
  } else {
    hits.push(...wiki.hits);
    await step("EVIDENCE_SEARCH", () => `wikipedia hits=${wiki.hits.length}`);
  }

  const web = await optionalWebSearch(primary.normalizedClaim, input.env, input.config.timeoutMs);
  searchNotes.push(`web_search:${web.status}:${web.error ?? ""}`);
  if (web.status === "OK") hits.push(...web.hits);

  hits = dedupeHits(hits).slice(0, input.config.maxEvidence);

  let sources = hits.map(sourceFromHit);
  let relationships = detectSourceRelationships(sources);
  let evidence = hitsToEvidence(primary, sources, input.config.asOf);
  evidence = markExpired(evidence, input.config.asOf);
  let contradictions = findContradictions(evidence);

  let { verdict, reason } = decideVerdict({
    verifiable: true,
    evidence,
    contradictions,
    sources,
    searchStatus: hits.length ? "OK" : wiki.status,
  });
  let confidence = computeConfidence({
    evidence,
    independentSources: independentSourceCount(sources),
    contradictionCount: contradictions.length,
    rawModelConfidence: null,
  });

  const rounds: VerificationRound[] = [
    {
      round: 1,
      reason: "initial",
      verdictBefore: null,
      verdictAfter: verdict,
      confidenceBefore: null,
      confidenceAfter: confidence.finalSystemConfidence,
      newEvidenceIds: evidence.map((e) => e.id),
      selfVerificationDelta: 0,
    },
  ];

  const trigger = shouldSelfVerify({
    round: 1,
    maxRounds: input.config.maxRounds,
    threshold: input.config.selfVerifyThreshold,
    verdict,
    evidenceConfidence: confidence.evidenceConfidence,
    contradictionCount: contradictions.length,
    independentSources: independentSourceCount(sources),
    atomicityUnknown: primary.atomicity === "UNKNOWN" || primary.atomicity === "COMPOUND",
  });

  if (trigger.run) {
    const extraQuery = `${primary.normalizedClaim} criticism OR controversy OR correction`;
    const extra = await wikipediaSearch(extraQuery, input.config.timeoutMs, 3);
    const beforeV = verdict;
    const beforeC = confidence.finalSystemConfidence;
    if (extra.status === "OK") {
      const newHits = dedupeHits([...hits, ...extra.hits]).slice(0, input.config.maxEvidence);
      const added = newHits.filter((h) => !hits.some((x) => x.url === h.url));
      hits = newHits;
      sources = hits.map(sourceFromHit);
      relationships = detectSourceRelationships(sources);
      evidence = hitsToEvidence(primary, sources, input.config.asOf);
      evidence = markExpired(evidence, input.config.asOf);
      contradictions = findContradictions(evidence);
      const decided = decideVerdict({
        verifiable: true,
        evidence,
        contradictions,
        sources,
        searchStatus: "OK",
      });
      verdict = decided.verdict;
      reason = decided.reason;
      confidence = computeConfidence({
        evidence,
        independentSources: independentSourceCount(sources),
        contradictionCount: contradictions.length,
        rawModelConfidence: null,
      });
      rounds.push({
        round: 2,
        reason: trigger.reason,
        verdictBefore: beforeV,
        verdictAfter: verdict,
        confidenceBefore: beforeC,
        confidenceAfter: confidence.finalSystemConfidence,
        newEvidenceIds: added.map((_, i) => evidence[evidence.length - added.length + i]?.id).filter(Boolean) as string[],
        selfVerificationDelta: selfVerificationDelta(beforeC, confidence.finalSystemConfidence),
      });
      await step("SELF_VERIFICATION", () => trigger.reason);
    } else {
      await step("SELF_VERIFICATION", () => `skipped extra search ${extra.status}`);
    }
  } else {
    await step("SELF_VERIFICATION", () => trigger.reason);
    steps[steps.length - 1].status = "SKIPPED";
  }

  const graph = buildVerificationGraph(executionId, primary, evidence, sources, contradictions, verdict);
  const explanation = explain(primary.text, evidence, sources, contradictions, verdict, reason);

  let status: VerificationOutput["status"] = "SUCCESS";
  if (evidence.length === 0) status = "NO_EVIDENCE";
  else if (verdict === "INSUFFICIENT_EVIDENCE") status = "INSUFFICIENT_EVIDENCE";
  else if (verdict === "CONFLICTING_EVIDENCE") status = "CONFLICTING_EVIDENCE";
  else if (wiki.status !== "OK" && evidence.length === 0) status = "TOOL_FAILURE";
  else if (wiki.status !== "OK") status = "PARTIAL_SUCCESS";

  await step("FUSION_READY", () => `elapsed=${Date.now() - t0}ms`);

  return {
    executionId,
    requestId: input.requestId,
    status,
    claims,
    skippedOpinions,
    sources,
    sourceRelationships: relationships,
    evidence,
    contradictions,
    verdict,
    confidence,
    explanation,
    rounds,
    graph,
    steps,
    searchNotes,
  };
}

async function extractClaims(
  router: ModelRouter,
  text: string,
  step: <T>(stage: string, fn: () => Promise<T> | T, d?: string) => Promise<T | undefined>,
): Promise<Claim[]> {
  if (!router.configured()) {
    const claims = extractClaimsHeuristic(text);
    await step("CLAIM_EXTRACTION", () => `HEURISTIC n=${claims.length}`);
    return claims;
  }
  const llm = await router.completeJson("extract", [
    {
      role: "system",
      content:
        "Extract atomic claims as JSON array with fields text, normalizedClaim, claimType (FACTUAL|STATISTICAL|CAUSAL|TEMPORAL|PREDICTIVE|COMPARATIVE|DEFINITIONAL|OPINION|NORMATIVE|UNVERIFIABLE), atomicity (ATOMIC|COMPOUND), entities [{text,kind}], temporalScope, spatialScope. Do not invent facts.",
    },
    { role: "user", content: text },
  ]);
  if (llm.status !== "OK" || !llm.text) {
    const claims = extractClaimsHeuristic(text);
    await step("CLAIM_EXTRACTION", () => `fallback HEURISTIC because ${llm.status}`);
    return claims;
  }
  try {
    const parsed = JSON.parse(llm.text) as unknown;
    const arr = Array.isArray(parsed) ? parsed : (parsed as { claims?: unknown }).claims;
    const claims = parseLlmClaims(arr, text);
    await step("CLAIM_EXTRACTION", () => `LLM n=${claims.length}`);
    return claims;
  } catch {
    const claims = extractClaimsHeuristic(text);
    await step("CLAIM_EXTRACTION", () => "LLM JSON parse failed; HEURISTIC fallback");
    return claims;
  }
}

function hitsToEvidence(claim: Claim, sources: Source[], asOf?: string): Evidence[] {
  return sources.map((source) => {
    const passage = source.snippet || source.title;
    const relevance = lexicalRelevance(claim.normalizedClaim, passage);
    const support = lexicalSupport(claim.normalizedClaim, passage);
    const contradiction = lexicalContradiction(claim.normalizedClaim, passage);
    const provenance: Provenance = {
      pipelineStage: "EVIDENCE_RETRIEVAL",
      producedAt: nowIso(),
      producer: "wikipedia_or_web_search",
      model: null,
      modelVersion: null,
      transformation: "search_snippet_as_evidence",
      notes: `provider=${source.provider}`,
    };
    return {
      id: newId("ev"),
      claimId: claim.id,
      sourceId: source.id,
      content: passage,
      extractedText: passage,
      relevanceScore: relevance,
      supportScore: support,
      contradictionScore: contradiction,
      sourceReliability: source.reliabilityScore,
      independenceScore: source.independenceScore,
      publicationDate: source.publishedAt,
      retrievalDate: source.retrievedAt,
      validFrom: source.publishedAt,
      validUntil: null,
      temporalValidity: temporalValidity(source.publishedAt, asOf),
      evidenceStatus: passage.trim() ? "ACTIVE" : "NONE",
      provenance,
    };
  });
}

function dedupeHits(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const h of hits) {
    if (seen.has(h.url)) continue;
    seen.add(h.url);
    out.push(h);
  }
  return out;
}

function explain(
  checked: string,
  evidence: Evidence[],
  sources: Source[],
  contradictions: Contradiction[],
  verdict: Verdict,
  reason: string,
): Explanation {
  const supporting = evidence.filter((e) => e.supportScore >= 0.25 && e.contradictionScore < 0.25);
  const contradicting = evidence.filter((e) => e.contradictionScore >= 0.25);
  const rel = sources.length ? (sources.reduce((s, x) => s + x.reliabilityScore, 0) / sources.length).toFixed(2) : "n/a";
  const ind = sources.length ? (sources.reduce((s, x) => s + x.independenceScore, 0) / sources.length).toFixed(2) : "n/a";
  const temporal = evidence.map((e) => e.temporalValidity).join(", ") || "no dated evidence";
  return {
    checked,
    supporting: supporting.length ? supporting.map((e) => e.extractedText.slice(0, 180)).join(" | ") : "None",
    contradicting: contradicting.length
      ? contradicting.map((e) => e.extractedText.slice(0, 180)).join(" | ")
      : contradictions.length
        ? contradictions.map((c) => c.explanation).join(" | ")
        : "None",
    sourceReliability: `Mean PARADOX reliability heuristic: ${rel}`,
    sourceIndependence: `Mean independence heuristic: ${ind}; relationships detected where overlap is high.`,
    temporalContext: temporal,
    uncertainty: evidence.length ? "Lexical matching is a fallback when no LLM relevance judge is configured." : "No external evidence.",
    verdictReason: reason,
  };
}

function emptyGraph(executionId: string): KnowledgeGraph {
  return { id: `g_${executionId}`, graphType: "VERIFICATION", nodes: [], edges: [] };
}

function buildVerificationGraph(
  executionId: string,
  claim: Claim,
  evidence: Evidence[],
  sources: Source[],
  contradictions: Contradiction[],
  verdict: Verdict,
): KnowledgeGraph {
  const nodes = [
    { id: claim.id, kind: "CLAIM" as const, label: claim.normalizedClaim.slice(0, 80), refId: claim.id },
    ...evidence.map((e) => ({ id: e.id, kind: "EVIDENCE" as const, label: e.extractedText.slice(0, 80), refId: e.id })),
    ...sources.map((s) => ({ id: s.id, kind: "SOURCE" as const, label: s.title.slice(0, 80), refId: s.id })),
    { id: `verdict_${executionId}`, kind: "FINDING" as const, label: verdict, refId: executionId },
  ];
  const edges = [
    ...evidence.map((e) => ({
      id: newId("edge"),
      from: e.id,
      to: claim.id,
     kind: e.contradictionScore > e.supportScore ? ("REFUTES" as const) : ("SUPPORTS" as const), provenanceNote: null,    })),
    ...evidence.map((e) => ({
      id: newId("edge"),
      from: e.sourceId,
      to: e.id,
      kind: "DERIVED_FROM" as const,
      provenanceNote: "source→evidence",
    })),
    ...contradictions.map((c) => ({
      id: c.id,
      from: c.leftEvidenceId,
      to: c.rightEvidenceId,
      kind: "CONTRADICTS" as const,
      provenanceNote: c.type,
    })),
    {
      id: newId("edge"),
      from: claim.id,
      to: `verdict_${executionId}`,
      kind: "RESULTS_IN" as const,
      provenanceNote: "verdict_logic",
    },
  ];
  return { id: `g_${executionId}`, graphType: "VERIFICATION", nodes, edges };
}

export { computeConfidence } from "./confidence.js";
export { decideVerdict } from "./verdict.js";
export { shouldSelfVerify, selfVerificationDelta } from "./selfVerify.js";
