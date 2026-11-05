export default async function leanieCouncil(request: Request): Promise<Response> {
  const cors = { "content-type": "application/json", "access-control-allow-origin": "*" };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  const brief = await request.json().catch(() => null);
  if (!brief) return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: cors });
  const requestedStep = String(brief.step || "full").toLowerCase();
  if (!["full", "strategic", "feasibility", "critique", "arbiter"].includes(requestedStep)) {
    return new Response(JSON.stringify({ error: "Unknown Council step" }), { status: 400, headers: cors });
  }

  const apiKey = process.env.NVIDIA_NIM_API_KEY || "";
  const baseUrl = (process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");
  const models = {
    strategic: process.env.LEANIE_GLM_MODEL || "google/diffusiongemma-26b-a4b-it",
    synthesis: process.env.LEANIE_ARBITER_MODEL || "google/diffusiongemma-26b-a4b-it",
  };

  if (!apiKey) {
    return new Response(JSON.stringify(demoResult(brief, true)), { headers: cors });
  }

  try {
    const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
    async function chat(model: string, system: string, user: string) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90000);
      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          signal: controller.signal,
          method: "POST",
          headers,
          body: JSON.stringify({ model, temperature: 0.2, max_tokens: 1200, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
        });
        if (!res.ok) throw new Error(`NVIDIA NIM ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const data = await res.json();
        const message = data?.choices?.[0]?.message || {};
        return String(message.content || message.reasoning_content || "");
      } finally {
        clearTimeout(timer);
      }
    }
    if (requestedStep === "feasibility") {
    const reply = await chat(models.strategic, "Return JSON only with fields: feasible (boolean), notes (string), risks array {title,likelihood,mitigation}. No markdown.", JSON.stringify(brief));
    const feasibility = parseJson(reply) ?? { feasible: true, notes: "", risks: [] };
    return new Response(JSON.stringify({
      mode: "live",
      step: requestedStep,
      note: "feasibility",
      feasible: feasibility.feasible ?? true,
      notes: feasibility.notes || "",
      risks: Array.isArray(feasibility.risks) ? feasibility.risks.map((r: any) => ({ title: r.title || "Risk", likelihood: ["Low", "Medium", "High"].includes(r.likelihood) ? r.likelihood : "Medium", mitigation: r.mitigation || "" })) : [],
      analysis: { feasibility },
    }), { headers: cors });
  }

  if (requestedStep === "critique") {
    const reply = await chat(models.strategic, "Return JSON only with fields: assumptions string[] and risks array {title,likelihood,mitigation}. No markdown.", JSON.stringify(brief));
    const critique = parseJson(reply) ?? { assumptions: [], risks: [] };
    return new Response(JSON.stringify({
      mode: "live",
      step: requestedStep,
      "type": "critique",
      assumptions: Array.isArray(critique.assumptions) ? critique.assumptions : [],
      risks: Array.isArray(critique.risks) ? critique.risks.map((r: any) => ({ title: r.title || "Risk", likelihood: ["Low", "Medium", "High"].includes(r.likelihood) ? r.likelihood : "Medium", mitigation: r.mitigation || "" })) : [],
      analysis: { critique },
    }), { headers: cors });
  }

  const replyStrategic = await chat(models.strategic, "Return JSON only with fields: phases array {title,objective,tasks {title,description,priority,duration,dependency,resource,deliverable}}; risks array {title,likelihood,mitigation}; assumptions string[]; successCriteria string[]. No markdown.", JSON.stringify(brief));
  const strategic = parseJson(replyStrategic) ?? { phases: [], risks: [], assumptions: [], successCriteria: [] };
  const parsed = strategic;
  const phases = Array.isArray(parsed.phases) ? parsed.phases.map((p: any, i: number) => ({
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
  })) : [];
  const risks = Array.isArray(parsed.risks) ? parsed.risks.map((r: any) => ({
      title: r.title || "Risk",
      likelihood: ["Low", "Medium", "High"].includes(r.likelihood) ? r.likelihood : "Medium",
      mitigation: r.mitigation || "",
  })) : [];
  const assumptions = Array.isArray(parsed.assumptions) ? parsed.assumptions : [];
  const successCriteria = Array.isArray(parsed.successCriteria) ? parsed.successCriteria : [];
  return new Response(JSON.stringify({ mode: "live", step: requestedStep, phases, risks, assumptions, successCriteria, analysis: { strategic: parseJson(replyStrategic) } }), { headers: cors });

  } catch (error) {
    return new Response(JSON.stringify(demoResult(brief, true, String(error).slice(0, 300))), { headers: cors });
  }
}

function parseJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

function demoResult(brief: any, configured: boolean, error?: string) {
  return {
    mode: "demo",
    phases: [
      { id: "phase-1", title: "01 — Validate the problem", objective: "Confirm urgent recurring problem.", tasks: [{ id: crypto.randomUUID(), title: "Define validation criteria", description: "Translate objective into measurable thresholds.", priority: "High", duration: "2 days", dependency: "None", resource: "Project lead", deliverable: "Validation scorecard" }] },
      { id: "phase-2", title: "02 — Prototype the core path", objective: "Build the smallest credible test.", tasks: [{ id: crypto.randomUUID(), title: "Build a testable prototype", description: "Produce focused prototype covering core workflow.", priority: "Medium", duration: "2 weeks", dependency: "Interview synthesis", resource: "Designer + developer", deliverable: "Interactive prototype" }] },
      { id: "phase-3", title: "03 — Test and decide", objective: "Measure and decide.", tasks: [{ id: crypto.randomUUID(), title: "Make proceed / revise decision", description: "Compare evidence to thresholds.", priority: "High", duration: "2 days", dependency: "Test findings", resource: "Project sponsor", deliverable: "Decision memo" }] },
    ],
    risks: [{ title: "Insufficient access to target users", likelihood: "Medium", mitigation: "Recruit through two channels." }, { title: "Prototype scope expands", likelihood: "High", mitigation: "Freeze critical path." }],
    assumptions: ["Target users experience the problem monthly.", "A prototype is sufficient to test value.", "Decision-makers accept staged investment."],
    successCriteria: ["At least 6 of 8 interviews confirm urgency.", "4 of 5 users complete the critical path.", "Delivery estimate remains inside budget."],
    configured,
    ...(error ? { error } : {}),
  };
}
