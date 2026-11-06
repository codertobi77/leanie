import { Pool } from "pg";
import {
  COUNCIL_STEPS,
  defaultModel,
  envTarget,
  loadPublishedPlan,
  resolvePlanOverride,
  runPipeline,
  scoreAnalysisQuality,
  scoreCoherence,
  scoreRiskRelevance,
  type StepTarget,
} from "./leanie-council-core";

// Admin benchmark runner. Executes the Council pipeline with a per-step
// provider/model plan and publishes progress to leanie_benchmark_runs so the
// admin UI can follow the run live over Neon Realtime.
export default async function leanieBench(request: Request): Promise<Response> {
  const cors = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  const body = await request.json().catch(() => null);
  if (!body) return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: cors });

  const runId = typeof body.runId === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(body.runId) ? body.runId : "";
  if (!runId) return new Response(JSON.stringify({ error: "runId is required" }), { status: 400, headers: cors });

  const requestedStep = String(body.step || "full").toLowerCase();
  if (!["full", "strategic", "feasibility", "critique", "arbiter"].includes(requestedStep)) {
    return new Response(JSON.stringify({ error: "Unknown Council step" }), { status: 400, headers: cors });
  }

  const brief = body.brief && typeof body.brief === "object" ? body.brief : {};
  const briefTitle = String(brief.title || "Benchmark run").slice(0, 200);
  const configId = typeof body.configId === "string" && /^[0-9a-f-]{1,64}$/i.test(body.configId) ? body.configId : null;

  const fallbackTarget = envTarget(defaultModel());
  if (!fallbackTarget.apiKey) {
    return new Response(JSON.stringify({ error: "Council is not configured" }), { status: 503, headers: cors });
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  // Resolve the per-step plan: inline steps override > configId > published config > env default.
  const plan: Record<string, StepTarget> = {};
  let resolvedConfigId = configId;
  let configName: string | null = null;
  try {
    const published = await loadPublishedPlan(pool);
    if (published) {
      Object.assign(plan, published.plan);
      if (!configId) {
        resolvedConfigId = published.configId;
        configName = published.configName;
      }
    }
    if (configId) {
      const { rows } = await pool.query(`SELECT name, steps FROM public.leanie_council_configs WHERE id = $1`, [configId]);
      if (rows.length) {
        configName = String(rows[0].name);
        Object.assign(plan, await resolvePlanOverride(pool, rows[0].steps));
      }
    }
    if (body.steps) Object.assign(plan, await resolvePlanOverride(pool, body.steps));
  } catch (error) {
    console.error("bench plan resolution failed:", String(error).slice(0, 200));
  }
  for (const step of COUNCIL_STEPS) {
    if (!plan[step]) plan[step] = fallbackTarget;
  }

  const planSummary = Object.fromEntries(
    Object.entries(plan).map(([step, target]) => [step, { provider: target.provider, model: target.model }]),
  );

  try {
    await pool.query(
      `INSERT INTO public.leanie_benchmark_runs (id, source, config, status, steps)
       VALUES ($1, 'bench', $2, 'running', '[]'::jsonb)
       ON CONFLICT (id) DO UPDATE SET config = $2, status = 'running', steps = '[]'::jsonb, result = NULL, error = NULL, updated_at = now()`,
      [runId, JSON.stringify({ steps: planSummary, configId: resolvedConfigId, configName, step: requestedStep })],
    );
  } catch (error) {
    console.error("benchmark run insert failed:", String(error).slice(0, 200));
  }

  const writeProgress = async (sql: string, params: unknown[]) => {
    try {
      await pool.query(sql, params);
    } catch (error) {
      console.error("benchmark progress write failed:", String(error).slice(0, 200));
    }
  };

  const runStartedAt = Date.now();
  const result = await runPipeline({
    brief,
    requestedStep,
    plan,
    onStep: async (update) => {
      if (update.status === "running") {
        await writeProgress(`UPDATE public.leanie_benchmark_runs SET current_step = $2, status = 'running', updated_at = now() WHERE id = $1`, [runId, update.step]);
        return;
      }
      if (update.detail) {
        await writeProgress(
          `UPDATE public.leanie_benchmark_runs SET steps = steps || $2::jsonb, updated_at = now() WHERE id = $1`,
          [runId, JSON.stringify([update.detail])],
        );
      }
    },
  });
  const latencyMs = Date.now() - runStartedAt;

  const primary = result.steps[0];
  const responseModel = primary?.model || fallbackTarget.model;
  const responseProvider = primary?.provider || fallbackTarget.provider;
  const scores = {
    analysisQuality: scoreAnalysisQuality(result.payload),
    riskRelevance: scoreRiskRelevance(result.payload.risks),
    coherence: scoreCoherence(result.payload),
  };
  const metrics = {
    model: responseModel,
    provider: responseProvider,
    configId: resolvedConfigId,
    configName,
    step: requestedStep,
    mode: result.failed ? "error" : "live",
    latencyMs,
    tokens: result.usage,
    costUsd: result.costUsd,
    jsonValid: result.jsonValid,
    scores,
    steps: result.steps,
  };

  await writeProgress(
    `UPDATE public.leanie_benchmark_runs SET status = $2, current_step = NULL, result = $3, error = $4, updated_at = now() WHERE id = $1`,
    [runId, result.failed ? "failed" : "done", JSON.stringify({ metrics, payload: { step: requestedStep, mode: result.payload.mode, phases: result.payload.phases ?? null, risks: result.payload.risks ?? null } }), result.error],
  );

  // Bench runs count toward the model metrics as well.
  try {
    await pool.query(
      `INSERT INTO public.leanie_model_runs
        (model, provider, step, mode, latency_ms, prompt_tokens, completion_tokens, total_tokens, cost_usd,
         json_valid, analysis_quality, risk_relevance, coherence, brief_title, error, config_id, run_id, steps)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        responseModel,
        responseProvider,
        requestedStep,
        metrics.mode,
        Math.round(latencyMs),
        result.usage.prompt,
        result.usage.completion,
        result.usage.total,
        result.costUsd.toFixed(6),
        result.jsonValid,
        scores.analysisQuality,
        scores.riskRelevance,
        scores.coherence,
        briefTitle,
        result.error,
        resolvedConfigId,
        runId,
        JSON.stringify(result.steps),
      ],
    );
  } catch (error) {
    console.error("leanie_model_runs insert failed:", String(error).slice(0, 200));
  }

  await pool.end().catch(() => {});
  return new Response(JSON.stringify({ ...result.payload, metrics, runId }), { headers: cors });
}
