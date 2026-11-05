export default async function leanieCouncil(request: Request): Promise<Response> {
  const cors = { "content-type": "application/json", "access-control-allow-origin": "*" };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  const brief = await request.json().catch(() => null);
  if (!brief) return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: cors });

  const apiKey = process.env.NVIDIA_NIM_API_KEY || "";
  const baseUrl = (process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");
  const models = {
    strategic: process.env.LEANIE_GLM_MODEL || "z-ai/glm-5.3-flash",
    feasibility: process.env.LEANIE_DEEPSEEK_MODEL || "deepseek-ai/deepseek-v4.1-flash",
    critique: process.env.LEANIE_KIMI_MODEL || "moonshotai/kimi-k2.6",
    synthesis: process.env.LEANIE_ARBITER_MODEL || "z-ai/glm-5.3-flash",
  };

  if (!apiKey) {
    return new Response(JSON.stringify(demoResult(brief, false)), { headers: cors });
  }

  try {
    const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
    async function chat(model: string, system: string, user: string) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model, temperature: 0.3, max_tokens: 1800, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      });
      if (!res.ok) throw new Error(`NVIDIA NIM ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      return String(data?.choices?.[0]?.message?.content ?? "");
    }
    const replyStrategic = await chat(models.strategic, "Return JSON only: {phases:[{title,objective,tasks:[{title,description,priority:'High'|'Medium'|'Low',duration,dependency,resource,deliverable}]}, risks:[{title,likelihood:'Low'|'Medium'|'High',mitigation}]}", JSON.stringify(brief));
    const strategic = parseJson(replyStrategic) ?? { phases: [], risks: [] };
    const replySynthesis = await chat(models.synthesis, "Return JSON only with final {phases,risk[]}.", JSON.stringify({ brief, strategic }));
    const parsed = parseJson(replySynthesis) ?? strategic;
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
    })) : (strategic.risks || []);
    return new Response(JSON.stringify({ mode: "live", phases, risks, analysis: { strategic: parseJson(replyStrategic) } }), { headers: cors });
  } catch (error) {
    return new Response(JSON.stringify(demoResult(brief, true, String(error))), { headers: cors });
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
    mode: configured ? "demo" : "demo",
    phases: [
      { id: "phase-1", title: "01 — Validate the problem", objective: "Confirm urgent recurring problem.", tasks: [{ id: crypto.randomUUID(), title: "Define validation criteria", description: "Translate objective into measurable thresholds.", priority: "High", duration: "2 days", dependency: "None", resource: "Project lead", deliverable: "Validation scorecard" }] },
      { id: "phase-2", title: "02 — Prototype the core path", objective: "Build the smallest credible test.", tasks: [{ id: crypto.randomUUID(), title: "Build a testable prototype", description: "Produce focused prototype covering core workflow.", priority: "Medium", duration: "2 weeks", dependency: "Interview synthesis", resource: "Designer + developer", deliverable: "Interactive prototype" }] },
      { id: "phase-3", title: "03 — Test and decide", objective: "Measure and decide.", tasks: [{ id: crypto.randomUUID(), title: "Make proceed / revise decision", description: "Compare evidence to thresholds.", priority: "High", duration: "2 days", dependency: "Test findings", resource: "Project sponsor", deliverable: "Decision memo" }] },
    ],
    risks: [{ title: "Insufficient access to target users", likelihood: "Medium", mitigation: "Recruit through two channels." }, { title: "Prototype scope expands", likelihood: "High", mitigation: "Freeze critical path." }],
    configured,
    ...(error ? { error } : {}),
  };
}
