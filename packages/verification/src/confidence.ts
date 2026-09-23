import { SYSTEM_METRIC_NOTICE, clamp01, roundMetric, type ConfidenceRecord, type Evidence } from "@paradox/shared";
import { evidenceStrength } from "@paradox/evidence";

export function computeConfidence(input: {
  evidence: Evidence[];
  independentSources: number;
  contradictionCount: number;
  rawModelConfidence: number | null;
}): ConfidenceRecord {
  const ev = evidenceStrength(input.evidence);
  const independenceBoost = clamp01(input.independentSources / 3);
  const contradictionPenalty = clamp01(input.contradictionCount * 0.15);
  const finalSystemConfidence = roundMetric(clamp01(0.65 * ev + 0.25 * independenceBoost - contradictionPenalty));
  return {
    rawModelConfidence: input.rawModelConfidence,
    evidenceConfidence: roundMetric(ev),
    finalSystemConfidence,
    calibratedConfidence: null,
    calibrationState: "UNCALIBRATED",
    formulaNotes: [
      SYSTEM_METRIC_NOTICE,
      "evidenceConfidence = weighted mean of relevance × reliability × independence × support, plus source diversity.",
      "finalSystemConfidence = 0.65*evidenceConfidence + 0.25*min(independentSources/3,1) − 0.15*contradictionCount, clamped 0–1, rounded to 2 decimals.",
      "calibratedConfidence is null until outcome records exist.",
      "rawModelConfidence is model self-report only and is never treated as evidence strength.",
    ],
  };
}
