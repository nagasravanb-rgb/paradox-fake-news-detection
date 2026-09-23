import { runSituation } from "@paradox/situation";
import { ModelRouter } from "@paradox/providers";
import { newId, nowIso, clamp01, type KnowledgeGraph, type TraceStep } from "@paradox/shared";

export interface DecisionFactor {
  id: string;
  name: string;
  weight: number;
  optionScores: Record<string, number>;
  evidenceNote: string;
}

export interface DecisionResult {
  executionId: string;
  requestId: string;
  status: string;
  objective: string;
  options: string[];
  constraints: string[];
  factors: DecisionFactor[];
  recommendation: string | null;
  recommendationConfidence: number | null;
  keyReasons: string[];
  risks: string[];
  tradeoffs: string[];
  changeConditions: string[];
  supportingEvidence: string[];
  unknowns: string[];
  sensitivity: { factor: string; swing: number }[];
  graph: KnowledgeGraph;
  steps: TraceStep[];
  situationExecutionId: string;
}

export async function runDecision(input: {
  objective: string;
  options: string[];
  constraints: string[];
  context?: string;
  requestId: string;
  router: ModelRouter;
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
}): Promise<DecisionResult> {
  const situation = await runSituation({
    description: [input.objective, input.context ?? "", ...input.options].join("\n"),
    requestId: input.requestId,
    router: input.router,
    timeoutMs: input.timeoutMs,
    env: input.env,
  });

  const factorNames = ["evidence_support", "risk", "constraint_fit", "uncertainty_penalty"];
  const factors: DecisionFactor[] = factorNames.map((name) => {
    const weight = name === "evidence_support" ? 0.35 : name === "risk" ? 0.25 : name === "constraint_fit" ? 0.2 : 0.2;
    const optionScores: Record<string, number> = {};
    for (const opt of input.options) {
      const overlap = lexical(input.objective + (input.context ?? ""), opt);
      if (name === "evidence_support") optionScores[opt] = clamp01(overlap + (situation.status === "SUCCESS" ? 0.15 : 0));
      else if (name === "risk") optionScores[opt] = clamp01(1 - situation.risks.length * 0.08);
      else if (name === "constraint_fit") {
        const violated = input.constraints.some((c) => opt.toLowerCase().includes("ignore") && c.length > 0);
        optionScores[opt] = violated ? 0.2 : 0.7;
      } else optionScores[opt] = situation.uncertainties.length ? 0.45 : 0.6;
    }
    return {
      id: newId("fac"),
      name,
      weight,
      optionScores,
      evidenceNote: "PARADOX weighted heuristic — not a utility theorem.",
    };
  });

  const totals = input.options.map((opt) => ({
    opt,
    score: factors.reduce((s, f) => s + f.weight * (f.optionScores[opt] ?? 0), 0),
  }));
  totals.sort((a, b) => b.score - a.score);
  const best = totals[0];
  const hasEvidence = situation.status === "SUCCESS";
  const recommendation = hasEvidence ? best.opt : null;
  const recommendationConfidence = hasEvidence ? Math.round(clamp01(best.score) * 100) / 100 : null;

  const sensitivity = factors.map((f) => {
    const vals = input.options.map((o) => f.optionScores[o] ?? 0);
    return { factor: f.name, swing: Math.round((Math.max(...vals) - Math.min(...vals)) * 100) / 100 };
  });

  const executionId = newId("ex");
  const recNode = newId("rec");
  const graph: KnowledgeGraph = {
    id: `g_${executionId}`,
    graphType: "DECISION",
    nodes: [
      { id: "obj", kind: "DECISION", label: input.objective.slice(0, 80), refId: "obj" },
      ...input.options.map((o, i) => ({ id: `opt_${i}`, kind: "OPTION" as const, label: o.slice(0, 80), refId: `opt_${i}` })),
      ...factors.map((f) => ({ id: f.id, kind: "FACTOR" as const, label: f.name, refId: f.id })),
      { id: recNode, kind: "DECISION", label: recommendation ?? "NO_RECOMMENDATION", refId: recNode },
    ],
    edges: [
      ...input.options.map((_, i) => ({
        id: newId("edge"),
        from: "obj",
        to: `opt_${i}`,
        kind: "RELATED_TO" as const,
        provenanceNote: "option",
      })),
      ...factors.map((f) => ({
        id: newId("edge"),
        from: "obj",
        to: f.id,
        kind: "DEPENDS_ON" as const,
        provenanceNote: "factor",
      })),
      {
        id: newId("edge"),
        from: recommendation ? `opt_${input.options.indexOf(recommendation)}` : "obj",
        to: recNode,
        kind: "RESULTS_IN" as const,
        provenanceNote: hasEvidence ? "weighted_score" : "NO_EVIDENCE",
      },
    ],
  };

  return {
    executionId,
    requestId: input.requestId,
    status: hasEvidence ? "SUCCESS" : "NO_EVIDENCE",
    objective: input.objective,
    options: input.options,
    constraints: input.constraints,
    factors,
    recommendation,
    recommendationConfidence,
    keyReasons: hasEvidence
      ? [`Highest weighted heuristic score: ${best.opt} (${best.score.toFixed(2)}).`]
      : ["No recommendation: situation/research retrieved no evidence."],
    risks: situation.risks.map((r) => r.text),
    tradeoffs: totals.slice(1).map((t) => `${t.opt} trails by ${(best.score - t.score).toFixed(2)}`),
    changeConditions: [
      "A new independent primary source that reverses evidence_support ranking.",
      "A hard constraint violation on the leading option.",
    ],
    supportingEvidence: situation.events.filter((e) => e.mode === "OBSERVED").map((e) => e.text),
    unknowns: situation.uncertainties,
    sensitivity,
    graph,
    steps: [
      ...situation.steps,
      { index: 99, stage: "DECISION_ANALYSIS", status: "OK", detail: hasEvidence ? "scored" : "NO_EVIDENCE", startedAt: nowIso(), endedAt: nowIso(), latencyMs: 0 },
    ],
    situationExecutionId: situation.executionId,
  };
}

function lexical(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\W+/).filter((x) => x.length > 2));
  const tb = new Set(b.toLowerCase().split(/\W+/).filter((x) => x.length > 2));
  let n = 0;
  for (const x of tb) if (ta.has(x)) n += 1;
  return tb.size ? n / tb.size : 0;
}
