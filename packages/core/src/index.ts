import { ModelRouter } from "@paradox/providers";
import { runVerification } from "@paradox/verification";
import { runResearch } from "@paradox/research";
import { runSituation } from "@paradox/situation";
import { runDecision } from "@paradox/decision";
import { applyFusionEvent, createKnowledgeState, type KnowledgeState } from "@paradox/fusion";
import { recordShift } from "@paradox/truth-shift";
import { adaptInput } from "@paradox/multimodal";
import { serializeGraph } from "@paradox/graphs";
import { newId, type Modality, type TruthShiftEvent } from "@paradox/shared";

export interface AppConfig {
  maxRounds: number;
  selfVerifyThreshold: number;
  maxEvidence: number;
  timeoutMs: number;
  llm: {
    baseUrl: string;
    apiKey: string | undefined;
    models: Record<"classify" | "extract" | "reason" | "synthesize" | "forecast" | "decision", string>;
  };
}

export class ParadoxOrchestrator {
  readonly state: KnowledgeState = createKnowledgeState();
  readonly shifts: TruthShiftEvent[] = [];
  readonly router: ModelRouter;

  constructor(
    private readonly cfg: AppConfig,
    private readonly env: NodeJS.ProcessEnv,
  ) {
    this.router = new ModelRouter({
      baseUrl: cfg.llm.baseUrl,
      apiKey: cfg.llm.apiKey,
      models: cfg.llm.models,
      timeoutMs: cfg.timeoutMs,
    });
  }

  async verify(text: string, modality: Modality = "TEXT", asOf?: string) {
    const adapted = adaptInput(modality, text);
    if (adapted.status === "UNSUPPORTED_MODALITY") {
      return {
        status: "UNSUPPORTED_MODALITY" as const,
        message: adapted.message,
        executionId: newId("ex"),
        requestId: newId("req"),
      };
    }
    const requestId = newId("req");
    const result = await runVerification({
      text: adapted.text ?? "",
      requestId,
      router: this.router,
      config: {
        maxRounds: this.cfg.maxRounds,
        selfVerifyThreshold: this.cfg.selfVerifyThreshold,
        maxEvidence: this.cfg.maxEvidence,
        timeoutMs: this.cfg.timeoutMs,
        asOf,
      },
      env: this.env,
    });
    applyFusionEvent(this.state, "VERIFICATION_COMPLETED", result.executionId, result);
    const claim = result.claims.find((c) => c.isVerifiable);
    if (claim) {
      this.shifts.push(
        recordShift({
          claimId: claim.id,
          kind: result.rounds.length > 1 ? "VERDICT_CHANGED" : "CREATED",
          summary: `Verdict ${result.verdict}`,
          beforeVerdict: result.rounds[0]?.verdictBefore ?? null,
          afterVerdict: result.verdict,
          beforeEvidenceStrength: result.rounds[0]?.confidenceBefore ?? 0,
          afterEvidenceStrength: result.confidence?.evidenceConfidence ?? 0,
          newEvidenceCount: result.evidence.length,
        }),
      );
    }
    return { ...result, graph: serializeGraph(result.graph), truthShift: this.shifts.filter((s) => s.claimId === claim?.id) };
  }

  async research(question: string) {
    const requestId = newId("req");
    const result = await runResearch({
      question,
      requestId,
      router: this.router,
      timeoutMs: this.cfg.timeoutMs,
      env: this.env,
    });
    applyFusionEvent(this.state, "RESEARCH_COMPLETED", result.executionId, result);
    return { ...result, graph: serializeGraph(result.graph) };
  }

  async situation(description: string) {
    const requestId = newId("req");
    const result = await runSituation({
      description,
      requestId,
      router: this.router,
      timeoutMs: this.cfg.timeoutMs,
      env: this.env,
    });
    applyFusionEvent(this.state, "SITUATION_COMPLETED", result.executionId, result);
    return { ...result, graph: serializeGraph(result.graph) };
  }

  async decision(input: { objective: string; options: string[]; constraints: string[]; context?: string }) {
    const requestId = newId("req");
    const result = await runDecision({
      ...input,
      requestId,
      router: this.router,
      timeoutMs: this.cfg.timeoutMs,
      env: this.env,
    });
    applyFusionEvent(this.state, "DECISION_COMPLETED", result.executionId, result);
    return { ...result, graph: serializeGraph(result.graph) };
  }
}

export function configFromEnv(env: NodeJS.ProcessEnv): AppConfig {
  const model = env.LLM_MODEL_REASON || "gpt-4o-mini";
  return {
    maxRounds: Number(env.MAX_VERIFICATION_ROUNDS ?? 2),
    selfVerifyThreshold: Number(env.SELF_VERIFY_THRESHOLD ?? 0.7),
    maxEvidence: Number(env.MAX_EVIDENCE_ITEMS ?? 12),
    timeoutMs: Number(env.REQUEST_TIMEOUT_MS ?? 15000),
    llm: {
      baseUrl: env.LLM_BASE_URL || "https://api.openai.com/v1",
      apiKey: env.LLM_API_KEY || undefined,
      models: {
        classify: env.LLM_MODEL_CLASSIFY || model,
        extract: env.LLM_MODEL_EXTRACT || model,
        reason: env.LLM_MODEL_REASON || model,
        synthesize: env.LLM_MODEL_SYNTHESIZE || model,
        forecast: env.LLM_MODEL_FORECAST || model,
        decision: env.LLM_MODEL_DECISION || model,
      },
    },
  };
}
