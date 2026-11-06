import { Pool } from "pg";

export default async function leanieMetrics(request: Request): Promise<Response> {
  const cors = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const { rows: models } = await pool.query(
      `SELECT model,
              COUNT(*)::int AS runs,
              ROUND(AVG(latency_ms))::int AS avg_latency_ms,
              ROUND(AVG(analysis_quality))::int AS avg_analysis_quality,
              ROUND(AVG(risk_relevance))::int AS avg_risk_relevance,
              ROUND(AVG(coherence))::int AS avg_coherence,
              ROUND(100.0 * COUNT(*) FILTER (WHERE json_valid) / NULLIF(COUNT(*), 0))::int AS json_valid_rate,
              COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
              COALESCE(SUM(cost_usd), 0)::float AS total_cost_usd,
              MAX(created_at) AS last_run_at
       FROM public.leanie_model_runs
       GROUP BY model
       ORDER BY MAX(created_at) DESC NULLS LAST`,
    );
    const { rows: runs } = await pool.query(
      `SELECT id, created_at, model, step, mode, latency_ms,
              prompt_tokens, completion_tokens, total_tokens,
              cost_usd::float AS cost_usd, json_valid,
              analysis_quality, risk_relevance, coherence, brief_title, error
       FROM public.leanie_model_runs
       ORDER BY created_at DESC
       LIMIT 30`,
    );
    return new Response(JSON.stringify({ models, runs }), { headers: cors });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: cors });
  } finally {
    await pool.end().catch(() => {});
  }
}
