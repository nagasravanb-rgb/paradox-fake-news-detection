import { useState } from "react";
import { api } from "../lib/api";
import { GraphView, StatusBadge } from "../components/ui";

export function SituationPage() {
  const [description, setDescription] = useState("France tourism infrastructure around Paris landmarks in 2026.");
  const [r, setR] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null);
    try {
      setR(await api("/api/v1/situation", { method: "POST", body: JSON.stringify({ description }) }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2">Situation</h2>
      <p className="text-sm mb-2">Modes: OBSERVED vs INFERRED vs PREDICTED are labeled. Scenarios are not facts.</p>
      <textarea className="w-full border border-line p-3 min-h-[100px]" value={description} onChange={(e) => setDescription(e.target.value)} />
      <button className="mt-2 bg-accent text-white px-4 py-2 text-sm" onClick={run}>
        Analyze situation
      </button>
      {err ? <p className="text-danger text-sm">{err}</p> : null}
      {r ? (
        <div className="mt-4 space-y-3 text-sm">
          <StatusBadge status={r.status} />
          <p>{r.currentState}</p>
          <List title="Actors" items={r.actors?.map((a: any) => `${a.name} [${a.mode}]`)} />
          <List title="Events" items={r.events?.map((a: any) => `${a.text} [${a.mode}]`)} />
          <List title="Drivers" items={r.drivers?.map((a: any) => `${a.text} [${a.mode}]`)} />
          <List title="Risks" items={r.risks?.map((a: any) => `${a.text} [${a.mode}]`)} />
          <h3 className="font-medium">Scenarios</h3>
          {r.scenarios?.map((s: any) => (
            <div key={s.id} className="border border-line p-2 bg-white">
              <strong>{s.kind}</strong>
              <div>{s.probabilityLabel}</div>
              <div>Uncertainty: {s.uncertainty}</div>
            </div>
          ))}
          <GraphView nodes={r.graph?.nodes ?? []} edges={r.graph?.edges ?? []} />
        </div>
      ) : null}
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="font-medium">{title}</h3>
      <ul className="list-disc ml-5">{(items ?? []).map((x) => <li key={x}>{x}</li>)}</ul>
    </section>
  );
}
