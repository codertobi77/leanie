import { Pool } from "pg";

const RUN_COLUMNS = `id, created_at, model, provider, step, mode, latency_ms,
  prompt_tokens, completion_tokens, total_tokens,
  cost_usd::float AS cost_usd, json_valid,
  analysis_quality, risk_relevance, coherence, brief_title, error, config_id, run_id, steps`;

const STEP_VALUES = new Set(["full", "strategic", "feasibility", "critique", "arbiter", "probe"]);
const MODE_VALUES = new Set(["live", "error", "demo"]);
const RANGE_HOURS: Record<string, number> = { "24h": 24, "7d": 168, "30d": 720 };

export default async function leanieMetrics(request: Request): Promise<Response> {
  const cors = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  const url = new URL(request.url);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    if (url.searchParams.get("view") === "runs") {
      return await runsView(url, pool, cors);
    }
    return await modelsView(pool, cors);
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: cors });
  } finally {
    await pool.end().catch(() => {});
  }
}

// Aggregate metrics per provider+model (used by the Metrics tab cards).
async function modelsView(pool: Pool, cors: Record<string, string>): Promise<Response> {
  const { rows: models } = await pool.query(
    `SELECT provider, model,
            COUNT(*)::int AS runs,
            ROUND(AVG(latency_ms))::int AS avg_latency_ms,
            ROUND(AVG(analysis_quality))::int AS avg_analysis_quality,
            ROUND(AVG(risk_relevance))::int AS avg_risk_relevance,
            ROUND(AVG(coherence))::int AS avg_coherence,
            ROUND(100.0 * COUNT(*) FILTER (WHERE json_valid) / NULLIF(COUNT(*) FILTER (WHERE json_valid IS NOT NULL), 0))::int AS json_valid_rate,
            COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
            COALESCE(SUM(cost_usd), 0)::float AS total_cost_usd,
            MAX(created_at) AS last_run_at
     FROM public.leanie_model_runs
     GROUP BY provider, model
     ORDER BY MAX(created_at) DESC NULLS LAST`,
  );
  return new Response(JSON.stringify({ models }), { headers: cors });
}

// Paginated, filterable run list for the Recent runs table.
async function runsView(url: URL, pool: Pool, cors: Record<string, string>): Promise<Response> {
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(5, Number.parseInt(url.searchParams.get("pageSize") ?? "15", 10) || 15));

  const where: string[] = [];
  const params: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replaceAll("$?", `$${params.length}`));
  };

  const provider = (url.searchParams.get("provider") ?? "").trim().slice(0, 120);
  const model = (url.searchParams.get("model") ?? "").trim().slice(0, 160);
  const step = (url.searchParams.get("step") ?? "").trim();
  const mode = (url.searchParams.get("mode") ?? "").trim();
  const json = (url.searchParams.get("json") ?? "").trim();
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const range = (url.searchParams.get("range") ?? "all").trim();

  if (provider) add("provider = $?", provider);
  if (model) add("model = $?", model);
  if (step && STEP_VALUES.has(step)) add("step = $?", step);
  if (mode && MODE_VALUES.has(mode)) add("mode = $?", mode);
  if (json === "valid") where.push("json_valid = true");
  if (json === "invalid") where.push("json_valid = false");
  if (q) add("(brief_title ILIKE $? OR error ILIKE $? OR model ILIKE $? OR provider ILIKE $?)", `%${q}%`);
  if (range in RANGE_HOURS) {
    params.push(new Date(Date.now() - RANGE_HOURS[range] * 3_600_000).toISOString());
    where.push(`created_at >= $${params.length}::timestamptz`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM public.leanie_model_runs ${whereSql}`,
    params,
  );
  const total = countRows[0]?.total ?? 0;

  const limitParams = [...params, pageSize, (page - 1) * pageSize];
  const limit = `$${params.length + 1}`;
  const offset = `$${params.length + 2}`;
  const { rows } = await pool.query(
    `SELECT ${RUN_COLUMNS} FROM public.leanie_model_runs ${whereSql}
     ORDER BY created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    limitParams,
  );

  return new Response(
    JSON.stringify({ runs: rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }),
    { headers: cors },
  );
}
