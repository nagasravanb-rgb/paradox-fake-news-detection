import type { Evidence } from "@paradox/shared";

export function temporalValidity(
  publishedAt: string | null,
  asOfIso: string | undefined,
): Evidence["temporalValidity"] {
  if (!publishedAt) return "UNKNOWN";
  const pub = Date.parse(publishedAt);
  if (Number.isNaN(pub)) return "UNKNOWN";
  const asOf = asOfIso ? Date.parse(asOfIso) : Date.now();
  if (Number.isNaN(asOf)) return "UNKNOWN";
  const ageMs = asOf - pub;
  const years = ageMs / (365.25 * 24 * 3600 * 1000);
  if (years < 0) return "UNKNOWN";
  if (years > 8) return "HISTORICAL";
  return "CURRENT";
}

export function markExpired(evidence: Evidence[], asOfIso?: string): Evidence[] {
  return evidence.map((e) => {
    const validity = temporalValidity(e.publicationDate, asOfIso);
    return {
      ...e,
      temporalValidity: validity,
      evidenceStatus: validity === "EXPIRED" ? "EXPIRED" : e.evidenceStatus,
    };
  });
}
