// Deno edge function implementing the Leanie Council.
// Secrets (NVIDIA_NIM_API_KEY etc.) stay on Supabase and are never shipped.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Brief {
  title: string;
  objective: string;
  context: string;
  outcome: string;
  targetDate?: string;
  budget?: string;
  resources?: string;
}

type Models = {
  strategic: string;
  feasibility: string;
  critique: string;
  synthesis: string;
};

function getConfig() {
  const apiKey =
    Deno.env.get("NVIDIA_NIM_API_KEY") ||
    Deno.env.get("NVIDIA_API_KEY") ||
    null;
  const baseUrl = (
    Deno.env.get("NVIDIA_NIM_BASE_URL") ||
    "https://integrate.api.nvidia.com/v1"
  ).replace(/\/+$/, "");
  const models: Models = {
    strategic: Deno.env.get("LEANIE_GLM_MODEL") || "z-ai/glm-5.3-flash",
    feasibility:
      Deno.env.get("LEANIE_DEEPSEEK_MODEL") ||
      "deepseek-ai/deepseek-v4.1-flash",
    critique: Deno.env.get("LEANIE_KIMI_MODEL") || "moonshotai/kimi-k3",
    synthesis: Deno.env.get("LEANIE_ARBITER_MODEL") || "z-ai/glm-5.3",
  };
  return { apiKey, baseUrl, models, configured: apiKey !== null };
}

async function chat(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string,
  user: string,
) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
      max_tokens: 1800,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`NVIDIA NIM ${response.status}: ${body.slice(0, 500)}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Empty model response");
  return content;
}

function tryParseJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function demoResult(brief: Brief) {
  return {
    mode: "demo",
    risks: [
      {
        title: "Insufficient access to target users",
        likelihood: "Medium",
        mitigation: "Recruit through two channels and maintain a reserve list.",
      },
      {
        title: "Prototype scope expands during delivery",
        likelihood: "High",
        mitigation: "Freeze the critical path; defer secondary workflows.",
      },
    ],
    phases: [
      {
        id: "phase-1",
        title: "01 — Validate the problem",
        objective:
          "Confirm the audience experiences the problem urgently enough to act.",
        tasks: [
          {
            id: crypto.randomUUID(),
            title: "Define validation criteria",
            description: "Translate the objective into measurable evidence thresholds.",
            priority: "High",
            duration: "2 days",
            dependency: "None",
            resource: "Project lead",
            deliverable: "Validation scorecard",
          },
        ],
      },
      {
        id: "phase-2",
        title: "02 — Prototype the core path",
        objective: "Create the smallest credible experience to test the core value proposition.",
        tasks: [
          {
            id: crypto.randomUUID(),
            title: "Build a testable prototype",
            description: "Produce a focused prototype covering the core workflow.",
            priority: "Medium",
            duration: "2 weeks",
            dependency: "Interview synthesis",
            resource: "Designer + developer",
            deliverable: "Interactive prototype",
          },
        ],
      },
      {
        id: "phase-3",
        title: "03 — Test and decide",
        objective: "Measure value, usability, and delivery risk before broader build.",
        tasks: [
          {
            id: crypto.randomUUID(),
            title: "Make the proceed / revise decision",
            description: "Compare evidence to thresholds and document the next investment decision.",
            priority: "High",
            duration: "2 days",
            dependency: "Test findings",
            resource: "Project sponsor",
            deliverable: "Decision memo",
          },
        ],
      },
    ],
    configured: false,
    note: `Demo result for "${brief.title}" (no NVIDIA_NIM_API_KEY configured).`,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let brief: Brief;
  try {
    brief = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const cfg = getConfig();
  if (!cfg.configured) {
    return json(demoResult(brief));
  }

  const briefText = JSON.stringify(brief);

  try {
    const strategic = await chat(
      cfg.baseUrl,
      cfg.apiKey!,
      cfg.models.strategic,
      "You are Leanie's Strategic Analyst. Return JSON only with keys: strategy (string), phases (array of { title, objective, tasks: array of { title, description, priority: High|Medium|Low, duration, dependency, resource, deliverable } }), risks (array { title, likelihood: Low|Medium|High, mitigation }).",
      briefText,
    );
    const strategicParsed = tryParseJson(strategic) ?? { phases: [], risks: [] };

    const feasibility = await chat(
      cfg.baseUrl,
      cfg.apiKey!,
      cfg.models.feasibility,
      "You are Leanie's Feasibility Analyst. Return JSON only with keys: feasible (boolean), notes (string).",
      JSON.stringify({ brief, strategic: strategicParsed }),
    );

    const critique = await chat(
      cfg.baseUrl,
      cfg.apiKey!,
      cfg.models.critique,
      "You are Leanie's Critical Reviewer. Return JSON only with keys: assumptions (string array), risks (array { title, likelihood, mitigation }).",
      JSON.stringify({ brief, strategic: strategicParsed }),
    );

    const synthesis = await chat(
      cfg.baseUrl,
      cfg.apiKey!,
      cfg.models.synthesis,
      "You are Leanie's Arbiter. Merge the inputs and return JSON only with keys: phases (final array { title, objective, tasks... }), risks (final array { title, likelihood, mitigation }).",
      JSON.stringify({ brief, strategic: strategicParsed, feasibility: tryParseJson(feasibility), critique: tryParseJson(critique) }),
    );

    const parsed = tryParseJson(synthesis) ?? strategicParsed;

    // Normalize phase/task ids.
    const phases = Array.isArray(parsed.phases)
      ? parsed.phases.map((phase: any, i: number) => ({
          id: `phase-${i + 1}`,
          title: phase.title || `0${i + 1} — Phase`,
          objective: phase.objective || "",
          tasks: Array.isArray(phase.tasks)
            ? phase.tasks.map((task: any) => ({
                id: crypto.randomUUID(),
                title: task.title || "Task",
                description: task.description || "",
                priority: ["High", "Medium", "Low"].includes(task.priority)
                  ? task.priority
                  : "Medium",
                duration: task.duration || "1 week",
                dependency: task.dependency || "None",
                resource: task.resource || "Unassigned",
                deliverable: task.deliverable || "Defined output",
              }))
            : [],
        }))
      : [];

    const risks = Array.isArray(parsed.risks)
      ? parsed.risks.map((risk: any) => ({
          title: risk.title || "Risk",
          likelihood: ["Low", "Medium", "High"].includes(risk.likelihood)
            ? risk.likelihood
            : "Medium",
          mitigation: risk.mitigation || "",
        }))
      : (strategicParsed.risks || []);

    return json({
      mode: "live",
      phases,
      risks,
      analysis: {
        strategic: tryParseJson(strategic),
        feasibility: tryParseJson(feasibility),
        critique: tryParseJson(critique),
        synthesis: tryParseJson(synthesis),
      },
      configured: true,
    });
  } catch (error) {
    return json(
      {
        ...demoResult(brief),
        error: String(error),
      },
      200,
    );
  }
});
