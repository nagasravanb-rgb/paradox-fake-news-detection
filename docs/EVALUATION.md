# Evaluation

Metrics (Precision, Recall, F1, Brier, ECE, retrieval success, failure rate, latency) are computed only from stored labels and outcomes.

`GET /api/v1/evaluation` returns `null` fields when n=0. Do not display invented benchmarks.

Add gold labels via `EvalLabel` rows and outcomes via `POST /api/v1/outcomes`.
