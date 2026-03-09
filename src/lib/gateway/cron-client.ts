/**
 * Gateway Cron Client
 * Proxies cron job operations to the OpenClaw gateway.
 * Tries REST endpoints first, falls back to chat-based creation.
 */

export interface GatewayCronJob {
  id: string;
  name: string;
  schedule: string;
  description?: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export interface CreateCronJobParams {
  name: string;
  schedule: string;
  description?: string;
  enabled?: boolean;
}

const DEFAULT_TIMEOUT = 15000;

function baseUrl(url: string) {
  return url.replace(/\/$/, "");
}

export async function listGatewayCronJobs(
  gatewayUrl: string,
  token: string
): Promise<{ jobs: GatewayCronJob[]; error?: string }> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    const res = await fetch(`${baseUrl(gatewayUrl)}/v1/cron`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!res.ok) return { jobs: [], error: `${res.status}` };
    const data = await res.json();
    const jobs: GatewayCronJob[] = (data.jobs || data.cronJobs || data.data || []).map((j: Record<string, unknown>) => ({
      id: String(j.id || j.jobId || ""),
      name: String(j.name || j.title || ""),
      schedule: String(j.schedule || j.cron || ""),
      description: j.description ? String(j.description) : undefined,
      enabled: j.enabled !== false,
      lastRun: j.last_run ? String(j.last_run) : undefined,
      nextRun: j.next_run ? String(j.next_run) : undefined,
    }));
    return { jobs };
  } catch (err) {
    return { jobs: [], error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function createGatewayCronJob(
  gatewayUrl: string,
  token: string,
  job: CreateCronJobParams
): Promise<{ jobId?: string; method: "rest" | "chat" | "noop"; error?: string }> {
  const base = baseUrl(gatewayUrl);

  // Try REST endpoint
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    const res = await fetch(`${base}/v1/cron`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: job.name, schedule: job.schedule, description: job.description, enabled: job.enabled !== false }),
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (res.ok) {
      const data = await res.json();
      return { jobId: data.id ? String(data.id) : undefined, method: "rest" };
    }
  } catch { /* fall through */ }

  // Fall back to chat
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openclaw:main",
        messages: [{ role: "user", content: `Please create a cron job: Name="${job.name}", Schedule="${job.schedule}", Description="${job.description || job.name}". Confirm when done.` }],
      }),
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (res.ok) return { method: "chat" };
  } catch { /* ignore */ }

  return { method: "noop", error: "Could not reach gateway" };
}

export async function toggleGatewayCronJob(
  gatewayUrl: string,
  token: string,
  jobId: string,
  enabled: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    const res = await fetch(`${baseUrl(gatewayUrl)}/v1/cron/${jobId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
      signal: controller.signal,
    });
    clearTimeout(tid);
    return { ok: res.ok };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function deleteGatewayCronJob(
  gatewayUrl: string,
  token: string,
  jobId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    const res = await fetch(`${baseUrl(gatewayUrl)}/v1/cron/${jobId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(tid);
    return { ok: res.ok };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}
