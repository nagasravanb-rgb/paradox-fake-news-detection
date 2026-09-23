export type ProviderStatus =
  | "OK"
  | "NOT_CONFIGURED"
  | "REQUIRES_CREDENTIAL"
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "TOOL_FAILURE"
  | "MODEL_FAILURE";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmResult {
  status: ProviderStatus;
  text: string | null;
  model: string | null;
  modelVersion: string | null;
  rawConfidence: number | null;
  error: string | null;
}

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  publishedAt: string | null;
  provider: string;
}

export interface SearchResult {
  status: ProviderStatus;
  hits: SearchHit[];
  error: string | null;
}

export interface FetchResult {
  status: ProviderStatus;
  url: string;
  statusCode: number | null;
  text: string | null;
  error: string | null;
  retrievedAt: string;
}

export type ModelTask =
  | "classify"
  | "extract"
  | "reason"
  | "synthesize"
  | "forecast"
  | "decision";
