import { newId, nowIso, type Claim, type Evidence, type KnowledgeGraph, type Source, type Verdict } from "@paradox/shared";

export type FusionEventType =
  | "VERIFICATION_COMPLETED"
  | "RESEARCH_COMPLETED"
  | "SITUATION_COMPLETED"
  | "DECISION_COMPLETED"
  | "OUTCOME_RECORDED";

export interface FusionEvent {
  id: string;
  type: FusionEventType;
  executionId: string;
  at: string;
  payload: unknown;
}

export interface KnowledgeState {
  claims: Map<string, Claim>;
  evidence: Map<string, Evidence>;
  sources: Map<string, Source>;
  verdicts: Map<string, Verdict>;
  events: FusionEvent[];
}

export function createKnowledgeState(): KnowledgeState {
  return {
    claims: new Map(),
    evidence: new Map(),
    sources: new Map(),
    verdicts: new Map(),
    events: [],
  };
}

export function applyFusionEvent(state: KnowledgeState, type: FusionEventType, executionId: string, payload: unknown): FusionEvent {
  const event: FusionEvent = { id: newId("fus"), type, executionId, at: nowIso(), payload };
  state.events.push(event);
  if (payload && typeof payload === "object") {
    const p = payload as {
      claims?: Claim[];
      evidence?: Evidence[];
      sources?: Source[];
      verdict?: Verdict | null;
    };
    for (const c of p.claims ?? []) state.claims.set(c.id, c);
    for (const e of p.evidence ?? []) state.evidence.set(e.id, e);
    for (const s of p.sources ?? []) state.sources.set(s.id, s);
    if (p.verdict && p.claims?.[0]) state.verdicts.set(p.claims[0].id, p.verdict);
  }
  return event;
}

export function fusionSnapshot(state: KnowledgeState): {
  claimCount: number;
  evidenceCount: number;
  sourceCount: number;
  eventCount: number;
} {
  return {
    claimCount: state.claims.size,
    evidenceCount: state.evidence.size,
    sourceCount: state.sources.size,
    eventCount: state.events.length,
  };
}

export function fusionGraph(state: KnowledgeState): KnowledgeGraph {
  const nodes = [
    ...[...state.claims.values()].map((c) => ({ id: c.id, kind: "CLAIM" as const, label: c.normalizedClaim.slice(0, 80), refId: c.id })),
    ...[...state.evidence.values()].map((e) => ({ id: e.id, kind: "EVIDENCE" as const, label: e.extractedText.slice(0, 80), refId: e.id })),
    ...[...state.sources.values()].map((s) => ({ id: s.id, kind: "SOURCE" as const, label: s.title.slice(0, 80), refId: s.id })),
  ];
  const edges = [...state.evidence.values()].map((e) => ({
    id: newId("edge"),
    from: e.id,
    to: e.claimId,
    kind: "SUPPORTS" as const,
    provenanceNote: "fusion_index",
  }));
  return { id: newId("gfus"), graphType: "FUSION", nodes, edges };
}
