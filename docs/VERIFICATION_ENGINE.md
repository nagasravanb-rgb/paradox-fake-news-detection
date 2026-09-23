# Verification engine

Pipeline (deterministic control):

INPUT → CLAIM EXTRACTION (LLM JSON if configured, else HEURISTIC) → DECOMPOSITION/TYPE/ATOMICITY → EVIDENCE RETRIEVAL (Wikipedia + optional web) → SOURCE RELIABILITY/INDEPENDENCE → RELEVANCE (lexical or LLM later) → SUPPORT/CONTRADICTION → TEMPORAL → VERDICT → optional SELF-VERIFY (max 2) → CONFIDENCE → EXPLANATION → GRAPH → FUSION

Verdicts: SUPPORTED, REFUTED, MISLEADING, PARTIALLY_SUPPORTED, UNVERIFIED, INSUFFICIENT_EVIDENCE, CONFLICTING_EVIDENCE.

Self-verify: `SELF_VERIFY_THRESHOLD` (default 0.70), `MAX_VERIFICATION_ROUNDS` (default 2).

Confidence: see formula notes on `ConfidenceRecord.formulaNotes`. Calibrated confidence stays null until outcomes exist.
