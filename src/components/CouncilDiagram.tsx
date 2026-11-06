import {
  Activity,
  BrainCircuit,
  Check,
  FileInput,
  FileOutput,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Scale,
  ShieldAlert,
  Target,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import { analysts } from "../data"
import type {
  BenchmarkRunRow,
  CouncilStepDetail,
  CouncilStepName,
  LeanieProvider,
  Project,
} from "../types"

export type CouncilStage = 0 | 1 | 2 | 3 | 4
type NodeId = "input" | "strategic" | "feasibility" | "critical" | "arbiter" | "output"

const specialistMeta = [
  { id: "strategic" as const, icon: Target, agent: analysts[0] },
  { id: "feasibility" as const, icon: Gauge, agent: analysts[1] },
  { id: "critical" as const, icon: ShieldAlert, agent: analysts[2] },
]

function isFlowHighlighted(focused: NodeId, flowId: string): boolean {
  const [from, to] = flowId.split("-") as [NodeId, NodeId]
  return focused === from || focused === to
}

// Shared flow geometry: [id, svg path, stage at which the flow lights up]
const flowPaths: [string, string, number][] = [
  ["input-strategic", "M170 260 C250 260 240 90 340 90", 1],
  ["input-feasibility", "M170 260 C250 260 250 260 340 260", 1],
  ["input-critical", "M170 260 C250 260 240 430 340 430", 1],
  ["strategic-arbiter", "M560 90 C650 90 630 260 720 260", 2],
  ["feasibility-arbiter", "M560 260 C630 260 650 260 720 260", 2],
  ["critical-arbiter", "M560 430 C650 430 630 260 720 260", 2],
  ["arbiter-output", "M835 260 C875 260 890 260 930 260", 4],
]

export function CouncilDiagram({
  project,
  stage,
  paused,
  onPause,
  onReplay,
}: {
  project: Project
  stage: CouncilStage
  paused: boolean
  onPause: () => void
  onReplay: () => void
}) {
  const [selected, setSelected] = useState<NodeId | null>(null)
  const [hovered, setHovered] = useState<NodeId | null>(null)
  const focused = selected ?? hovered
  const active = (id: NodeId) =>
    id === "input"
      ? stage === 0
      : specialistMeta.some((item) => item.id === id)
        ? stage === 1
        : id === "arbiter"
          ? stage === 3
          : stage === 4
  const done = (id: NodeId) =>
    id === "input"
      ? stage > 0
      : specialistMeta.some((item) => item.id === id)
        ? stage > 1
        : id === "arbiter"
          ? stage > 3
          : false
  const faded = (id: NodeId) =>
    focused &&
    focused !== id &&
    !(focused === "input" && specialistMeta.some((item) => item.id === id)) &&
    !(focused === "arbiter" && specialistMeta.some((item) => item.id === id))
  const select = (id: NodeId) =>
    setSelected((value) => (value === id ? null : id))
  const rawDetail =
    selected === "input"
      ? {
          title: "Project idea",
          role: "User-provided context",
          status: stage > 0 ? "Distributed" : "Preparing",
          summary: project.objective,
        }
      : selected === "arbiter"
        ? {
            title: "Arbiter",
            role: "Synthesis and decision",
            status:
              stage > 3 ? "Completed" : stage === 3 ? "Arbitrating" : "Pending",
            summary:
              "Compares evidence, maps disagreements, weighs risks, and resolves trade-offs into one recommendation.",
          }
        : selected === "output"
          ? {
              title: "Project intelligence",
              role: "Final structured output",
              status: stage === 4 ? "Ready" : "Pending",
              summary:
                "A consolidated analysis and editable phased plan with risks, assumptions, dependencies, and success criteria.",
            }
          : specialistMeta.find((item) => item.id === selected)?.agent
  const detail =
    rawDetail &&
    ("title" in rawDetail
      ? rawDetail
      : {
          title: rawDetail.role,
          role: rawDetail.description,
          status:
            stage > 1 ? "Completed" : stage === 1 ? "Analyzing" : "Pending",
          summary: rawDetail.preview,
        })

  return (
    <div className="council-visual">
      <div className="council-toolbar">
        <div>
          <span>COUNCIL ARCHITECTURE</span>
          <p>State-driven simulation · no live AI inference</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onPause}
            className="council-control"
            aria-label={paused ? "Resume visualization" : "Pause visualization"}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={onReplay}
            className="council-control"
            aria-label="Replay visualization"
          >
            <RotateCcw size={14} />
            Replay
          </button>
        </div>
      </div>
      <div
        className={`council-canvas stage-${stage} ${paused ? "is-paused" : ""}`}
      >
        <svg
          className="council-lines"
          viewBox="0 0 1000 520"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="flow" x1="0" x2="1">
              <stop stopColor="#648bff" />
              <stop offset="1" stopColor="#9f8bea" />
            </linearGradient>
          </defs>
          {flowPaths.map(([id, path, litStage]) => (
            <g
              key={id}
              className={`${stage >= litStage ? "flow-lit" : ""} ${
                focused && !isFlowHighlighted(focused, id) ? "flow-muted" : ""
              }`}
            >
              <path className="flow-track" d={path} />
              <path className="flow-path" d={path} pathLength="1" />
              {stage >= litStage && (
                <circle className="data-particle" r="4">
                  <animateMotion
                    dur="1.8s"
                    repeatCount="indefinite"
                    path={path}
                  />
                </circle>
              )}
            </g>
          ))}
        </svg>

        <button
          className={`council-node node-input ${
            active("input") ? "active" : ""
          } ${done("input") ? "done" : ""} ${faded("input") ? "faded" : ""}`}
          onClick={() => select("input")}
          onMouseEnter={() => setHovered("input")}
          onMouseLeave={() => setHovered(null)}
        >
          <span className="node-icon">
            <FileInput size={18} />
          </span>
          <span className="node-copy">
            <strong>Project idea</strong>
            <small>User input</small>
            <em>{done("input") ? "Distributed" : "Entering Council"}</em>
          </span>
        </button>
        <div className="specialist-stack">
          {specialistMeta.map(({ id, icon: Icon, agent }) => (
            <button
              key={id}
              className={`council-node specialist ${
                active(id) ? "active" : ""
              } ${done(id) ? "done" : ""} ${faded(id) ? "faded" : ""}`}
              onClick={() => select(id)}
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="node-icon">
                <Icon size={17} />
              </span>
              <span className="node-copy">
                <strong>{agent.role}</strong>
                <small>{agent.description}</small>
                <em>
                  {done(id)
                    ? "Completed"
                    : active(id)
                      ? "Analyzing in parallel"
                      : "Pending"}
                </em>
              </span>
              {done(id) && <Check size={14} className="node-check" />}
            </button>
          ))}
        </div>
        <button
          className={`council-node node-arbiter ${
            active("arbiter") ? "active" : ""
          } ${done("arbiter") ? "done" : ""} ${
            faded("arbiter") ? "faded" : ""
          }`}
          onClick={() => select("arbiter")}
          onMouseEnter={() => setHovered("arbiter")}
          onMouseLeave={() => setHovered(null)}
        >
          <span className="node-icon">
            <Scale size={19} />
          </span>
          <span className="node-copy">
            <strong>Arbiter</strong>
            <small>Compares & resolves</small>
            <em>
              {done("arbiter")
                ? "Synthesis complete"
                : active("arbiter")
                  ? "Resolving trade-offs"
                  : stage === 2
                    ? "Receiving perspectives"
                    : "Pending"}
            </em>
          </span>
        </button>
        <button
          className={`council-node node-output ${
            active("output") ? "active" : ""
          } ${faded("output") ? "faded" : ""}`}
          onClick={() => select("output")}
          onMouseEnter={() => setHovered("output")}
          onMouseLeave={() => setHovered(null)}
        >
          <span className="node-icon">
            <FileOutput size={18} />
          </span>
          <span className="node-copy">
            <strong>Project intelligence</strong>
            <small>Analysis + plan</small>
            <em>{active("output") ? "Ready" : "Pending"}</em>
          </span>
        </button>
        {stage >= 2 && (
          <div
            className="signal-chips"
            aria-label="Converging contribution types"
          >
            <span>Agreement</span>
            <span>Risk</span>
            <span>Trade-off</span>
            <span>Recommendation</span>
          </div>
        )}
      </div>
      {selected && detail && (
        <div className="agent-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span>SELECTED CONTRIBUTION</span>
              <h3>{detail.title}</h3>
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="Close agent details"
            >
              <X size={16} />
            </button>
          </div>
          <div className="agent-meta">
            <span>{detail.role}</span>
            <strong>{detail.status}</strong>
          </div>
          <p>{detail.summary}</p>
          {selected !== "input" && selected !== "output" && (
            <div className="agent-evidence">
              <span>
                <Check size={12} />
                Agreement: validate before full investment
              </span>
              <span>
                <BrainCircuit size={12} />
                Tension: breadth versus testability
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Admin variant: identical canvas and visual language, driven by the live
// benchmark run instead of the simulated analysis stages.
const adminStepOf: Record<Exclude<NodeId, "input" | "output">, CouncilStepName> = {
  strategic: "strategic",
  feasibility: "feasibility",
  critical: "critique",
  arbiter: "arbiter",
}

export function AdminCouncilDiagram({
  run,
  connection,
}: {
  run: BenchmarkRunRow | null
  connection: string | null
}) {
  const [selected, setSelected] = useState<NodeId | null>(null)
  const [hovered, setHovered] = useState<NodeId | null>(null)
  const focused = selected ?? hovered

  const stage: CouncilStage = useMemo(() => {
    if (!run) return 0
    if (run.status === "done") return 4
    if (run.current_step === "arbiter") return 3
    if (run.status === "running") return 1
    return 2
  }, [run])

  const stepDetail = (step: CouncilStepName): CouncilStepDetail | undefined =>
    (run?.steps ?? []).find((entry) => entry.step === step)

  const statusOf = (id: NodeId): "idle" | "running" | "done" | "failed" => {
    if (id === "input") return run ? "done" : "idle"
    if (id === "output") {
      if (run?.status === "done") return "done"
      if (run?.status === "failed") return "failed"
      if (run?.status === "running") return "running"
      return "idle"
    }
    const step = adminStepOf[id]
    const detail = stepDetail(step)
    if (detail) return detail.error ? "failed" : "done"
    if (run?.status === "running" && run.current_step === step) return "running"
    return "idle"
  }

  const faded = (id: NodeId) =>
    focused &&
    focused !== id &&
    !(focused === "input" && specialistMeta.some((item) => item.id === id)) &&
    !(focused === "arbiter" && specialistMeta.some((item) => item.id === id))

  const select = (id: NodeId) =>
    setSelected((value) => (value === id ? null : id))

  const resolvedModel = (step: CouncilStepName): string =>
    run?.config?.steps?.[step]?.model ?? ""

  const stepStatusLine = (id: Exclude<NodeId, "input" | "output">): string => {
    const status = statusOf(id)
    const step = adminStepOf[id]
    const detail = stepDetail(step)
    if (status === "running") return `Running ${resolvedModel(step) || "…"}`
    if (status === "done" && detail)
      return `✓ ${(detail.latencyMs / 1000).toFixed(1)}s · ${detail.totalTokens.toLocaleString()} tok`
    if (status === "failed") return "Failed"
    return "Pending"
  }

  const outputMetrics = (run?.result?.metrics ?? null) as
    | {
        latencyMs?: number
        costUsd?: number
        mode?: string
        configName?: string | null
        jsonValid?: boolean
        tokens?: { total?: number }
        scores?: { analysisQuality?: number | null; riskRelevance?: number | null; coherence?: number | null }
      }
    | null

  const detail = (() => {
    if (!selected) return null
    if (selected === "input") {
      return {
        title: "Benchmark brief",
        role: "Admin sample input",
        status: run ? "Distributed to the council" : "Waiting for a run",
        summary:
          "Standard sample brief used for admin model comparisons. Every benchmark run sends this brief through the configured pipeline.",
        metrics: null,
        error: null,
      }
    }
    if (selected === "output") {
      return {
        title: "Project intelligence",
        role: "Final structured output",
        status:
          run?.status === "done"
            ? "Ready"
            : run?.status === "failed"
              ? "Failed"
              : run?.status === "running"
                ? "Streaming"
                : "Pending",
        summary: run?.status === "done" && outputMetrics
          ? `Completed in ${((outputMetrics.latencyMs ?? 0) / 1000).toFixed(1)}s · ${(
              outputMetrics.tokens?.total ?? 0
            ).toLocaleString()} tokens · $${(outputMetrics.costUsd ?? 0).toFixed(4)} · quality ${
              outputMetrics.scores?.analysisQuality ?? "—"
            }/100 · risk ${outputMetrics.scores?.riskRelevance ?? "—"}/100 · coherence ${
              outputMetrics.scores?.coherence ?? "—"
            }/100${outputMetrics.configName ? ` · config: ${outputMetrics.configName}` : ""}`
          : run?.status === "failed"
            ? run.error ?? "The run failed before producing an output."
            : "The consolidated analysis and phased plan appear here once the run completes.",
        metrics: null,
        error: run?.status === "failed" ? run.error : null,
      }
    }
    const agent = specialistMeta.find((item) => item.id === selected)?.agent
    const step = adminStepOf[selected]
    const detailRow = stepDetail(step)
    const status = statusOf(selected)
    return {
      title: agent?.role ?? step,
      role: agent?.description ?? "",
      status:
        status === "running"
          ? "Analyzing"
          : status === "done"
            ? "Completed"
            : status === "failed"
              ? "Failed"
              : "Pending",
      summary: detailRow
        ? `${detailRow.provider} · ${detailRow.model} · ${(detailRow.latencyMs / 1000).toFixed(1)}s · ${detailRow.totalTokens.toLocaleString()} tokens (${detailRow.promptTokens} prompt / ${detailRow.completionTokens} completion) · $${detailRow.costUsd.toFixed(4)} · JSON ${detailRow.jsonValid ? "valid" : "invalid"}`
        : agent?.preview ?? "",
      metrics: detailRow ?? null,
      error: detailRow?.error ?? null,
    }
  })()

  return (
    <div className="council-visual">
      <div className="council-toolbar">
        <div>
          <span>COUNCIL ARCHITECTURE</span>
          <p>Live benchmark · progress streams over Neon Realtime</p>
        </div>
        {connection && (
          <span className="council-control">
            {connection === "live" ? <Activity size={12} /> : <RotateCcw size={12} />}
            {connection}
          </span>
        )}
      </div>
      <div className={`council-canvas stage-${stage}`}>
        <svg
          className="council-lines"
          viewBox="0 0 1000 520"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="flow" x1="0" x2="1">
              <stop stopColor="#648bff" />
              <stop offset="1" stopColor="#9f8bea" />
            </linearGradient>
          </defs>
          {flowPaths.map(([id, path, litStage]) => (
            <g
              key={id}
              className={`${stage >= litStage ? "flow-lit" : ""} ${
                focused && !isFlowHighlighted(focused, id) ? "flow-muted" : ""
              }`}
            >
              <path className="flow-track" d={path} />
              <path className="flow-path" d={path} pathLength="1" />
              {stage >= litStage && (
                <circle className="data-particle" r="4">
                  <animateMotion dur="1.8s" repeatCount="indefinite" path={path} />
                </circle>
              )}
            </g>
          ))}
        </svg>

        <button
          className={`council-node node-input ${statusOf("input") === "done" ? "done" : ""} ${
            statusOf("input") === "running" ? "active" : ""
          } ${faded("input") ? "faded" : ""}`}
          onClick={() => select("input")}
          onMouseEnter={() => setHovered("input")}
          onMouseLeave={() => setHovered(null)}
        >
          <span className="node-icon">
            <FileInput size={18} />
          </span>
          <span className="node-copy">
            <strong>Benchmark brief</strong>
            <small>Standard sample brief</small>
            <em>{run ? "Distributed" : "Entering Council"}</em>
          </span>
        </button>
        <div className="specialist-stack">
          {specialistMeta.map(({ id, icon: Icon, agent }) => {
            const status = statusOf(id)
            return (
              <button
                key={id}
                className={`council-node specialist ${status === "running" ? "active" : ""} ${
                  status === "done" ? "done" : ""
                } ${status === "failed" ? "failed" : ""} ${faded(id) ? "faded" : ""}`}
                onClick={() => select(id)}
                onMouseEnter={() => setHovered(id)}
                onMouseLeave={() => setHovered(null)}
              >
                <span className="node-icon">
                  <Icon size={17} />
                </span>
                <span className="node-copy">
                  <strong>{agent.role}</strong>
                  <small>{resolvedModel(adminStepOf[id]) || agent.model}</small>
                  <em>{stepStatusLine(id)}</em>
                </span>
                {status === "done" && <Check size={14} className="node-check" />}
                {status === "failed" && <X size={14} className="node-check node-check-failed" />}
              </button>
            )
          })}
        </div>
        <button
          className={`council-node node-arbiter ${statusOf("arbiter") === "running" ? "active" : ""} ${
            statusOf("arbiter") === "done" ? "done" : ""
          } ${statusOf("arbiter") === "failed" ? "failed" : ""} ${faded("arbiter") ? "faded" : ""}`}
          onClick={() => select("arbiter")}
          onMouseEnter={() => setHovered("arbiter")}
          onMouseLeave={() => setHovered(null)}
        >
          <span className="node-icon">
            <Scale size={19} />
          </span>
          <span className="node-copy">
            <strong>Arbiter</strong>
            <small>Compares &amp; resolves</small>
            <em>{stepStatusLine("arbiter")}</em>
          </span>
          {statusOf("arbiter") === "done" && <Check size={14} className="node-check" />}
          {statusOf("arbiter") === "failed" && <X size={14} className="node-check node-check-failed" />}
        </button>
        <button
          className={`council-node node-output ${statusOf("output") === "running" ? "active" : ""} ${
            statusOf("output") === "done" ? "done" : ""
          } ${statusOf("output") === "failed" ? "failed" : ""} ${faded("output") ? "faded" : ""}`}
          onClick={() => select("output")}
          onMouseEnter={() => setHovered("output")}
          onMouseLeave={() => setHovered(null)}
        >
          <span className="node-icon">
            <FileOutput size={18} />
          </span>
          <span className="node-copy">
            <strong>Project intelligence</strong>
            <small>Analysis + plan</small>
            <em>
              {statusOf("output") === "done" && outputMetrics
                ? `✓ ${((outputMetrics.latencyMs ?? 0) / 1000).toFixed(1)}s · ${
                    (outputMetrics.tokens?.total ?? 0).toLocaleString()
                  } tok`
                : statusOf("output") === "running"
                  ? "Streaming…"
                  : statusOf("output") === "failed"
                    ? "Failed"
                    : "Pending"}
            </em>
          </span>
        </button>
        {stage >= 2 && (
          <div className="signal-chips" aria-label="Converging contribution types">
            <span>Agreement</span>
            <span>Risk</span>
            <span>Trade-off</span>
            <span>Recommendation</span>
          </div>
        )}
      </div>
      {selected && detail && (
        <div className="agent-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span>SELECTED CONTRIBUTION</span>
              <h3>{detail.title}</h3>
            </div>
            <button onClick={() => setSelected(null)} aria-label="Close details">
              <X size={16} />
            </button>
          </div>
          <div className="agent-meta">
            <span>{detail.role}</span>
            <strong>{detail.status}</strong>
          </div>
          <p>{detail.summary}</p>
          {detail.error && <p className="mt-2 text-xs text-red-400">✗ {detail.error}</p>}
        </div>
      )}
    </div>
  )
}
