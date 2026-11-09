import { afterEach, describe, expect, it, vi } from "vitest"
import {
  chat,
  normalizePhases,
  normalizeRisks,
  parseJson,
  scoreAnalysisQuality,
  scoreCoherence,
  scoreRiskRelevance,
  stepTargetFromProvider,
  type StepTarget,
} from "../../neon/leanie-council-core"

describe("council-core", () => {
  it("parseJson extracts the outer JSON object", () => {
    expect(parseJson('prefix {"ok":true,"n":1} suffix')).toEqual({ ok: true, n: 1 })
    expect(parseJson("no json")).toBeNull()
  })

  it("normalizePhases fills defaults and preserves structure", () => {
    const phases = normalizePhases(
      [{ title: "P1", objective: "O1", tasks: [{ title: "T1", priority: "Nope" }] }],
      [],
    )
    expect(phases).toHaveLength(1)
    expect(phases[0].id).toBe("phase-1")
    expect(phases[0].tasks[0].priority).toBe("Medium")
    expect(phases[0].tasks[0].title).toBe("T1")
  })

  it("normalizeRisks normalizes likelihood and fills missing titles", () => {
    const risks = normalizeRisks([
      { title: "R1", likelihood: "High", mitigation: "m" },
      { title: "", likelihood: "weird" },
      { title: "R2", likelihood: "weird" },
    ])
    expect(risks).toHaveLength(3)
    expect(risks[0].likelihood).toBe("High")
    expect(risks[1]).toMatchObject({ title: "Risk", likelihood: "Medium" })
    expect(risks[2].likelihood).toBe("Medium")
  })

  it("scores higher for richer, well-mitigated payloads", () => {
    const rich = {
      phases: [
        {
          tasks: [
            { description: "A sufficiently detailed description for scoring purposes.", dependency: "None", duration: "2d" },
            { description: "Another detailed task description for the score.", dependency: "Task 1", duration: "3d" },
          ],
        },
        {
          tasks: [
            { description: "Third detailed task description that is long enough.", dependency: "Phase 1", duration: "1w" },
          ],
        },
      ],
      risks: [
        { title: "A", likelihood: "High", mitigation: "A clear mitigation plan described here." },
        { title: "B", likelihood: "Medium", mitigation: "Another concrete mitigation step." },
      ],
      assumptions: ["a1", "a2"],
      successCriteria: ["c1", "c2"],
    }
    expect(scoreAnalysisQuality(rich)).toBeGreaterThan(40)
    expect(scoreRiskRelevance(rich.risks)).toBeGreaterThan(60)
    expect(scoreCoherence(rich)).toBeGreaterThan(40)

    expect(scoreRiskRelevance([])).toBe(0)
  })

  it("resolves a meta provider into concrete fallback targets (no recursion)", () => {
    const fallback: StepTarget = {
      providerId: null, provider: "env", baseUrl: "https://example.test/v1", apiKey: "k", model: "m", pricePrompt: 0, priceCompletion: 0,
    }
    const concreteA = { id: "pa", name: "A", base_url: "https://a.test/v1", api_key: "ka", models: [] }
    const concreteB = { id: "pb", name: "B", base_url: "https://b.test/v1", api_key: "kb", models: [] }
    const meta = {
      id: "pm",
      name: "MetaRoute",
      base_url: "meta:fallback",
      api_key: "",
      models: [
        {
          id: "route-1",
          strategy: "fallback",
          targets: [
            { providerId: "pa", model: "model-a" },
            { providerId: "pm", model: "route-1" }, // recursive -> ignored
            { providerId: "pb", model: "model-b" },
          ],
        },
      ],
    }
    const byId = new Map([
      ["pa", concreteA],
      ["pb", concreteB],
      ["pm", meta],
    ])
    const target = stepTargetFromProvider(meta, "route-1", fallback, byId)
    expect(target).not.toBeNull()
    expect(target?.meta?.strategy).toBe("fallback")
    expect(target?.meta?.targets.map((t) => `${t.provider}/${t.model}`)).toEqual(["A/model-a", "B/model-b"])
    expect(target?.providerId).toBe("pm")
  })

  it("returns null for meta models with no resolvable concrete targets", () => {
    const fallback: StepTarget = {
      providerId: null, provider: "env", baseUrl: "https://example.test/v1", apiKey: "k", model: "m", pricePrompt: 0, priceCompletion: 0,
    }
    const meta = { id: "pm", name: "MetaRoute", base_url: "meta:fallback", api_key: "", models: [{ id: "x", targets: [{ providerId: "missing", model: "m" }] }] }
    expect(stepTargetFromProvider(meta, "x", fallback, new Map([["pm", meta]]))).toBeNull()
  })
})

describe("council-core meta chat fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("falls back to the next concrete target and reports effective provider/model", async () => {
    const calls: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(String(url))
        if (String(url).includes("a.test")) {
          return new Response("boom", { status: 500 })
        }
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"ok":true}' } }],
            usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      }),
    )

    const target: StepTarget = {
      providerId: "pm",
      provider: "MetaRoute",
      baseUrl: "meta:fallback",
      apiKey: "",
      model: "route-1",
      pricePrompt: 0,
      priceCompletion: 0,
      meta: {
        strategy: "fallback",
        targets: [
          { providerId: "pa", provider: "A", baseUrl: "https://a.test/v1", apiKey: "ka", model: "model-a", pricePrompt: 0, priceCompletion: 0 },
          { providerId: "pb", provider: "B", baseUrl: "https://b.test/v1", apiKey: "kb", model: "model-b", pricePrompt: 1, priceCompletion: 2 },
        ],
      },
    }

    const reply = await chat(target, "sys", "user", 5000)
    expect(calls).toHaveLength(2)
    expect(calls[0]).toContain("a.test")
    expect(calls[1]).toContain("b.test")
    expect(parseJson(reply.text)).toEqual({ ok: true })
    expect((reply as any).effective.provider).toBe("MetaRoute>B")
    expect((reply as any).effective.model).toBe("model-b")
  })

  it("surfaces combined errors when all meta targets fail", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })))
    const target: StepTarget = {
      providerId: "pm", provider: "MetaRoute", baseUrl: "meta:fallback", apiKey: "", model: "route-1", pricePrompt: 0, priceCompletion: 0,
      meta: {
        strategy: "fallback",
        targets: [
          { providerId: "pa", provider: "A", baseUrl: "https://a.test/v1", apiKey: "ka", model: "model-a", pricePrompt: 0, priceCompletion: 0 },
        ],
      },
    }
    await expect(chat(target, "s", "u", 5000)).rejects.toThrow(/Meta-provider route-1 failed/)
  })
})
