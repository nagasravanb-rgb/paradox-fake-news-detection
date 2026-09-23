# Data model

Prisma models in `apps/api/prisma/schema.prisma`.

Domain objects (Zod): Claim, Evidence, Source, SourceRelationship, VerificationResult (API payload), Research report, Situation, Scenario, Decision, DecisionFactor, KnowledgeNode/Edge, TruthShiftEvent, PipelineExecution, VerificationRound, ConfidenceRecord, Calibration/Outcome records.

IDs are prefixed UUIDs (`clm_`, `ev_`, `ex_`, …). JSON blobs store full typed objects for v1; indexes exist on execution and claim foreign keys.

Fusion graph in memory is process-local; executions are durable.
