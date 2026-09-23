import { SYSTEM_METRIC_NOTICE } from "@paradox/shared";

export interface OutcomeRecord {
  id: string;
  executionId: string;
  predicted: number;
  observed: number;
  recordedAt: string;
}

export function brierScore(records: OutcomeRecord[]): number | null {
  if (!records.length) return null;
  const s = records.reduce((acc, r) => acc + (r.predicted - r.observed) ** 2, 0);
  return Math.round((s / records.length) * 1000) / 1000;
}

export function expectedCalibrationError(records: OutcomeRecord[], bins = 10): number | null {
  if (!records.length) return null;
  const bucket: { n: number; p: number; o: number }[] = Array.from({ length: bins }, () => ({ n: 0, p: 0, o: 0 }));
  for (const r of records) {
    const i = Math.min(bins - 1, Math.max(0, Math.floor(r.predicted * bins)));
    bucket[i].n += 1;
    bucket[i].p += r.predicted;
    bucket[i].o += r.observed;
  }
  let ece = 0;
  const N = records.length;
  for (const b of bucket) {
    if (!b.n) continue;
    ece += (b.n / N) * Math.abs(b.p / b.n - b.o / b.n);
  }
  return Math.round(ece * 1000) / 1000;
}

export function calibrationSummary(records: OutcomeRecord[]) {
  return {
    n: records.length,
    brier: brierScore(records),
    ece: expectedCalibrationError(records),
    note:
      records.length === 0
        ? "INSUFFICIENT_OUTCOMES — metrics are null until real outcomes are recorded."
        : SYSTEM_METRIC_NOTICE,
  };
}
