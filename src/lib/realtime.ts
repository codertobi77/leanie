import { createRealtimeClient } from "@neon/realtime/client"
import type { SealedLiveQuery } from "@neon/realtime/client"
import type { BenchmarkRunRow } from "../types"

const realtimeUrl = import.meta.env.VITE_NEON_REALTIME_URL as string | undefined

// One client for the whole app: every subscription multiplexes over a single
// WebSocket connection. Created lazily so a missing env var only disables
// realtime features instead of crashing the app.
export const realtimeClient = realtimeUrl
  ? createRealtimeClient({ url: realtimeUrl, logLevel: "warn" })
  : null

export const realtimeEnabled = realtimeClient != null

// Fetches a sealed live query for one benchmark run row. The seal endpoint
// signs the SQL server-side, so the browser never sees credentials and cannot
// change the query.
export async function fetchSealedBenchmarkRun(
  runId: string,
): Promise<SealedLiveQuery<BenchmarkRunRow>> {
  const sealUrl = import.meta.env.VITE_NEON_FUNCTION_SEAL_BASE_URL as string | undefined
  if (!sealUrl) {
    throw new Error("Seal endpoint is not configured (VITE_NEON_FUNCTION_SEAL_BASE_URL).")
  }
  const response = await fetch(sealUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({ runId }),
  })
  if (!response.ok) {
    throw new Error(`Seal request failed (${response.status})`)
  }
  return (await response.json()) as SealedLiveQuery<BenchmarkRunRow>
}

export async function callNeonFunction<T>(
  url: string | undefined,
  body: unknown,
  method: "GET" | "POST" = "POST",
): Promise<T> {
  if (!url) throw new Error("Neon function endpoint is not configured.")
  const response = await fetch(url, {
    method,
    headers: method === "POST" ? { "Content-Type": "text/plain;charset=UTF-8" } : undefined,
    body: method === "POST" ? JSON.stringify(body) : undefined,
  })
  const payload = (await response.json().catch(() => null)) as T & { error?: string } | null
  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed (${response.status})`)
  }
  return payload as T
}
