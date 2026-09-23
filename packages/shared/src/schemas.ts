import { z } from "zod";
import {
  CLAIM_TYPES,
  CONTRADICTION_TYPES,
  EDGE_KINDS,
  ERROR_STATES,
  EVIDENCE_STATUSES,
  MODALITIES,
  NODE_KINDS,
  OBSERVATION_MODES,
  PIPELINE_ENGINES,
  SCENARIO_KINDS,
  SOURCE_RELATIONSHIPS,
  VERDICTS,
} from "./enums.js";

export const provenanceSchema = z.object({
  pipelineStage: z.string(),
  producedAt: z.string(),
  producer: z.string(),
  model: z.string().nullable(),
  modelVersion: z.string().nullable(),
  transformation: z.string(),
  notes: z.string().nullable(),
});

export type Provenance = z.infer<typeof provenanceSchema>;

export const entityMentionSchema = z.object({
  text: z.string(),
  kind: z.enum(["PERSON", "ORG", "PLACE", "DATE", "QUANTITY", "OTHER"]),
});

export const claimSchema = z.object({
  id: z.string(),
  text: z.string(),
  normalizedClaim: z.string(),
  claimType: z.enum(CLAIM_TYPES),
  atomicity: z.enum(["ATOMIC", "COMPOUND", "UNKNOWN"]),
  entities: z.array(entityMentionSchema),
  temporalScope: z.string().nullable(),
  spatialScope: z.string().nullable(),
  sourceContext: z.string().nullable(),
  isOpinion: z.boolean(),
  isVerifiable: z.boolean(),
  createdAt: z.string(),
  extractionMethod: z.enum(["LLM", "HEURISTIC"]),
});

export type Claim = z.infer<typeof claimSchema>;

export const sourceSchema = z.object({
  id: z.string(),
  url: z.string().nullable(),
  title: z.string(),
  snippet: z.string(),
  sourceType: z.enum(["ENCYCLOPEDIA", "NEWS", "GOVERNMENT", "ACADEMIC", "PRIMARY", "SECONDARY", "UNKNOWN"]),
  retrievedAt: z.string(),
  publishedAt: z.string().nullable(),
  authorityScore: z.number().min(0).max(1),
  transparencyScore: z.number().min(0).max(1),
  reliabilityScore: z.number().min(0).max(1),
  independenceScore: z.number().min(0).max(1),
  primaryVsSecondary: z.enum(["PRIMARY", "SECONDARY", "UNKNOWN"]),
  conflictOfInterest: z.enum(["DETECTED", "NONE_DETECTED", "UNKNOWN"]),
  provider: z.string(),
});

export type Source = z.infer<typeof sourceSchema>;

export const sourceRelationshipSchema = z.object({
  id: z.string(),
  fromSourceId: z.string(),
  toSourceId: z.string(),
  relationship: z.enum(SOURCE_RELATIONSHIPS),
  reason: z.string(),
});

export type SourceRelationship = z.infer<typeof sourceRelationshipSchema>;

export const evidenceSchema = z.object({
  id: z.string(),
  claimId: z.string(),
  sourceId: z.string(),
  content: z.string(),
  extractedText: z.string(),
  relevanceScore: z.number().min(0).max(1),
  supportScore: z.number().min(0).max(1),
  contradictionScore: z.number().min(0).max(1),
  sourceReliability: z.number().min(0).max(1),
  independenceScore: z.number().min(0).max(1),
  publicationDate: z.string().nullable(),
  retrievalDate: z.string(),
  validFrom: z.string().nullable(),
  validUntil: z.string().nullable(),
  temporalValidity: z.enum(["CURRENT", "HISTORICAL", "EXPIRED", "UNKNOWN"]),
  evidenceStatus: z.enum(EVIDENCE_STATUSES),
  provenance: provenanceSchema,
});

export type Evidence = z.infer<typeof evidenceSchema>;

export const contradictionSchema = z.object({
  id: z.string(),
  type: z.enum(CONTRADICTION_TYPES),
  leftEvidenceId: z.string(),
  rightEvidenceId: z.string(),
  explanation: z.string(),
  score: z.number().min(0).max(1),
});

export type Contradiction = z.infer<typeof contradictionSchema>;

export const confidenceRecordSchema = z.object({
  rawModelConfidence: z.number().nullable(),
  evidenceConfidence: z.number(),
  finalSystemConfidence: z.number(),
  calibratedConfidence: z.number().nullable(),
  calibrationState: z.enum(["UNCALIBRATED", "INSUFFICIENT_OUTCOMES", "CALIBRATED"]),
  formulaNotes: z.array(z.string()),
});

export type ConfidenceRecord = z.infer<typeof confidenceRecordSchema>;

export const verificationRoundSchema = z.object({
  round: z.number().int().positive(),
  reason: z.string(),
  verdictBefore: z.enum(VERDICTS).nullable(),
  verdictAfter: z.enum(VERDICTS),
  confidenceBefore: z.number().nullable(),
  confidenceAfter: z.number(),
  newEvidenceIds: z.array(z.string()),
  selfVerificationDelta: z.number(),
});

export type VerificationRound = z.infer<typeof verificationRoundSchema>;

export const explanationSchema = z.object({
  checked: z.string(),
  supporting: z.string(),
  contradicting: z.string(),
  sourceReliability: z.string(),
  sourceIndependence: z.string(),
  temporalContext: z.string(),
  uncertainty: z.string(),
  verdictReason: z.string(),
});

export type Explanation = z.infer<typeof explanationSchema>;

export const graphNodeSchema = z.object({
  id: z.string(),
  kind: z.enum(NODE_KINDS),
  label: z.string(),
  refId: z.string(),
});

export const graphEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  kind: z.enum(EDGE_KINDS),
  provenanceNote: z.string().nullable(),
});

export const knowledgeGraphSchema = z.object({
  id: z.string(),
  graphType: z.enum(["VERIFICATION", "RESEARCH", "SITUATION", "DECISION", "FUSION"]),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

export type KnowledgeGraph = z.infer<typeof knowledgeGraphSchema>;

export const traceStepSchema = z.object({
  index: z.number(),
  stage: z.string(),
  status: z.enum(["OK", "SKIPPED", "FAILED", "UNAVAILABLE"]),
  detail: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  latencyMs: z.number(),
});

export type TraceStep = z.infer<typeof traceStepSchema>;

export const pipelineExecutionSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  engine: z.enum(PIPELINE_ENGINES),
  status: z.enum(ERROR_STATES),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
  steps: z.array(traceStepSchema),
});

export type PipelineExecution = z.infer<typeof pipelineExecutionSchema>;

export const verifyRequestSchema = z.object({
  text: z.string().min(1).max(20000),
  modality: z.enum(MODALITIES).default("TEXT"),
  asOf: z.string().datetime().optional(),
});

export const researchRequestSchema = z.object({
  question: z.string().min(1).max(8000),
});

export const situationRequestSchema = z.object({
  description: z.string().min(1).max(20000),
});

export const decisionRequestSchema = z.object({
  objective: z.string().min(1).max(4000),
  options: z.array(z.string().min(1)).min(1).max(12),
  constraints: z.array(z.string()).default([]),
  context: z.string().max(20000).optional(),
});

export const truthShiftEventSchema = z.object({
  id: z.string(),
  claimId: z.string(),
  at: z.string(),
  kind: z.enum(["CREATED", "EVIDENCE_ADDED", "VERDICT_CHANGED", "SUPERSEDED", "CORRECTED", "CONTEXT_CHANGED"]),
  summary: z.string(),
  claimShiftIndex: z.number(),
  beforeVerdict: z.enum(VERDICTS).nullable(),
  afterVerdict: z.enum(VERDICTS).nullable(),
});

export type TruthShiftEvent = z.infer<typeof truthShiftEventSchema>;
