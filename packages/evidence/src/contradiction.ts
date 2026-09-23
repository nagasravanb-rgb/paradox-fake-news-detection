import { jaccard, newId, type Contradiction, type Evidence } from "@paradox/shared";

const NEGATION = /\b(not|no|never|false|incorrect|denied|untrue)\b/i;

function numbers(text: string): number[] {
  return (text.match(/\b\d+(\.\d+)?\b/g) ?? []).map(Number).filter((n) => !Number.isNaN(n));
}

function years(text: string): number[] {
  return (text.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number);
}

export function findContradictions(evidence: Evidence[]): Contradiction[] {
  const out: Contradiction[] = [];
  for (let i = 0; i < evidence.length; i++) {
    for (let j = i + 1; j < evidence.length; j++) {
      const a = evidence[i];
      const b = evidence[j];
      const overlap = jaccard(a.extractedText, b.extractedText);
      if (overlap < 0.12) continue;

      const numsA = numbers(a.extractedText);
      const numsB = numbers(b.extractedText);
      if (numsA.length && numsB.length) {
        const mismatch = numsA.some((n) => numsB.every((m) => Math.abs(m - n) / Math.max(1, n) > 0.25));
        if (mismatch && overlap > 0.2) {
          out.push(make(a, b, "NUMERICAL", "Numeric values differ substantially in overlapping context", 0.7));
          continue;
        }
      }

      const ya = years(a.extractedText);
      const yb = years(b.extractedText);
      if (ya.length && yb.length && ya.some((y) => yb.every((z) => z !== y)) && overlap > 0.25) {
        out.push(make(a, b, "TEMPORAL", "Year/date references disagree", 0.55));
        continue;
      }

      const negA = NEGATION.test(a.extractedText);
      const negB = NEGATION.test(b.extractedText);
      if (negA !== negB && overlap > 0.35) {
        out.push(make(a, b, "DIRECT", "One passage negates overlapping content of the other", 0.65));
        continue;
      }
    }
  }
  return out;
}

function make(
  a: Evidence,
  b: Evidence,
  type: Contradiction["type"],
  explanation: string,
  score: number,
): Contradiction {
  return {
    id: newId("ctr"),
    type,
    leftEvidenceId: a.id,
    rightEvidenceId: b.id,
    explanation,
    score,
  };
}
