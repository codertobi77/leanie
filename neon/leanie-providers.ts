import { Pool } from "pg";
import { chat, parseJson, stepTargetFromProvider, type StepTarget } from "./leanie-council-core";

// Admin provider management. Providers are OpenAI-compatible chat endpoints
// (NVIDIA NIM, OpenRouter, Groq, Together, Ollama, OpenAI, ...). API keys are
// stored server-side and never returned to the browser (masked instead).
// P5.15: a "meta" provider uses base_url starting with "meta:" and routes a
// named model across concrete provider targets stored in its `models` jsonb:
//   { id: "fast-fallback", strategy: "fallback"|"first",
//     targets: [{ providerId, model }, ...] }
// No DB schema change; API key is not required for meta providers.
function isMetaBaseUrl(baseUrl: string): boolean {
  return baseUrl.startsWith("meta:");
}
function validateBaseUrl(baseUrl: string): string | null {
  if (isMetaBaseUrl(baseUrl)) return null;
  if (!/^https?:\/\//.test(baseUrl)) return "baseUrl must be an http(s) URL or a meta: route";
  return null;
}

export default async function leanieProviders(request: Request): Promise<Response> {
  const cors = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    if (request.method === "GET") {
      const { rows } = await pool.query(
        `SELECT id, name, base_url, api_key, models, status, created_at, updated_at
         FROM public.leanie_providers ORDER BY created_at ASC`,
      );
      return new Response(JSON.stringify({
        providers: rows.map((p: any) => ({
          id: p.id,
          name: p.name,
          baseUrl: p.base_url,
          apiKeyMasked: p.api_key ? `••••${String(p.api_key).slice(-4)}` : "",
          hasKey: !!p.api_key,
          models: Array.isArray(p.models) ? p.models : [],
          status: p.status,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        })),
      }), { headers: cors });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });
    }

    const body = await request.json().catch(() => null);
    if (!body?.action) return new Response(JSON.stringify({ error: "action is required" }), { status: 400, headers: cors });
    const action = String(body.action);

    if (action === "create") {
      const name = String(body.name || "").trim().slice(0, 80);
      const baseUrl = String(body.baseUrl || "").trim().replace(/\/+$/, "");
      const apiKey = String(body.apiKey || "").trim();
      if (!name || !baseUrl) return new Response(JSON.stringify({ error: "name and baseUrl are required" }), { status: 400, headers: cors });
      const baseUrlErr = validateBaseUrl(baseUrl);
      if (baseUrlErr) return new Response(JSON.stringify({ error: baseUrlErr }), { status: 400, headers: cors });
      if (!isMetaBaseUrl(baseUrl) && !apiKey) {
        return new Response(JSON.stringify({ error: "apiKey is required for non-meta providers" }), { status: 400, headers: cors });
      }
      const { rows } = await pool.query(
        `INSERT INTO public.leanie_providers (id, name, base_url, api_key, models, status)
         VALUES ($1, $2, $3, $4, $5::jsonb, 'testing') RETURNING id`,
        [crypto.randomUUID(), name, baseUrl, apiKey, JSON.stringify(Array.isArray(body.models) ? body.models : [])],
      );
      return new Response(JSON.stringify({ id: rows[0].id }), { headers: cors });
    }

    if (action === "update") {
      const id = String(body.id || "");
      if (!id) return new Response(JSON.stringify({ error: "id is required" }), { status: 400, headers: cors });
      const fields: string[] = [];
      const params: unknown[] = [];
      if (typeof body.name === "string" && body.name.trim()) { params.push(body.name.trim().slice(0, 80)); fields.push(`name = $${params.length}`); }
      if (typeof body.baseUrl === "string" && body.baseUrl.trim()) {
        const baseUrl = body.baseUrl.trim().replace(/\/+$/, "");
        const baseUrlErr = validateBaseUrl(baseUrl);
        if (baseUrlErr) return new Response(JSON.stringify({ error: baseUrlErr }), { status: 400, headers: cors });
        params.push(baseUrl); fields.push(`base_url = $${params.length}`);
      }
      if (typeof body.apiKey === "string" && body.apiKey.trim()) { params.push(body.apiKey.trim()); fields.push(`api_key = $${params.length}`); }
      if (Array.isArray(body.models)) { params.push(JSON.stringify(body.models)); fields.push(`models = $${params.length}::jsonb`); }
      if (!fields.length) return new Response(JSON.stringify({ error: "nothing to update" }), { status: 400, headers: cors });
      params.push(id);
      await pool.query(`UPDATE public.leanie_providers SET ${fields.join(", ")}, updated_at = now() WHERE id = $${params.length}`, params);
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    if (action === "delete") {
      const id = String(body.id || "");
      if (!id) return new Response(JSON.stringify({ error: "id is required" }), { status: 400, headers: cors });
      await pool.query(`DELETE FROM public.leanie_providers WHERE id = $1`, [id]);
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    if (action === "publish") {
      const id = String(body.id || "");
      const published = body.published !== false;
      if (!id) return new Response(JSON.stringify({ error: "id is required" }), { status: 400, headers: cors });
      await pool.query(`UPDATE public.leanie_providers SET status = $2, updated_at = now() WHERE id = $1`, [id, published ? "published" : "testing"]);
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    if (action === "models") {
      // Discover the models exposed by the provider's /models endpoint.
      const { rows } = await pool.query(`SELECT base_url, api_key, models FROM public.leanie_providers WHERE id = $1`, [String(body.id || "")]);
      if (!rows.length) return new Response(JSON.stringify({ error: "Provider not found" }), { status: 404, headers: cors });
      const baseUrl = String(rows[0].base_url).replace(/\/+$/, "");
      if (isMetaBaseUrl(baseUrl)) {
        // Meta providers are routing definitions, not discoverable endpoints.
        const configured = Array.isArray(rows[0].models) ? rows[0].models : [];
        return new Response(
          JSON.stringify({
            models: configured,
            meta: true,
            message: "Meta provider: models/targets are configured manually (no /models discovery).",
          }),
          { headers: cors },
        );
      }
      const res = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${rows[0].api_key}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return new Response(JSON.stringify({ error: `Models request failed: ${res.status} ${(await res.text()).slice(0, 200)}` }), { status: 502, headers: cors });
      const data = await res.json();
      const ids = Array.isArray(data?.data)
        ? data.data.map((m: any) => String(m?.id || m?.name || "")).filter(Boolean)
        : Array.isArray(data?.models)
          ? data.models.map((m: any) => String(m?.id || m?.name || m)).filter(Boolean)
          : [];
      const existing = await pool.query(`SELECT models FROM public.leanie_providers WHERE id = $1`, [String(body.id)]);
      const previous = Array.isArray(existing.rows[0]?.models) ? existing.rows[0].models : [];
      const previousById = new Map(previous.map((m: any) => [typeof m === "string" ? m : m?.id, m]));
      const merged = ids.map((id: string) => previousById.get(id) ?? { id });
      await pool.query(`UPDATE public.leanie_providers SET models = $2::jsonb, updated_at = now() WHERE id = $1`, [String(body.id), JSON.stringify(merged)]);
      return new Response(JSON.stringify({ models: merged }), { headers: cors });
    }

    if (action === "test") {
      // Small probe chat against one provider/model; recorded in leanie_model_runs (step 'probe').
      const model = String(body.model || "").trim();
      if (!model) return new Response(JSON.stringify({ error: "model is required" }), { status: 400, headers: cors });
      const { rows } = await pool.query(`SELECT id, name, base_url, api_key, models FROM public.leanie_providers WHERE id = $1`, [String(body.id || "")]);
      if (!rows.length) return new Response(JSON.stringify({ error: "Provider not found" }), { status: 404, headers: cors });
      const provider = rows[0];
      let target: StepTarget | null = null;
      if (isMetaBaseUrl(String(provider.base_url || ""))) {
        const { rows: providers } = await pool.query(`SELECT id, name, base_url, api_key, models FROM public.leanie_providers`);
        const byId = new Map<string, any>(providers.map((p: any) => [String(p.id), p]));
        target = stepTargetFromProvider(provider, model, {
          providerId: null, provider: "probe", baseUrl: "", apiKey: "", model, pricePrompt: 0, priceCompletion: 0,
        }, byId);
        if (!target) {
          return new Response(JSON.stringify({ error: "Meta provider model has no resolvable concrete targets." }), { status: 400, headers: cors });
        }
      } else {
        target = {
          providerId: String(body.id),
          provider: String(provider.name),
          baseUrl: String(provider.base_url).replace(/\/+$/, ""),
          apiKey: String(provider.api_key),
          model,
          pricePrompt: 0,
          priceCompletion: 0,
        };
        const models = Array.isArray(provider.models) ? provider.models : [];
        const entry = models.find((m: any) => (typeof m === "string" ? m === model : m?.id === model));
        if (entry && typeof entry !== "string") {
          target.pricePrompt = Number(entry.price_prompt_per_1m ?? 0) || 0;
          target.priceCompletion = Number(entry.price_completion_per_1m ?? 0) || 0;
        }
      }
      const startedAt = Date.now();
      let ok = false;
      let error: string | null = null;
      let tokens = { prompt: 0, completion: 0, total: 0 };
      let latencyMs = 0;
      let effectiveProvider = String(provider.name);
      let effectiveModel = model;
      try {
        const reply = await chat(target, "You are a connectivity probe. Reply with exactly: {\"ok\":true}", "Ping.", 20000);
        latencyMs = reply.latencyMs;
        tokens = { prompt: reply.promptTokens, completion: reply.completionTokens, total: reply.totalTokens };
        effectiveProvider = String((reply as any).effective?.provider ?? target.provider);
        effectiveModel = String((reply as any).effective?.model ?? target.model);
        ok = !!parseJson(reply.text);
        if (!ok) error = "Reply was not valid JSON";
      } catch (err) {
        error = String(err).slice(0, 300);
        latencyMs = Date.now() - startedAt;
      }
      try {
        await pool.query(
          `INSERT INTO public.leanie_model_runs
            (model, provider, step, mode, latency_ms, prompt_tokens, completion_tokens, total_tokens, cost_usd,
             json_valid, analysis_quality, risk_relevance, coherence, brief_title, error)
           VALUES ($1, $2, 'probe', $3, $4, $5, $6, $7, $8, NULL, NULL, NULL, NULL, $9, $10)`,
          [
            effectiveModel,
            effectiveProvider,
            ok ? "live" : "error",
            Math.round(latencyMs),
            tokens.prompt,
            tokens.completion,
            tokens.total,
            "0",
            `Provider test — ${String(provider.name)}/${model}`,
            error,
          ],
        );
      } catch (err) {
        console.error("probe run insert failed:", String(err).slice(0, 200));
      }
      return new Response(JSON.stringify({ ok, latencyMs, tokens, error, provider: effectiveProvider, model: effectiveModel }), { headers: cors });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: cors });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: cors });
  } finally {
    await pool.end().catch(() => {});
  }
}
