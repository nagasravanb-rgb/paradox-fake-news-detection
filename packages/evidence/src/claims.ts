import type { Claim, ClaimType } from "@paradox/shared";
import { CLAIM_TYPES, newId, nowIso } from "@paradox/shared";

const OPINION_CUE = /\b(i think|i believe|in my opinion|should|ought|beautiful|best ever|worst)\b/i;
const NORMATIVE_CUE = /\b(must|should|ought to|it is right|it is wrong|moral)\b/i;
const CAUSAL_CUE = /\b(because|caused|leads to|due to|results in|therefore)\b/i;
const PREDICT_CUE = /\b(will|forecast|expected to|predict|by 20\d{2})\b/i;
const STAT_CUE = /\b(\d+(\.\d+)?%|million|billion|average|rate of)\b/i;
const COMPARE_CUE = /\b(more than|less than|greater than|compared to|versus|vs\.?)\b/i;
const DEFINE_CUE = /\b(is defined as|means|refers to|is a type of)\b/i;
const TEMPORAL_CUE = /\b(in \d{4}|on \d{1,2}\s+\w+|yesterday|today|since|until|before|after)\b/i;
const UNVERIFIABLE_CUE = /\b(soul|destiny|fate|god intends|unknowable)\b/i;

export function classifyClaimType(text: string): ClaimType {
  if (UNVERIFIABLE_CUE.test(text)) return "UNVERIFIABLE";
  if (OPINION_CUE.test(text) && !STAT_CUE.test(text)) return "OPINION";
  if (NORMATIVE_CUE.test(text) && !STAT_CUE.test(text)) return "NORMATIVE";
  if (CAUSAL_CUE.test(text)) return "CAUSAL";
  if (PREDICT_CUE.test(text)) return "PREDICTIVE";
  if (STAT_CUE.test(text)) return "STATISTICAL";
  if (COMPARE_CUE.test(text)) return "COMPARATIVE";
  if (DEFINE_CUE.test(text)) return "DEFINITIONAL";
  if (TEMPORAL_CUE.test(text)) return "TEMPORAL";
  return "FACTUAL";
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

function extractEntities(text: string): Claim["entities"] {
  const entities: Claim["entities"] = [];
  const dates = text.match(/\b(?:\d{4}|January|February|March|April|May|June|July|August|September|October|November|December)\b/g) ?? [];
  for (const d of dates) entities.push({ text: d, kind: "DATE" });
  const qty = text.match(/\b\d+(\.\d+)?%?\b/g) ?? [];
  for (const q of qty) entities.push({ text: q, kind: "QUANTITY" });
  const caps = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) ?? [];
  for (const c of caps.slice(0, 12)) {
    if (!entities.some((e) => e.text === c)) entities.push({ text: c, kind: "OTHER" });
  }
  return entities;
}

export function extractClaimsHeuristic(text: string): Claim[] {
  const sentences = splitSentences(text);
  const units = sentences.length ? sentences : [text.trim()];
  return units.map((sentence) => {
    const claimType = classifyClaimType(sentence);
    const isOpinion = claimType === "OPINION" || claimType === "NORMATIVE";
    const isVerifiable = !isOpinion && claimType !== "UNVERIFIABLE";
    const compound = /\b(and|but|;)\b/i.test(sentence) && sentence.length > 140;
    return {
      id: newId("clm"),
      text: sentence,
      normalizedClaim: sentence.replace(/\s+/g, " ").trim(),
      claimType,
      atomicity: compound ? "COMPOUND" : "ATOMIC",
      entities: extractEntities(sentence),
      temporalScope: sentence.match(/\b(?:in|since|until)?\s*\d{4}\b/)?.[0] ?? null,
      spatialScope: null,
      sourceContext: "user_input",
      isOpinion,
      isVerifiable,
      createdAt: nowIso(),
      extractionMethod: "HEURISTIC",
    };
  });
}

export function parseLlmClaims(raw: unknown, fallbackText: string): Claim[] {
  if (!Array.isArray(raw)) return extractClaimsHeuristic(fallbackText);
  const out: Claim[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const text = typeof rec.text === "string" ? rec.text : null;
    if (!text) continue;
    const type = CLAIM_TYPES.includes(rec.claimType as ClaimType)
      ? (rec.claimType as ClaimType)
      : classifyClaimType(text);
    out.push({
      id: newId("clm"),
      text,
      normalizedClaim: typeof rec.normalizedClaim === "string" ? rec.normalizedClaim : text.trim(),
      claimType: type,
      atomicity: rec.atomicity === "COMPOUND" ? "COMPOUND" : "ATOMIC",
      entities: Array.isArray(rec.entities)
        ? rec.entities
            .filter((e) => e && typeof e === "object")
            .map((e) => {
              const ent = e as { text?: string; kind?: string };
              return {
                text: String(ent.text ?? ""),
                kind: (["PERSON", "ORG", "PLACE", "DATE", "QUANTITY", "OTHER"].includes(ent.kind ?? "")
                  ? ent.kind
                  : "OTHER") as Claim["entities"][number]["kind"],
              };
            })
        : extractEntities(text),
      temporalScope: typeof rec.temporalScope === "string" ? rec.temporalScope : null,
      spatialScope: typeof rec.spatialScope === "string" ? rec.spatialScope : null,
      sourceContext: "user_input",
      isOpinion: type === "OPINION" || type === "NORMATIVE",
      isVerifiable: type !== "OPINION" && type !== "NORMATIVE" && type !== "UNVERIFIABLE",
      createdAt: nowIso(),
      extractionMethod: "LLM",
    });
  }
  return out.length ? out : extractClaimsHeuristic(fallbackText);
}
