import { Pool } from "pg";
import {
  defaultModel,
  demoResult,
  envTarget,
  loadPublishedPlan,
  runPipeline,
  scoreAnalysisQuality,
  scoreCoherence,
  scoreRiskRelevance,
  type StepTarget,
} from "./leanie-council-core";

export default async function leanieCouncil(request: Request): Promise<Response> {
  const cors = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  const brief = await request.json().catch(() => null);
  if (!brief) return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: cors });
  const requestedStep = String(brief.step || "full").toLowerCase();
  if (!["full", "strategic", "feasibility", "critique", "arbiter"].includes(requestedStep)) {
    return new Response(JSON.stringify({ error: "Unknown Council step" }), { status: 400, headers: cors });
  }

  // Optional per-run model override (used by the admin test bench).
  const requestedModel = typeof brief.model === "string" ? brief.model.trim() : "";
  const safeModel = /^[a-zA-Z0-9._/-]{1,120}$/.test(requestedModel) ? requestedModel : "";
  const runId = typeof brief.runId === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(brief.runId) ? brief.runId : null;
  const briefTitle = String(brief.title || "").slice(0, 200);

  const fallbackTarget = envTarget(safeModel || defaultModel());
  const runStartedAt = Date.now();
  let plan: Record<string, StepTarget> = {};
  let configId: string | null = null;
  let configName: string | null = null;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const published = await loadPublishedPlan(pool);
    if (published) {
      plan = published.plan;
      configId = published.configId;
      configName = published.configName;
    }
  } catch (error) {
    console.error("published config load failed:", String(error).slice(0, 200));
  }
  // Steps without a configured target fall back to the default provider/model.
  for (const step of ["strategic", "feasibility", "critique", "arbiter"]) {
    if (!plan[step]) plan[step] = fallbackTarget;
  }

  // Only use demo if no step has a valid API key
  const hasAnyKey = Object.values(plan).some((t: any) => t && t.apiKey && t.apiKey.length > 0);
  if (!hasAnyKey) {
    await pool.end().catch(() => {});
    return new Response(JSON.stringify(demoResult(brief, requestedStep, true)), { headers: cors });
  }

  const result = await runPipeline({ brief, requestedStep, plan });
  await pool.end().catch(() => {});

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
    configId,
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

  // Record the run (non-fatal on failure).
  try {
    const recordPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await recordPool.query(
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
        configId,
        runId,
        JSON.stringify(result.steps),
      ],
    );
    await recordPool.end().catch(() => {});
  } catch (error) {
    console.error("leanie_model_runs insert failed:", String(error).slice(0, 200));
  }

  return new Response(JSON.stringify({ ...result.payload, metrics }), { headers: cors });
}
