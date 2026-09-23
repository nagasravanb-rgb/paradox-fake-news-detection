
import {
  hostnameOf,
  jaccard,
  normalizeUrl,
  newId,
  type Source,
  type SourceRelationship,
} from "@paradox/shared";

export function detectSourceRelationships(
  sources: Source[],
): SourceRelationship[] {
  const rels: SourceRelationship[] = [];

  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const a = sources[i];
      const b = sources[j];

      const rel = classifyPair(a, b);

      if (rel) {
        rels.push({
          id: newId("srel"),
          fromSourceId: a.id,
          toSourceId: b.id,
          relationship: rel.relationship,
          reason: rel.reason,
        });
      }
    }
  }

  applyIndependence(sources, rels);

  return rels;
}

function classifyPair(
  a: Source,
  b: Source,
): {
  relationship: SourceRelationship["relationship"];
  reason: string;
} | null {
  // Same normalized URL = repost
  if (a.url && b.url && normalizeUrl(a.url) === normalizeUrl(b.url)) {
    return {
      relationship: "REPOST",
      reason: "Identical normalized URL",
    };
  }

  const ha = hostnameOf(a.url);
  const hb = hostnameOf(b.url);

  const titleSim = jaccard(a.title, b.title);
  const snippetSim = jaccard(a.snippet, b.snippet);

  // Same host + nearly identical title = repost
  if (ha && hb && ha === hb && titleSim > 0.8) {
    return {
      relationship: "REPOST",
      reason: "Same host and near-identical title",
    };
  }

  // Very high title/snippet similarity = syndicated
  if (snippetSim > 0.85 && titleSim > 0.6) {
    return {
      relationship: "SYNDICATED",
      reason: "Near-duplicate title and snippet across sources",
    };
  }

  // Moderate/high overlap = derived
  if (snippetSim > 0.55 && titleSim > 0.4) {
    return {
      relationship: "DERIVED",
      reason: "High lexical overlap suggesting derivation",
    };
  }

  return null;
}

function applyIndependence(
  sources: Source[],
  rels: SourceRelationship[],
): void {
  const dep = new Map<string, number>();

  // Every supplied source starts with zero dependency.
  for (const source of sources) {
    dep.set(source.id, 0);
  }

  // Relationships must always reference the original source IDs.
  for (const relationship of rels) {
    if (
      relationship.relationship === "REPOST" ||
      relationship.relationship === "SYNDICATED" ||
      relationship.relationship === "DERIVED"
    ) {
      dep.set(
        relationship.toSourceId,
        (dep.get(relationship.toSourceId) ?? 0) + 1,
      );

      dep.set(
        relationship.fromSourceId,
        (dep.get(relationship.fromSourceId) ?? 0) + 0.5,
      );
    }
  }

  // Convert dependency count into an independence score.
  for (const source of sources) {
    const d = dep.get(source.id) ?? 0;

    source.independenceScore = Math.max(0.15, 1 / (1 + d));
  }
}

export function independentSourceCount(sources: Source[]): number {
  const seen = new Set<string>();
  let n = 0;

  for (const source of sources) {
    const key = hostnameOf(source.url) ?? source.id;

    if (source.independenceScore < 0.4) {
      continue;
    }

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    n += 1;
  }

  return n;
}
