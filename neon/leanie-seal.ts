import { createRealtime, rawSql } from "@neon/realtime/server";

// Seals a live query for one benchmark run row so the admin UI can follow the
// run in realtime over the Neon Live SQL API without holding DB credentials.
const realtime = createRealtime({
  secret: process.env.NEON_REALTIME_SECRET!,
  db: process.env.NEON_REALTIME_DB || "neondb",
});

export default async function leanieSeal(request: Request): Promise<Response> {
  const cors = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  const body = await request.json().catch(() => null);
  const runId = typeof body?.runId === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(body.runId) ? body.runId : "";
  if (!runId) return new Response(JSON.stringify({ error: "runId is required" }), { status: 400, headers: cors });

  try {
    const sealed = await realtime.seal({
      query: rawSql<Record<string, unknown>>(
        `SELECT id, source, config, status, current_step, steps, result, error, created_at, updated_at
         FROM leanie_benchmark_runs WHERE id = $1`,
        [runId],
      ),
    });
    return new Response(JSON.stringify(sealed), { headers: cors });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: cors });
  }
}
