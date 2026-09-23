import { brierScore, expectedCalibrationError, type OutcomeRecord } from "@paradox/calibration";

export interface LabeledVerdict {
  predicted: string;
  gold: string;
}

export function precisionRecallF1(rows: LabeledVerdict[], positive = "SUPPORTED") {
  if (!rows.length) {
    return { precision: null, recall: null, f1: null, n: 0, note: "No labeled evaluation rows." };
  }
  let tp = 0, fp = 0, fn = 0;
  for (const r of rows) {
    if (r.predicted === positive && r.gold === positive) tp += 1;
    if (r.predicted === positive && r.gold !== positive) fp += 1;
    if (r.predicted !== positive && r.gold === positive) fn += 1;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1, n: rows.length, note: null as string | null };
}

export function evaluationDashboard(input: {
  labeled: LabeledVerdict[];
  outcomes: OutcomeRecord[];
  retrievalAttempts: number;
  retrievalSuccesses: number;
  failures: number;
  total: number;
  latencies: number[];
}) {
  const pr = precisionRecallF1(input.labeled);
  const avgLatency = input.latencies.length
    ? Math.round(input.latencies.reduce((a, b) => a + b, 0) / input.latencies.length)
    : null;
  return {
    precision: pr.precision,
    recall: pr.recall,
    f1: pr.f1,
    labeledN: pr.n,
    brier: brierScore(input.outcomes),
    ece: expectedCalibrationError(input.outcomes),
    retrievalSuccessRate:
      input.retrievalAttempts === 0 ? null : Math.round((input.retrievalSuccesses / input.retrievalAttempts) * 100) / 100,
    failureRate: input.total === 0 ? null : Math.round((input.failures / input.total) * 100) / 100,
    latencyMsAvg: avgLatency,
    note: "Null metrics mean no evaluation/outcome data yet — values are not fabricated.",
  };
}
