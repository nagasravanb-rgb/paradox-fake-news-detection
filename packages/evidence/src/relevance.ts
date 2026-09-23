import { clamp01, jaccard, type Evidence } from "@paradox/shared";

export function lexicalRelevance(claim: string, passage: string): number {
  return clamp01(jaccard(claim, passage));
}

export function lexicalSupport(claim: string, passage: string): number {
  const rel = lexicalRelevance(claim, passage);
  const negated = /\b(not|no|never|false|incorrect|untrue)\b/i.test(passage);
  if (negated) return clamp01(rel * 0.25);
  return rel;
}

export function lexicalContradiction(claim: string, passage: string): number {
  const rel = lexicalRelevance(claim, passage);
  const negated = /\b(not|no|never|false|incorrect|untrue|denied)\b/i.test(passage);
  if (negated && rel > 0.15) return clamp01(0.4 + rel * 0.5);
  return 0;
}

export function evidenceStrength(items: Evidence[]): number {
  if (!items.length) return 0;

  const active = items.filter(
    (e) => e.evidenceStatus !== "NONE" && e.evidenceStatus !== "EXPIRED",
  );

  if (!active.length) return 0;

  const relevant = active.filter((e) => e.relevanceScore >= 0.25);

  if (!relevant.length) return 0;

  const relevanceWeight = relevant.reduce(
    (sum, e) => sum + e.relevanceScore,
    0,
  );

  if (relevanceWeight <= 0) return 0;

  const weightedQuality = relevant.reduce(
    (sum, e) =>
      sum +
      e.relevanceScore *
        e.sourceReliability *
        e.independenceScore *
        e.supportScore,
    0,
  );

  const mean = weightedQuality / relevanceWeight;

  const diversity = Math.min(
    1,
    new Set(relevant.map((e) => e.sourceId)).size / 3,
  );

  return clamp01(0.7 * mean + 0.3 * diversity);
}
