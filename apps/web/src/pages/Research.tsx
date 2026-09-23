import { useState } from "react";
import { api } from "../lib/api";
import { GraphView, StatusBadge } from "../components/ui";

export function ResearchPage() {
  const [question, setQuestion] = useState("What is known about the location of the Eiffel Tower?");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [r, setR] = useState<any>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      setR(await api("/api/v1/research", { method: "POST", body: JSON.stringify({ question }) }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2">Research</h2>
      <textarea className="w-full border border-line p-3 min-h-[100px]" value={question} onChange={(e) => setQuestion(e.target.value)} />
      <button className="mt-2 bg-accent text-white px-4 py-2 text-sm" disabled={loading} onClick={run}>
        {loading ? "Researching…" : "Run research"}
      </button>
      {err ? <p className="text-danger text-sm mt-2">{err}</p> : null}
      {r ? (
        <div className="mt-6 space-y-4 text-sm">
          <StatusBadge status={r.status} />
          <h3 className="font-medium">Executive summary</h3>
          <p>{r.executiveSummary}</p>
          <h3 className="font-medium">Plan</h3>
          <ol className="list-decimal ml-5">{r.plan?.map((p: string) => <li key={p}>{p}</li>)}</ol>
          <h3 className="font-medium">Subquestions</h3>
          <ul className="list-disc ml-5">{r.subquestions?.map((p: string) => <li key={p}>{p}</li>)}</ul>
          <h3 className="font-medium">Method</h3>
          <p>{r.method}</p>
          <h3 className="font-medium">Findings</h3>
          <ul className="list-disc ml-5">{r.findings?.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>
          <h3 className="font-medium">Conflicts</h3>
          <ul>{r.conflicts?.length ? r.conflicts.map((c: string) => <li key={c}>{c}</li>) : <li>None reported</li>}</ul>
          <h3 className="font-medium">Uncertainty</h3>
          <ul>{r.uncertainties?.map((c: string) => <li key={c}>{c}</li>)}</ul>
          <h3 className="font-medium">Sources</h3>
          <ul>
            {r.sources?.map((s: any) => (
              <li key={s.id}>
                <a className="underline" href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>{" "}
                ({s.provider})
              </li>
            ))}
          </ul>
          <GraphView nodes={r.graph?.nodes ?? []} edges={r.graph?.edges ?? []} />
        </div>
      ) : null}
    </div>
  );
}
