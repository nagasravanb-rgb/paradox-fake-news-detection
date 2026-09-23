import { useState } from "react";
import { api } from "../lib/api";
import { GraphView, Metric, StatusBadge } from "../components/ui";

export function VerifyPage() {
  const [text, setText] = useState("The Eiffel Tower is in Paris.");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      setResult(await api("/api/v1/verify", { method: "POST", body: JSON.stringify({ text, modality: "TEXT" }) }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2">Verification</h2>
      <p className="text-sm text-neutral-700 mb-4">
        External evidence is retrieved (Wikipedia by default). Without evidence the verdict is UNVERIFIED / INSUFFICIENT_EVIDENCE
        — never a fabricated “verified” label.
      </p>
      <textarea className="w-full border border-line p-3 min-h-[120px]" value={text} onChange={(e) => setText(e.target.value)} />
      <button className="mt-2 bg-accent text-white px-4 py-2 text-sm disabled:opacity-50" disabled={loading} onClick={run}>
        {loading ? "Running pipeline…" : "Verify"}
      </button>
      {err ? <p className="text-danger mt-3 text-sm">{err}</p> : null}
      {result?.status === "UNSUPPORTED_MODALITY" ? <p className="mt-3">{result.message}</p> : null}
      {result?.verdict ? (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <StatusBadge status={result.status} />
            <span className="text-xl font-semibold">{result.verdict}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Model confidence" value={result.confidence?.rawModelConfidence ?? "n/a"} hint="Not evidence strength" />
            <Metric label="Evidence strength" value={result.confidence?.evidenceConfidence} hint="PARADOX metric" />
            <Metric label="System confidence" value={result.confidence?.finalSystemConfidence} />
            <Metric label="Calibrated" value={result.confidence?.calibratedConfidence ?? "UNCALIBRATED"} />
          </div>
          {result.claims?.map((c: any) => (
            <div key={c.id} className="border border-line bg-white p-3">
              <div className="text-xs text-neutral-500">
                {c.claimType} · {c.atomicity} · {c.extractionMethod}
              </div>
              <div>{c.text}</div>
            </div>
          ))}
          <section>
            <h3 className="font-medium">Supporting evidence</h3>
            <EvidenceList items={(result.evidence ?? []).filter((e: any) => e.supportScore >= e.contradictionScore)} />
          </section>
          <section>
            <h3 className="font-medium">Contradicting evidence</h3>
            <EvidenceList items={(result.evidence ?? []).filter((e: any) => e.contradictionScore > e.supportScore)} />
          </section>
          <section>
            <h3 className="font-medium">Sources</h3>
            <ul className="text-sm space-y-2">
              {(result.sources ?? []).map((s: any) => (
                <li key={s.id} className="border border-line p-2 bg-white">
                  <div>
                    <a className="underline" href={s.url} target="_blank" rel="noreferrer">
                      {s.title}
                    </a>
                  </div>
                  <div className="text-xs text-neutral-600">
                    reliability {s.reliabilityScore.toFixed(2)} · independence {s.independenceScore.toFixed(2)} · {s.sourceType} ·{" "}
                    {s.provider} · retrieved {s.retrievedAt}
                  </div>
                </li>
              ))}
            </ul>
          </section>
          {result.explanation ? (
            <section className="border border-line bg-white p-3 text-sm space-y-1">
              <h3 className="font-medium">Why this verdict</h3>
              <p>Checked: {result.explanation.checked}</p>
              <p>Supports: {result.explanation.supporting}</p>
              <p>Contradicts: {result.explanation.contradicting}</p>
              <p>{result.explanation.sourceReliability}</p>
              <p>{result.explanation.sourceIndependence}</p>
              <p>Temporal: {result.explanation.temporalContext}</p>
              <p>Uncertainty: {result.explanation.uncertainty}</p>
              <p>Reason: {result.explanation.verdictReason}</p>
            </section>
          ) : null}
          <section>
            <h3 className="font-medium">Self-verification rounds</h3>
            <pre className="text-xs bg-white border border-line p-2 overflow-auto">{JSON.stringify(result.rounds, null, 2)}</pre>
          </section>
          <section>
            <h3 className="font-medium">Verification graph</h3>
            <GraphView nodes={result.graph?.nodes ?? []} edges={result.graph?.edges ?? []} />
          </section>
          <section>
            <h3 className="font-medium">Truth-Shift</h3>
            <pre className="text-xs bg-white border border-line p-2 overflow-auto">{JSON.stringify(result.truthShift, null, 2)}</pre>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function EvidenceList({ items }: { items: any[] }) {
  if (!items.length) return <p className="text-sm text-neutral-600">None.</p>;
  return (
    <ul className="text-sm space-y-2">
      {items.map((e) => (
        <li key={e.id} className="border border-line p-2 bg-white">
          <div>{e.extractedText}</div>
          <div className="text-xs text-neutral-600">
            relevance {e.relevanceScore.toFixed(2)} · support {e.supportScore.toFixed(2)} · contradiction {e.contradictionScore.toFixed(2)}{" "}
            · status {e.evidenceStatus} · temporal {e.temporalValidity}
          </div>
        </li>
      ))}
    </ul>
  );
}
