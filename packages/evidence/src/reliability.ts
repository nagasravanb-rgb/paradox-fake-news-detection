import { clamp01, hostnameOf, type Source } from "@paradox/shared";
import type { SearchHit } from "@paradox/providers";
import { newId, nowIso } from "@paradox/shared";

/**
 * PARADOX source reliability is a transparent weighted heuristic.
 * It is not a claim of ground-truth trustworthiness.
 */
export function scoreSourceReliability(input: {
  url: string | null;
  title: string;
  snippet: string;
  publishedAt: string | null;
  provider: string;
}): {
  sourceType: Source["sourceType"];
  authorityScore: number;
  transparencyScore: number;
  reliabilityScore: number;
  primaryVsSecondary: Source["primaryVsSecondary"];
} {
  const host = hostnameOf(input.url) ?? "";
  let sourceType: Source["sourceType"] = "UNKNOWN";
  let authority = 0.35;
  let primaryVsSecondary: Source["primaryVsSecondary"] = "UNKNOWN";

  if (host.endsWith(".gov") || host.endsWith(".gov.uk")) {
    sourceType = "GOVERNMENT";
    authority = 0.78;
    primaryVsSecondary = "PRIMARY";
  } else if (host.endsWith(".edu") || host.includes("arxiv.org") || host.includes("nih.gov")) {
    sourceType = "ACADEMIC";
    authority = 0.72;
    primaryVsSecondary = "SECONDARY";
  } else if (host.includes("wikipedia.org")) {
    sourceType = "ENCYCLOPEDIA";
    authority = 0.62;
    primaryVsSecondary = "SECONDARY";
  } else if (/\.(org|int)$/.test(host)) {
    sourceType = "SECONDARY";
    authority = 0.5;
  }

  const hasDate = Boolean(input.publishedAt);
  const hasTitle = input.title.trim().length > 8;
  const hasSnippet = input.snippet.trim().length > 40;
  const transparency = clamp01((Number(hasDate) + Number(hasTitle) + Number(hasSnippet)) / 3);

  let recency = 0.5;
  if (input.publishedAt) {
    const ageYears = (Date.now() - Date.parse(input.publishedAt)) / (365.25 * 24 * 3600 * 1000);
    if (!Number.isNaN(ageYears)) recency = clamp01(1 - ageYears / 20);
  }

  const reliability = clamp01(0.45 * authority + 0.25 * transparency + 0.3 * recency);
  return { sourceType, authorityScore: authority, transparencyScore: transparency, reliabilityScore: reliability, primaryVsSecondary };
}

export function sourceFromHit(hit: SearchHit): Source {
  const scored = scoreSourceReliability(hit);
  return {
    id: newId("src"),
    url: hit.url,
    title: hit.title,
    snippet: hit.snippet,
    sourceType: scored.sourceType,
    retrievedAt: nowIso(),
    publishedAt: hit.publishedAt,
    authorityScore: scored.authorityScore,
    transparencyScore: scored.transparencyScore,
    reliabilityScore: scored.reliabilityScore,
    independenceScore: 1,
    primaryVsSecondary: scored.primaryVsSecondary,
    conflictOfInterest: "UNKNOWN",
    provider: hit.provider,
  };
}
