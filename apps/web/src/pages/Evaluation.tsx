import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Metric } from "../components/ui";

export function EvaluationPage() {
  const [ev, setEv] = useState<any>(null);
  const [cal, setCal] = useState<any>(null);
  useEffect(() => {
    api("/api/v1/evaluation").then(setEv).catch(() => setEv({ note: "API unavailable" }));
    api("/api/v1/calibration").then(setCal).catch(() => setCal(null));
  }, []);
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2">Evaluation</h2>
      <p className="text-sm mb-4">{ev?.note}</p>
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Precision" value={ev?.precision} />
        <Metric label="Recall" value={ev?.recall} />
        <Metric label="F1" value={ev?.f1} />
        <Metric label="Brier" value={ev?.brier ?? cal?.brier} />
        <Metric label="ECE" value={ev?.ece ?? cal?.ece} />
        <Metric label="Retrieval success" value={ev?.retrievalSuccessRate} />
        <Metric label="Failure rate" value={ev?.failureRate} />
        <Metric label="Labeled n" value={ev?.labeledN} />
        <Metric label="Calibration n" value={cal?.n} />
      </div>
    </div>
  );
}
