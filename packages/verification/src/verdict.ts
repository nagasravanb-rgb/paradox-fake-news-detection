import { SYSTEM_METRIC_NOTICE, type Verdict } from "@paradox/shared";
import { evidenceStrength, independentSourceCount } from "@paradox/evidence";
import type { Contradiction, Evidence, Source } from "@paradox/shared";

export function decideVerdict(input: {
  verifiable: boolean;
  evidence: Evidence[];
  contradictions: Contradiction[];
  sources: Source[];
  searchStatus: string;
}): { verdict: Verdict; reason: string } {
  if (!input.verifiable) {
    return { verdict: "UNVERIFIED", reason: "Claim is opinion, normative, or unverifiable — not treated as a factual check." };
  }
  if (input.searchStatus === "NOT_CONFIGURED" && input.evidence.length === 0) {
    return { verdict: "UNVERIFIED", reason: "No evidence retrieved (search unconfigured or empty)." };
  }
  const active = input.evidence.filter((e) => e.evidenceStatus !== "NONE");
  if (active.length === 0) {
    return { verdict: "INSUFFICIENT_EVIDENCE", reason: "Evidence status is NONE — no externally retrieved support." };
  }

 const support = Math.max(
  ...active.map((e) => e.supportScore * e.relevanceScore * e.sourceReliability * e.independenceScore),
);

const contra = Math.max(
  ...active.map((e) => e.contradictionScore * e.relevanceScore * e.sourceReliability * e.independenceScore),
);
  const strength = evidenceStrength(active);
  const independent = independentSourceCount(input.sources);
  const hasHardContra = input.contradictions.some((c) => c.score >= 0.6);

  if (hasHardContra && support > 0.25 && contra > 0.25) {
    return { verdict: "CONFLICTING_EVIDENCE", reason: "Independent passages disagree on overlapping content." };
  }
  if (contra > support + 0.15 && contra > 0.35) {
    return { verdict: "REFUTED", reason: "Retrieved passages more strongly contradict than support the claim." };
  }
  if (support > 0.45 && contra < 0.2 && independent >= 1 && strength > 0.35) {
    return { verdict: "SUPPORTED", reason: "Relevant retrieved evidence supports the claim without strong contradiction." };
  }
  if (support > 0.3 && contra > 0.2) {
    return { verdict: "PARTIALLY_SUPPORTED", reason: "Some support exists alongside residual contradiction or weak independence." };
  }
  if (support > 0.25 && contra < 0.15 && (independent < 1 || strength < 0.3)) {
    return { verdict: "MISLEADING", reason: "Limited or dependent sources could overstate support." };
  }
  return { verdict: "INSUFFICIENT_EVIDENCE", reason: "Retrieved material is too weak, off-topic, or thin to support a stronger verdict." };
}

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export { SYSTEM_METRIC_NOTICE };
