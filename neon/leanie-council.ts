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

  const model = process.env.LEANIE_GLM_MODEL || "google/diffusiongemma-26b-a4b-it";
  const baseUrl = (process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");
  const apiKey = process.env.NVIDIA_NIM_API_KEY || "";

  if (!apiKey) {
    return new Response(JSON.stringify(demoResult(brief, requestedStep, true)), { headers: cors });
  }

  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  async function chat(system: string, user: string) {
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
      return String(message.content || message.reasoning_content || "");
    } finally {
      clearTimeout(timer);
    }
  }

  function parseJsonResult(text: string) {
    return parseJson(text);
  }

  try {
    const briefText = JSON.stringify(brief);

    if (requestedStep === "feasibility") {
      const reply = await chat(
        "You are Leanie's Feasibility Analyst, an experienced solutions architect and delivery lead. Challenge strategy against real constraints: budget, deadline, staff, dependencies, infrastructure, security, maintenance, support, cost and operational risk. Return valid JSON only with: feasible (boolean), summary (string), notes (string), changed (boolean), risks array {title,likelihood:'Low'|'Medium'|'High',mitigation}, resourceWarnings (string[]). Be concrete. Do not include markdown.",
        briefText,
      );
      const feasibility = parseJsonResult(reply) ?? { feasible: true, summary: "", notes: "", changed: false, risks: [], resourceWarnings: [] };
      return new Response(JSON.stringify({
        mode: "live",
        step: "feasibility",
        feasible: feasibility.feasible ?? true,
        notes: feasibility.notes || feasibility.summary || "",
        summary: feasibility.summary || feasibility.notes || "",
        risks: normalizeRisks(feasibility.risks),
        resourceWarnings: Array.isArray(feasibility.resourceWarnings) ? feasibility.resourceWarnings : [],
        analysis: { feasibility },
      }), { headers: cors });
    }

    if (requestedStep === "critique") {
      const reply = await chat(
        "You are Leanie's independent Critical Reviewer. Your job is productive tension: challenge assumptions, scope creep, weak evidence, hidden dependencies, user-access, security, privacy, compliance, failure modes, edge cases, vague success metrics, and over-optimistic timelines. Return valid JSON only with: assumptions (string[]), risks array {title,likelihood:'Low'|'Medium'|'High',mitigation}, redFlags (string[]), challenged (boolean). No markdown.",
        briefText,
      );
      const critical = parseJsonResult(reply) ?? { assumptions: [], risks: [], redFlags: [], challenged: false };
      return new Response(JSON.stringify({
        mode: "live",
        step: "critique",
        assumptions: Array.isArray(critical.assumptions) ? critical.assumptions : [],
        risks: normalizeRisks(critical.risks),
        redFlags: Array.isArray(critical.redFlags) ? critical.redFlags : [],
        analysis: { critique: critical },
      }), { headers: cors });
    }

    const strategicReply = await chat(
      "You are Leanie's Strategic Analyst, an expert in product strategy, market fit, scope design and roadmap architecture. Build a complete execution plan covering every aspect of delivering the project: discovery and user validation, product positioning, UX and content, technical architecture and data model, integrations, security/privacy, infrastructure, development and testing, launch and rollback, operations and support, analytics and governance. Do not stop at three themes: produce 6 to 8 detailed phases with 4 to 6 concrete tasks per phase. Each task needs dependencies, resources and measurable deliverables. Return valid JSON only with: phases array {title,objective,tasks array {title,description,priority 'High'|'Medium'|'Low',duration,dependency,resource,deliverable}}; risks array {title,likelihood 'Low'|'Medium'|'High',mitigation}; assumptions string[]; successCriteria string[]. No markdown.",
      briefText,
    );
    const strategic = parseJson(strategicReply) ?? { phases: [], risks: [], assumptions: [], successCriteria: [] };

    if (requestedStep === "strategic") {
      const phases = normalizePhases(strategic.phases, strategic.risks);
      const risks = normalizeRisks(strategic.risks);
      return new Response(JSON.stringify({
        mode: "live",
        step: "strategic",
        phases,
        risks,
        assumptions: Array.isArray(strategic.assumptions) ? strategic.assumptions : [],
        successCriteria: Array.isArray(strategic.successCriteria) ? strategic.successCriteria : [],

        analysis: { strategic: parseJson(strategicReply) },
      }), { headers: cors });
    }

    // full / arbiter: run the full council and have the arbiter synthesize into one comprehensive plan.
    const feasibilityReply = await chat(
      "You are Leanie's Feasibility Analyst. Return valid JSON only with: feasible (boolean), notes (string), risks array {title,likelihood,mitigation}.",
      JSON.stringify({ brief, strategic }),
    );
    const feasibility = parseJson(feasibilityReply) ?? { feasible: true, notes: "", risks: [] };

    const critiqueReply = await chat(
      "You are Leanie's Critical Reviewer. Return valid JSON only with: assumptions string[], risks array {title,likelihood,mitigation}.",
      JSON.stringify({ brief, strategic, feasibility }),
    );
    const critique = parseJson(critiqueReply) ?? { assumptions: [], risks: [] };

    const arbiterReply = await chat(
      "You are Leanie's Arbiter. Synthesize the strategic, feasibility and critique perspectives into one comprehensive delivery plan. Do not collapse the plan into a few phases; include discovery, design, architecture, implementation, quality, security, launch, operations and governance as distinct phases. Resolve trade-offs explicitly. Return valid JSON only with: phases array {title,objective,tasks array {title,description,priority,duration,dependency,resource,deliverable}}, risks array {title,likelihood,mitigation}, assumptions string[], successCriteria string[].",
      JSON.stringify({ brief, strategic, feasibility, critique }),
    );
    const synthesized = parseJson(arbiterReply);
    const selected = isDetailedPlan(synthesized) ? synthesized : strategic;

    const phases = normalizePhases(selected.phases, strategic.risks);
    const risks = normalizeRisks(selected.risks && selected.risks.length ? selected.risks : strategic.risks);
    const assumptions = Array.isArray(selected.assumptions) && selected.assumptions.length ? selected.assumptions : (Array.isArray(critique.assumptions) ? critique.assumptions : []);
    const successCriteria = Array.isArray(selected.successCriteria) ? selected.successCriteria : [];

    return new Response(JSON.stringify({
      mode: "live",
      step: requestedStep,
      phases,
      risks,
      assumptions,
      successCriteria,
      analysis: { strategic, feasibility, critique, arbiter: parseJson(arbiterReply) },
    }), { headers: cors });
  } catch (error) {
    return new Response(JSON.stringify(demoResult(brief, requestedStep, true, String(error).slice(0, 300))), { headers: cors });
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