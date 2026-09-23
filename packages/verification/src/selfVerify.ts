import type { Verdict } from "@paradox/shared";

export function shouldSelfVerify(input: {
  round: number;
  maxRounds: number;
  threshold: number;
  verdict: Verdict;
  evidenceConfidence: number;
  contradictionCount: number;
  independentSources: number;
  atomicityUnknown: boolean;
}): { run: boolean; reason: string } {
  if (input.round >= input.maxRounds) {
    return { run: false, reason: "MAX_VERIFICATION_ROUNDS reached" };
  }
  if (input.verdict === "CONFLICTING_EVIDENCE") {
    return { run: true, reason: "Conflicting evidence" };
  }
  if (input.evidenceConfidence < input.threshold && input.verdict !== "INSUFFICIENT_EVIDENCE") {
    return { run: true, reason: "Evidence confidence below SELF_VERIFY_THRESHOLD" };
  }
  if (input.independentSources < 1 && input.verdict === "SUPPORTED") {
    return { run: true, reason: "High-impact supported verdict without independent sources" };
  }
  if (input.atomicityUnknown) {
    return { run: true, reason: "Uncertain claim decomposition" };
  }
  if (input.contradictionCount > 0 && input.evidenceConfidence < 0.8) {
    return { run: true, reason: "Contradiction present" };
  }
  return { run: false, reason: "No self-verification trigger" };
}

export function selfVerificationDelta(before: number, after: number): number {
  return Math.round((after - before) * 100) / 100;
}
