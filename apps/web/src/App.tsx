import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api } from "./lib/api";
import { OrganizationWorkspace } from "./components/OrganizationWorkspace";

type Mode = "verify" | "research" | "situation" | "decision";
type View = "home" | "history" | "about";
type ProductSurface = "personal" | "organization";
type JsonObject = Record<string, unknown>;

type HistoryItem = {
  id: string;
  mode: Mode;
  input: string;
  createdAt: string;
  preview: string;
};

const MODES: Array<{ id: Mode; label: string; title: string; hint: string; icon: string }> = [
  { id: "verify", label: "Verify", title: "Check a claim", hint: "Claim extraction, evidence, cross-checking and self-verification.", icon: "✓" },
  { id: "research", label: "Research", title: "Research a topic", hint: "Subquestions, sources, findings, conflicts and uncertainty.", icon: "⌕" },
  { id: "situation", label: "Situation", title: "Understand a situation", hint: "Actors, events, drivers, risks and scenario structure.", icon: "◌" },
  { id: "decision", label: "Decision", title: "Think through a decision", hint: "Options, factors, trade-offs and change conditions.", icon: "↗" },
];

const PROGRESS_STEPS = [
  "Understanding your question",
  "Researching external evidence",
  "Evaluating source relationships",
  "Cross-checking and reasoning",
  "Preparing the result",
];

const HISTORY_KEY = "paradox-v2-history";

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readPath(value: unknown, paths: string[]): unknown {
  for (const path of paths) {
    let current: unknown = value;
    for (const part of path.split(".")) {
      if (!isObject(current)) {
        current = undefined;
        break;
      }
      current = current[part];
    }
    if (current !== undefined && current !== null && current !== "") return current;
  }
  return undefined;
}

function arrayOfObjects(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function arrayOfText(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim()) : [];
}

function percent(value: unknown): string | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.max(0, Math.min(100, normalized)).toFixed(0)}%`;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getVerdict(result: unknown) {
  return asText(readPath(result, [
    "verdict",
    "classification",
    "finalVerdict",
    "finalAssessment.classification",
    "finalAssessment.verdict",
  ])) ?? "Assessment complete";
}

function getConfidence(result: unknown) {
  return percent(readPath(result, [
    "confidence.finalSystemConfidence",
    "confidence.evidenceConfidence",
    "confidenceRecord.finalSystemConfidence",
    "finalSystemConfidence",
    "recommendationConfidence",
  ]));
}

function getClaims(result: unknown) {
  return arrayOfObjects(readPath(result, ["claims", "finalAssessment.claims"]));
}

function getEvidence(result: unknown) {
  return arrayOfObjects(readPath(result, ["evidence", "finalAssessment.evidence", "results.evidence"]));
}

function getSources(result: unknown) {
  return arrayOfObjects(readPath(result, ["sources"]));
}

function getSteps(result: unknown) {
  return arrayOfObjects(readPath(result, ["steps"]));
}

function getGraph(result: unknown) {
  const graph = readPath(result, ["graph"]);
  return isObject(graph) ? graph : null;
}

function getExecutionId(result: unknown) {
  return asText(readPath(result, ["executionId", "id", "finalAssessment.executionId"]));
}

function getSourceTitle(item: JsonObject) {
  return asText(item.title) ?? asText(item.url) ?? "Evidence source";
}

function getSourceUrl(item: JsonObject) {
  const url = asText(item.url);
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function getEvidenceText(item: JsonObject) {
  return asText(item.content) ?? asText(item.extractedText) ?? asText(item.snippet) ?? "No evidence text supplied.";
}

function getModeSummary(mode: Mode, result: unknown) {
  if (mode === "research") {
    return asText(readPath(result, ["executiveSummary", "conclusion"])) ?? "Research completed.";
  }
  if (mode === "situation") {
    return asText(readPath(result, ["currentState"])) ?? "Situation structured.";
  }
  if (mode === "decision") {
    const recommendation = asText(readPath(result, ["recommendation"]));
    return recommendation ? `Structured comparison completed. Result: ${recommendation}.` : "No recommendation was produced from the available evidence.";
  }
  return asText(readPath(result, ["explanation.verdictReason"])) ?? "Verification completed.";
}

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isObject) as unknown as HistoryItem[] : [];
  } catch {
    return [];
  }
}

function storeHistory(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 20)));
}

function Icon({ name }: { name: string }) {
  const common = {
    width: 19,
    height: 19,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "search": return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
    case "history": return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 2" /></svg>;
    case "info": return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 10v6" /><path d="M12 7h.01" /></svg>;
    case "sun": return <svg {...common}><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
    case "arrow": return <svg {...common}><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>;
    case "external": return <svg {...common}><path d="M14 5h5v5" /><path d="M10 14 19 5" /><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg>;
    case "menu": return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case "check": return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
    default: return null;
  }
}

function LogoMark() {
  return (
    <div className="logo-mark" aria-hidden="true">
      <span className="logo-dot logo-dot-a" />
      <span className="logo-dot logo-dot-b" />
      <span className="logo-dot logo-dot-c" />
      <span className="logo-ring" />
    </div>
  );
}

function NavButton({
  active,
  children,
  onClick,
  icon,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
  icon: string;
}) {
  return <button className={`nav-button ${active ? "nav-button-active" : ""}`} onClick={onClick} type="button"><Icon name={icon} /><span>{children}</span></button>;
}

function ModeButton({
  mode,
  active,
  onClick,
}: {
  mode: (typeof MODES)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`mode-card ${active ? "mode-card-active" : ""}`} onClick={onClick} type="button">
      <span className="mode-icon">{mode.icon}</span>
      <span className="mode-copy"><strong>{mode.label}</strong><small>{mode.hint}</small></span>
    </button>
  );
}

function ProgressPanel({ progress }: { progress: number }) {
  return (
    <section className="result-shell result-stack">
      <div className="progress-header">
        <div><span className="eyebrow">PARADOX is working</span><h2>Building an evidence-backed result</h2></div>
        <div className="progress-number">{Math.round(progress)}%</div>
      </div>
      <div className="progress-bar"><span style={{ width: `${progress}%` }} /></div>
      <div className="progress-list">
        {PROGRESS_STEPS.map((step, index) => {
          const done = progress >= ((index + 1) / PROGRESS_STEPS.length) * 100;
          const current = !done && progress >= (index / PROGRESS_STEPS.length) * 100;
          return <div className={`progress-row ${done ? "done" : ""} ${current ? "current" : ""}`} key={step}>
            <span className="progress-bullet">{done ? "✓" : current ? "•" : ""}</span><span>{step}</span>
          </div>;
        })}
      </div>
    </section>
  );
}

function Metric({ label, value, note }: { label: string; value: ReactNode; note: string }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function SourceCard({ item, index }: { item: JsonObject; index: number }) {
  const url = getSourceUrl(item);
  return (
    <article className="evidence-item">
      <div className="evidence-marker">{index + 1}</div>
      <div className="evidence-main">
        <div className="evidence-meta">
          <span className="pill">{asText(item.sourceType) ?? asText(item.provider) ?? "Source"}</span>
          <span className="subtle-label">{asText(item.evidenceStatus) ?? "Retrieved"}</span>
        </div>
        <h4>{getSourceTitle(item)}</h4>
        <p>{getEvidenceText(item)}</p>
        <div className="stat-strip">
          <span>Relevance {percent(item.relevanceScore) ?? "—"}</span>
          <span>Reliability {percent(item.sourceReliability ?? item.reliabilityScore) ?? "—"}</span>
          <span>Independence {percent(item.independenceScore) ?? "—"}</span>
        </div>
        {url && <a href={url} target="_blank" rel="noreferrer" className="source-link">Open source <Icon name="external" /></a>}
      </div>
    </article>
  );
}

function DetailList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="detail-card">
      <div className="section-heading"><div><span className="eyebrow">Engine output</span><h3>{title}</h3></div></div>
      {items.length ? <div className="bullet-list">{items.map((item, index) => <div className="bullet-row" key={`${item}-${index}`}><span>•</span><p>{item}</p></div>)}</div> : <div className="empty-evidence"><strong>{empty}</strong></div>}
    </div>
  );
}

function TraceAndGraph({ result }: { result: unknown }) {
  const steps = getSteps(result);
  const graph = getGraph(result);
  const nodes = arrayOfObjects(graph?.nodes);
  const edges = arrayOfObjects(graph?.edges);
  return (
    <div className="detail-two-column">
      <div className="detail-card">
        <div className="section-heading"><div><span className="eyebrow">Trace</span><h3>Pipeline execution</h3></div><span className="subtle-label">{steps.length} steps</span></div>
        {steps.length ? <div className="trace-list">{steps.map((step, index) => (
          <div className="trace-row" key={`${String(step.stage)}-${index}`}>
            <span className={`trace-status trace-${String(step.status).toLowerCase()}`}>{String(step.status ?? "—")}</span>
            <div><strong>{String(step.stage ?? "Stage")}</strong><small>{String(step.detail ?? "")}</small></div>
            <time>{typeof step.latencyMs === "number" ? `${step.latencyMs}ms` : ""}</time>
          </div>
        ))}</div> : <div className="empty-evidence"><strong>No execution trace returned.</strong></div>}
      </div>
      <div className="detail-card">
        <div className="section-heading"><div><span className="eyebrow">Graph</span><h3>Knowledge structure</h3></div><span className="subtle-label">{graph ? String(graph.graphType ?? "graph") : "not returned"}</span></div>
        {graph ? (
          <><div className="graph-summary"><Metric label="Nodes" value={nodes.length} note="Claim, source, evidence and reasoning objects." /><Metric label="Edges" value={edges.length} note="Relationships preserved for inspection." /></div>
          <div className="graph-list">{edges.slice(0, 12).map((edge, index) => <div className="graph-row" key={`${String(edge.id ?? index)}`}><span>{String(edge.kind ?? "RELATED_TO")}</span><b>{String(edge.from ?? "—")}</b><i>→</i><b>{String(edge.to ?? "—")}</b></div>)}</div></>
        ) : <div className="empty-evidence"><strong>No graph returned.</strong></div>}
      </div>
    </div>
  );
}

function VerifyResult({ result }: { result: unknown }) {
  const evidence = getEvidence(result);
  const claims = getClaims(result);
  const rounds = arrayOfObjects(readPath(result, ["rounds"]));
  const contradictions = arrayOfObjects(readPath(result, ["contradictions"]));
  const truthShift = arrayOfObjects(readPath(result, ["truthShift"]));
  const explanation = isObject(readPath(result, ["explanation"])) ? readPath(result, ["explanation"]) as JsonObject : null;
  const confidence = getConfidence(result);
  return (
    <div className="result-stack">
      <div className="metric-grid">
        <Metric label="Verdict" value={getVerdict(result)} note="Deterministic assessment from the verification engine." />
        <Metric label="Assessment confidence" value={confidence ?? "Not available"} note="System confidence is not a truth probability." />
        <Metric label="Evidence objects" value={evidence.length} note="Retrieved evidence represented in the result." />
      </div>
      <div className="detail-two-column">
        <DetailList title="Claims extracted" items={claims.map((c) => asText(c.normalizedClaim) ?? asText(c.text) ?? "Claim")} empty="No verifiable claims were extracted." />
        <DetailList title="Contradictions" items={contradictions.map((c) => asText(c.explanation) ?? asText(c.type) ?? "Conflict detected")} empty="No explicit contradiction records were returned." />
      </div>
      {explanation && <div className="detail-card"><div className="section-heading"><div><span className="eyebrow">Why this result</span><h3>Verification explanation</h3></div></div><div className="explanation-grid">{Object.entries(explanation).map(([key, value]) => typeof value === "string" && value.trim() ? <div className="explanation-item" key={key}><span>{key.replace(/([A-Z])/g, " $1")}</span><p>{value}</p></div> : null)}</div></div>}
      <div className="detail-card"><div className="section-heading"><div><span className="eyebrow">Self-verification</span><h3>Verification rounds</h3></div><span className="subtle-label">{rounds.length} round{rounds.length === 1 ? "" : "s"}</span></div>{rounds.length ? <div className="round-list">{rounds.map((round, index) => <div className="round-row" key={`${String(round.round ?? index)}`}><span>Round {String(round.round ?? index + 1)}</span><strong>{String(round.verdictAfter ?? "—")}</strong><small>{String(round.reason ?? "")}</small><small>Δ confidence {percent(round.selfVerificationDelta) ?? "0%"}</small></div>)}</div> : <div className="empty-evidence"><strong>No self-verification round was needed or returned.</strong></div>}</div>
      {truthShift.length > 0 && <DetailList title="Truth-shift trail" items={truthShift.map((shift) => `${String(shift.kind ?? "SHIFT")}: ${String(shift.summary ?? "")} · CSI ${String(shift.claimShiftIndex ?? "—")}`)} empty="" />}
      <div><div className="section-heading"><div><span className="eyebrow">Evidence trail</span><h3>What was actually inspected</h3></div><span className="subtle-label">{evidence.length} records</span></div>{evidence.length ? <div className="evidence-list">{evidence.slice(0, 12).map((item, index) => <SourceCard item={item} index={index} key={String(item.id ?? index)} />)}</div> : <div className="empty-evidence"><strong>No evidence records were returned.</strong><span>PARADOX keeps the result uncertain rather than inventing support.</span></div>}</div>
      <TraceAndGraph result={result} />
    </div>
  );
}

function ResearchResult({ result }: { result: unknown }) {
  const sources = getSources(result);
  const findings = arrayOfText(readPath(result, ["findings"]));
  const subquestions = arrayOfText(readPath(result, ["subquestions"]));
  const conflicts = arrayOfText(readPath(result, ["conflicts"]));
  const uncertainties = arrayOfText(readPath(result, ["uncertainties"]));
  const plan = arrayOfText(readPath(result, ["plan"]));
  return (
    <div className="result-stack">
      <div className="detail-card hero-result"><span className="eyebrow">Research engine</span><h3>{String(readPath(result, ["executiveSummary", "conclusion"]) ?? "Research completed.")}</h3><p>{String(readPath(result, ["method"]) ?? "Bounded external retrieval with explicit uncertainty.")}</p></div>
      <div className="metric-grid"><Metric label="Sources" value={sources.length} note="Source records returned by retrieval." /><Metric label="Findings" value={findings.length} note="Retrieved findings preserved in the report." /><Metric label="Conflicts" value={conflicts.length} note="Potential conflicts surfaced by the engine." /></div>
      <div className="detail-two-column"><DetailList title="Research plan" items={plan} empty="No explicit plan was returned." /><DetailList title="Subquestions" items={subquestions} empty="No decomposition was returned." /></div>
      <DetailList title="Findings" items={findings} empty="No on-topic findings were retrieved." />
      <div className="detail-two-column"><DetailList title="Conflicts" items={conflicts} empty="No conflicts were detected." /><DetailList title="Uncertainty" items={uncertainties} empty="No additional uncertainty notes were returned." /></div>
      <div><div className="section-heading"><div><span className="eyebrow">Research sources</span><h3>Source records</h3></div><span className="subtle-label">{sources.length} sources</span></div>{sources.length ? <div className="evidence-list">{sources.slice(0, 14).map((item, index) => <SourceCard item={item} index={index} key={String(item.id ?? index)} />)}</div> : <div className="empty-evidence"><strong>No external sources were retrieved.</strong></div>}</div>
      <TraceAndGraph result={result} />
    </div>
  );
}

function SituationResult({ result }: { result: unknown }) {
  const actors = arrayOfObjects(readPath(result, ["actors"]));
  const events = arrayOfObjects(readPath(result, ["events"]));
  const drivers = arrayOfObjects(readPath(result, ["drivers"]));
  const risks = arrayOfObjects(readPath(result, ["risks"]));
  const scenarios = arrayOfObjects(readPath(result, ["scenarios"]));
  return (
    <div className="result-stack">
      <div className="detail-card hero-result"><span className="eyebrow">Situation engine</span><h3>Current state</h3><p>{String(readPath(result, ["currentState"]) ?? "Situation structure was created.")}</p></div>
      <div className="metric-grid"><Metric label="Actors" value={actors.length} note="Entities structurally identified from the request." /><Metric label="Events" value={events.length} note="Observed or inferred events from research output." /><Metric label="Risks" value={risks.length} note="Explicit risks and uncertainty-bound constraints." /></div>
      <div className="detail-two-column">
        <DetailList title="Actors" items={actors.map((a) => `${String(a.name ?? "Actor")} · ${String(a.mode ?? "UNKNOWN")}`)} empty="No actors were structurally extracted." />
        <DetailList title="Events" items={events.map((e) => `${String(e.text ?? "Event")} · ${String(e.mode ?? "UNKNOWN")}`)} empty="No events were returned." />
      </div>
      <div className="detail-two-column">
        <DetailList title="Drivers" items={drivers.map((d) => `${String(d.text ?? "Driver")} · ${String(d.mode ?? "UNKNOWN")}`)} empty="No drivers were returned." />
        <DetailList title="Risks" items={risks.map((r) => `${String(r.text ?? "Risk")} · ${String(r.mode ?? "UNKNOWN")}`)} empty="No risks were returned." />
      </div>
      <div className="detail-card"><div className="section-heading"><div><span className="eyebrow">Scenario graph</span><h3>Possible situations</h3></div><span className="subtle-label">{scenarios.length} scenario structures</span></div>{scenarios.length ? <div className="scenario-grid">{scenarios.map((s, index) => <article className="scenario-card" key={String(s.id ?? index)}><div className="evidence-meta"><span className="pill">{String(s.kind ?? "SCENARIO")}</span><span className="subtle-label">{String(s.probabilityLabel ?? "Not estimated")}</span></div><p>{String(s.uncertainty ?? "Scenario structure only.")}</p><small>Triggers: {arrayOfText(s.triggers).join(" · ") || "—"}</small></article>)}</div> : <div className="empty-evidence"><strong>No scenarios were returned.</strong></div>}</div>
      <TraceAndGraph result={result} />
    </div>
  );
}

function DecisionResult({ result }: { result: unknown }) {
  const factors = arrayOfObjects(readPath(result, ["factors"]));
  const options = arrayOfText(readPath(result, ["options"]));
  const risks = arrayOfText(readPath(result, ["risks"]));
  const tradeoffs = arrayOfText(readPath(result, ["tradeoffs"]));
  const unknowns = arrayOfText(readPath(result, ["unknowns"]));
  const sensitivity = arrayOfObjects(readPath(result, ["sensitivity"]));
  const recommendation = asText(readPath(result, ["recommendation"]));
  return (
    <div className="result-stack">
      <div className="detail-card hero-result"><span className="eyebrow">Decision engine</span><h3>{recommendation ? `Result structure: ${recommendation}` : "No recommendation"}</h3><p>{String(readPath(result, ["keyReasons", "0"]) ?? readPath(result, ["objective"]) ?? "Decision analysis completed.")}</p></div>
      <div className="metric-grid"><Metric label="Recommendation confidence" value={percent(readPath(result, ["recommendationConfidence"])) ?? "Not available"} note="Heuristic confidence from the decision engine." /><Metric label="Options" value={options.length} note="Options included in the comparison." /><Metric label="Factors" value={factors.length} note="Weighted decision factors." /></div>
      <div className="detail-two-column"><DetailList title="Options" items={options} empty="No options returned." /><DetailList title="Key reasons" items={arrayOfText(readPath(result, ["keyReasons"]))} empty="No key reasons returned." /></div>
      <div className="detail-card"><div className="section-heading"><div><span className="eyebrow">Scoring model</span><h3>Decision factors</h3></div></div><div className="factor-table">{factors.map((factor, index) => <div className="factor-row" key={String(factor.id ?? index)}><strong>{String(factor.name ?? "Factor")}</strong><span>weight {String(factor.weight ?? "—")}</span><small>{String(factor.evidenceNote ?? "")}</small></div>)}</div></div>
      <div className="detail-two-column"><DetailList title="Risks" items={risks} empty="No risks returned." /><DetailList title="Trade-offs" items={tradeoffs} empty="No trade-offs returned." /></div>
      <div className="detail-two-column"><DetailList title="Unknowns" items={unknowns} empty="No unknowns returned." /><DetailList title="Change conditions" items={arrayOfText(readPath(result, ["changeConditions"]))} empty="No change conditions returned." /></div>
      <div className="detail-card"><div className="section-heading"><div><span className="eyebrow">Sensitivity</span><h3>Where option scores can swing</h3></div></div><div className="sensitivity-list">{sensitivity.map((item, index) => <div className="sensitivity-row" key={String(item.factor ?? index)}><strong>{String(item.factor ?? "Factor")}</strong><span>{percent(item.swing) ?? "—"} swing</span></div>)}</div></div>
      <TraceAndGraph result={result} />
    </div>
  );
}

function PillarResult({ mode, result }: { mode: Mode; result: unknown }) {
  return (
    <section className="result-shell result-stack">
      <div className="result-topline">
        <div><span className="eyebrow">PARADOX result</span><h2>{MODES.find((item) => item.id === mode)?.label ?? "Result"}</h2><p className="result-intro">{getModeSummary(mode, result)}</p></div>
        <span className="result-status"><Icon name="check" /> Engine completed</span>
      </div>
      {mode === "verify" && <VerifyResult result={result} />}
      {mode === "research" && <ResearchResult result={result} />}
      {mode === "situation" && <SituationResult result={result} />}
      {mode === "decision" && <DecisionResult result={result} />}
      <div className="result-footnote">{getExecutionId(result) ? `Execution: ${getExecutionId(result)}` : "Result returned by PARADOX"} · Evidence and confidence should be reviewed before relying on the output.</div>
    </section>
  );
}

export function App() {
  const [mode, setMode] = useState<Mode>("verify");
  const [view, setView] = useState<View>("home");
  const [text, setText] = useState("");
  const [decisionOptionA, setDecisionOptionA] = useState("");
  const [decisionOptionB, setDecisionOptionB] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("paradox-theme") === "dark");
  const [surface, setSurface] = useState<ProductSurface>(() => localStorage.getItem("paradox-surface") === "organization" ? "organization" : "personal");

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    localStorage.setItem("paradox-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => { localStorage.setItem("paradox-surface", surface); }, [surface]);

  const selectedMode = useMemo(() => MODES.find((item) => item.id === mode) ?? MODES[0], [mode]);

  function selectMode(next: Mode) {
    setMode(next);
    setView("home");
    setResult(null);
    setError("");
    setMobileNavOpen(false);
  }

  function goHome() {
    setView("home");
    setMobileNavOpen(false);
  }

  async function runInvestigation(event?: FormEvent) {
    event?.preventDefault();
    const cleanText = text.trim();

    if (!cleanText) {
      setError("Tell PARADOX what you want to investigate.");
      return;
    }

    if (mode === "decision" && (!decisionOptionA.trim() || !decisionOptionB.trim())) {
      setError("For a decision, add both options you want to compare.");
      return;
    }

    setBusy(true);
    setResult(null);
    setError("");
    setProgress(4);

    let timer: ReturnType<typeof setInterval> | undefined;

    try {
      timer = setInterval(() => {
        setProgress((current) => Math.min(88, current + (current < 30 ? 9 : current < 60 ? 12 : 7)));
      }, 800);

      let response: unknown;

      if (mode === "verify") {
        response = await api("/api/v1/verify", { method: "POST", body: JSON.stringify({ text: cleanText, modality: "TEXT" }) });
      } else if (mode === "research") {
        response = await api("/api/v1/research", { method: "POST", body: JSON.stringify({ question: cleanText }) });
      } else if (mode === "situation") {
        response = await api("/api/v1/situation", { method: "POST", body: JSON.stringify({ description: cleanText }) });
      } else {
        response = await api("/api/v1/decision", {
          method: "POST",
          body: JSON.stringify({ objective: cleanText, options: [decisionOptionA.trim(), decisionOptionB.trim()], constraints: [] }),
        });
      }

      if (timer) clearInterval(timer);
      setProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 250));
      setResult(response);

      const item: HistoryItem = {
        id: crypto.randomUUID(),
        mode,
        input: cleanText,
        createdAt: new Date().toISOString(),
        preview: getVerdict(response),
      };

      const nextHistory = [item, ...history].slice(0, 20);
      setHistory(nextHistory);
      storeHistory(nextHistory);
    } catch (err) {
      if (timer) clearInterval(timer);
      setError(err instanceof Error ? err.message : "PARADOX could not complete this request.");
      setProgress(0);
    } finally {
      if (timer) clearInterval(timer);
      setBusy(false);
    }
  }

  function restoreHistory(item: HistoryItem) {
    setMode(item.mode);
    setText(item.input);
    setView("home");
    setResult(null);
    setError("");
  }

  function clearHistory() {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="topbar">
        <button className="brand" onClick={goHome} aria-label="Go to PARADOX home" type="button">
          <LogoMark />
          <span><strong>PARADOX</strong><small>Evidence-driven fake-news detection</small></span>
        </button>

        <nav className="desktop-nav" aria-label="Primary">
          <NavButton active={view === "home"} onClick={goHome} icon="search">Explore</NavButton>
          <NavButton active={view === "history"} onClick={() => setView("history")} icon="history">History</NavButton>
          <NavButton active={view === "about"} onClick={() => setView("about")} icon="info">Architecture</NavButton>
        </nav>

        <div className="top-actions">
          <button className="surface-switch" onClick={() => { setSurface(surface === "personal" ? "organization" : "personal"); setView("home"); setResult(null); setError(""); }} type="button" aria-label="Switch PARADOX product surface">
            <span className={surface === "personal" ? "active" : ""}>Personal</span><span className={surface === "organization" ? "active" : ""}>Organizations</span>
          </button>
          <button className="icon-button" onClick={() => setDarkMode((value) => !value)} aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"} type="button"><Icon name="sun" /></button>
          <button className="mobile-menu" onClick={() => setMobileNavOpen((value) => !value)} aria-label="Open menu" type="button"><Icon name="menu" /></button>
        </div>
      </header>

      {mobileNavOpen && <div className="mobile-nav">
        <NavButton active={view === "home"} onClick={goHome} icon="search">Explore</NavButton>
        <NavButton active={view === "history"} onClick={() => { setView("history"); setMobileNavOpen(false); }} icon="history">History</NavButton>
        <NavButton active={view === "about"} onClick={() => { setView("about"); setMobileNavOpen(false); }} icon="info">Architecture</NavButton>
      </div>}

      <main className="page">
        {surface === "organization" ? <OrganizationWorkspace onExit={() => { setSurface("personal"); setView("home"); }} /> : null}
        {surface === "personal" && view === "home" && <>
          <section className="hero">
            <div className="hero-copy">
              <div className="status-chip"><span className="status-dot" /> Evidence first · four engines</div>
              <h1>Detect the claim.<br /><span>Trace the evidence.</span></h1>
              <p>PARADOX combines verification, research, situation analysis and decision assistance into one evidence-driven pipeline. No single model call is treated as the final truth.</p>
            </div>
            <div className="hero-orbit" aria-hidden="true"><div className="orbit-core"><LogoMark /><span>research</span><span>evidence</span><span>reason</span></div></div>
          </section>

          <section className="workspace">
            <div className="workspace-header"><div><span className="eyebrow">Start with one request</span><h2>Choose the PARADOX engine</h2></div><span className="workspace-tip">Research is the evidence layer behind the other engines</span></div>

            <div className="mode-grid">{MODES.map((item) => <ModeButton key={item.id} mode={item} active={mode === item.id} onClick={() => selectMode(item.id)} />)}</div>

            <form className="composer" onSubmit={runInvestigation}>
              <div className="composer-label"><span>{selectedMode.title}</span><span className="composer-count">{text.length}/20000</span></div>
              <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={
                mode === "verify" ? "Example: The new policy reduced waiting times by 30%."
                  : mode === "research" ? "Example: What does the evidence say about..."
                    : mode === "situation" ? "Example: Explain what is happening and what could change next..."
                      : "Example: I need to choose between two options because..."
              } rows={5} maxLength={20000} aria-label={selectedMode.title} />
              {mode === "decision" && <div className="decision-fields"><input value={decisionOptionA} onChange={(event) => setDecisionOptionA(event.target.value)} placeholder="Option A" maxLength={500} /><input value={decisionOptionB} onChange={(event) => setDecisionOptionB(event.target.value)} placeholder="Option B" maxLength={500} /></div>}
              <div className="composer-footer"><div className="input-tools"><span className="input-tool">Text</span><span className="input-tool">External evidence</span><span className="input-tool muted">Media adapters planned</span></div><button className="primary-button" type="submit" disabled={busy}><span>{busy ? "Investigating..." : "Investigate"}</span><Icon name="arrow" /></button></div>
            </form>

            {error && <div className="error-banner" role="alert"><strong>Request needs attention.</strong><span>{error}</span></div>}
          </section>

          <section className="examples">
            <div className="section-heading"><div><span className="eyebrow">Quick tests</span><h3>Try each pillar</h3></div></div>
            <div className="example-grid">
              {[
                ["verify", "Did humans land on the Moon?"],
                ["research", "What caused the Titanic to sink?"],
                ["situation", "Explain the current situation and the major risks around a company facing a product recall."],
                ["decision", "I need to compare a low-cost option with a higher-cost option based on evidence."],
              ].map(([exampleMode, example]) => <button className="example-card" key={example} onClick={() => { setMode(exampleMode as Mode); setText(example); setView("home"); }} type="button"><span><b>{MODES.find((m) => m.id === exampleMode)?.label}</b><br />{example}</span><Icon name="arrow" /></button>)}
            </div>
          </section>

          <section className="how-section">
            <div className="how-copy"><span className="eyebrow">Whole PARADOX pipeline</span><h2>Four engines.<br />One evidence chain.</h2><p>The verification engine extracts claims and checks them. The research engine gathers evidence. The situation engine structures context and scenarios. The decision engine compares options. Supporting graphs, traces, truth-shift history, evaluation and calibration remain inspectable.</p></div>
            <div className="pipeline">{["Claim extraction", "Research", "Evidence + lineage", "Verification + self-check", "Situation", "Decision"].map((label, index) => <div className="pipeline-node" key={label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong>{index < 5 && <i />}</div>)}</div>
          </section>

          {(busy || result) && <section className="analysis-area">{busy ? <ProgressPanel progress={progress} /> : result ? <PillarResult mode={mode} result={result} /> : null}</section>}
        </>}

        {surface === "personal" && view === "history" && <section className="content-page">
          <div className="content-page-header"><div><span className="eyebrow">Your workspace</span><h1>Investigation history</h1><p>Recent questions are stored locally in this browser.</p></div>{history.length > 0 && <button className="secondary-button danger-button" onClick={clearHistory} type="button">Clear history</button>}</div>
          {!history.length ? <div className="empty-state"><div className="empty-icon"><Icon name="history" /></div><h3>No investigations yet</h3><p>Your recent PARADOX requests will appear here.</p><button className="primary-button" onClick={goHome} type="button">Start an investigation <Icon name="arrow" /></button></div>
            : <div className="history-list">{history.map((item) => <button className="history-item" key={item.id} onClick={() => restoreHistory(item)} type="button"><div className="history-icon">{item.mode.slice(0, 1).toUpperCase()}</div><div className="history-main"><div className="history-meta"><span>{item.mode}</span><time>{formatDate(item.createdAt)}</time></div><strong>{item.input}</strong><small>{item.preview}</small></div><Icon name="arrow" /></button>)}</div>}
        </section>}

        {surface === "personal" && view === "about" && <section className="content-page about-page">
          <div className="content-page-header"><div><span className="eyebrow">PARADOX architecture</span><h1>Evidence before certainty.</h1><p>The user-facing layer exposes the actual engine outputs instead of reducing every request to a single generic answer.</p></div></div>
          <div className="about-grid">
            <article className="about-card"><span className="about-number">01</span><h3>Verification engine</h3><p>Claim extraction → evidence retrieval → relevance → source quality → source independence/lineage → evidence weighting → verification → adversarial self-verification.</p></article>
            <article className="about-card"><span className="about-number">02</span><h3>Research engine</h3><p>Question decomposition, bounded search, provenance, source comparison, conflict discovery, findings, conclusion and a dedicated research graph.</p></article>
            <article className="about-card"><span className="about-number">03</span><h3>Situation engine</h3><p>Builds actor, event, driver and risk structure from researched evidence, then represents baseline, optimistic, adverse and alternative scenario forms.</p></article>
            <article className="about-card"><span className="about-number">04</span><h3>Decision engine</h3><p>Compares options using explicit factors, risks, constraints, uncertainty penalties, sensitivity and change conditions.</p></article>
            <article className="about-card"><span className="about-number">05</span><h3>Graph + trace layer</h3><p>Execution traces, knowledge graphs and truth-shift records make the pipeline inspectable rather than opaque.</p></article>
            <article className="about-card"><span className="about-number">06</span><h3>Calibration + evaluation</h3><p>Outcome recording, evaluation summaries and calibration are separate from the current evidence assessment so confidence is not silently treated as correctness.</p></article>
          </div>
        </section>}
      </main>

      <footer className="footer"><span>PARADOX</span><span>Evidence-driven fake-news detection</span><span>Research · Verification · Situation · Decision</span></footer>
    </div>
  );
}
