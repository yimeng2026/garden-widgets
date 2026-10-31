import { assertWidgetId, validateLawPackage } from "./contracts.mjs";

export function normalizeGardenBaseUrl(value) {
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("Garden base URL must use HTTPS, except for loopback development");
  }
  if (url.username || url.password || url.search || url.hash) throw new Error("Garden base URL must not contain credentials, query, or fragment");
  return url.origin;
}

export function createGardenClient({ baseUrl, token, fetchImpl = fetch }) {
  const origin = normalizeGardenBaseUrl(baseUrl);
  if (typeof token !== "string" || token.length < 32) throw new Error("GARDEN_AGENT_TOKEN is missing or too short");
  async function request(path, params = {}) {
    const url = new URL(path, origin);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
    const response = await fetchImpl(url, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
    let body;
    try { body = await response.json(); } catch { throw new Error(`Garden returned non-JSON response (${response.status})`); }
    if (!response.ok || body.success !== true) throw new Error(body.error || `Garden request failed (${response.status})`);
    return body;
  }
  return {
    async listLawPackages(filters = {}) {
      const allowed = Object.fromEntries(Object.entries(filters).filter(([key]) => ["kind", "status", "q"].includes(key)));
      const body = await request("/api/research/law-packages", allowed);
      if (!Array.isArray(body.data)) throw new Error("Garden collection data must be an array");
      for (const item of body.data) {
        const issues = validateLawPackage(item);
        if (issues.length) throw new Error(`Invalid garden law package ${item.id || "unknown"}: ${issues.join("; ")}`);
      }
      return body;
    },
    async getLawPackage(id) {
      assertWidgetId(id);
      const body = await request(`/api/research/law-packages/${encodeURIComponent(id)}`);
      const issues = validateLawPackage(body.data);
      if (issues.length) throw new Error(`Invalid garden law package ${id}: ${issues.join("; ")}`);
      return body.data;
    },
  };
}
