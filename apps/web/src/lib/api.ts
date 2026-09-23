const rawBaseUrl = (import.meta.env.VITE_API_URL ?? "").trim();
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

function resolveApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${cleanPath}` : cleanPath;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("paradox_token");

  const res = await fetch(resolveApiUrl(path), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const data: unknown = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    if (isObjectLike(data)) {
      const error = data.error;
      if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
        throw new Error(error.message);
      }
      if (typeof error === "string") throw new Error(error);
    }
    throw new Error(typeof data === "string" && data ? data : res.statusText || "Request failed");
  }

  return data as T;
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
