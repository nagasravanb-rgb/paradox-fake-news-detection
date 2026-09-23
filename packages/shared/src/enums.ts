export const SYSTEM_METRIC_NOTICE =
  "PARADOX system-defined metric. Not an academically validated statistical estimator.";

export const ERROR_STATES = [
  "SUCCESS",
  "PARTIAL_SUCCESS",
  "NO_EVIDENCE",
  "INSUFFICIENT_EVIDENCE",
  "CONFLICTING_EVIDENCE",
  "TOOL_FAILURE",
  "MODEL_FAILURE",
  "TIMEOUT",
  "UNSUPPORTED_MODALITY",
  "VALIDATION_ERROR",
  "NOT_CONFIGURED",
  "UNAVAILABLE",
  "REQUIRES_PROVIDER",
  "REQUIRES_CREDENTIAL",
  "UNVERIFIED",
] as const;

export type ErrorState = (typeof ERROR_STATES)[number];

export const CLAIM_TYPES = [
  "FACTUAL",
  "STATISTICAL",
  "CAUSAL",
  "TEMPORAL",
  "PREDICTIVE",
  "COMPARATIVE",
  "DEFINITIONAL",
  "OPINION",
  "NORMATIVE",
  "UNVERIFIABLE",
] as const;

export type ClaimType = (typeof CLAIM_TYPES)[number];

export const VERDICTS = [
  "SUPPORTED",
  "REFUTED",
  "MISLEADING",
  "PARTIALLY_SUPPORTED",
  "UNVERIFIED",
  "INSUFFICIENT_EVIDENCE",
  "CONFLICTING_EVIDENCE",
] as const;

export type Verdict = (typeof VERDICTS)[number];

export const EVIDENCE_STATUSES = [
  "ACTIVE",
  "UPDATED",
  "SUPERSEDED",
  "CONTRADICTED",
  "EXPIRED",
  "UNKNOWN",
  "NONE",
] as const;

export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const SOURCE_RELATIONSHIPS = [
  "ORIGINAL",
  "SYNDICATED",
  "DERIVED",
  "QUOTING",
  "REPOST",
  "UNKNOWN",
] as const;

export type SourceRelationshipType = (typeof SOURCE_RELATIONSHIPS)[number];

export const CONTRADICTION_TYPES = [
  "DIRECT",
  "NUMERICAL",
  "TEMPORAL",
  "CONTEXTUAL",
  "ENTITY_MISMATCH",
  "DEFINITION_MISMATCH",
  "PARTIAL",
] as const;

export type ContradictionType = (typeof CONTRADICTION_TYPES)[number];

export const MODALITIES = ["TEXT", "IMAGE", "AUDIO", "VIDEO"] as const;
export type Modality = (typeof MODALITIES)[number];

export const NODE_KINDS = [
  "CLAIM",
  "EVIDENCE",
  "SOURCE",
  "ENTITY",
  "EVENT",
  "SITUATION",
  "SCENARIO",
  "DECISION",
  "OUTCOME",
  "QUESTION",
  "FINDING",
  "OPTION",
  "FACTOR",
  "ACTOR",
  "DRIVER",
  "RISK",
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const EDGE_KINDS = [
  "SUPPORTS",
  "REFUTES",
  "CONTRADICTS",
  "DERIVED_FROM",
  "QUOTES",
  "RELATED_TO",
  "PRECEDES",
  "CAUSES",
  "DEPENDS_ON",
  "SUPERSEDES",
  "UPDATES",
  "RESULTS_IN",
] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

export const OBSERVATION_MODES = ["OBSERVED", "INFERRED", "PREDICTED"] as const;
export type ObservationMode = (typeof OBSERVATION_MODES)[number];

export const SCENARIO_KINDS = ["BASELINE", "OPTIMISTIC", "ADVERSE", "ALTERNATIVE"] as const;
export type ScenarioKind = (typeof SCENARIO_KINDS)[number];

export const PIPELINE_ENGINES = ["VERIFICATION", "RESEARCH", "SITUATION", "DECISION"] as const;
export type PipelineEngine = (typeof PIPELINE_ENGINES)[number];
