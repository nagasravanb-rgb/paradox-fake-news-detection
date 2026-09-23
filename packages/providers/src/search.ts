import type { SearchHit, SearchResult } from "./types.js";

interface WikiSearchItem {
  title?: string;
  excerpt?: string;
  description?: string;
}

interface WikiSummary {
  title?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
  timestamp?: string;
}

export async function wikipediaSearch(query: string, timeoutMs: number, limit = 5): Promise<SearchResult> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "PARADOX-EvidenceEngine/0.1 (local research; contact via operator)" },
    });
    if (!res.ok) {
      return { status: "TOOL_FAILURE", hits: [], error: `WIKI_SEARCH_HTTP_${res.status}` };
    }
    const body = (await res.json()) as { pages?: WikiSearchItem[] };
    const pages = body.pages ?? [];
    const hits: SearchHit[] = [];
    for (const page of pages.slice(0, limit)) {
      if (!page.title) continue;
      const summary = await wikipediaSummary(page.title, timeoutMs);
      hits.push({
        title: page.title,
        url: summary.url ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
        snippet: summary.extract ?? page.excerpt ?? page.description ?? "",
        publishedAt: summary.timestamp,
        provider: "wikipedia",
      });
    }
    if (hits.length === 0) {
      return { status: "OK", hits: [], error: null };
    }
    return { status: "OK", hits, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: msg.includes("abort") ? "TIMEOUT" : "UNAVAILABLE",
      hits: [],
      error: msg,
    };
  } finally {
    clearTimeout(t);
  }
}

async function wikipediaSummary(
  title: string,
  timeoutMs: number,
): Promise<{ extract: string | null; url: string | null; timestamp: string | null }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "PARADOX-EvidenceEngine/0.1" },
    });
    if (!res.ok) return { extract: null, url: null, timestamp: null };
    const body = (await res.json()) as WikiSummary;
    return {
      extract: body.extract ?? null,
      url: body.content_urls?.desktop?.page ?? null,
      timestamp: body.timestamp ?? null,
    };
  } catch {
    return { extract: null, url: null, timestamp: null };
  } finally {
    clearTimeout(t);
  }
}

export async function optionalWebSearch(query: string, env: NodeJS.ProcessEnv, timeoutMs: number): Promise<SearchResult> {
  const provider = (env.WEB_SEARCH_PROVIDER ?? "none").toLowerCase();
  const key = env.WEB_SEARCH_API_KEY;
  if (provider === "none" || !provider) {
    return { status: "NOT_CONFIGURED", hits: [], error: "WEB_SEARCH_PROVIDER=none" };
  }
  if (!key) {
    return { status: "REQUIRES_CREDENTIAL", hits: [], error: "WEB_SEARCH_API_KEY unset" };
  }
  if (provider === "tavily") {
    return tavilySearch(query, key, timeoutMs);
  }
  return { status: "NOT_CONFIGURED", hits: [], error: `Unknown WEB_SEARCH_PROVIDER=${provider}` };
}

async function tavilySearch(query: string, key: string, timeoutMs: number): Promise<SearchResult> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: key, query, max_results: 5, include_answer: false }),
      signal: controller.signal,
    });
    if (!res.ok) return { status: "TOOL_FAILURE", hits: [], error: `TAVILY_HTTP_${res.status}` };
    const body = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    const hits: SearchHit[] = (body.results ?? [])
      .filter((r) => r.url && r.title)
      .map((r) => ({
        title: r.title!,
        url: r.url!,
        snippet: r.content ?? "",
        publishedAt: null,
        provider: "tavily",
      }));
    return { status: "OK", hits, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: msg.includes("abort") ? "TIMEOUT" : "UNAVAILABLE", hits: [], error: msg };
  } finally {
    clearTimeout(t);
  }
}
