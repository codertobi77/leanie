import { Pool } from "pg";

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
  const model = safeModel || process.env.LEANIE_GLM_MODEL || "google/diffusiongemma-26b-a4b-it";
  const baseUrl = (process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");
  const apiKey = process.env.NVIDIA_NIM_API_KEY || "";
  const pricePrompt = Number(process.env.LEANIE_PRICE_PROMPT_PER_1M || "0.2") || 0.2;
  const priceCompletion = Number(process.env.LEANIE_PRICE_COMPLETION_PER_1M || "0.6") || 0.6;
  const briefTitle = String(brief.title || "").slice(0, 200);

  if (!apiKey) {
    return new Response(JSON.stringify(demoResult(brief, requestedStep, true)), { headers: cors });
  }

  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  const runStartedAt = Date.now();
  const usage = { prompt: 0, completion: 0, total: 0 };
  let jsonValid = true;

  async function chat(system: string, user: string) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        signal: controller.signal,
        method: "POST",
        headers,
        body: JSON.stringify({ model, temperature: 0.25, max_tokens: 4096, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      });
      if (!res.ok) throw new Error(`NVIDIA NIM ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      const message = data?.choices?.[0]?.message || {};
      const raw = data?.usage || {};
      const promptTokens = Number(raw.prompt_tokens ?? 0) || 0;
      const completionTokens = Number(raw.completion_tokens ?? 0) || 0;
      const totalTokens = Number(raw.total_tokens ?? promptTokens + completionTokens) || promptTokens + completionTokens;
      return {
        text: String(message.content || message.reasoning_content || ""),
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs: Date.now() - startedAt,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  function addUsage(result: Awaited<ReturnType<typeof chat>>) {
    usage.prompt += result.promptTokens;
    usage.completion += result.completionTokens;
    usage.total += result.totalTokens;
    return result.text;
  }

  function parseTracked(text: string) {
    const parsed = parseJson(text);
    if (!parsed) jsonValid = false;
    return parsed;
  }

  async function recordRun(entry: {
    mode: string;
    latencyMs: number;
    jsonValid: boolean;
    analysisQuality: number | null;
    riskRelevance: number | null;
    coherence: number | null;
    error: string | null;
  }) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) return;
    const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await pool.query(
        `INSERT INTO public.leanie_model_runs
          (model, step, mode, latency_ms, prompt_tokens, completion_tokens, total_tokens, cost_usd,
           json_valid, analysis_quality, risk_relevance, coherence, brief_title, error)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          model,
          requestedStep,
          entry.mode,
          Math.round(entry.latencyMs),
          usage.prompt,
          usage.completion,
          usage.total,
          ((usage.prompt / 1e6) * pricePrompt + (usage.completion / 1e6) * priceCompletion).toFixed(6),
          entry.jsonValid,
          entry.analysisQuality,
          entry.riskRelevance,
          entry.coherence,
          briefTitle,
          entry.error,
        ],
      );
    } catch (error) {
      console.error("leanie_model_runs insert failed:", String(error).slice(0, 200));
    } finally {
      await pool.end().catch(() => {});
    }
  }

  async function finish(payload: Record<string, unknown>) {
    const latencyMs = Date.now() - runStartedAt;
    const costUsd = (usage.prompt / 1e6) * pricePrompt + (usage.completion / 1e6) * priceCompletion;
    const scores = {
      analysisQuality: scoreAnalysisQuality(payload),
      riskRelevance: scoreRiskRelevance(payload.risks),
      coherence: scoreCoherence(payload),
    };
    const metrics = {
      model,
      step: requestedStep,
      mode: "live",
      latencyMs,
      tokens: { prompt: usage.prompt, completion: usage.completion, total: usage.total },
      costUsd: Number(costUsd.toFixed(6)),
      jsonValid,
      scores,
    };
    await recordRun({
      mode: "live",
      latencyMs,
      jsonValid,
      analysisQuality: scores.analysisQuality,
      riskRelevance: scores.riskRelevance,
      coherence: scores.coherence,
      error: null,
    });
    return new Response(JSON.stringify({ ...payload, metrics }), { headers: cors });
  }

  try {
    const briefText = JSON.stringify(brief);

    if (requestedStep === "feasibility") {
      const reply = addUsage(await chat(
        "You are Leanie's Feasibility Analyst, an experienced solutions architect and delivery lead. Challenge strategy against real constraints: budget, deadline, staff, dependencies, infrastructure, security, maintenance, support, cost and operational risk. Return valid JSON only with: feasible (boolean), summary (string), notes (string), changed (boolean), risks array {title,likelihood:'Low'|'Medium'|'High',mitigation}, resourceWarnings (string[]). Be concrete. Do not include markdown.",
        briefText,
      ));
      const feasibility = parseTracked(reply) ?? { feasible: true, summary: "", notes: "", changed: false, risks: [], resourceWarnings: [] };
      return await finish({
        mode: "live",
        step: "feasibility",
        feasible: feasibility.feasible ?? true,
        notes: feasibility.notes || feasibility.summary || "",
        summary: feasibility.summary || feasibility.notes || "",
        risks: normalizeRisks(feasibility.risks),
        resourceWarnings: Array.isArray(feasibility.resourceWarnings) ? feasibility.resourceWarnings : [],
        analysis: { feasibility },
      });
    }

    if (requestedStep === "critique") {
      const reply = addUsage(await chat(
        "You are Leanie's independent Critical Reviewer. Your job is productive tension: challenge assumptions, scope creep, weak evidence, hidden dependencies, user-access, security, privacy, compliance, failure modes, edge cases, vague success metrics, and over-optimistic timelines. Return valid JSON only with: assumptions (string[]), risks array {title,likelihood:'Low'|'Medium'|'High',mitigation}, redFlags (string[]), challenged (boolean). No markdown.",
        briefText,
      ));
      const critical = parseTracked(reply) ?? { assumptions: [], risks: [], redFlags: [], challenged: false };
      return await finish({
        mode: "live",
        step: "critique",
        assumptions: Array.isArray(critical.assumptions) ? critical.assumptions : [],
        risks: normalizeRisks(critical.risks),
        redFlags: Array.isArray(critical.redFlags) ? critical.redFlags : [],
        analysis: { critique: critical },
      });
    }

    const strategicReply = addUsage(await chat(
      "You are Leanie's Strategic Analyst, an expert in product strategy, market fit, scope design and roadmap architecture. Build a complete execution plan covering every aspect of delivering the project: discovery and user validation, product positioning, UX and content, technical architecture and data model, integrations, security/privacy, infrastructure, development and testing, launch and rollback, operations and support, analytics and governance. Do not stop at three themes: produce 6 to 8 detailed phases with 4 to 6 concrete tasks per phase. Each task needs dependencies, resources and measurable deliverables. Return valid JSON only with: phases array {title,objective,tasks array {title,description,priority 'High'|'Medium'|'Low',duration,dependency,resource,deliverable}}; risks array {title,likelihood 'Low'|'Medium'|'High',mitigation}; assumptions string[]; successCriteria string[]. No markdown.",
      briefText,
    ));
    const strategic = parseTracked(strategicReply) ?? { phases: [], risks: [], assumptions: [], successCriteria: [] };

    if (requestedStep === "strategic") {
      const phases = normalizePhases(strategic.phases, strategic.risks);
      const risks = normalizeRisks(strategic.risks);
      return await finish({
        mode: "live",
        step: "strategic",
        phases,
        risks,
        assumptions: Array.isArray(strategic.assumptions) ? strategic.assumptions : [],
        successCriteria: Array.isArray(strategic.successCriteria) ? strategic.successCriteria : [],
        analysis: { strategic: parseTracked(strategicReply) },
      });
    }

    // full / arbiter: run the full council and have the arbiter synthesize into one comprehensive plan.
    const feasibilityReply = addUsage(await chat(
      "You are Leanie's Feasibility Analyst. Return valid JSON only with: feasible (boolean), notes (string), risks array {title,likelihood,mitigation}.",
      JSON.stringify({ brief, strategic }),
    ));
    const feasibility = parseTracked(feasibilityReply) ?? { feasible: true, notes: "", risks: [] };

    const critiqueReply = addUsage(await chat(
      "You are Leanie's Critical Reviewer. Return valid JSON only with: assumptions string[], risks array {title,likelihood,mitigation}.",
      JSON.stringify({ brief, strategic, feasibility }),
    ));
    const critique = parseTracked(critiqueReply) ?? { assumptions: [], risks: [] };

    const arbiterReply = addUsage(await chat(
      "You are Leanie's Arbiter. Synthesize the strategic, feasibility and critique perspectives into one comprehensive delivery plan. Do not collapse the plan into a few phases; include discovery, design, architecture, implementation, quality, security, launch, operations and governance as distinct phases. Resolve trade-offs explicitly. Return valid JSON only with: phases array {title,objective,tasks array {title,description,priority,duration,dependency,resource,deliverable}}, risks array {title,likelihood,mitigation}, assumptions string[], successCriteria string[].",
      JSON.stringify({ brief, strategic, feasibility, critique }),
    ));
    const synthesized = parseTracked(arbiterReply);
    const selected = isDetailedPlan(synthesized) ? synthesized : strategic;

    const phases = normalizePhases(selected.phases, strategic.risks);
    const risks = normalizeRisks(selected.risks && selected.risks.length ? selected.risks : strategic.risks);
    const assumptions = Array.isArray(selected.assumptions) && selected.assumptions.length ? selected.assumptions : (Array.isArray(critique.assumptions) ? critique.assumptions : []);
    const successCriteria = Array.isArray(selected.successCriteria) ? selected.successCriteria : [];

    return await finish({
      mode: "live",
      step: requestedStep,
      phases,
      risks,
      assumptions,
      successCriteria,
      analysis: { strategic, feasibility, critique, arbiter: parseTracked(arbiterReply) },
    });
  } catch (error) {
    const message = String(error).slice(0, 300);
    await recordRun({
      mode: "error",
      latencyMs: Date.now() - runStartedAt,
      jsonValid: false,
      analysisQuality: null,
      riskRelevance: null,
      coherence: null,
      error: message,
    });
    return new Response(JSON.stringify(demoResult(brief, requestedStep, true, message)), { headers: cors });
  }
}

function normalizePhases(input: unknown, fallbackRisks: unknown) {
  const source = Array.isArray(input) ? input : [];
  const phases = source.map((p: any, i: number) => ({
    id: `phase-${i + 1}`,
    title: p.title || `0${i + 1} — Phase`,
    objective: p.objective || "",
    tasks: Array.isArray(p.tasks) ? p.tasks.map((t: any) => ({
      id: crypto.randomUUID(),
      title: t.title || "Task",
      description: t.description || "",
      priority: ["High", "Medium", "Low"].includes(t.priority) ? t.priority : "Medium",
      duration: t.duration || "1 week",
      dependency: t.dependency || "None",
      resource: t.resource || "Unassigned",
      deliverable: t.deliverable || "Defined output",
    })) : [],
  }));
  if (phases.length > 0) return phases;
  return [];
}

function normalizeRisks(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.map((r: any) => ({
    title: r.title || "Risk",
    likelihood: ["Low", "Medium", "High"].includes(r.likelihood) ? r.likelihood : "Medium",
    mitigation: r.mitigation || "",
  })).filter((risk: any) => risk.title);
}

function isDetailedPlan(value: any) {
  if (!value || !Array.isArray(value.phases)) return false;
  return value.phases.length >= 4 && value.phases.some((phase: any) => Array.isArray(phase.tasks) && phase.tasks.length >= 2);
}

function parseJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

// Heuristic quality scores (0-100) computed from the normalized payload.
function scoreAnalysisQuality(payload: any): number | null {
  const phases = Array.isArray(payload?.phases) ? payload.phases : [];
  if (phases.length) {
    const tasks = phases.flatMap((p: any) => (Array.isArray(p?.tasks) ? p.tasks : []));
    const phaseScore = (Math.min(phases.length, 8) / 8) * 40;
    const avgTasks = phases.length ? tasks.length / phases.length : 0;
    const taskScore = (Math.min(avgTasks, 5) / 5) * 35;
    const described = tasks.filter((t: any) => String(t?.description || "").trim().length >= 30).length;
    const descScore = tasks.length ? (described / tasks.length) * 25 : 0;
    return Math.round(phaseScore + taskScore + descScore);
  }
  const words = [payload?.summary, payload?.notes].filter(Boolean).join(" ").split(/\s+/).filter(Boolean).length;
  const flags = Array.isArray(payload?.redFlags) ? payload.redFlags.length : 0;
  if (!words && !flags) return null;
  return Math.round((Math.min(words, 120) / 120) * 70 + (Math.min(flags, 4) / 4) * 30);
}

function scoreRiskRelevance(risks: unknown): number {
  if (!Array.isArray(risks) || !risks.length) return 0;
  const countScore = (Math.min(risks.length, 5) / 5) * 45;
  const withMitigation = risks.filter((r: any) => String(r?.mitigation || "").trim().length >= 15).length;
  const mitigationScore = (withMitigation / risks.length) * 35;
  const validLikelihood = risks.filter((r: any) => ["Low", "Medium", "High"].includes(r?.likelihood)).length;
  const likelihoodScore = (validLikelihood / risks.length) * 20;
  return Math.round(countScore + mitigationScore + likelihoodScore);
}

function scoreCoherence(payload: any): number {
  const phases = Array.isArray(payload?.phases) ? payload.phases : [];
  if (phases.length) {
    const tasks = phases.flatMap((p: any) => (Array.isArray(p?.tasks) ? p.tasks : []));
    const criteria = Array.isArray(payload?.successCriteria) ? payload.successCriteria : [];
    const assumptions = Array.isArray(payload?.assumptions) ? payload.assumptions : [];
    const criteriaScore = (Math.min(criteria.length, 3) / 3) * 25;
    const assumptionScore = (Math.min(assumptions.length, 3) / 3) * 25;
    const withDependency = tasks.filter((t: any) => {
      const dependency = String(t?.dependency || "").trim();
      return dependency && dependency.toLowerCase() !== "none";
    }).length;
    const depScore = tasks.length ? (withDependency / tasks.length) * 25 : 0;
    const withDuration = tasks.filter((t: any) => String(t?.duration || "").trim()).length;
    const durScore = tasks.length ? (withDuration / tasks.length) * 25 : 0;
    return Math.round(criteriaScore + assumptionScore + depScore + durScore);
  }
  const risks = Array.isArray(payload?.risks) ? payload.risks : [];
  const assumptions = Array.isArray(payload?.assumptions) ? payload.assumptions : [];
  const warnings = Array.isArray(payload?.resourceWarnings) ? payload.resourceWarnings : [];
  const structured = risks.length + assumptions.length + warnings.length;
  return Math.round((Math.min(structured, 5) / 5) * 100);
}

function demoResult(brief: any, step: string, configured: boolean, error?: string) {
  const assumptions = ["Target users experience the problem monthly.", "A prototype is sufficient to test value.", "Decision-makers accept staged investment."];
  const successCriteria = ["At least 6 of 8 interviews confirm urgency.", "4 of 5 users complete the critical path.", "Delivery estimate remains inside budget."];
  const phases = [
    { id: "phase-1", title: "01 — Discovery & validation", objective: "Frame the decision and validate the problem with users.", tasks: [
      { id: crypto.randomUUID(), title: "Define success thresholds", description: "Translate the objective into measurable evidence and decision rules.", priority: "High", duration: "2 days", dependency: "None", resource: "Project lead", deliverable: "Validation scorecard" },
      { id: crypto.randomUUID(), title: "Interview target users", description: "Run structured interviews about current behavior, cost and alternatives.", priority: "High", duration: "1 week", dependency: "Validation scorecard", resource: "Researcher", deliverable: "Interview synthesis" },
    ] },
    { id: "phase-2", title: "02 — Product strategy & UX", objective: "Define scope, journey and prototype.", tasks: [
      { id: crypto.randomUUID(), title: "Map critical journey", description: "Reduce the experience to decisions and actions needed for the primary outcome.", priority: "High", duration: "3 days", dependency: "Interview synthesis", resource: "Product designer", deliverable: "Journey map" },
      { id: crypto.randomUUID(), title: "Create testable prototype", description: "Build the smallest credible experience to test the core value proposition.", priority: "Medium", duration: "2 weeks", dependency: "Journey map", resource: "Designer + developer", deliverable: "Interactive prototype" },
    ] },
    { id: "phase-3", title: "03 — Technical architecture", objective: "Choose stack, data, security and run constraints.", tasks: [
      { id: crypto.randomUUID(), title: "Define architecture decision record", description: "Capture components, integrations, privacy and failure-mode mitigation.", priority: "High", duration: "3 days", dependency: "MVP feature list", resource: "Tech lead", deliverable: "Architecture decision record" },
      { id: crypto.randomUUID(), title: "Prepare test environment", description: "Set up previews, secrets, monitoring and seed data safely.", priority: "Medium", duration: "2 days", dependency: "Architecture decision record", resource: "Developer", deliverable: "Preview environment" },
    ] },
    { id: "phase-4", title: "04 — Implementation & tests", objective: "Build, verify and stabilize the MVP.", tasks: [
      { id: crypto.randomUUID(), title: "Implement core workflow", description: "Deliver the smallest end-to-end workflow that validates the hypothesis.", priority: "High", duration: "2 weeks", dependency: "Interactive prototype", resource: "Developer", deliverable: "Working MVP" },
      { id: crypto.randomUUID(), title: "Run moderated usability tests", description: "Observe five target users and capture structured evidence.", priority: "High", duration: "1 week", dependency: "Working MVP", resource: "Product lead", deliverable: "Test findings" },
    ] },
    { id: "phase-5", title: "05 — Launch & validation", objective: "Launch, measure and make the investment decision.", tasks: [
      { id: crypto.randomUUID(), title: "Pilot launch", description: "Release to a limited user group with monitoring and rollback plan.", priority: "High", duration: "1 week", dependency: "Test findings", resource: "Product + engineering", deliverable: "Pilot report" },
      { id: crypto.randomUUID(), title: "Make proceed / revise decision", description: "Compare evidence to thresholds and document the next investment step.", priority: "High", duration: "2 days", dependency: "Pilot report", deliverable: "Decision memo" },
    ] },
  ];
  const risks = [
    { title: "Insufficient access to target users", likelihood: "Medium", mitigation: "Recruit through two channels and maintain a reserve list." },
    { title: "Prototype scope expands during delivery", likelihood: "High", mitigation: "Freeze the critical path; defer secondary workflows." },
    { title: "Security or privacy is overlooked", likelihood: "Medium", mitigation: "Review auth, data and permissions before launch." },
  ];
  return {
    mode: "demo",
    step,
    phases,
    risks,
    assumptions,
    successCriteria,
    configured: configured && !error,
    ...(error ? { error: error } : {}),
  };
}
