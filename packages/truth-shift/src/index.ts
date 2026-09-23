import { SYSTEM_METRIC_NOTICE, newId, nowIso, type TruthShiftEvent, type Verdict } from "@paradox/shared";

const VERDICT_RANK: Record<Verdict, number> = {
  SUPPORTED: 3,
  PARTIALLY_SUPPORTED: 2,
  MISLEADING: 1,
  UNVERIFIED: 0,
  INSUFFICIENT_EVIDENCE: 0,
  CONFLICTING_EVIDENCE: -1,
  REFUTED: -3,
};

/**
 * Claim Shift Index (PARADOX-defined):
 * CSI = 0.5*|ΔverdictRank|/6 + 0.3*|ΔevidenceStrength| + 0.2*min(newEvidence/5, 1)
 */
export function claimShiftIndex(input: {
  beforeVerdict: Verdict | null;
  afterVerdict: Verdict | null;
  beforeEvidenceStrength: number;
  afterEvidenceStrength: number;
  newEvidenceCount: number;
}): number {
  const br = input.beforeVerdict ? VERDICT_RANK[input.beforeVerdict] : 0;
  const ar = input.afterVerdict ? VERDICT_RANK[input.afterVerdict] : 0;
  const v = Math.abs(ar - br) / 6;
  const e = Math.abs(input.afterEvidenceStrength - input.beforeEvidenceStrength);
  const n = Math.min(input.newEvidenceCount / 5, 1);
  return Math.round((0.5 * v + 0.3 * e + 0.2 * n) * 100) / 100;
}

export function recordShift(input: {
  claimId: string;
  kind: TruthShiftEvent["kind"];
  summary: string;
  beforeVerdict: Verdict | null;
  afterVerdict: Verdict | null;
  beforeEvidenceStrength: number;
  afterEvidenceStrength: number;
  newEvidenceCount: number;
}): TruthShiftEvent {
  return {
    id: newId("ts"),
    claimId: input.claimId,
    at: nowIso(),
    kind: input.kind,
    summary: `${input.summary} (${SYSTEM_METRIC_NOTICE})`,
    claimShiftIndex: claimShiftIndex(input),
    beforeVerdict: input.beforeVerdict,
    afterVerdict: input.afterVerdict,
  };
}
