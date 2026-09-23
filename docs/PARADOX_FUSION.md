# PARADOX-FUSION

In-process `KnowledgeState` maps of claims, evidence, sources, verdicts, and an append-only event log.

Event types: VERIFICATION_COMPLETED, RESEARCH_COMPLETED, SITUATION_COMPLETED, DECISION_COMPLETED, OUTCOME_RECORDED.

Engines publish after completion; they do not subscribe to each other in a loop. Situation/Decision compose by calling upstream engines once per request.
