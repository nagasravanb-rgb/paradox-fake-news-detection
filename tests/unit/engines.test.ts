import { describe, expect, it } from "vitest";
import { classifyClaimType, extractClaimsHeuristic } from "../../packages/evidence/src/claims";
import { detectSourceRelationships } from "../../packages/evidence/src/independence";
import { findContradictions } from "../../packages/evidence/src/contradiction";
import { evidenceStrength } from "../../packages/evidence/src/relevance";
import { decideVerdict } from "../../packages/verification/src/verdict";
import { shouldSelfVerify, selfVerificationDelta } from "../../packages/verification/src/selfVerify";
import { computeConfidence } from "../../packages/verification/src/confidence";
import { claimShiftIndex } from "../../packages/truth-shift/src/index";
import { calibrationSummary } from "../../packages/calibration/src/index";
import { adaptInput } from "../../packages/multimodal/src/index";
import { precisionRecallF1 } from "../../packages/evaluation/src/index";
import { assertSafeUrl } from "../../packages/providers/src/http";
import type { Evidence, Source } from "../../packages/shared/src/index";

function ev(partial: Partial<Evidence> & { id: string; extractedText: string }): Evidence {
  return {
    claimId: "c",
    sourceId: "s",
    content: partial.extractedText,
    relevanceScore: 0.5,
    supportScore: 0.5,
    contradictionScore: 0,
    sourceReliability: 0.5,
    independenceScore: 1,
    publicationDate: null,
    retrievalDate: new Date().toISOString(),
    validFrom: null,
    validUntil: null,
    temporalValidity: "UNKNOWN",
    evidenceStatus: "ACTIVE",
    provenance: {
      pipelineStage: "t",
      producedAt: new Date().toISOString(),
      producer: "test",
      model: null,
      modelVersion: null,
      transformation: "t",
      notes: null,
    },
    ...partial,
  };
}

describe("claim extraction", () => {
  it("does not treat opinions as factual", () => {
    expect(classifyClaimType("I think this is the best city")).toBe("OPINION");
    const claims = extractClaimsHeuristic("I think Paris is lovely. The Eiffel Tower is in Paris.");
    expect(claims.some((c) => c.isOpinion)).toBe(true);
    expect(claims.some((c) => c.isVerifiable)).toBe(true);
  });
});

describe("verdict logic", () => {
  it("does not claim SUPPORTED without evidence", () => {
    const r = decideVerdict({
      verifiable: true,
      evidence: [],
      contradictions: [],
      sources: [],
      searchStatus: "NOT_CONFIGURED",
    });
    expect(r.verdict).toBe("UNVERIFIED");
  });

  it("returns INSUFFICIENT_EVIDENCE when evidence status is empty set", () => {
    const r = decideVerdict({
      verifiable: true,
      evidence: [ev({ id: "e1", extractedText: "x", evidenceStatus: "NONE", supportScore: 0, relevanceScore: 0 })],
      contradictions: [],
      sources: [],
      searchStatus: "OK",
    });
    expect(r.verdict).toBe("INSUFFICIENT_EVIDENCE");
  });
});

describe("source independence", () => {
  it("does not treat duplicate URLs as independent", () => {
    const sources: Source[] = [
      baseSrc("a", "https://example.com/p", "Same title"),
      baseSrc("b", "https://example.com/p", "Same title"),
    ];
     detectSourceRelationships(sources);
    expect(sources.some((s) => s.independenceScore < 1)).toBe(true);
  });
});
    describe("source relationships", () => {
  it("keeps relationship source IDs aligned with the provided sources", () => {
    const sources: Source[] = [
      baseSrc("s1", "https://example.com/a", "Source A"),
      baseSrc("s2", "https://example.org/b", "Source B"),
    ];

    const relationships = detectSourceRelationships(sources);
    const sourceIds = new Set(sources.map((source) => source.id));

    for (const relationship of relationships) {
      expect(sourceIds.has(relationship.fromSourceId)).toBe(true);
      expect(sourceIds.has(relationship.toSourceId)).toBe(true);
    }
  });
});

function baseSrc(id: string, url: string, title: string): Source {
  return {
    id,
    url,
    title,
    snippet: "The same snippet repeated across copies of an article about a topic.",
    sourceType: "UNKNOWN",
    retrievedAt: new Date().toISOString(),
    publishedAt: null,
    authorityScore: 0.4,
    transparencyScore: 0.4,
    reliabilityScore: 0.4,
    independenceScore: 1,
    primaryVsSecondary: "UNKNOWN",
    conflictOfInterest: "UNKNOWN",
    provider: "test",
  };
}

describe("contradictions", () => {
  it("flags numerical mismatch in overlapping text", () => {
    const c = findContradictions([
      ev({ id: "e1", extractedText: "The population is 1000 people in Springfield county." }),
      ev({ id: "e2", extractedText: "The population is 9000 people in Springfield county." }),
    ]);
    expect(c.some((x) => x.type === "NUMERICAL")).toBe(true);
  });
});

describe("self-verification", () => {
  it("is bounded by max rounds", () => {
    const r = shouldSelfVerify({
      round: 2,
      maxRounds: 2,
      threshold: 0.7,
      verdict: "CONFLICTING_EVIDENCE",
      evidenceConfidence: 0.1,
      contradictionCount: 3,
      independentSources: 0,
      atomicityUnknown: true,
    });
    expect(r.run).toBe(false);
  });
  it("computes delta", () => {
    expect(selfVerificationDelta(0.4, 0.6)).toBe(0.2);
  });
});
describe("evidence strength", () => {
  it("does not let irrelevant evidence dilute or inflate strong relevant evidence", () => {
    const strong = ev({
      id: "e1",
      sourceId: "s1",
      extractedText: "The Earth is the third planet from the Sun.",
      relevanceScore: 1,
      supportScore: 1,
      sourceReliability: 1,
      independenceScore: 1,
    });

    const irrelevant = [
      ev({
        id: "e2",
        sourceId: "s2",
        extractedText: "Escape from Planet Earth is an animated film.",
        relevanceScore: 0.02,
        supportScore: 0,
        sourceReliability: 1,
        independenceScore: 1,
      }),
      ev({
        id: "e3",
        sourceId: "s3",
        extractedText: "Kepler's laws describe planetary motion.",
        relevanceScore: 0.05,
        supportScore: 0,
        sourceReliability: 1,
        independenceScore: 1,
      }),
      ev({
        id: "e4",
        sourceId: "s4",
        extractedText: "The IAU defines astronomical terminology.",
        relevanceScore: 0.03,
        supportScore: 0,
        sourceReliability: 1,
        independenceScore: 1,
      }),
    ];

    const strongOnly = evidenceStrength([strong]);
    const withIrrelevant = evidenceStrength([strong, ...irrelevant]);

    expect(strongOnly).toBeCloseTo(0.8,10);
    expect(withIrrelevant).toBeCloseTo(strongOnly, 10);
  });
});
describe("confidence", () => {
  it("keeps model confidence separate and calibrated null", () => {
    const c = computeConfidence({
      evidence: [],
      independentSources: 0,
      contradictionCount: 0,
      rawModelConfidence: 0.99,
    });
    expect(c.rawModelConfidence).toBe(0.99);
    expect(c.evidenceConfidence).toBe(0);
    expect(c.calibratedConfidence).toBeNull();
    expect(c.calibrationState).toBe("UNCALIBRATED");
  });
});

describe("truth-shift", () => {
  it("increases CSI when verdict flips", () => {
    const low = claimShiftIndex({
      beforeVerdict: "UNVERIFIED",
      afterVerdict: "UNVERIFIED",
      beforeEvidenceStrength: 0,
      afterEvidenceStrength: 0,
      newEvidenceCount: 0,
    });
    const high = claimShiftIndex({
      beforeVerdict: "SUPPORTED",
      afterVerdict: "REFUTED",
      beforeEvidenceStrength: 0.8,
      afterEvidenceStrength: 0.2,
      newEvidenceCount: 4,
    });
    expect(high).toBeGreaterThan(low);
  });
});

describe("calibration / eval", () => {
  it("returns null metrics without outcomes", () => {
    expect(calibrationSummary([]).brier).toBeNull();
    expect(precisionRecallF1([]).precision).toBeNull();
  });
});

describe("multimodal", () => {
  it("rejects unimplemented modalities", () => {
    expect(adaptInput("IMAGE", "x").status).toBe("UNSUPPORTED_MODALITY");
  });
});

describe("SSRF", () => {
  it("blocks localhost", async () => {
    await expect(assertSafeUrl("http://localhost/admin")).rejects.toThrow();
    await expect(assertSafeUrl("http://127.0.0.1/")).rejects.toThrow();
  });
});
