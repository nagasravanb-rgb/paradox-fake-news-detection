import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { FetchResult } from "./types.js";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google.internal.",
]);

function isPrivateIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd") || ip.toLowerCase().startsWith("fe80")) {
    return true;
  }
  return false;
}

export async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("INVALID_URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("BLOCKED_SCHEME");
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("BLOCKED_HOST");
  }
  if (isIP(host) && isPrivateIp(host)) {
    throw new Error("BLOCKED_IP");
  }
  const resolved = await lookup(host, { all: true });
  for (const rec of resolved) {
    if (isPrivateIp(rec.address)) throw new Error("BLOCKED_RESOLVED_IP");
  }
  return url;
}

export async function safeFetchText(
  rawUrl: string,
  timeoutMs: number,
): Promise<FetchResult> {
  const retrievedAt = new Date().toISOString();
  try {
    const url = await assertSafeUrl(rawUrl);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: "manual",
        headers: { "user-agent": "PARADOX-EvidenceEngine/0.1" },
      });
      if (res.status >= 300 && res.status < 400) {
        return {
          status: "TOOL_FAILURE",
          url: url.toString(),
          statusCode: res.status,
          text: null,
          error: "REDIRECT_BLOCKED",
          retrievedAt,
        };
      }
      const text = await res.text();
      if (!res.ok) {
        return {
          status: "TOOL_FAILURE",
          url: url.toString(),
          statusCode: res.status,
          text: null,
          error: `HTTP_${res.status}`,
          retrievedAt,
        };
      }
      return {
        status: "OK",
        url: url.toString(),
        statusCode: res.status,
        text: text.slice(0, 80_000),
        error: null,
        retrievedAt,
      };
    } finally {
      clearTimeout(t);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status =
      msg.includes("abort") ? "TIMEOUT" : msg.startsWith("BLOCKED") || msg === "INVALID_URL" ? "TOOL_FAILURE" : "UNAVAILABLE";
    return {
      status,
      url: rawUrl,
      statusCode: null,
      text: null,
      error: msg,
      retrievedAt,
    };
  }
}
