import { useState } from "react";
import { api } from "../lib/api";
import { GraphView, Metric, StatusBadge } from "../components/ui";

export function DecisionPage() {
  const [objective, setObjective] = useState("Choose a public landmark briefing source policy");
  const [options, setOptions] = useState("Use encyclopedia summaries\nCommission primary reporting\nDefer until primary sources exist");
  const [constraints, setConstraints] = useState("Do not fabricate citations");
  const [r, setR] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null);
    try {
      setR(
        await api("/api/v1/decision", {
          method: "POST",
          body: JSON.stringify({
            objective,
            options: options.split("\n").map((s) => s.trim()).filter(Boolean),
            constraints: constraints.split("\n").map((s) => s.trim()).filter(Boolean),
          }),
        }),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2">Decision</h2>
      <label className="block text-sm">Objective</label>
      <input className="w-full border border-line p-2 mb-2" value={objective} onChange={(e) => setObjective(e.target.value)} />
      <label className="block text-sm">Options (one per line)</label>
      <textarea className="w-full border border-line p-2 mb-2" value={options} onChange={(e) => setOptions(e.target.value)} />
      <label className="block text-sm">Constraints</label>
      <textarea className="w-full border border-line p-2 mb-2" value={constraints} onChange={(e) => setConstraints(e.target.value)} />
      <button className="bg-accent text-white px-4 py-2 text-sm" onClick={run}>
        Analyze decision
      </button>
      {err ? <p className="text-danger text-sm">{err}</p> : null}
      {r ? (
        <div className="mt-4 space-y-3 text-sm">
          <StatusBadge status={r.status} />
          <Metric label="Recommended option" value={r.recommendation ?? "NO_RECOMMENDATION"} hint="Absent if NO_EVIDENCE" />
          <Metric label="Confidence" value={r.recommendationConfidence ?? "—"} />
          <ul>{r.keyReasons?.map((x: string) => <li key={x}>{x}</li>)}</ul>
          <h3 className="font-medium">Factors</h3>
          <pre className="text-xs border border-line p-2 overflow-auto bg-white">{JSON.stringify(r.factors, null, 2)}</pre>
          <h3 className="font-medium">Risks / tradeoffs / change conditions</h3>
          <ul>{[...(r.risks ?? []), ...(r.tradeoffs ?? []), ...(r.changeConditions ?? [])].map((x: string) => <li key={x}>{x}</li>)}</ul>
          <GraphView nodes={r.graph?.nodes ?? []} edges={r.graph?.edges ?? []} />
        </div>
      ) : null}
    </div>
  );
}
