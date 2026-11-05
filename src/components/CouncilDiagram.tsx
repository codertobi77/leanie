import {
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
import { useState } from "react"
import { analysts } from "../data"
import type { Project } from "../types"

export type CouncilStage = 0 | 1 | 2 | 3 | 4
type NodeId = "input" | "strategic" | "feasibility" | "critical" | "arbiter" | "output"

const specialistMeta = [
  { id: "strategic" as const, icon: Target, agent: analysts[0] },
  { id: "feasibility" as const, icon: Gauge, agent: analysts[1] },
  { id: "critical" as const, icon: ShieldAlert, agent: analysts[2] },
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
          {[
            [
              "input-strategic",
              "M170 260 C250 260 240 90 340 90",
              stage >= 1,
              focused === "input" || focused === "strategic",
            ],
            [
              "input-feasibility",
              "M170 260 C250 260 250 260 340 260",
              stage >= 1,
              focused === "input" || focused === "feasibility",
            ],
            [
              "input-critical",
              "M170 260 C250 260 240 430 340 430",
              stage >= 1,
              focused === "input" || focused === "critical",
            ],
            [
              "strategic-arbiter",
              "M560 90 C650 90 630 260 720 260",
              stage >= 2,
              focused === "strategic" || focused === "arbiter",
            ],
            [
              "feasibility-arbiter",
              "M560 260 C630 260 650 260 720 260",
              stage >= 2,
              focused === "feasibility" || focused === "arbiter",
            ],
            [
              "critical-arbiter",
              "M560 430 C650 430 630 260 720 260",
              stage >= 2,
              focused === "critical" || focused === "arbiter",
            ],
            [
              "arbiter-output",
              "M835 260 C875 260 890 260 930 260",
              stage >= 4,
              focused === "arbiter" || focused === "output",
            ],
          ].map(([id, path, lit, highlighted]) => (
            <g
              key={String(id)}
              className={`${lit ? "flow-lit" : ""} ${
                focused && !highlighted ? "flow-muted" : ""
              }`}
            >
              <path className="flow-track" d={String(path)} />
              <path className="flow-path" d={String(path)} pathLength="1" />
              {lit && (
                <circle className="data-particle" r="4">
                  <animateMotion
                    dur="1.8s"
                    repeatCount="indefinite"
                    path={String(path)}
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
