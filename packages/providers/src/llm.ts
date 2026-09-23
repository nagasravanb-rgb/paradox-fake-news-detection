import type { LlmMessage, LlmResult, ModelTask } from "./types.js";

export interface LlmConfig {
  baseUrl: string;
  apiKey: string | undefined;
  models: Record<ModelTask, string>;
  timeoutMs: number;
}

export class ModelRouter {
  constructor(private readonly cfg: LlmConfig) {}

  configured(): boolean {
    return Boolean(this.cfg.apiKey && this.cfg.apiKey.trim());
  }

  modelFor(task: ModelTask): string {
    return this.cfg.models[task];
  }

  async complete(task: ModelTask, messages: LlmMessage[]): Promise<LlmResult> {
    if (!this.configured()) {
      return {
        status: "NOT_CONFIGURED",
        text: null,
        model: null,
        modelVersion: null,
        rawConfidence: null,
        error: "LLM_API_KEY unset — model calls skipped",
      };
    }
    const model = this.modelFor(task);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      const base = this.cfg.baseUrl.replace(/\/$/, "");
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        return {
          status: "MODEL_FAILURE",
          text: null,
          model,
          modelVersion: null,
          rawConfidence: null,
          error: `HTTP_${res.status}`,
        };
      }
      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        model?: string;
      };
      const text = body.choices?.[0]?.message?.content ?? null;
      if (!text) {
        return {
          status: "MODEL_FAILURE",
          text: null,
          model,
          modelVersion: body.model ?? null,
          rawConfidence: null,
          error: "EMPTY_MODEL_OUTPUT",
        };
      }
      return {
        status: "OK",
        text,
        model,
        modelVersion: body.model ?? model,
        rawConfidence: null,
        error: null,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        status: msg.includes("abort") ? "TIMEOUT" : "MODEL_FAILURE",
        text: null,
        model,
        modelVersion: null,
        rawConfidence: null,
        error: msg,
      };
    } finally {
      clearTimeout(t);
    }
  }

  async completeJson(task: ModelTask, messages: LlmMessage[]): Promise<LlmResult> {
    const result = await this.complete(task, [
      ...messages,
      { role: "user", content: "Respond with valid JSON only. No markdown." },
    ]);
    return result;
  }
}
