import { runResearch } from "@paradox/research";
import { ModelRouter } from "@paradox/providers";
import { newId, nowIso, type KnowledgeGraph, type ObservationMode, type ScenarioKind, type TraceStep } from "@paradox/shared";

export interface Actor {
  id: string;
  name: string;
  mode: ObservationMode;
}
export interface SituationEvent {
  id: string;
  text: string;
  mode: ObservationMode;
}
export interface Driver {
  id: string;
  text: string;
  mode: ObservationMode;
}
export interface Risk {
  id: string;
  text: string;
  mode: ObservationMode;
}
export interface Scenario {
  id: string;
  kind: ScenarioKind;
  assumptions: string[];
  drivers: string[];
  probabilityEstimate: number | null;
  probabilityLabel: string;
  confidence: number | null;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  uncertainty: string;
  triggers: string[];
}

export interface SituationResult {
  executionId: string;
  requestId: string;
  status: string;
  currentState: string;
  actors: Actor[];
  events: SituationEvent[];
  constraints: string[];
  drivers: Driver[];
  signals: { text: string; mode: ObservationMode }[];
  dependencies: string[];
  risks: Risk[];
  scenarios: Scenario[];
  uncertainties: string[];
  graph: KnowledgeGraph;
  steps: TraceStep[];
  researchExecutionId: string;
}

const ACTOR_RE = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g;

export async function runSituation(input: {
  description: string;
  requestId: string;
  router: ModelRouter;
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
}): Promise<SituationResult> {
  const research = await runResearch({
    question: input.description,
    requestId: input.requestId,
    router: input.router,
    timeoutMs: input.timeoutMs,
    env: input.env,
  });
  const names = new Set<string>();
  for (const m of input.description.matchAll(ACTOR_RE)) {
    if (m[1] && m[1].length > 3) names.add(m[1]);
  }
  const actors: Actor[] = [...names].slice(0, 8).map((name) => ({
    id: newId("act"),
    name,
    mode: "OBSERVED",
  }));
  const events: SituationEvent[] = research.findings.slice(0, 6).map((text) => ({
    id: newId("evt"),
    text,
    mode: research.sources.length ? "OBSERVED" : "INFERRED",
  }));
  const drivers: Driver[] = research.subquestions.slice(0, 4).map((text) => ({
    id: newId("drv"),
    text,
    mode: "INFERRED",
  }));
  const risks: Risk[] = research.conflicts.length
    ? research.conflicts.map((text) => ({ id: newId("risk"), text, mode: "OBSERVED" as const }))
    : [{ id: newId("risk"), text: "Insufficient independent evidence to bound downside.", mode: "INFERRED" }];

  const scenarios = makeScenarios(research.findings, research.conflicts, research.sources.length > 0);
  const executionId = newId("ex");
  const graph: KnowledgeGraph = {
    id: `g_${executionId}`,
    graphType: "SITUATION",
    nodes: [
      ...actors.map((a) => ({ id: a.id, kind: "ACTOR" as const, label: a.name, refId: a.id })),
      ...events.map((e) => ({ id: e.id, kind: "EVENT" as const, label: e.text.slice(0, 80), refId: e.id })),
      ...drivers.map((d) => ({ id: d.id, kind: "DRIVER" as const, label: d.text.slice(0, 80), refId: d.id })),
      ...risks.map((r) => ({ id: r.id, kind: "RISK" as const, label: r.text.slice(0, 80), refId: r.id })),
      ...scenarios.map((s) => ({ id: s.id, kind: "SCENARIO" as const, label: s.kind, refId: s.id })),
    ],
    edges: [
      ...drivers.flatMap((d) =>
        scenarios.slice(0, 2).map((s) => ({
          id: newId("edge"),
          from: d.id,
          to: s.id,
          kind: "RELATED_TO" as const,
          provenanceNote: "driver→scenario (inferred)",
        })),
      ),
      ...risks.slice(0, 3).map((r) => ({
        id: newId("edge"),
        from: r.id,
        to: scenarios[2]?.id ?? scenarios[0].id,
        kind: "RELATED_TO" as const,
        provenanceNote: "risk→adverse",
      })),
    ],
  };

  return {
    executionId,
    requestId: input.requestId,
    status: research.status,
    currentState: research.executiveSummary,
    actors,
    events,
    constraints: ["Do not treat scenarios as observed facts.", "Probabilities are unlabeled model estimates when present."],
    drivers,
    signals: events.map((e) => ({ text: e.text, mode: e.mode })),
    dependencies: ["Situation structure depends on research retrieval quality."],
    risks,
    scenarios,
    uncertainties: research.uncertainties,
    graph,
    steps: [...research.steps, { index: research.steps.length + 1, stage: "SITUATION_MODEL", status: "OK", detail: "structured", startedAt: nowIso(), endedAt: nowIso(), latencyMs: 0 }],
    researchExecutionId: research.executionId,
  };
}

function makeScenarios(findings: string[], conflicts: string[], hasEvidence: boolean): Scenario[] {
  const kinds: ScenarioKind[] = ["BASELINE", "OPTIMISTIC", "ADVERSE", "ALTERNATIVE"];
  return kinds.map((kind) => ({
    id: newId("scn"),
    kind,
    assumptions: hasEvidence
      ? [`Kind ${kind} assumes retrieved snippets remain relevant.`, "No hidden variables modeled."]
      : ["NO_EVIDENCE — scenario is structural only, not an empirical forecast."],
    drivers: findings.slice(0, 2),
    probabilityEstimate: null,
    probabilityLabel: "NOT_ESTIMATED — no calibrated forecasting model or outcome history.",
    confidence: null,
    supportingEvidence: kind === "ADVERSE" ? conflicts : findings.slice(0, 2),
    contradictingEvidence: kind === "OPTIMISTIC" ? conflicts : [],
    uncertainty: "Scenario probabilities are not claimed as objective frequencies.",
    triggers: kind === "ADVERSE" ? ["New contradicting high-reliability source"] : ["Corroboration by an independent primary source"],
  }));
}
