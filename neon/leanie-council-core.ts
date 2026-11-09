import { Pool } from "pg";

// Shared Council engine used by the production `council` function and the
// admin `bench` function. Every step can target a different provider/model.

export interface StepTarget {
  providerId: string | null;
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  pricePrompt: number; // USD per 1M prompt tokens
  priceCompletion: number; // USD per 1M completion tokens
  // P5.15 meta-provider: routes a step across concrete targets (no schema change).
  meta?: {
    strategy: "fallback" | "first";
    targets: StepTarget[];
  };
}

export interface StepDetail {
  step: string;
  provider: string;
  model: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  jsonValid: boolean;
  error: string | null;
}

export interface PipelineResult {
  payload: Record<string, unknown>;
  steps: StepDetail[];
  usage: { prompt: number; completion: number; total: number };
  costUsd: number;
  jsonValid: boolean;
  failed: boolean;
  error: string | null;
}

export const COUNCIL_STEPS = ["strategic", "feasibility", "critique", "arbiter"] as const;

export function envTarget(model: string): StepTarget {
  return {
    providerId: null,
    provider: "nvidia-nim",
    baseUrl: (process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, ""),
    apiKey: process.env.NVIDIA_NIM_API_KEY || "",
    model,
    pricePrompt: Number(process.env.LEANIE_PRICE_PROMPT_PER_1M || "0.2") || 0.2,
    priceCompletion: Number(process.env.LEANIE_PRICE_COMPLETION_PER_1M || "0.6") || 0.6,
  };
}

export function defaultModel(): string {
  return process.env.LEANIE_GLM_MODEL || "google/diffusiongemma-26b-a4b-it";
}

function modelPrice(providerRow: any, model: string, fallback: StepTarget) {
  const models = Array.isArray(providerRow?.models) ? providerRow.models : [];
  const entry = models.find((m: any) => (typeof m === "string" ? m === model : m?.id === model));
  if (!entry || typeof entry === "string") return { pricePrompt: fallback.pricePrompt, priceCompletion: fallback.priceCompletion };
  return {
    pricePrompt: Number(entry.price_prompt_per_1m ?? entry.pricePrompt ?? fallback.pricePrompt) || fallback.pricePrompt,
    priceCompletion: Number(entry.price_completion_per_1m ?? entry.priceCompletion ?? fallback.priceCompletion) || fallback.priceCompletion,
  };
}

export function isMetaProviderRow(providerRow: any): boolean {
  return String(providerRow?.base_url || "").startsWith("meta:");
}

function resolveConcreteTarget(providerRow: any, model: string, fallback: StepTarget): StepTarget | null {
  if (!providerRow?.base_url || !providerRow?.api_key) return null;
  const prices = modelPrice(providerRow, model, fallback);
  return {
    providerId: String(providerRow.id),
    provider: String(providerRow.name),
    baseUrl: String(providerRow.base_url).replace(/\/+$/, ""),
    apiKey: String(providerRow.api_key),
    model,
    ...prices,
  };
}

export function stepTargetFromProvider(
  providerRow: any,
  model: string,
  fallback: StepTarget,
  byId?: Map<string, any>,
): StepTarget | null {
  if (!providerRow) return null;
  if (isMetaProviderRow(providerRow)) {
    const models = Array.isArray(providerRow.models) ? providerRow.models : [];
    const entry = models.find((m: any) => (typeof m === "string" ? m === model : m?.id === model));
    const rawTargets = Array.isArray((entry as any)?.targets) ? (entry as any).targets : [];
    const strategy: "fallback" | "first" =
      (entry as any)?.strategy === "first" ? "first" : "fallback";
    const targets = (byId ? rawTargets : [])
      .map((t: any) => {
        const pid = String(t?.providerId || "");
        const pmodel = String(t?.model || "");
        if (!pid || !pmodel) return null;
        const row = byId!.get(pid);
        if (!row || isMetaProviderRow(row)) return null; // concrete only, no recursion
        return resolveConcreteTarget(row, pmodel, fallback);
      })
      .filter(Boolean) as StepTarget[];
    if (!targets.length) return null;
    return {
      providerId: String(providerRow.id),
      provider: String(providerRow.name || "meta"),
      baseUrl: String(providerRow.base_url || "meta:fallback"),
      apiKey: "",
      model,
      pricePrompt: targets[0].pricePrompt,
      priceCompletion: targets[0].priceCompletion,
      meta: { strategy, targets },
    };
  }
  return resolveConcreteTarget(providerRow, model, fallback);
}

// Build a per-step plan from a published council config (production path).
export async function loadPublishedPlan(pool: Pool): Promise<{ plan: Record<string, StepTarget>; configId: string | null; configName: string | null } | null> {
  const fallback = envTarget(defaultModel());
  const { rows } = await pool.query(
    `SELECT id, name, steps FROM public.leanie_council_configs WHERE status = 'published' ORDER BY updated_at DESC LIMIT 1`,
  );
  if (!rows.length) return null;
  const { rows: providers } = await pool.query(`SELECT id, name, base_url, api_key, models FROM public.leanie_providers`);
  const byId = new Map<string, any>(providers.map((p: any) => [String(p.id), p]));
  const plan: Record<string, StepTarget> = {};
  const configSteps = rows[0].steps || {};
  for (const step of COUNCIL_STEPS) {
    const entry = configSteps[step];
    const model = entry?.model ? String(entry.model) : "";
    if (!model) continue;
    const providerRow = entry?.providerId ? byId.get(String(entry.providerId)) : null;
    const target = providerRow ? stepTargetFromProvider(providerRow, model, fallback, byId) : null;
    if (target) plan[step] = target;
  }
  if (!Object.keys(plan).length) return null;
  return { plan, configId: String(rows[0].id), configName: String(rows[0].name) };
}

// Build a per-step plan from an inline {step: {providerId, model}} override.
// Provider credentials always resolve from the database, never from the request.
export async function resolvePlanOverride(pool: Pool, steps: unknown): Promise<Record<string, StepTarget>> {
  const fallback = envTarget(defaultModel());
  if (!steps || typeof steps !== "object") return {};
  const { rows: providers } = await pool.query(`SELECT id, name, base_url, api_key, models FROM public.leanie_providers`);
  const byId = new Map<string, any>(providers.map((p: any) => [String(p.id), p]));
  const plan: Record<string, StepTarget> = {};
  for (const step of COUNCIL_STEPS) {
    const entry = (steps as Record<string, any>)[step];
    const model = entry?.model ? String(entry.model) : "";
    const providerId = entry?.providerId ? String(entry.providerId) : "";
    if (!model || !providerId) continue;
    const providerRow = byId.get(providerId);
    const target = providerRow ? stepTargetFromProvider(providerRow, model, fallback, byId) : null;
    if (target) plan[step] = target;
  }
  return plan;
}

async function chatOnce(target: StepTarget, system: string, user: string, timeoutMs = 25000) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${target.baseUrl}/chat/completions`, {
      signal: controller.signal,
      method: "POST",
      headers: { Authorization: `Bearer ${target.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: target.model,
        temperature: 0.25,
        max_tokens: 4096,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`${target.provider} ${res.status}: ${(await res.text()).slice(0, 300)}`);
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
      effective: {
        provider: target.provider,
        model: target.model,
        pricePrompt: target.pricePrompt,
        priceCompletion: target.priceCompletion,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function chat(target: StepTarget, system: string, user: string, timeoutMs = 25000) {
  if (target.meta?.targets?.length) {
    const errors: string[] = [];
    for (const concrete of target.meta.targets) {
      try {
        const reply = await chatOnce(concrete, system, user, timeoutMs);
        return {
          ...reply,
          effective: {
            ...reply.effective,
            // surface the meta route while keeping concrete provider/model for metrics
            provider: `${target.provider}>${reply.effective.provider}`,
            model: reply.effective.model,
          },
        };
      } catch (error) {
        errors.push(`${concrete.provider}/${concrete.model}: ${String(error).slice(0, 160)}`);
      }
    }
    throw new Error(`Meta-provider ${target.model} failed: ${errors.join(" | ").slice(0, 500)}`);
  }
  return chatOnce(target, system, user, timeoutMs);
}

export function parseJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

// Run the requested Council step (or the full pipeline) with per-step targets.
export async function runPipeline(opts: {
  brief: any;
  requestedStep: string;
  plan: Record<string, StepTarget>;
  onStep?: (update: { step: string; status: "running" | "done" | "failed"; detail?: StepDetail }) => void | Promise<void>;
}): Promise<PipelineResult> {
  const { brief, requestedStep, plan, onStep } = opts;
  const fallback = envTarget(defaultModel());
  const targetFor = (step: string): StepTarget => plan[step] || fallback;
  const briefText = JSON.stringify(brief);

  const steps: StepDetail[] = [];
  const usage = { prompt: 0, completion: 0, total: 0 };
  let jsonValid = true;
  let costUsd = 0;

  async function runStep(step: string, system: string, user: string) {
    const target = targetFor(step);
    await onStep?.({ step, status: "running" });
    try {
      const reply = await chat(target, system, user);
      const parsed = parseJson(reply.text);
      if (!parsed) jsonValid = false;
      const effective = (reply as any).effective ?? target;
      const detail: StepDetail = {
        step,
        provider: String(effective.provider ?? target.provider),
        model: String(effective.model ?? target.model),
        latencyMs: reply.latencyMs,
        promptTokens: reply.promptTokens,
        completionTokens: reply.completionTokens,
        totalTokens: reply.totalTokens,
        costUsd: Number(
          (
            (reply.promptTokens / 1e6) * Number(effective.pricePrompt ?? target.pricePrompt ?? 0) +
            (reply.completionTokens / 1e6) * Number(effective.priceCompletion ?? target.priceCompletion ?? 0)
          ).toFixed(6),
        ),
        jsonValid: !!parsed,
        error: null,
      };
      steps.push(detail);
      usage.prompt += detail.promptTokens;
      usage.completion += detail.completionTokens;
      usage.total += detail.totalTokens;
      costUsd += detail.costUsd;
      await onStep?.({ step, status: "done", detail });
      return { parsed, text: reply.text };
    } catch (error) {
      const message = String(error).slice(0, 300);
      const detail: StepDetail = {
        step,
        provider: target.provider,
        model: target.model,
        latencyMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        jsonValid: false,
        error: message,
      };
      steps.push(detail);
      await onStep?.({ step, status: "failed", detail });
      throw new Error(message);
    }
  }

  try {
    if (requestedStep === "feasibility") {
      const { parsed: feasibility } = await runStep(
        "feasibility",
        "You are LeanIE Plan's Feasibility Analyst, an experienced solutions architect and delivery lead. Challenge strategy against real constraints: budget, deadline, staff, dependencies, infrastructure, security, maintenance, support, cost and operational risk. Return valid JSON only with: feasible (boolean), summary (string), notes (string), changed (boolean), risks array {title,likelihood:'Low'|'Medium'|'High',mitigation}, resourceWarnings (string[]). Be concrete. Do not include markdown.",
        briefText,
      );
      const safe = feasibility ?? { feasible: true, summary: "", notes: "", changed: false, risks: [], resourceWarnings: [] };
      return {
        payload: {
          mode: "live",
          step: "feasibility",
          feasible: safe.feasible ?? true,
          notes: safe.notes || safe.summary || "",
          summary: safe.summary || safe.notes || "",
          risks: normalizeRisks(safe.risks),
          resourceWarnings: Array.isArray(safe.resourceWarnings) ? safe.resourceWarnings : [],
          analysis: { feasibility: safe },
        },
        steps, usage, costUsd: Number(costUsd.toFixed(6)), jsonValid, failed: false, error: null,
      };
    }

    if (requestedStep === "critique") {
      const { parsed: critical } = await runStep(
        "critique",
        "You are LeanIE Plan's independent Critical Reviewer. Your job is productive tension: challenge assumptions, scope creep, weak evidence, hidden dependencies, user-access, security, privacy, compliance, failure modes, edge cases, vague success metrics, and over-optimistic timelines. Return valid JSON only with: assumptions (string[]), risks array {title,likelihood:'Low'|'Medium'|'High',mitigation}, redFlags (string[]), challenged (boolean). No markdown.",
        briefText,
      );
      const safe = critical ?? { assumptions: [], risks: [], redFlags: [], challenged: false };
      return {
        payload: {
          mode: "live",
          step: "critique",
          assumptions: Array.isArray(safe.assumptions) ? safe.assumptions : [],
          risks: normalizeRisks(safe.risks),
          redFlags: Array.isArray(safe.redFlags) ? safe.redFlags : [],
          analysis: { critique: safe },
        },
        steps, usage, costUsd: Number(costUsd.toFixed(6)), jsonValid, failed: false, error: null,
      };
    }

    const { parsed: strategicRaw } = await runStep(
      "strategic",
      "You are LeanIE Plan's Strategic Analyst, an expert in product strategy, market fit, scope design and roadmap architecture. Build a complete execution plan covering every aspect of delivering the project: discovery and user validation, product positioning, UX and content, technical architecture and data model, integrations, security/privacy, infrastructure, development and testing, launch and rollback, operations and support, analytics and governance. Do not stop at three themes: produce 6 to 8 detailed phases with 4 to 6 concrete tasks per phase. Each task needs dependencies, resources and measurable deliverables. Return valid JSON only with: phases array {title,objective,tasks array {title,description,priority 'High'|'Medium'|'Low',duration,dependency,resource,deliverable}}; risks array {title,likelihood 'Low'|'Medium'|'High',mitigation}; assumptions string[]; successCriteria string[]. No markdown.",
      briefText,
    );
    const strategic = strategicRaw ?? { phases: [], risks: [], assumptions: [], successCriteria: [] };

    if (requestedStep === "strategic") {
      return {
        payload: {
          mode: "live",
          step: "strategic",
          phases: normalizePhases(strategic.phases, strategic.risks),
          risks: normalizeRisks(strategic.risks),
          assumptions: Array.isArray(strategic.assumptions) ? strategic.assumptions : [],
          successCriteria: Array.isArray(strategic.successCriteria) ? strategic.successCriteria : [],
          analysis: { strategic: strategicRaw },
        },
        steps, usage, costUsd: Number(costUsd.toFixed(6)), jsonValid, failed: false, error: null,
      };
    }

    // full / arbiter: run the full council and have the arbiter synthesize into one comprehensive plan.
    const { parsed: feasibility } = await runStep(
      "feasibility",
      "You are LeanIE Plan's Feasibility Analyst. Return valid JSON only with: feasible (boolean), notes (string), risks array {title,likelihood,mitigation}.",
      JSON.stringify({ brief, strategic }),
    );
    const safeFeasibility = feasibility ?? { feasible: true, notes: "", risks: [] };

    const { parsed: critique } = await runStep(
      "critique",
      "You are LeanIE Plan's Critical Reviewer. Return valid JSON only with: assumptions string[], risks array {title,likelihood,mitigation}.",
      JSON.stringify({ brief, strategic, feasibility: safeFeasibility }),
    );
    const safeCritique = critique ?? { assumptions: [], risks: [] };

    const { parsed: synthesized, text: arbiterReply } = await runStep(
      "arbiter",
      "You are LeanIE Plan's Arbiter. Synthesize the strategic, feasibility and critique perspectives into one comprehensive delivery plan. Do not collapse the plan into a few phases; include discovery, design, architecture, implementation, quality, security, launch, operations and governance as distinct phases. Resolve trade-offs explicitly. Return valid JSON only with: phases array {title,objective,tasks array {title,description,priority,duration,dependency,resource,deliverable}}, risks array {title,likelihood,mitigation}, assumptions string[], successCriteria string[].",
      JSON.stringify({ brief, strategic, feasibility: safeFeasibility, critique: safeCritique }),
    );

    const selected = isDetailedPlan(synthesized) ? synthesized : strategic;
    const payload = {
      mode: "live",
      step: requestedStep,
      phases: normalizePhases(selected.phases, strategic.risks),
      risks: normalizeRisks(selected.risks && selected.risks.length ? selected.risks : strategic.risks),
      assumptions: Array.isArray(selected.assumptions) && selected.assumptions.length
        ? selected.assumptions
        : (Array.isArray(safeCritique.assumptions) ? safeCritique.assumptions : []),
      successCriteria: Array.isArray(selected.successCriteria) ? selected.successCriteria : [],
      analysis: { strategic: strategicRaw, feasibility: safeFeasibility, critique: safeCritique, arbiter: synthesized ?? parseJson(arbiterReply) },
    };
    return { payload, steps, usage, costUsd: Number(costUsd.toFixed(6)), jsonValid, failed: false, error: null };
  } catch (error) {
    return {
      payload: demoResult(brief, requestedStep, true, String(error).slice(0, 300)),
      steps, usage, costUsd: Number(costUsd.toFixed(6)), jsonValid, failed: true,
      error: String(error).slice(0, 300),
    };
  }
}

// Heuristic quality scores (0-100) computed from the normalized payload.
export function scoreAnalysisQuality(payload: any): number | null {
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

export function scoreRiskRelevance(risks: unknown): number {
  if (!Array.isArray(risks) || !risks.length) return 0;
  const countScore = (Math.min(risks.length, 5) / 5) * 45;
  const withMitigation = risks.filter((r: any) => String(r?.mitigation || "").trim().length >= 15).length;
  const mitigationScore = (withMitigation / risks.length) * 35;
  const validLikelihood = risks.filter((r: any) => ["Low", "Medium", "High"].includes(r?.likelihood)).length;
  const likelihoodScore = (validLikelihood / risks.length) * 20;
  return Math.round(countScore + mitigationScore + likelihoodScore);
}

export function scoreCoherence(payload: any): number {
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

export function normalizePhases(input: unknown, fallbackRisks: unknown) {
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

export function normalizeRisks(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.map((r: any) => ({
    title: r.title || "Risk",
    likelihood: ["Low", "Medium", "High"].includes(r.likelihood) ? r.likelihood : "Medium",
    mitigation: r.mitigation || "",
  })).filter((risk: any) => risk.title);
}

export function isDetailedPlan(value: any) {
  if (!value || !Array.isArray(value.phases)) return false;
  return value.phases.length >= 4 && value.phases.some((phase: any) => Array.isArray(phase.tasks) && phase.tasks.length >= 2);
}

export function demoResult(brief: any, step: string, configured: boolean, error?: string) {
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
