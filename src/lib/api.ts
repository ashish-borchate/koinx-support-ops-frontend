export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const TOKEN_KEY = "koinx_token";
const VIEW_AS_KEY = "koinx_view_as";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getViewAs() {
  return sessionStorage.getItem(VIEW_AS_KEY);
}

export function setViewAs(userId: string | null) {
  if (userId) sessionStorage.setItem(VIEW_AS_KEY, userId);
  else sessionStorage.removeItem(VIEW_AS_KEY);
}

function apiUrl(path: string) {
  const base = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  return `${base}${path}`;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const viewAs = getViewAs();
  if (viewAs) headers.set("X-View-As", viewAs);
  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...options, headers });
  } catch {
    throw new ApiError(
      0,
      "Cannot reach the API. Start the server from the server folder, then open the client at http://127.0.0.1:4178.",
    );
  }
  const text = await response.text();
  let data: { error?: string; message?: string } = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const snippet = text.replace(/\s+/g, " ").trim().slice(0, 160);
      if (response.status === 502 || response.status === 504) {
        throw new ApiError(
          response.status,
          "The API is not reachable. Start MongoDB, then run npm run dev in the server folder.",
        );
      }
      throw new ApiError(
        response.status,
        snippet || "The server returned an unexpected response. Check that the API is running and MongoDB is up.",
      );
    }
  }
  if (response.status === 401 && !path.endsWith("/auth/login")) {
    setToken(null);
    setViewAs(null);
    if (!window.location.pathname.startsWith("/login")) window.location.assign("/login");
  }
  if (!response.ok) {
    throw new ApiError(response.status, failureMessage(response.status, data, text));
  }
  return data as T;
}

function failureMessage(status: number, data: { error?: string; message?: string }, rawText: string) {
  if (data.error) return data.error;
  if (data.message) return data.message;
  if (status === 502 || status === 504) {
    return "The API is not running. Start MongoDB, then run npm run dev in the server folder and wait for “API listening on http://127.0.0.1:4179”.";
  }
  if (status === 503) {
    return "The API is temporarily unavailable. If you just started the server, wait a few seconds and try again.";
  }
  if (status >= 500) {
    return "The API hit an error. Check the server terminal for MongoDB or startup errors, then try again.";
  }
  if (!rawText.trim()) {
    return "The request did not reach the API. Open http://127.0.0.1:4178 with the client dev server running, and the API on port 4179.";
  }
  return `Request failed (${status}). Confirm MongoDB is running and the server is up on port 4179.`;
}

export async function checkApiHealth(options?: { retries?: number; delayMs?: number }): Promise<{ ok: boolean; detail: string }> {
  const retries = options?.retries ?? 4;
  const delayMs = options?.delayMs ?? 750;
  let lastDetail =
    "Cannot reach the API. Start it from the server folder, then open http://127.0.0.1:4178.";

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(apiUrl("/api/health"));
      if (!response.ok) {
        lastDetail =
          response.status === 502 || response.status === 504
            ? "The API is starting or not running. Wait a few seconds, or run npm run dev in the server folder (port 4179)."
            : `Health check failed (HTTP ${response.status}).`;
      } else {
        const data = (await response.json()) as { ok?: boolean };
        if (data.ok) return { ok: true, detail: "" };
        lastDetail = "API health check returned an unexpected response.";
      }
    } catch {
      lastDetail = "Cannot reach the API. Start it from the server folder, then open http://127.0.0.1:4178.";
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, delayMs));
  }
  return { ok: false, detail: lastDetail };
}

export async function download(path: string, filename: string) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const viewAs = getViewAs();
  if (viewAs) headers.set("X-View-As", viewAs);
  const response = await fetch(apiUrl(path), { headers });
  if (!response.ok) throw new ApiError(response.status, "Export failed");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
