import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Bot,
  BrainCircuit,
  CalendarDays,
  Command,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  Download,
  FileText,
  Gauge,
  GripVertical,
  Home,
  Info,
  Languages,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Menu,
  Moon,
  MoreHorizontal,
  Play,
  Plus,
  RotateCw,
  Rocket,
  Scale,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Sun,
  Target,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react"
import { Brand } from "./components/Brand"
import { CommandPalette } from "./components/CommandPalette"
import { ConfirmationDialog } from "./components/ConfirmationDialog"
import { CouncilDiagram, type CouncilStage } from "./components/CouncilDiagram"
import {
  ToastViewport,
  type ToastItem,
  type ToastKind,
} from "./components/Toast"
import { analysts, cloneDemoPlan, demoProject } from "./data"
import type {
  MetricsPayload,
  ModelMetrics,
  ModelRun,
  Phase,
  Project,
  ProjectFormData,
  Risk,
  Screen,
  Task,
} from "./types"
import { useAuth } from "./lib/auth"
import { hasNeon, requireNeon, neonClient } from "./lib/neon"
import {
  loadProjects,
  saveProject,
  removeProject,
  syncOfflineProjects,
  createProjectShare,
  loadSharedProject,
  saveProjectVersion,
  loadProjectVersions,
  queueProjectForSync,
  getActiveShareToken,
  setActiveShareToken,
  persistSharedProject,
  refreshSharedProject,
} from "./lib/projectsRepo"

const STORAGE_KEY = "leanie-projects-v1"
const blankForm: ProjectFormData = {
  title: "",
  objective: "",
  context: "",
  outcome: "",
  targetDate: "",
  budget: "",
  resources: "",
}
const navItems: { id: Screen; label: string; icon: typeof Home }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "projects", label: "My Projects", icon: FileText },
  { id: "new", label: "New Project", icon: Plus },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "admin", label: "Admin", icon: BarChart3 },
]

function fmtDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

function StatusPill({ status }: { status: Project["status"] }) {
  const cls =
    status === "Validated"
      ? "status-green"
      : status === "Analyzing"
        ? "status-blue"
        : status === "Plan ready"
          ? "status-purple"
          : "status-gray"
  return (
    <span className={`status ${cls}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const start = performance.now()
    let frame = 0
    const tick = (time: number) => {
      const progress = Math.min((time - start) / 500, 1)
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <>{display}</>
}

function Landing({ enter }: { enter: (screen?: Screen) => void }) {
  return (
    <div className="min-h-screen overflow-hidden bg-[#f8f9fc] text-[#101827]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#101827]/95 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-[1240px] items-center justify-between px-5 lg:px-8">
          <Brand light />
          <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="#process" className="hover:text-white">
              How it works
            </a>
            <a href="#council" className="hover:text-white">
              AI Council
            </a>
            <a href="#benefits" className="hover:text-white">
              Benefits
            </a>
          </nav>
          <button
            onClick={() => enter("overview")}
            className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#101827] transition hover:bg-blue-50"
          >
            Get started
          </button>
        </div>
      </header>

      <main>
        <section className="relative bg-[#101827] pb-24 pt-36 text-white lg:pb-32 lg:pt-44">
          <div className="hero-grid absolute inset-0 opacity-40" />
          <div className="pointer-events-none absolute left-[8%] top-40 size-72 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="relative mx-auto max-w-[1240px] px-5 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <div className="eyebrow mx-auto border-white/10 bg-white/5 text-blue-200">
                <Sparkles size={13} /> Lean Intelligence Engine
              </div>
              <h1 className="mt-7 text-[clamp(3.2rem,7vw,6.6rem)] font-medium leading-[0.94] tracking-[-0.065em]">
                Better thinking.
                <br />
                <span className="text-[#9bb2ff]">Clearer plans.</span>
                <br />
                Smarter execution.
              </h1>
              <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-slate-300">
                Turn an idea into a realistic plan through a Council of
                specialized AI perspectives—challenged, compared, and
                synthesized for action.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  onClick={() => enter("new")}
                  className="btn-light group"
                >
                  Start planning{" "}
                  <ArrowRight
                    size={16}
                    className="transition group-hover:translate-x-0.5"
                  />
                </button>
                <a href="#process" className="btn-dark-outline">
                  Discover how it works <ArrowDown size={15} />
                </a>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Interactive prototype · Simulated AI analysis
              </p>
            </div>

            <div className="relative mx-auto mt-16 max-w-5xl rounded-[24px] border border-white/10 bg-[#172338] p-2 shadow-[0_40px_100px_rgba(0,0,0,.4)]">
              <div className="rounded-[18px] border border-white/8 bg-[#111c2d] p-5 sm:p-8">
                <div className="flex items-center justify-between border-b border-white/8 pb-5">
                  <div className="text-left">
                    <p className="text-xs text-slate-500">COUNCIL SESSION</p>
                    <p className="mt-1 font-medium">Market entry validation</p>
                  </div>
                  <span className="status border-blue-400/20 bg-blue-400/10 text-blue-200">
                    <span className="pulse-dot" />
                    Analyzing
                  </span>
                </div>
                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  {analysts.map((a, index) => (
                    <div
                      key={a.role}
                      className="rounded-xl border border-white/8 bg-white/[.035] p-4 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="grid size-8 place-items-center rounded-lg bg-blue-400/10 text-blue-300">
                          <BrainCircuit size={15} />
                        </span>
                        <CheckCircle2
                          size={16}
                          className={
                            index < 2 ? "text-emerald-400" : "text-slate-600"
                          }
                        />
                      </div>
                      <p className="mt-7 text-sm font-medium">{a.role}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        {a.description}
                      </p>
                      <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-[#648bff]"
                          style={{ width: index < 2 ? "100%" : "64%" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mx-auto my-3 h-7 w-px bg-gradient-to-b from-blue-400/50 to-violet-400/50" />
                <div className="mx-auto flex max-w-lg items-center gap-4 rounded-xl border border-violet-400/20 bg-violet-400/8 p-4 text-left">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-violet-400/15 text-violet-300">
                    <Scale size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-medium">Arbiter synthesis</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Comparing evidence, resolving trade-offs, and forming a
                      recommendation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="process" className="section-wrap">
          <div className="section-heading">
            <span>01 / PROCESS</span>
            <h2>
              From open question
              <br />
              to executable direction.
            </h2>
            <p>
              Leanie introduces productive tension before commitment, then
              translates the strongest reasoning into practical steps.
            </p>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 md:grid-cols-3">
            {([
              [
                Lightbulb,
                "01",
                "Describe your idea",
                "Capture the objective, context, desired outcome, and the constraints that shape reality.",
              ],
              [
                BrainCircuit,
                "02",
                "Challenge it with the Council",
                "Independent analytical roles test strategy, feasibility, and hidden assumptions.",
              ],
              [
                ListChecks,
                "03",
                "Get an actionable plan",
                "The Arbiter resolves disagreements and creates an editable phased plan.",
              ],
            ] as const).map(([Icon, n, title, body]) => (
              <div key={String(n)} className="bg-white p-7 lg:p-9">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-[#eef2ff] text-[#526fd2]">
                    <Icon size={20} />
                  </span>
                  <span className="font-mono text-xs text-slate-400">{n}</span>
                </div>
                <h3 className="mt-14 text-xl font-semibold tracking-tight">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="council"
          className="bg-[#101827] py-24 text-white lg:py-32"
        >
          <div className="mx-auto grid max-w-[1240px] gap-14 px-5 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
            <div>
              <span className="section-kicker-dark">02 / THE COUNCIL</span>
              <h2 className="mt-6 text-4xl font-medium leading-tight tracking-[-0.045em] sm:text-5xl">
                One idea.
                <br />
                Multiple lenses.
                <br />
                <span className="text-[#9bb2ff]">Better judgment.</span>
              </h2>
              <p className="mt-6 max-w-md leading-7 text-slate-400">
                Not a chatbot. A structured reasoning process in which
                complementary perspectives work independently before conclusions
                are synthesized.
              </p>
            </div>
            <div className="space-y-3">
              {([
                [
                  Target,
                  "Strategic Analyst",
                  "Does this direction make sense?",
                  "Tests objectives, alignment, relevance, and strategic coherence.",
                ],
                [
                  Gauge,
                  "Feasibility Analyst",
                  "Can this work in practice?",
                  "Evaluates technical, operational, financial, and delivery realities.",
                ],
                [
                  ShieldAlert,
                  "Critical Reviewer",
                  "What are we missing?",
                  "Challenges assumptions, contradictions, blind spots, and overlooked risk.",
                ],
                [
                  Scale,
                  "Arbiter",
                  "What should we do next?",
                  "Weighs evidence and disagreements to produce a consolidated recommendation.",
                ],
              ] as const).map(([Icon, title, question, body], i) => (
                <div
                  key={String(title)}
                  className={`group grid gap-4 rounded-xl border p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center ${
                    i === 3
                      ? "border-violet-400/30 bg-violet-400/10"
                      : "border-white/8 bg-white/[.035]"
                  }`}
                >
                  <span
                    className={`grid size-10 place-items-center rounded-lg ${
                      i === 3
                        ? "bg-violet-400/15 text-violet-300"
                        : "bg-white/5 text-blue-300"
                    }`}
                  >
                    <Icon size={18} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <h3 className="font-medium">{title}</h3>
                      <span className="text-xs text-slate-500">{question}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{body}</p>
                  </div>
                  <span className="hidden font-mono text-xs text-slate-600 sm:block">
                    0{i + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="benefits" className="section-wrap">
          <div className="section-heading">
            <span>03 / OUTCOMES</span>
            <h2>
              Move forward with
              <br />
              eyes open.
            </h2>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {([
              [
                Gauge,
                "Feasibility",
                "Understand what is achievable before committing resources.",
              ],
              [
                ShieldAlert,
                "Risk awareness",
                "Surface fragile assumptions while they are still inexpensive to address.",
              ],
              [
                CircleDot,
                "Clarity",
                "Separate evidence, assumptions, disagreements, and recommendations.",
              ],
              [
                Rocket,
                "Execution",
                "Translate sound reasoning into sequenced work with clear outcomes.",
              ],
            ] as const).map(([Icon, title, body]) => (
              <div
                key={String(title)}
                className="border-t border-slate-300 pt-5"
              >
                <Icon size={20} className="text-[#648bff]" />
                <h3 className="mt-8 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-5 pb-20 lg:px-8">
          <div className="mx-auto max-w-[1240px] rounded-[24px] bg-[#e9edff] px-6 py-16 text-center sm:px-12 lg:py-20">
            <p className="text-xs font-semibold tracking-[.18em] text-[#526fd2]">
              START WITH BETTER QUESTIONS
            </p>
            <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-medium tracking-[-.045em] sm:text-5xl">
              Your idea deserves more than a first answer.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-slate-600">
              Challenge it from every angle, then build a plan grounded in what
              the Council discovers.
            </p>
            <button onClick={() => enter("new")} className="btn-primary mt-8">
              Start planning <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <Brand />
          <p className="text-xs text-slate-500">
            A product concept by LiteTECH Startup · © 2026
          </p>
        </div>
      </footer>
    </div>
  )
}

function Sidebar({
  screen,
  navigate,
  mobileOpen,
  close,
  collapsed,
  toggleCollapsed,
  openCommand,
}: {
  screen: Screen
  navigate: (s: Screen) => void
  mobileOpen: boolean
  close: () => void
  collapsed: boolean
  toggleCollapsed: () => void
  openCommand: () => void
}) {
  return (
    <>
      {mobileOpen && (
        <button
          className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden"
          aria-label="Close navigation"
          onClick={close}
        />
      )}
      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-50 flex flex-col bg-[#101827] text-white lg:translate-x-0 ${
          collapsed ? "is-collapsed" : ""
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/8 px-5">
          <div className="sidebar-brand">
            <Brand light />
          </div>
          <button
            onClick={close}
            className="text-slate-400 lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-6">
          <p className="sidebar-label px-3 pb-3 text-[10px] font-semibold tracking-[.18em] text-slate-600">
            WORKSPACE
          </p>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                navigate(id)
                close()
              }}
              className={`sidebar-item ${
                screen === id ||
                (id === "projects" &&
                  ["council", "results", "plan"].includes(screen))
                  ? "sidebar-active"
                  : ""
              }`}
            >
              <Icon size={17} />
              <span className="sidebar-label">{label}</span>
              {id === "new" && (
                <span className="sidebar-label ml-auto rounded bg-blue-400/10 px-1.5 py-0.5 text-[10px] text-blue-300">
                  NEW
                </span>
              )}
            </button>
          ))}
          <button
            onClick={openCommand}
            className="sidebar-item mt-4 border border-white/8"
          >
            <Search size={17} />
            <span className="sidebar-label">Quick search</span>
            <kbd className="sidebar-label ml-auto rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-500">
              ⌘K
            </kbd>
          </button>
        </nav>
        <div className="border-t border-white/8 p-4">
          <div className="flex items-center gap-3 rounded-xl p-2">
            <span className="grid size-9 place-items-center rounded-full bg-[#293a56] text-xs font-semibold">
              LP
            </span>
            <div className="sidebar-label min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Local prototype</p>
              <p className="truncate text-xs text-slate-500">
                Data stored in this browser
              </p>
            </div>
            <MoreHorizontal size={16} className="text-slate-500" />
          </div>
          <button
            onClick={toggleCollapsed}
            className="sidebar-collapse hidden lg:flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronRight size={14} className={collapsed ? "" : "rotate-180"} />
            <span className="sidebar-label">Collapse sidebar</span>
          </button>
        </div>
      </aside>
    </>
  )
}

function AppHeader({
  title,
  menu,
  action,
}: {
  title: string
  menu: () => void
  action?: React.ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-[#f8f9fc]/90 px-5 backdrop-blur-lg lg:px-9">
      <div className="flex items-center gap-3">
        <button
          onClick={menu}
          className="icon-button lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-lg font-semibold tracking-[-.025em] text-slate-950">
          {title}
        </h1>
      </div>
      {action}
    </header>
  )
}

function Dashboard({
  projects,
  navigate,
  select,
}: {
  projects: Project[]
  navigate: (s: Screen) => void
  select: (p: Project) => void
}) {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 320)
    return () => clearTimeout(timer)
  }, [])
  const recent = projects
    .slice()
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 4)
  if (loading) return <DashboardSkeleton />
  return (
    <div className="page">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Tuesday, March 17</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-.04em] text-slate-950 sm:text-4xl">
            Good morning.
          </h2>
          <p className="mt-3 text-slate-600">
            Turn your next open question into a defensible plan.
          </p>
        </div>
        <button onClick={() => navigate("new")} className="btn-primary">
          <Plus size={16} />
          Create a project
        </button>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="metric-card">
          <FileText size={18} />
          <div>
            <span>
              <AnimatedNumber value={projects.length} />
            </span>
            <p>Total projects</p>
          </div>
        </div>
        <div className="metric-card">
          <ListChecks size={18} />
          <div>
            <span>
              <AnimatedNumber
                value={projects.filter((p) => p.status === "Plan ready").length}
              />
            </span>
            <p>Plans ready</p>
          </div>
        </div>
        <div className="metric-card">
          <CheckCircle2 size={18} />
          <div>
            <span>
              <AnimatedNumber
                value={projects.filter((p) => p.status === "Validated").length}
              />
            </span>
            <p>Validated</p>
          </div>
        </div>
      </div>
      <div className="mt-10 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-950">Recent projects</h3>
          <p className="mt-1 text-sm text-slate-500">
            Demonstration content and your locally saved projects.
          </p>
        </div>
        <button onClick={() => navigate("projects")} className="text-button">
          View all <ArrowRight size={14} />
        </button>
      </div>
      {recent.length ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {recent.map((p, i) => (
            <button
              key={p.id}
              onClick={() => select(p)}
              className={`project-row ${i ? "border-t border-slate-100" : ""}`}
            >
              <span className="project-icon">
                <FileText size={17} />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {p.title}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Updated {fmtDate(p.updatedAt)}
                </span>
              </span>
              <StatusPill status={p.status} />
              <ChevronRight size={16} className="text-slate-400" />
            </button>
          ))}
        </div>
      ) : (
        <EmptyState navigate={navigate} />
      )}
      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_.72fr]">
        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h3>Recent activity</h3>
              <p>Sample and locally generated project events.</p>
            </div>
            <Clock3 size={17} />
          </div>
          <div className="activity-timeline">
            {recent.slice(0, 3).map((project, index) => (
              <button key={project.id} onClick={() => select(project)}>
                <span
                  className={`activity-dot ${index === 0 ? "active" : ""}`}
                />
                <div>
                  <strong>
                    {project.status === "Validated"
                      ? "Plan validated"
                      : project.status === "Plan ready"
                        ? "Council analysis completed"
                        : "Project brief updated"}
                  </strong>
                  <p>{project.title}</p>
                </div>
                <time>{fmtDate(project.updatedAt)}</time>
              </button>
            ))}
          </div>
        </section>
        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h3>Quick actions</h3>
              <p>Continue your next decision.</p>
            </div>
            <Zap size={17} />
          </div>
          <div className="quick-actions">
            <button onClick={() => navigate("new")}>
              <span>
                <Plus size={16} />
              </span>
              <div>
                <strong>New Council session</strong>
                <p>Challenge a project idea</p>
              </div>
              <ChevronRight size={15} />
            </button>
            <button onClick={() => navigate("projects")}>
              <span>
                <FileText size={16} />
              </span>
              <div>
                <strong>Browse projects</strong>
                <p>Review plans and analyses</p>
              </div>
              <ChevronRight size={15} />
            </button>
          </div>
        </section>
      </div>
      <div className="mt-8 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <Info size={17} className="mt-0.5 shrink-0 text-blue-600" />
        <p className="text-xs leading-5 text-blue-900">
          <strong>Prototype mode.</strong> Council responses are deterministic
          demonstration content, not live AI inference. Projects are stored only
          in this browser.
        </p>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="page" aria-label="Loading dashboard">
      <div className="skeleton h-4 w-28" />
      <div className="skeleton mt-4 h-10 w-64" />
      <div className="skeleton mt-3 h-4 w-96 max-w-full" />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="skeleton h-20 rounded-xl" />
        ))}
      </div>
      <div className="skeleton mt-10 h-5 w-36" />
      <div className="skeleton mt-4 h-64 rounded-xl" />
      <span className="sr-only">Loading locally saved project information</span>
    </div>
  )
}

function EmptyState({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-500">
        <Lightbulb size={21} />
      </span>
      <h3 className="mt-5 font-semibold">Start with an open question</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        Describe an idea, decision, or project. The Council will help you test
        it before you commit.
      </p>
      <button onClick={() => navigate("new")} className="btn-primary mt-6">
        <Plus size={16} />
        Create your first project
      </button>
    </div>
  )
}

function MissingProject({ navigate }: { navigate: (screen: Screen) => void }) {
  return (
    <div className="page">
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-500">
          <AlertCircle size={21} />
        </span>
        <h2 className="mt-5 font-semibold">
          Project information is unavailable
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
          This project may have been removed from local storage. Return to the
          project library or begin a new Council session.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => navigate("projects")}
            className="btn-secondary"
          >
            Browse projects
          </button>
          <button onClick={() => navigate("new")} className="btn-primary">
            <Plus size={15} />
            New project
          </button>
        </div>
      </div>
    </div>
  )
}

function ProjectsScreen({
  projects,
  open,
  remove,
  navigate,
  onImport,
}: {
  projects: Project[]
  open: (p: Project) => void
  remove: (p: Project) => void
  navigate: (s: Screen) => void
  onImport: (file: File) => void
}) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [sort, setSort] = useState("updated-desc")
  const [tag, setTag] = useState("")
  const importRef = useRef<HTMLInputElement>(null)
  const filtered = useMemo(() => {
    let next = [...projects]
    if (query.trim()) {
      const q = query.toLowerCase()
      next = next.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.objective.toLowerCase().includes(q) ||
          (p.context ?? "").toLowerCase().includes(q),
      )
    }
    if (status !== "all") next = next.filter((p) => p.status === status)
    if (tag.trim()) {
      const t = tag.toLowerCase()
      next = next.filter((p) => (p.tags ?? []).some((item) => item.toLowerCase().includes(t)))
    }
    next.sort((a, b) => {
      if (sort === "updated-desc") return +new Date(b.updatedAt) - +new Date(a.updatedAt)
      if (sort === "updated-asc") return +new Date(a.updatedAt) - +new Date(b.updatedAt)
      if (sort === "title") return a.title.localeCompare(b.title)
      if (sort === "status") return a.status.localeCompare(b.status)
      return 0
    })
    return next
  }, [projects, query, status, sort, tag])
  return (
    <div className="page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">PROJECT LIBRARY</p>
          <h2 className="page-title">My projects</h2>
          <p className="page-subtitle">
            Plans and analyses ({projects.length}) · {filtered.length} shown
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onImport(file)
              event.target.value = ""
            }}
          />
          <button onClick={() => importRef.current?.click()} className="btn-secondary">
            <Download size={16} />
            Import
          </button>
          <button onClick={() => navigate("new")} className="btn-primary">
            <Plus size={16} />
            New project
          </button>
        </div>
      </div>
      <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 md:grid-cols-[1fr_auto_auto_auto]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title, objective or context…"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2"
          aria-label="Search projects"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {["Draft", "Analyzing", "Plan ready", "Validated"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2"
          aria-label="Sort projects"
        >
          <option value="updated-desc">Newest first</option>
          <option value="updated-asc">Oldest first</option>
          <option value="title">Title</option>
          <option value="status">Status</option>
        </select>
        <input
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          placeholder="Tag filter"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2"
          aria-label="Filter by tag"
        />
      </div>
      <div className="mt-9 grid gap-4 lg:grid-cols-2">
        {filtered.map((p) => (
          <article
            key={p.id}
            className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/40"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="project-icon">
                <FileText size={17} />
              </span>
              <StatusPill status={p.status} />
            </div>
            <button
              onClick={() => open(p)}
              className="mt-6 block w-full text-left"
            >
              <h3 className="text-lg font-semibold tracking-[-.025em] text-slate-950 group-hover:text-blue-700">
                {p.title}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                {p.objective}
              </p>
            </button>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-xs text-slate-500">
                Updated {fmtDate(p.updatedAt)}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => remove(p)}
                  className="icon-button hover:text-red-600"
                  aria-label={`Delete ${p.title}`}
                >
                  <Trash2 size={15} />
                </button>
                <button onClick={() => open(p)} className="icon-button">
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function ProjectForm({
  submit,
  cancel,
}: {
  submit: (f: ProjectFormData) => void
  cancel: () => void
}) {
  const [form, setForm] = useState(blankForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [step, setStep] = useState(0)
  const steps = ["Core idea", "Constraints", "Review"]
  const update = (key: keyof ProjectFormData, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: "" }))
  }
  const validateStep = () => {
    const next: Record<string, string> = {}
    if (step === 0) {
      if (!form.title.trim()) next.title = "Add a short project title."
      if (form.objective.trim().length < 20)
        next.objective = "Describe the objective in at least 20 characters."
      if (form.context.trim().length < 20)
        next.context = "Add enough context for the Council to reason from."
      if (!form.outcome.trim())
        next.outcome = "Describe what a useful outcome would look like."
    }
    setErrors(next)
    return !Object.keys(next).length
  }
  const next = () => {
    if (validateStep()) setStep((value) => Math.min(value + 1, 2))
  }
  const field = (
    key: keyof ProjectFormData,
    label: string,
    placeholder: string,
    helper?: string,
    area = false,
    max = 800,
  ) => (
    <label className="field">
      <span>{label}</span>
      {helper && <small>{helper}</small>}
      {area ? (
        <>
          <textarea
            rows={3}
            value={form[key]}
            maxLength={max}
            onChange={(event) => update(key, event.target.value)}
            onInput={(event) => {
              const target = event.currentTarget
              target.style.height = "auto"
              target.style.height = `${target.scrollHeight}px`
            }}
            placeholder={placeholder}
            className={errors[key] ? "input-error" : ""}
          />
          <span className="character-count">
            {form[key].length} / {max}
          </span>
        </>
      ) : (
        <input
          value={form[key]}
          onChange={(event) => update(key, event.target.value)}
          placeholder={placeholder}
          className={errors[key] ? "input-error" : ""}
        />
      )}
      {errors[key] && (
        <em className="validation-message">
          <AlertCircle size={13} />
          {errors[key]}
        </em>
      )}
    </label>
  )
  return (
    <div className="page max-w-4xl page-enter">
      <button onClick={cancel} className="back-button">
        <ArrowLeft size={15} />
        Back to overview
      </button>
      <div className="mt-7">
        <p className="page-kicker">NEW COUNCIL SESSION</p>
        <h2 className="page-title max-w-2xl">
          Give the Council the context it needs.
        </h2>
        <p className="page-subtitle max-w-2xl">
          A short guided brief turns uncertainty into structured evidence for
          the Council.
        </p>
      </div>
      <div className="form-progress mt-8">
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => index < step && setStep(index)}
            className={
              index === step ? "active" : index < step ? "complete" : ""
            }
          >
            <span>{index < step ? <Check size={12} /> : index + 1}</span>
            <em>{label}</em>
          </button>
        ))}
        <div className="form-progress-line">
          <span style={{ width: `${step * 50}%` }} />
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (step < 2) next()
          else submit(form)
        }}
        className="form-shell mt-9"
      >
        <div key={step} className="form-step-enter">
          {step === 0 && (
            <div className="grid gap-6">
              <div className="form-section-heading">
                <span>01</span>
                <div>
                  <h3>Frame the decision</h3>
                  <p>
                    Describe what the Council should test and why it matters
                    now.
                  </p>
                </div>
              </div>
              {field(
                "title",
                "Project title",
                "e.g. Validate a new service concept",
              )}
              {field(
                "objective",
                "Main objective or problem to solve",
                "What decision, problem, or opportunity should the Council examine?",
                "Focus on the central question rather than a proposed solution.",
                true,
                500,
              )}
              {field(
                "context",
                "Context and background",
                "What has led to this point? What evidence or uncertainty already exists?",
                "Include known facts, stakeholders, and open questions.",
                true,
                900,
              )}
              {field(
                "outcome",
                "Expected outcome",
                "What would a useful result make possible?",
                undefined,
                true,
                500,
              )}
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-6">
              <div className="form-section-heading">
                <span>02</span>
                <div>
                  <h3>Ground the analysis</h3>
                  <p>
                    Optional constraints help the Feasibility Analyst produce a
                    more realistic recommendation.
                  </p>
                </div>
              </div>
              <label className="field">
                <span>
                  Target date <small className="inline">(optional)</small>
                </span>
                <input
                  type="date"
                  value={form.targetDate}
                  onChange={(event) => update("targetDate", event.target.value)}
                />
              </label>
              {field(
                "budget",
                "Budget or financial constraint",
                "e.g. Maximum $15,000",
              )}
              {field(
                "resources",
                "Available resources",
                "e.g. One designer, two engineers",
                "Include people, tools, access, and time that are already available.",
                true,
                500,
              )}
              <div className="context-tip">
                <Lightbulb size={17} />
                <p>
                  <strong>Useful detail:</strong> Unknown constraints are valid.
                  The Critical Reviewer will identify what must be clarified.
                </p>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-5">
              <div className="form-section-heading">
                <span>03</span>
                <div>
                  <h3>Review the Council brief</h3>
                  <p>
                    Confirm the distinction between what you know and what the
                    Council will need to assume.
                  </p>
                </div>
              </div>
              {[
                ["Project", form.title],
                ["Objective", form.objective],
                ["Context", form.context],
                ["Expected outcome", form.outcome],
              ].map(([label, value]) => (
                <div key={label} className="review-row">
                  <span>{label}</span>
                  <p>{value}</p>
                  <button type="button" onClick={() => setStep(0)}>
                    Edit
                  </button>
                </div>
              ))}
              <div className="review-row">
                <span>Constraints</span>
                <p>
                  {[form.targetDate, form.budget, form.resources]
                    .filter(Boolean)
                    .join(" · ") || "No explicit constraints provided"}
                </p>
                <button type="button" onClick={() => setStep(1)}>
                  Edit
                </button>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-xs leading-5 text-blue-900">
                <Info size={16} className="mt-0.5 shrink-0" />
                <p>
                  This starts a deterministic simulation. It does not send your
                  brief to a live AI service.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => (step ? setStep(step - 1) : cancel())}
            className="btn-secondary"
          >
            {step ? "Previous" : "Cancel"}
          </button>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400">Step {step + 1} of 3</span>
            <button type="submit" className="btn-primary">
              {step === 2 ? (
                <>
                  Analyze my project <Sparkles size={16} />
                </>
              ) : (
                <>
                  Continue <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function CouncilScreen({
  project,
  complete,
}: {
  project: Project
  complete: (result?: any) => void
}) {
  const [stage, setStage] = useState<CouncilStage>(0)
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState(false)
  const auth = useAuth()
  const [result, setResult] = useState<any>(null)
  const completeRef = useRef(complete)
  completeRef.current = complete
  const resultRef = useRef(result)
  resultRef.current = result

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!neonClient || !auth.user) return
      const baseUrl = import.meta.env.VITE_NEON_FUNCTION_COUNCIL_BASE_URL as string | undefined
      if (!baseUrl) return
      try {
        const { data: sessionData } = await neonClient.auth.getSession()
        const token = (sessionData as any)?.session?.access_token
        const response = await fetch(baseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=UTF-8",
          },
          body: JSON.stringify({
            title: project.title,
            objective: project.objective,
            context: project.context,
            outcome: project.outcome,
            targetDate: project.targetDate,
            budget: project.budget,
            resources: project.resources,
          }),
        })
        const data = await response.json()
        if (!cancelled && response.ok && !data.error) setResult(data)
        if (!cancelled && (!response.ok || data.error)) setFailed(true)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [project])

  useEffect(() => {
    if (paused || failed) return
    if (stage === 4) {
      const done = window.setTimeout(
        () => completeRef.current(resultRef.current),
        1800,
      )
      return () => clearTimeout(done)
    }
    const timer = window.setTimeout(
      () => setStage((value) => Math.min(value + 1, 4) as CouncilStage),
      stage === 1 ? 2500 : 1700,
    )
    return () => clearTimeout(timer)
  }, [failed, paused, stage])
  const stages = [
    "Input distributed",
    "Parallel analysis",
    "Perspectives converge",
    "Arbitration",
    "Intelligence ready",
  ]
  const replay = () => {
    setFailed(false)
    setPaused(false)
    setStage(0)
  }
  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[#101827] px-4 py-8 text-white sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-6xl page-enter">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-blue-300">
              <span
                className={
                  paused ? "size-2 rounded-full bg-amber-400" : "pulse-dot"
                }
              />
              {paused ? "SIMULATION PAUSED" : "COUNCIL SIMULATION ACTIVE"}
            </div>
            <h2 className="mt-4 text-3xl font-medium tracking-[-.04em]">
              {project.title}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Three independent perspectives analyze in parallel before
              converging on the Arbiter.
            </p>
          </div>
          <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
            Deterministic demo · no live AI
          </span>
        </div>
        <div className="mt-7 rounded-xl border border-white/8 bg-white/[.025] p-4">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="text-blue-200">
              Stage {stage + 1} of 5 · {stages[stage]}
            </span>
            <span className="text-slate-500">{(stage + 1) * 20}%</span>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="council-progress"
              style={{ width: `${(stage + 1) * 20}%` }}
            />
          </div>
        </div>
        <div className="mt-5">
          <CouncilDiagram
            project={project}
            stage={stage}
            paused={paused}
            onPause={() => setPaused((value) => !value)}
            onReplay={replay}
          />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <Info size={13} />
          <span>
            Animation timing is driven by the simulated Council stage.
          </span>
          {!failed && (
            <button
              className="text-slate-400 underline decoration-slate-700 underline-offset-4 hover:text-slate-200"
              onClick={() => setFailed(true)}
            >
              Preview error state
            </button>
          )}
        </div>
        {failed && (
          <div className="error-state mt-5">
            <AlertCircle size={18} />
            <div>
              <strong>Analysis simulation interrupted</strong>
              <p>
                No project data was lost. Retry to restart the state-driven
                sequence.
              </p>
            </div>
            <button onClick={replay}>Retry analysis</button>
          </div>
        )}
      </div>
    </div>
  )
}

function Results({ project, plan }: { project: Project; plan: () => void }) {
  return (
    <div className="page max-w-5xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-emerald-700">
            <CheckCircle2 size={14} />
            COUNCIL COMPLETE
          </div>
          <h2 className="page-title mt-3">{project.title}</h2>
          <p className="page-subtitle">
            A structured comparison of the Council’s findings and the Arbiter’s
            decision.
          </p>
        </div>
        <button onClick={plan} className="btn-primary">
          Open project plan <ArrowRight size={16} />
        </button>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <InfoCard
          label="PROVIDED BY YOU"
          tone="blue"
          text={project.objective}
        />
        <InfoCard
          label="AI ASSUMPTION"
          tone="amber"
          text="Early users can be recruited within two weeks through accessible channels."
        />
        <InfoCard
          label="COUNCIL RECOMMENDATION"
          tone="green"
          text="Proceed with a time-boxed validation phase before funding a full build."
        />
      </div>
      <ReportSection icon={FileText} title="Executive summary">
        <p>
          The concept is strategically coherent and suitable for a focused
          validation cycle. The Council recommends proceeding conditionally:
          constrain the first release, verify access to target users, and define
          measurable evidence thresholds before delivery begins.
        </p>
      </ReportSection>
      <div className="grid gap-4 lg:grid-cols-3">
        <Assessment
          title="Strategic assessment"
          rating="Strong"
          body="The objective supports a clear decision and avoids premature commitment. The intended outcome is specific enough to guide discovery."
        />
        <Assessment
          title="Feasibility assessment"
          rating="Conditional"
          body="The proposed direction is viable within the stated constraints if the initial workflow remains tightly scoped."
        />
        <Assessment
          title="Critical review"
          rating="3 flags"
          body="User access, evidence quality, and uncontrolled scope are the assumptions most likely to undermine the result."
        />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ReportSection icon={CheckCircle2} title="Points of agreement" compact>
          <ul className="report-list">
            <li>Validate demand before committing to implementation.</li>
            <li>Focus on one audience and one critical workflow.</li>
            <li>Define decision thresholds before collecting evidence.</li>
          </ul>
        </ReportSection>
        <ReportSection
          icon={Zap}
          title="Disagreements and trade-offs"
          compact
          accent
        >
          <div className="space-y-4">
            <div>
              <span className="argument-label">STRATEGY</span>
              <p>
                Favored a broader proposition to preserve long-term opportunity.
              </p>
            </div>
            <div>
              <span className="argument-label">FEASIBILITY + CRITIQUE</span>
              <p>
                Argued that breadth creates untestable scope and weakens
                evidence.
              </p>
            </div>
            <div className="resolution">
              <Scale size={15} />
              <p>
                <strong>Arbiter resolution:</strong> preserve the broader vision
                as context, but test only the narrow critical path.
              </p>
            </div>
          </div>
        </ReportSection>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ReportSection icon={Lightbulb} title="Key assumptions" compact>
          <ul className="report-list numbered">
            {(project.assumptions ?? []).map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </ReportSection>
        <ReportSection icon={ShieldAlert} title="Identified risks" compact>
          <div className="space-y-3">
            {project.risks.map((r) => (
              <div
                key={r.title}
                className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm"
              >
                <span>{r.title}</span>
                <span className="status status-amber">{r.likelihood}</span>
              </div>
            ))}
          </div>
        </ReportSection>
      </div>
      <div className="mt-4 rounded-2xl bg-[#101827] p-6 text-white sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-violet-400/15 text-violet-300">
            <Scale size={19} />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-widest text-violet-300">
              FINAL ARBITER RECOMMENDATION
            </p>
            <h3 className="mt-1 text-xl font-medium">
              Proceed—through a gated validation plan.
            </h3>
          </div>
        </div>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300">
          The opportunity warrants further investment, but current evidence does
          not support a full build. Complete the three proposed phases, review
          the stated success criteria, then make a deliberate proceed, revise,
          or stop decision.
        </p>
        <button onClick={plan} className="btn-light mt-6">
          Review actionable plan <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

function InfoCard({
  label,
  text,
  tone,
}: {
  label: string
  text: string
  tone: "blue" | "amber" | "green"
}) {
  return (
    <div className={`info-card info-${tone}`}>
      <span>{label}</span>
      <p>{text}</p>
    </div>
  )
}

function ReportSection({
  icon: Icon,
  title,
  children,
  compact = false,
  accent = false,
}: {
  icon: typeof FileText
  title: string
  children: React.ReactNode
  compact?: boolean
  accent?: boolean
}) {
  return (
    <section
      className={`mt-4 rounded-2xl border bg-white ${
        accent ? "border-violet-200" : "border-slate-200"
      } ${compact ? "p-5 sm:p-6" : "p-6 sm:p-8"}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid size-9 place-items-center rounded-lg ${
            accent
              ? "bg-violet-50 text-violet-600"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          <Icon size={17} />
        </span>
        <h3 className="font-semibold tracking-[-.02em]">{title}</h3>
      </div>
      <div className="mt-5 text-sm leading-7 text-slate-600">{children}</div>
    </section>
  )
}

function Assessment({
  title,
  rating,
  body,
}: {
  title: string
  rating: string
  body: string
}) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="status status-blue">{rating}</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  )
}

function PlanScreen({
  project,
  updateProject,
  notify,
  navigate,
  shareToken,
  onShareTokenCreated,
}: {
  project: Project
  updateProject: (p: Project) => void
  notify: (kind: ToastKind, title: string, message?: string) => void
  navigate?: (s: Screen) => void
  shareToken?: string | null
  onShareTokenCreated?: (token: string) => void
}) {
  const [expanded, setExpanded] = useState<string[]>(
    project.phases.map((p) => p.id),
  )
  const [confirmValidation, setConfirmValidation] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [draggingTask, setDraggingTask] = useState<{
    phaseId: string
    index: number
  } | null>(null)
  const [dragOverTask, setDragOverTask] = useState<number | null>(null)
  const [newRiskTitle, setNewRiskTitle] = useState("")
  const [newSuccessCriterion, setNewSuccessCriterion] = useState("")
  const [replayStep, setReplayStep] = useState("strategic")
  const [replaying, setReplaying] = useState(false)
  const [shareUrl, setShareUrl] = useState("")
  const [sharing, setSharing] = useState(false)
  const [versions, setVersions] = useState<any[]>([])
  const [loadingVersions, setLoadingVersions] = useState(true)
  const auth = useAuth()
  useEffect(() => {
    const token = shareToken ?? getActiveShareToken()
    if (!token) return
    const interval = window.setInterval(async () => {
      try {
        const remote = await refreshSharedProject(token)
        if (!remote || remote.id !== project.id || remote.revision === project.revision) return
        updateProject(remote)
      } catch {
        // ignore transient collaboration polling errors
      }
    }, 4000)
    return () => window.clearInterval(interval)
  }, [project.id, project.revision, project.updatedAt, updateProject, shareToken])

  useEffect(() => {
    (loadProjectVersions(project.id))
      .then(setVersions)
      .catch(() => setVersions([]))
      .finally(() => setLoadingVersions(false))
  }, [project.id])

  const createShare = async () => {
    if (!auth.user) {
      notify("info", "Sign in required", "Sign in to create a share link.")
      return
    }
    setSharing(true)
    try {
      const token = crypto.randomUUID()
      await createProjectShare(project.id, token, auth.user.id)
      const url = `${window.location.origin}${window.location.pathname}#shared/${token}`
      setShareUrl(url)
      setActiveShareToken(token)
      await navigator.clipboard.writeText(url).catch(() => {})
      notify("success", "Share link created", url)
    } catch (error) {
      notify("error", "Share failed", String(error))
    } finally {
      setSharing(false)
    }
  }

  const exportJson = () => {
    const content = JSON.stringify(project, null, 2)
    const blob = new Blob([content], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${project.title.replace(/\\W+/g, "-").toLowerCase()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    notify("success", "JSON exported", "The project snapshot was downloaded.")
  }

  const importProject = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      notify("info", "Import loaded", "Use the app data to create a project.")
    } catch (error) {
      notify("error", "Import failed", String(error))
    }
  }
  const allTasks = project.phases.flatMap((phase) => phase.tasks)
  const completedTasks = allTasks.filter((task) => task.completed).length
  const progress = allTasks.length
    ? Math.round((completedTasks / allTasks.length) * 100)
    : 0
  const patch = (updates: Partial<Project>) =>
    updateProject({
      ...project,
      ...updates,
      updatedAt: new Date().toISOString(),
    })
  const updatePhase = (phaseId: string, updater: (phase: Phase) => Phase) =>
    patch({
      phases: project.phases.map((p) => (p.id === phaseId ? updater(p) : p)),
    })
  const updateTask = (phaseId: string, taskId: string, data: Partial<Task>) => {
    let blocked = false
    updatePhase(phaseId, (p) => {
      const tasks = p.tasks.map((t) => (t.id === taskId ? { ...t, ...data } : t))
      if ("dependency" in data && hasDependencyCycle(tasks)) {
        blocked = true
        return p
      }
      return { ...p, tasks }
    })
    if (blocked) notify("error", "Invalid dependency", "This task change would create a cycle.")
  }
  const moveTask = (phaseId: string, index: number, direction: -1 | 1) =>
    updatePhase(phaseId, (p) => {
      const tasks = [...p.tasks]
      const target = index + direction
      if (target < 0 || target >= tasks.length) return p
      ;[tasks[index], tasks[target]] = [tasks[target], tasks[index]]
      return { ...p, tasks }
    })
  const removeTask = (phaseId: string, taskId: string) =>
    updatePhase(phaseId, (p) => ({
      ...p,
      tasks: p.tasks.filter((t) => t.id !== taskId),
    }))
  const addTask = (phaseId: string) => {
    updatePhase(phaseId, (p) => ({
      ...p,
      tasks: [
        ...p.tasks,
        {
          id: crypto.randomUUID(),
          title: "New task",
          description: "Describe the intended work.",
          priority: "Medium",
          duration: "1 week",
          dependency: "None",
          resource: "Unassigned",
          deliverable: "Defined output",
        },
      ],
    }))
    notify("info", "Task added", "The new task is ready to edit.")
  }
  const hasDependencyCycle = (tasks: Task[]) => {
    const byTitle = new Map(tasks.map((task) => [task.title, task.id]))
    const graph = new Map(tasks.map((task) => [task.id, [] as string[]]))
    tasks.forEach((task) => {
      const targetId = task.dependency !== "None" ? byTitle.get(task.dependency) : undefined
      if (targetId) graph.get(task.id)?.push(targetId)
    })
    const state = new Map<string, "white" | "gray" | "black">(
      tasks.map((task) => [task.id, "white"]),
    )
    const visit = (id: string): boolean => {
      if (state.get(id) === "gray") return true
      if (state.get(id) === "black") return false
      state.set(id, "gray")
      for (const next of graph.get(id) ?? []) {
        if (visit(next)) return true
      }
      state.set(id, "black")
      return false
    }
    return tasks.some((task) => visit(task.id))
  }

  const reorderTask = (phaseId: string, from: number, to: number) => {
    if (from === to) return
    updatePhase(phaseId, (p) => {
      const tasks = [...p.tasks]
      if (from < 0 || to < 0 || from >= tasks.length || to >= tasks.length) return p
      const [moved] = tasks.splice(from, 1)
      tasks.splice(to, 0, moved)
      return hasDependencyCycle(tasks)
        ? p
        : { ...p, tasks }
    })
    if (hasDependencyCycle([]) === false) {
      // cycle notifications are handled at dependency change, not here
    }
  }

  const setSuccessCriteria = (next: string[]) => {
    const updated = { ...project, successCriteria: next, updatedAt: new Date().toISOString() }
    updateProject(updated)
    updateProject(updated)
  }

  const addSuccessCriterion = () => {
    const value = newSuccessCriterion.trim()
    if (!value) return
    const next = [...(project.successCriteria ?? []), value]
    setSuccessCriteria(next)
    setNewSuccessCriterion("")
    notify("success", "Criterion added", "The success criterion was saved.")
  }

  const removeSuccessCriterion = (index: number) => {
    const next = (project.successCriteria ?? []).filter((_, itemIndex) => itemIndex !== index)
    setSuccessCriteria(next)
  }

  const addRisk = () => {
    const title = newRiskTitle.trim()
    if (!title) return
    const nextRisk = { title, likelihood: "Medium" as const, mitigation: "Describe the mitigation strategy." }
    const updated = { ...project, risks: [...project.risks, nextRisk], updatedAt: new Date().toISOString() }
    updateProject(updated)
    updateProject(updated)
    setNewRiskTitle("")
    notify("info", "Risk added", "Review the new risk and its mitigation.")
  }

  const removeRisk = (index: number) => {
    const next = project.risks.filter((_, itemIndex) => itemIndex !== index)
    const updated = { ...project, risks: next, updatedAt: new Date().toISOString() }
    updateProject(updated)
    updateProject(updated)
  }

  const updateRisk = (index: number, data: Partial<Risk>) => {
    const next = project.risks.map((risk, itemIndex) =>
      itemIndex === index ? { ...risk, ...data } : risk,
    )
    const updated = { ...project, risks: next, updatedAt: new Date().toISOString() }
    updateProject(updated)
    updateProject(updated)
  }

  const putSuccessCriterion = (index: number, value: string) => {
    const next = (project.successCriteria ?? []).map((item, itemIndex) => (itemIndex === index ? value : item))
    setSuccessCriteria(next)
  }

  const replayIsolatedStep = async () => {
    const baseUrl = import.meta.env.VITE_NEON_FUNCTION_COUNCIL_BASE_URL as string | undefined
    if (!baseUrl || !neonClient) {
      notify("error", "Neon unavailable", "Configure the Neon Auth and Function URLs first.")
      return
    }
    setReplaying(true)
    try {
      const { data: sessionData } = await neonClient.auth.getSession()
      const token = (sessionData as any)?.session?.access_token
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
        },
        body: JSON.stringify({
          step: replayStep,
          title: project.title,
          objective: project.objective,
          context: project.context,
          outcome: project.outcome,
          targetDate: project.targetDate,
          budget: project.budget,
          resources: project.resources,
        }),
      })
      const data = await response.json()
      if (!response.ok || data.error) throw new Error(data.error ?? "Council request failed")
      const updated = {
        ...project,
        status: project.status,
        updatedAt: new Date().toISOString(),
        phases:
          Array.isArray(data.phases) && data.phases.length > 0 ? data.phases : project.phases,
        risks: Array.isArray(data.risks) && data.risks.length > 0 ? data.risks : project.risks,
        assumptions:
          Array.isArray(data.assumptions) && data.assumptions.length > 0
            ? data.assumptions
            : project.assumptions,
        successCriteria:
          Array.isArray(data.successCriteria) && data.successCriteria.length > 0
            ? data.successCriteria
            : project.successCriteria,
      }
      updateProject(updated)
      notify(
        "success",
        `${replayStep} step replayed`,
        "The selected Council step was refreshed without rebuilding the whole plan.",
      )
    } catch (error) {
      notify("error", "Isolated replay failed", String(error).slice(0, 240))
    } finally {
      setReplaying(false)
    }
  }

  const exportToNeon = async (type: "md" | "csv") => {
    const baseUrl = import.meta.env.VITE_NEON_FUNCTION_STORAGE_BASE_URL as string | undefined
    if (!baseUrl) {
      notify("info", "Storage unavailable", "Configure the Neon storage function first.")
      return
    }
    if (!neonClient) {
      notify("error", "Neon unavailable", "Configure the Neon Auth and Data API URLs first.")
      return
    }
    const { data: sessionData } = await neonClient.auth.getSession()
    const user = (sessionData as any)?.session?.user
    if (!user) {
      notify("info", "Sign in required", "Sign in to store exports in Neon.")
      return
    }
    try {
      const ext = type === "md" ? "md" : "csv"
      const path = `${user.id}/${project.id}-${Date.now()}.${ext}`
      const { data: saved, error } = await neonClient.from("leanie_exports").insert({
        user_id: user.id,
        project_id: project.id,
        format: type,
        storage_path: path,
      }).select().single()
      if (error) throw error
      setExportOpen(false)
      notify("success", "Export recorded", `Neon object storage planned path: ${saved?.storage_path ?? path}`)
    } catch (error) {
      notify("error", "Storage export failed", String(error))
    }
  }
  const printPlan = () => {
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(project.title)}</title>
<style>
  @page { margin: 18mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: #101827; }
  h1 { font-size: 26px; margin: 0; }
  h2 { font-size: 18px; margin-top: 24px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }
  p, li { line-height: 1.5; }
  .meta { color: #475569; font-size: 12px; margin: 8px 0 20px; }
  .task, .risk { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin: 8px 0; }
  .task strong, .risk strong { display: block; }
  .small { color: #475569; font-size: 11px; }
</style>
</head>
<body>
  <h1>${escapeHtml(project.title)}</h1>
  <div class="meta">Leanie plan export · Updated ${escapeHtml(fmtDate(project.updatedAt))}</div>
  <h2>Project overview</h2>
  <p>${escapeHtml(project.objective)}</p>
  <h2>Phases and tasks</h2>
  ${project.phases
    .map(
      (phase) => `
      <h3>${escapeHtml(phase.title)}</h3>
      <p class="small">${escapeHtml(phase.objective)}</p>
      ${phase.tasks
        .map(
          (task) => `
          <div class="task">
            <strong>${escapeHtml(task.title)} (${task.priority}, ${escapeHtml(task.duration)})</strong>
            <div>${escapeHtml(task.description)}</div>
            <div class="small">Deliverable: ${escapeHtml(task.deliverable)} · Resource: ${escapeHtml(task.resource)} · Dependency: ${escapeHtml(task.dependency)}</div>
          </div>`,
        )
        .join("")}`,
    )
    .join("")}
  <h2>Risks and mitigation</h2>
  ${project.risks
    .map(
      (risk) => `
      <div class="risk">
        <strong>${escapeHtml(risk.title)} (${risk.likelihood})</strong>
        <div>${escapeHtml(risk.mitigation)}</div>
      </div>`,
    )
    .join("")}
  <h2>Success criteria</h2>
  <ul>${(project.successCriteria ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  <h2>Key assumptions</h2>
  <ul>${(project.assumptions ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
</body>
</html>`
    console.log("printPlan opened")
    const iframe = document.createElement("iframe")
    iframe.setAttribute("aria-hidden", "true")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "0"
    document.body.appendChild(iframe)
    const win = iframe.contentWindow
    if (!win) {
      document.body.removeChild(iframe)
      setExportOpen(false)
      notify("error", "PDF export failed", "The browser could not open a printable view.")
      return
    }
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.document.title = project.title
    win.focus()
    const cleanup = () => {
      window.setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe)
      }, 1000)
    }
    win.onafterprint = cleanup
    window.setTimeout(cleanup, 3000)
    try {
      win.print()
      setExportOpen(false)
      notify("success", "Print dialog opened", "Choose “Save as PDF”.")
    } catch {
      cleanup()
      notify("error", "PDF export failed", "The browser blocked the print dialog.")
    }
  }

  const exportFile = (type: "md" | "csv") => {
    let content = ""
    let mime = "text/markdown"
    if (type === "md")
      content = `# ${project.title}\n\n${project.objective}\n\n${project.phases.map((p) => `## ${p.title}\n${p.objective}\n\n${p.tasks.map((t) => `- **${t.title}** — ${t.description} (${t.priority}, ${t.duration})`).join("\n")}`).join("\n\n")}`
    else {
      mime = "text/csv"
      content = [
        "Phase,Task,Priority,Duration,Dependency,Resource,Deliverable",
        ...project.phases.flatMap((p) =>
          p.tasks.map((t) =>
            [
              p.title,
              t.title,
              t.priority,
              t.duration,
              t.dependency,
              t.resource,
              t.deliverable,
            ]
                .map((v) => `"${v.replace(/"/g, '""')}"`)
              .join(","),
          ),
        ),
      ].join("\n")
    }
    try {
      const url = URL.createObjectURL(new Blob([content], { type: mime }))
      const a = document.createElement("a")
      a.href = url
      a.download = `${project.title.replace(/\W+/g, "-").toLowerCase()}.${type}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setExportOpen(false)
      notify(
        "success",
        `${type === "md" ? "Markdown" : "CSV"} exported`,
        "The file download was created successfully.",
      )
    } catch {
      notify(
        "error",
        "Export failed",
        "The browser could not create the requested file.",
      )
    }
  }
  return (
    <div className="page max-w-6xl">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <StatusPill status={project.status} />
            <span className="text-xs text-slate-400">
              Updated {fmtDate(project.updatedAt)}
            </span>
          </div>
          <input
            className="title-input mt-3"
            value={project.title}
            onChange={(e) => patch({ title: e.target.value })}
            aria-label="Project title"
          />
          <p className="mt-2 text-sm text-slate-500">
            Editable Council-generated plan · changes save locally
          </p>
          <div className="plan-progress mt-4">
            <div>
              <span>Project progress</span>
              <strong>{progress}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <button
              onClick={() => setExportOpen(!exportOpen)}
              className="btn-secondary"
            >
              <Download size={15} />
              Export <ChevronDown size={14} />
            </button>
            {exportOpen && (
              <div className="export-menu">
                <button onClick={() => exportFile("md")}>
                  Markdown <span>.md</span>
                </button>
                <button onClick={() => exportFile("csv")}>
                  Task data <span>.csv</span>
                </button>
                <button onClick={() => exportToNeon("md")}>
                  Cloud copy <span>.md</span>
                </button>
                <button onClick={printPlan}>
                  PDF report <span>.pdf</span>
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setConfirmValidation(true)}
            className="btn-primary"
            disabled={project.status === "Validated"}
          >
            <CheckCircle2 size={16} />
            {project.status === "Validated"
              ? "Plan validated"
              : "Validate plan"}
          </button>
        </div>
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_280px]">
        <div>
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="block-label">PROJECT OVERVIEW</p>
            <textarea
              className="editable-overview"
              value={project.objective}
              onChange={(e) => patch({ objective: e.target.value })}
              aria-label="Project objective"
            />
            <div className="mt-5 flex flex-wrap gap-5 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <CalendarDays size={14} />
                {project.targetDate
                  ? fmtDate(project.targetDate)
                  : "No fixed deadline"}
              </span>
              <span className="flex items-center gap-1.5">
                <ListChecks size={14} />
                {project.phases.length} phases ·{" "}
                {project.phases.reduce((n, p) => n + p.tasks.length, 0)} tasks
              </span>
            </div>
          </section>
          <div className="mt-5 space-y-4">
            {project.phases.map((phase, phaseIndex) => (
              <section
                key={phase.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <button
                  className="flex w-full items-start gap-4 p-5 text-left sm:p-6"
                  onClick={() =>
                    setExpanded((e) =>
                      e.includes(phase.id)
                        ? e.filter((x) => x !== phase.id)
                        : [...e, phase.id],
                    )
                  }
                >
                  <span className="mt-0.5 font-mono text-xs text-blue-600">
                    0{phaseIndex + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold tracking-[-.02em]">
                      {phase.title.replace(/^\d+ — /, "")}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-slate-500">
                      {phase.objective}
                    </span>
                  </span>
                  <span className="status status-gray">
                    {phase.tasks.filter((task) => task.completed).length}/
                    {phase.tasks.length} complete
                  </span>
                  <ChevronDown
                    size={17}
                    className={`mt-1 text-slate-400 transition ${
                      expanded.includes(phase.id) ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {expanded.includes(phase.id) && (
                  <div className="border-t border-slate-100 px-4 pb-5 sm:px-6">
                    {phase.tasks.map((task, index) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        index={index}
                        total={phase.tasks.length}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move"
                          event.dataTransfer.setData(
                            "text/plain",
                            JSON.stringify({ phaseId: phase.id, index }),
                          )
                          setDraggingTask({ phaseId: phase.id, index })
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          if (draggingTask?.phaseId === phase.id) setDragOverTask(index)
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          let from = draggingTask?.index
                          try {
                            const parsed = JSON.parse(event.dataTransfer.getData("text/plain"))
                            if (typeof parsed.index === "number") from = parsed.index
                          } catch {
                            // ignore malformed drop data
                          }
                          if (typeof from === "number" && from !== index) reorderTask(phase.id, from, index)
                          setDraggingTask(null)
                          setDragOverTask(null)
                        }}
                        onDragEnd={() => {
                          setDraggingTask(null)
                          setDragOverTask(null)
                        }}
                        className={draggingTask?.phaseId === phase.id && dragOverTask === index ? "ring-2 ring-blue-400 rounded-lg" : ""}
                        update={(data) => updateTask(phase.id, task.id, data)}
                        remove={() => removeTask(phase.id, task.id)}
                        move={(dir) => moveTask(phase.id, index, dir)}
                        toggle={() =>
                          updateTask(phase.id, task.id, {
                            completed: !task.completed,
                          })
                        }
                      />
                    ))}
                    <button
                      onClick={() => addTask(phase.id)}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-3 text-xs font-medium text-slate-500 hover:border-blue-300 hover:text-blue-700"
                    >
                      <Plus size={14} />
                      Add task
                    </button>
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <Lightbulb size={16} />
              Assumption check
            </div>
            <p className="mt-3 text-xs leading-5 text-amber-800">
              Review Council assumptions before validation. Validation remains a
              human decision.
            </p>
            {navigate && (
               <button
                 type="button"
                 onClick={() => {
                   const rework = { ...project, status: "Analyzing" as Project["status"], updatedAt: new Date().toISOString() }
                   updateProject(rework)
                   navigate("council")
                   notify("info", "Council re-run started", "This refreshes the plan.")
                 }}
                 className="mt-4 text-xs font-semibold text-amber-900 underline underline-offset-4"
               >
                 Re-run Council analysis
               </button>
             )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold">Success criteria</h3>
            <ul className="mt-4 space-y-3 text-xs leading-5 text-slate-600">
              {(project.successCriteria ?? []).map((criterion, index) => (
                <li key={`${criterion}-${index}`} className="flex items-center gap-2">
                  <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                  <input
                    value={criterion}
                    onChange={(event) => putSuccessCriterion(index, event.target.value)}
                    className="min-w-0 flex-1 border-b border-transparent text-xs outline-none focus:border-slate-300"
                    aria-label="Success criterion"
                  />
                  <button
                    onClick={() => removeSuccessCriterion(index)}
                    className="text-red-500"
                    type="button"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <input
                value={newSuccessCriterion}
                onChange={(event) => setNewSuccessCriterion(event.target.value)}
                placeholder="Add criterion"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
              <button type="button" onClick={addSuccessCriterion} className="btn-secondary">
                <Plus size={13} />
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold">Isolated Council step</h3>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              Re-run only one Council step and patch the completed plan.
            </p>
            <div className="mt-3 flex gap-2">
              <select
                value={replayStep}
                onChange={(event) => setReplayStep(event.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                aria-label="Council step selector"
              >
                <option value="strategic">Strategic Analyst</option>
                <option value="feasibility">Feasibility Analyst</option>
                <option value="critique">Critical Reviewer</option>
                <option value="arbiter">Arbiter / synthesis</option>
                <option value="full">Full Council</option>
              </select>
              <button
                type="button"
                onClick={replayIsolatedStep}
                disabled={replaying}
                className="btn-secondary"
              >
                {replaying ? "Running..." : "Replay selected step"}
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold">Risks & mitigation</h3>
            <div className="mt-4 space-y-4">
              {project.risks.map((risk, index) => (
                <div key={`${risk.title}-${index}`} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      value={risk.title}
                      onChange={(event) => updateRisk(index, { title: event.target.value })}
                      className="min-w-0 flex-1 text-xs font-medium outline-none border-b border-transparent focus:border-slate-300"
                      aria-label="Risk title"
                    />
                    <select
                      value={risk.likelihood}
                      onChange={(event) =>
                        updateRisk(index, { likelihood: event.target.value as Risk["likelihood"] })
                      }
                      className="rounded-md border border-slate-200 bg-white text-[10px]"
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                    </select>
                    <button onClick={() => removeRisk(index)} className="text-red-500" type="button">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <textarea
                    value={risk.mitigation}
                    onChange={(event) => updateRisk(index, { mitigation: event.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-5"
                    rows={2}
                    aria-label="Mitigation"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={newRiskTitle}
                onChange={(event) => setNewRiskTitle(event.target.value)}
                placeholder="New risk"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
              <button type="button" onClick={addRisk} className="btn-secondary">
                <Plus size={13} />
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold">Sharing & versions</h3>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              Share the current plan and restore a previous snapshot.
            </p>
            {auth.user ? (
              <button
                type="button"
                onClick={createShare}
                disabled={sharing}
                className="mt-3 btn-secondary"
              >
                {sharing ? "Creating..." : "Create share link"}
              </button>
            ) : (
              <p className="mt-3 text-[11px] leading-5 text-slate-500">
                Sign in to create a share link.
              </p>
            )}
            {shareUrl && <p className="mt-2 break-all text-xs text-blue-700">{shareUrl}</p>}
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold text-slate-600">Version history</h4>
              {loadingVersions ? (
                <p className="text-[11px] text-slate-500">Loading versions...</p>
              ) : versions.length ? (
                versions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => {
                      if (!version.snapshot) return
                      const restored = { ...version.snapshot, id: project.id, updatedAt: new Date().toISOString() }
                      updateProject(restored)
                      notify("success", "Version restored", version.action)
                    }}
                    className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-[11px] hover:border-blue-300"
                  >
                    {new Date(version.createdAt).toLocaleString()} - {version.action}
                  </button>
                ))
              ) : (
                <p className="text-[11px] text-slate-500">No versions yet.</p>
              )}
            </div>
            <button type="button" onClick={exportJson} className="mt-4 btn-secondary">
              Export JSON
            </button>
          </div>
        </aside>
      </div>
      <ConfirmationDialog
        open={confirmValidation}
        title="Validate this project plan?"
        description="Validation confirms that you have reviewed the Council’s assumptions, risks, tasks, and success criteria. You can continue editing afterward."
        confirmLabel="Validate plan"
        onClose={() => setConfirmValidation(false)}
        onConfirm={() => {
          patch({ status: "Validated" })
          setConfirmValidation(false)
          notify(
            "success",
            "Plan validated",
            "Your review decision has been saved locally.",
          )
        }}
      />
    </div>
  )
}

function TaskRow({
  task,
  index,
  total,
  update,
  remove,
  move,
  toggle,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  className,
}: {
  task: Task
  index: number
  total: number
  update: (d: Partial<Task>) => void
  remove: () => void
  move: (d: -1 | 1) => void
  toggle: () => void
  draggable?: boolean
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void
  onDragEnd?: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`task-row border-b border-slate-100 py-4 last:border-0 ${
        task.completed ? "is-complete" : ""
      } ${className ?? ""}`}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="task-checkbox"
          aria-label={
            task.completed
              ? `Mark ${task.title} incomplete`
              : `Mark ${task.title} complete`
          }
          aria-pressed={!!task.completed}
        >
          {task.completed && <Check size={12} />}
        </button>
        <GripVertical size={15} className="shrink-0 text-slate-300" />
        <button
          onClick={() => setOpen(!open)}
          className="min-w-0 flex-1 text-left"
        >
          <input
            value={task.title}
            onChange={(e) => update({ title: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="task-title"
            aria-label="Task title"
          />
          <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span
              className={`priority priority-${task.priority.toLowerCase()}`}
            >
              {task.priority}
            </span>
            <span>{task.duration}</span>
            <span>·</span>
            <span>{task.deliverable}</span>
          </span>
        </button>
        <div className="flex items-center">
          <button
            disabled={index === 0}
            onClick={() => move(-1)}
            className="icon-button"
            aria-label="Move task up"
          >
            <ArrowUp size={14} />
          </button>
          <button
            disabled={index === total - 1}
            onClick={() => move(1)}
            className="icon-button"
            aria-label="Move task down"
          >
            <ArrowDown size={14} />
          </button>
          <button onClick={() => setOpen(!open)} className="icon-button">
            <ChevronDown size={14} className={open ? "rotate-180" : ""} />
          </button>
        </div>
      </div>
      {open && (
        <div className="ml-6 mt-4 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          <label className="mini-field sm:col-span-2">
            Description
            <textarea
              value={task.description}
              onChange={(e) => update({ description: e.target.value })}
              rows={2}
            />
          </label>
          <label className="mini-field">
            Priority
            <select
              value={task.priority}
              onChange={(e) =>
                update({ priority: e.target.value as Task["priority"] })
              }
            >
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </label>
          <label className="mini-field">
            Duration
            <input
              value={task.duration}
              onChange={(e) => update({ duration: e.target.value })}
            />
          </label>
          <label className="mini-field">
            Dependency
            <input
              aria-label="Task dependency"
              value={task.dependency}
              onChange={(e) => update({ dependency: e.target.value })}
            />
          </label>
          <label className="mini-field">
            Required resource
            <input
              value={task.resource}
              onChange={(e) => update({ resource: e.target.value })}
            />
          </label>
          <label className="mini-field sm:col-span-2">
            Deliverable
            <input
              value={task.deliverable}
              onChange={(e) => update({ deliverable: e.target.value })}
            />
          </label>
          <button
            onClick={remove}
            className="flex items-center gap-2 text-xs font-medium text-red-600"
          >
            <Trash2 size={13} />
            Remove task
          </button>
        </div>
      )}
    </div>
  )
}

function SettingsScreen({
  theme,
  setTheme,
}: {
  theme: "light" | "dark"
  setTheme: (theme: "light" | "dark") => void
}) {
  const auth = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const signIn = async () => {
    const error = await auth.signIn(email, password)
    setAuthMessage(error ?? "Signed in successfully.")
  }
  const signUp = async () => {
    const error = await auth.signUp(email, password)
    setAuthMessage(error ?? "Account created. Check your inbox if confirmation is required.")
  }
  const signOut = async () => {
    await auth.signOut()
    setAuthMessage("Signed out.")
  }
  return (
    <div className="page max-w-4xl">
      <p className="page-kicker">PREFERENCES</p>
      <h2 className="page-title">Settings</h2>
      <p className="page-subtitle">
        Keep the experience comfortable and understand how this prototype
        handles data.
      </p>
      <div className="mt-9 space-y-4">
        <Setting
          icon={Sun}
          title="Interface theme"
          description="Choose how Leanie appears on this device."
        >
          <div className="segmented">
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={theme === t ? "selected" : ""}
              >
                {t === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </Setting>
        <Setting
          icon={Languages}
          title="Language"
          description="The prototype is currently available in English."
        >
          <select className="settings-select">
            <option>English</option>
          </select>
        </Setting>
        <Setting
          icon={hasNeon ? CheckCircle2 : Bot}
          title="Backend configuration"
          description={
            hasNeon
              ? "Neon is configured for auth, project storage, council requests, and file exports."
              : "Neon is not configured. Projects remain in this browser."
          }
        >
          <span className={`status ${hasNeon ? "status-green" : "status-amber"}`}>
            {hasNeon ? "Connected" : "Local only"}
          </span>
        </Setting>
        <Setting
          icon={Bot}
          title="AI configuration"
          description={
            hasNeon
              ? "Council requests are routed through the leanie-council Neon Edge Function. Secrets remain on Neon."
              : "Council responses use deterministic demonstration data. No AI provider is connected."
          }
        >
          <span className={`status ${hasNeon ? "status-blue" : "status-amber"}`}>
            {hasNeon ? "Neon function" : "Simulation only"}
          </span>
        </Setting>
        <Setting
          icon={ShieldAlert}
          title="Privacy & AI usage"
          description={
            hasNeon
              ? "Authenticated projects are stored in Neon with row-level security. Anonymous sessions use this browser."
              : "Projects are stored in your browser’s localStorage and are not synchronized or sent to a server."
          }
        >
          <span className={`status ${hasNeon ? "status-green" : "status-green"}`}>
            {hasNeon ? "RLS enabled" : "Local only"}
          </span>
        </Setting>
        <Setting
          icon={User}
          title="Account"
          description="Sign in to save projects and exports in Neon."
        >
          {auth.user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">{auth.user.email ?? auth.user.id}</span>
              <button onClick={signOut} className="btn-secondary">
                Sign out
              </button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="settings-select"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="settings-select"
              />
              <div className="flex gap-2">
                <button onClick={signIn} className="btn-secondary" disabled={auth.loading}>
                  Sign in
                </button>
                <button onClick={signUp} className="btn-primary" disabled={auth.loading}>
                  Sign up
                </button>
              </div>
            </div>
          )}
        </Setting>
        {authMessage && <p className="text-xs text-slate-500">{authMessage}</p>}
        <Setting
          icon={Info}
          title="Application"
          description="Leanie — Lean Intelligence Engine. Early-stage frontend prototype by LiteTECH Startup."
        >
          <span className="text-xs text-slate-400">Version 0.1</span>
        </Setting>
      </div>
    </div>
  )
}

function Setting({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Sun
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
        <Icon size={18} />
      </span>
      <div className="flex-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      {children}
    </div>
  )
}

const sampleBrief = {
  title: "Admin model benchmark",
  objective:
    "Evaluate council output quality and latency on a standard sample brief used for model comparison.",
  context: "Internal benchmark run from the admin console.",
  outcome: "A comparable phased plan used to score models consistently.",
}

function AdminScreen({
  notify,
}: {
  notify: (kind: ToastKind, title: string, message?: string) => void
}) {
  const metricsUrl = import.meta.env.VITE_NEON_FUNCTION_METRICS_BASE_URL as
    | string
    | undefined
  const councilUrl = import.meta.env.VITE_NEON_FUNCTION_COUNCIL_BASE_URL as
    | string
    | undefined
  const [data, setData] = useState<MetricsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testModel, setTestModel] = useState(
    "google/diffusiongemma-26b-a4b-it",
  )
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)

  const load = useCallback(async () => {
    if (!metricsUrl) {
      setError(
        "Metrics endpoint is not configured (VITE_NEON_FUNCTION_METRICS_BASE_URL).",
      )
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(metricsUrl)
      if (!response.ok) throw new Error(`Metrics request failed (${response.status})`)
      setData((await response.json()) as MetricsPayload)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [metricsUrl])

  useEffect(() => {
    load()
  }, [load])

  const runTest = async () => {
    if (!councilUrl || testing) return
    setTesting(true)
    setTestResult(null)
    try {
      const response = await fetch(councilUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ ...sampleBrief, step: "full", model: testModel }),
      })
      const payload = await response.json()
      setTestResult(payload)
      if (payload?.metrics)
        notify(
          "success",
          "Test run complete",
          `${payload.metrics.model} · ${payload.metrics.latencyMs} ms`,
        )
      else
        notify("warning", "Test run finished", "The council returned no metrics (demo mode?).")
    } catch (err) {
      notify("error", "Test run failed", String(err))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="page max-w-5xl">
      <p className="page-kicker">MODEL OBSERVABILITY</p>
      <h2 className="page-title">Admin</h2>
      <p className="page-subtitle">
        Measure every Council model on analysis quality, risk relevance,
        recommendation coherence, JSON compliance, latency and cost.
      </p>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {data
            ? `${data.models.length} model${data.models.length === 1 ? "" : "s"} · ${data.runs.length} recent run${data.runs.length === 1 ? "" : "s"}`
            : "No data yet"}
        </p>
        <button onClick={load} className="btn-secondary" disabled={loading}>
          <RotateCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading && <p className="mt-6 text-sm text-slate-500">Loading metrics…</p>}
      {error && (
        <div className="info-card info-amber mt-6">
          <span>UNAVAILABLE</span>
          <p>{error}</p>
        </div>
      )}

      {data?.models.map((model) => (
        <ModelCard key={model.model} model={model} />
      ))}

      {data && data.runs.length > 0 && (
        <div className="dashboard-panel mt-8 overflow-x-auto">
          <h3 className="text-sm font-semibold text-slate-950">Recent runs</h3>
          <table className="mt-4 w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-2 pr-3 font-semibold">When</th>
                <th className="py-2 pr-3 font-semibold">Model</th>
                <th className="py-2 pr-3 font-semibold">Step</th>
                <th className="py-2 pr-3 font-semibold">Mode</th>
                <th className="py-2 pr-3 font-semibold">Latency</th>
                <th className="py-2 pr-3 font-semibold">Tokens</th>
                <th className="py-2 pr-3 font-semibold">Cost</th>
                <th className="py-2 pr-3 font-semibold">JSON</th>
                <th className="py-2 pr-3 font-semibold">Q / R / C</th>
                <th className="py-2 pr-3 font-semibold">Brief</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {data.runs.map((run) => (
                <tr key={run.id} className="border-b border-slate-100">
                  <td className="whitespace-nowrap py-2 pr-3">
                    {new Date(run.created_at).toLocaleString()}
                  </td>
                  <td className="break-all py-2 pr-3">{run.model}</td>
                  <td className="py-2 pr-3">{run.step}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`status ${run.mode === "error" ? "status-amber" : "status-green"}`}
                    >
                      {run.mode}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{run.latency_ms ?? "—"} ms</td>
                  <td className="py-2 pr-3">
                    {Number(run.total_tokens ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3">
                    ${Number(run.cost_usd ?? 0).toFixed(4)}
                  </td>
                  <td className="py-2 pr-3">
                    {run.json_valid == null ? "—" : run.json_valid ? "✓" : "✗"}
                  </td>
                  <td className="py-2 pr-3">
                    {run.analysis_quality ?? "—"} / {run.risk_relevance ?? "—"} /{" "}
                    {run.coherence ?? "—"}
                  </td>
                  <td
                    className="max-w-[180px] truncate py-2 pr-3"
                    title={run.error ?? run.brief_title ?? ""}
                  >
                    {run.error ?? run.brief_title ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="dashboard-panel mt-8">
        <h3 className="text-sm font-semibold text-slate-950">Model test bench</h3>
        <p className="mt-1 text-xs text-slate-500">
          Run a full Council analysis on a standard sample brief with any NVIDIA
          NIM model id. Cold starts can take 10–30 seconds.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={testModel}
            onChange={(event) => setTestModel(event.target.value)}
            placeholder="vendor/model-id"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900"
          />
          <button onClick={runTest} className="btn-primary" disabled={testing}>
            <Play size={14} />
            {testing ? "Running…" : "Run test"}
          </button>
        </div>
        {testResult && <TestResultView result={testResult} />}
      </div>
    </div>
  )
}

function ModelCard({ model }: { model: ModelMetrics }) {
  const scores = [
    { label: "Analysis quality", value: model.avg_analysis_quality, suffix: "/100" },
    { label: "Risk relevance", value: model.avg_risk_relevance, suffix: "/100" },
    {
      label: "Recommendation coherence",
      value: model.avg_coherence,
      suffix: "/100",
    },
    {
      label: "JSON format compliance",
      value: model.json_valid_rate,
      suffix: "%",
    },
  ]
  return (
    <div className="dashboard-panel mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="break-all text-sm font-semibold text-slate-950">
            {model.model}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {model.runs} run{model.runs === 1 ? "" : "s"} · last{" "}
            {model.last_run_at ? fmtDate(model.last_run_at) : "—"}
          </p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Avg latency
            </p>
            <p className="text-lg font-semibold text-slate-900">
              {model.avg_latency_ms ?? "—"}
              <span className="text-xs font-normal text-slate-500"> ms</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Total cost
            </p>
            <p className="text-lg font-semibold text-slate-900">
              ${(model.total_cost_usd ?? 0).toFixed(4)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Tokens
            </p>
            <p className="text-lg font-semibold text-slate-900">
              {Number(model.total_tokens ?? 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {scores.map((score) => (
          <ScoreBar
            key={score.label}
            label={score.label}
            value={score.value}
            suffix={score.suffix}
          />
        ))}
      </div>
    </div>
  )
}

function ScoreBar({
  label,
  value,
  suffix,
}: {
  label: string
  value: number | null
  suffix: string
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value))
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">
          {value == null ? "—" : `${Math.round(value)}${suffix}`}
        </span>
      </div>
      <div className="progress-track mt-2">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function TestResultView({ result }: { result: any }) {
  const metrics = result?.metrics
  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      {result?.mode === "demo" && (
        <p className="text-xs font-medium text-amber-600">
          Demo fallback{result?.error ? ` — ${result.error}` : "."}
        </p>
      )}
      {metrics ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <AdminStat label="Model" value={metrics.model} small />
            <AdminStat label="Latency" value={`${metrics.latencyMs} ms`} />
            <AdminStat
              label="Tokens"
              value={(metrics.tokens?.total ?? 0).toLocaleString()}
            />
            <AdminStat label="Cost" value={`$${(metrics.costUsd ?? 0).toFixed(4)}`} />
            <AdminStat
              label="JSON"
              value={metrics.jsonValid ? "Valid" : "Invalid"}
            />
            <AdminStat
              label="Phases"
              value={String(result?.phases?.length ?? 0)}
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Quality {metrics.scores?.analysisQuality ?? "—"}/100 · risk relevance{" "}
            {metrics.scores?.riskRelevance ?? "—"}/100 · coherence{" "}
            {metrics.scores?.coherence ?? "—"}/100 ·{" "}
            {result?.risks?.length ?? 0} risks · {result?.assumptions?.length ?? 0}{" "}
            assumptions
          </p>
        </>
      ) : (
        <p className="text-xs text-slate-500">
          No metrics returned{result?.error ? ` — ${result.error}` : "."}
        </p>
      )}
    </div>
  )
}

function AdminStat({
  label,
  value,
  small,
}: {
  label: string
  value: string
  small?: boolean
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 font-semibold text-slate-900 ${small ? "break-all text-[11px]" : "text-sm"}`}
      >
        {value}
      </p>
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const hash = location.hash.slice(1)
    if (hash.startsWith("shared/")) return "shared"
    return (hash || "landing") as Screen
  })
  const [sharedLoading, setSharedLoading] = useState(false)
  const [sharedProject, setSharedProject] = useState<Project | null>(null)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("leanie-sidebar") === "collapsed",
  )
  const auth = useAuth()
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    localStorage.getItem("leanie-theme") === "dark" ? "dark" : "light",
  )
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [projectsLoading, setProjectsLoading] = useState(true)
  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? projects[0],
    [projects, selectedId],
  )
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    setProjectsLoading(true)
    setShareToken(null)
    loadProjects(auth.user?.id ?? null)
      .then((loaded) => {
        if (!active) return
        const fallback = auth.user ? [] : [demoProject]
        const next = loaded.length ? loaded : fallback
        setProjects(next)
        setSelectedId(next[0]?.id ?? "")
        setProjectsLoading(false)
        syncOfflineProjects().then(() => loadProjects(auth.user?.id ?? null)).then((synced) => {
          if (!active || !synced.length) return
          setProjects(synced)
        }).catch(() => {})
      })
      .catch((error) => {
        if (!active) return
        console.error(error)
        setProjectsLoading(false)
      })
    return () => {
      active = false
    }
  }, [auth.user])

  useEffect(() => {
    localStorage.setItem("leanie-theme", theme)
    document.documentElement.style.colorScheme = theme
    document.documentElement.dataset.theme = theme
  }, [theme])
  useEffect(
    () =>
      localStorage.setItem(
        "leanie-sidebar",
        collapsed ? "collapsed" : "expanded",
      ),
    [collapsed],
  )
  useEffect(() => {
    if (screen !== "shared") return
    const token = location.hash.slice("#shared/".length)
    if (!token) return
    setSharedLoading(true)
    loadSharedProject(token)
      .then((project) => {
        if (!project) {
          notify("error", "Shared plan unavailable", "The link is invalid or expired.")
          return
        }
        setSharedProject(project)
        setProjects([project])
        setSelectedId(project.id)
        setShareToken(token)
        setScreen("plan")
        history.replaceState(null, "", "#plan")
      })
      .catch(() => notify("error", "Shared plan unavailable", "Could not load this plan."))
      .finally(() => setSharedLoading(false))
  }, [screen])
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setCommandOpen((value) => !value)
      }
      if (event.key === "Escape") setCommandOpen(false)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [])
  const notify = useCallback(
    (kind: ToastKind, title: string, message?: string) => {
      const id = crypto.randomUUID()
      setToasts((items) => [...items, { id, kind, title, message }].slice(-4))
      window.setTimeout(
        () => setToasts((items) => items.filter((item) => item.id !== id)),
        4200,
      )
    },
    [],
  )
  const navigate = (s: Screen) => {
    setScreen(s)
    history.replaceState(null, "", `#${s}`)
    window.scrollTo(0, 0)
    scrollRef.current?.scrollTo(0, 0)
  }
  const openProject = (p: Project) => {
    setSelectedId(p.id)
    setShareToken(null)
    navigate(
      p.status === "Analyzing"
        ? "council"
        : p.status === "Draft"
          ? "results"
          : "plan",
    )
  }
  const importProjectFromFile = async (file: File) => {
    try {
      const text = await file.text()
      const source = JSON.parse(text) as Partial<Project>
      const now = new Date().toISOString()
      const project: Project = {
        id: crypto.randomUUID(),
        title: source.title?.trim() || file.name.replace(/\\.json$/i, ""),
        objective: source.objective?.trim() || "Imported project",
        context: source.context?.trim() || "",
        outcome: source.outcome?.trim() || "Review imported plan",
        targetDate: source.targetDate,
        budget: source.budget,
        resources: source.resources,
        createdAt: source.createdAt || now,
        updatedAt: now,
        status:
          source.status === "Draft" ||
          source.status === "Analyzing" ||
          source.status === "Plan ready" ||
          source.status === "Validated"
            ? source.status
            : "Draft",
        phases: Array.isArray(source.phases) ? source.phases : [],
        risks: Array.isArray(source.risks) ? source.risks : [],
        assumptions: Array.isArray(source.assumptions) ? source.assumptions : [],
        successCriteria: Array.isArray(source.successCriteria) ? source.successCriteria : [],
        tags: Array.isArray(source.tags) ? source.tags : [],
      }
      setProjects((p) => [project, ...p])
      setSelectedId(project.id)
      await saveProject(project, auth.user?.id ?? null)
      openProject(project)
      notify("success", "Project imported", "The JSON file was imported as a new project.")
    } catch (error) {
      notify("error", "Import failed", String(error))
    }
  }

  const createProject = (form: ProjectFormData) => {
    const plan = cloneDemoPlan()
    const now = new Date().toISOString()
    const project: Project = {
      ...form,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      status: "Analyzing",
      ...plan,
    }
    setProjects((p) => [project, ...p])
    setSelectedId(project.id)
    saveProject(project, auth.user?.id ?? null).then(() => {
      if (auth.user) saveProjectVersion(project, "created", auth.user.id)
    }).catch((error) =>
      notify("error", "Project save failed", String(error)),
    )
    navigate("council")
    notify(
      "info",
      hasNeon ? "Council request sent" : "Council simulation started",
      hasNeon
        ? "The Council request is being processed by Neon."
        : "Three specialist perspectives will analyze in parallel.",
    )
  }
  const completeCouncil = (result?: any) => {
    if (!selected) return
    const updated: Project = {
      ...selected,
      status: "Plan ready",
      updatedAt: new Date().toISOString(),
      phases: result?.phases ?? selected.phases,
      risks: result?.risks ?? selected.risks,
      assumptions: result?.assumptions ?? selected.assumptions,
      successCriteria: result?.successCriteria ?? selected.successCriteria,
      tags: result?.tags ?? selected.tags,
    }
    setProjects((p) => p.map((x) => (x.id === selected.id ? updated : x)))
    saveProject(updated, auth.user?.id ?? null).catch((error) =>
      notify("error", "Project save failed", String(error)),
    )
    navigate("results")
  }
  const updateProject = (project: Project) => {
    const updated = { ...project, updatedAt: new Date().toISOString() }
    const sharedToken = shareToken
    if (sharedToken) {
      setProjects((items) => items.map((x) => (x.id === project.id ? updated : x)))
      persistSharedProject(updated, sharedToken).then((result) => {
        if (result.status === "network" && auth.user?.id) queueProjectForSync(updated, auth.user.id)
        if (result.status === "conflict" && result.project) {
          setProjects((items) => items.map((x) => (x.id === project.id ? result.project! : x)))
          notify("error", "Conflict resolved", "Someone else updated the plan first. Your view has been refreshed.")
          return
        }
        if (result.status === "ok" && result.project) {
          setProjects((items) => items.map((x) => (x.id === project.id ? result.project! : x)))
        }
        if (result.status === "error" || result.status === "network") {
          notify("error", "Share update failed", result.error ?? "Could not update the shared plan.")
        }
      })
      return
    }
    setProjects((p) => p.map((x) => (x.id === project.id ? updated : x)))
    saveProject(updated, auth.user?.id ?? null).then(() => {
      if (auth.user) saveProjectVersion(updated, "updated", auth.user.id)
    }).catch((error) =>
      notify("error", "Project save failed", String(error)),
    )
  }
  const deleteProject = () => {
    if (!deleteTarget) return
    setProjects((p) => p.filter((x) => x.id !== deleteTarget.id))
    if (selectedId === deleteTarget.id) setSelectedId("")
    const id = deleteTarget.id
    setDeleteTarget(null)
    removeProject(id, auth.user?.id ?? null).catch((error) =>
      notify("error", "Project delete failed", String(error)),
    )
    navigate("projects")
    notify("success", "Project deleted", "The project data has been removed.")
  }

  if (screen === "landing")
    return (
      <div className={`theme-${theme}`}>
        <Landing enter={(s = "overview") => navigate(s)} />
      </div>
    )
  if (screen === "shared") {
    return (
      <div className={`theme-${theme}`}>
        <div className="page">
          {sharedLoading ? "Loading shared plan..." : "Shared plan is unavailable."}
        </div>
      </div>
    )
  }
  const title =
    screen === "overview"
      ? "Overview"
      : screen === "projects"
        ? "My Projects"
        : screen === "new"
          ? "New Project"
          : screen === "settings"
            ? "Settings"
            : screen === "admin"
              ? "Admin"
              : (selected?.title ?? "Project")
  return (
    <div
      className={`app-shell min-h-screen bg-[#f8f9fc] text-[#101827] theme-${theme}`}
    >
      <Sidebar
        screen={screen}
        navigate={navigate}
        mobileOpen={mobileOpen}
        close={() => setMobileOpen(false)}
        collapsed={collapsed}
        toggleCollapsed={() => setCollapsed((value) => !value)}
        openCommand={() => setCommandOpen(true)}
      />
      <main className={`app-main ${collapsed ? "sidebar-collapsed" : ""}`}>
        <AppHeader
          title={title}
          menu={() => setMobileOpen(true)}
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCommandOpen(true)}
                className="header-command"
                aria-label="Open command palette"
              >
                <Search size={14} />
                <span>Search</span>
                <kbd>
                  <Command size={10} />K
                </kbd>
              </button>
              <button
                onClick={() =>
                  setTheme((value) => (value === "dark" ? "light" : "dark"))
                }
                className="icon-button"
                aria-label={`Switch to ${
                  theme === "dark" ? "light" : "dark"
                } theme`}
              >
                {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button
                onClick={() => navigate("landing")}
                className="hidden items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 xl:flex"
              >
                <Home size={14} />
                Product site
              </button>
            </div>
          }
        />
        <div key={screen} ref={scrollRef} className="page-transition">
          {screen === "overview" && (
            <Dashboard
              projects={projects}
              navigate={navigate}
              select={openProject}
            />
          )}
          {screen === "projects" && (
            <ProjectsScreen
              projects={projects}
              open={openProject}
              remove={setDeleteTarget}
              navigate={navigate}
              onImport={importProjectFromFile}
            />
          )}
          {screen === "new" && (
            <ProjectForm
              submit={createProject}
              cancel={() => navigate("overview")}
            />
          )}
          {screen === "council" && selected && (
            <CouncilScreen project={selected} complete={completeCouncil} />
          )}
          {screen === "results" && selected && (
            <Results project={selected} plan={() => navigate("plan")} />
          )}
          {screen === "plan" && selected && (
            <PlanScreen
              project={selected}
              updateProject={updateProject}
              notify={notify}
              navigate={navigate}
            />
          )}
          {screen === "settings" && (
            <SettingsScreen theme={theme} setTheme={setTheme} />
          )}
          {screen === "admin" && <AdminScreen notify={notify} />}
          {["council", "results", "plan"].includes(screen) && !selected && (
            <MissingProject navigate={navigate} />
          )}
        </div>
      </main>
      <ConfirmationDialog
        open={!!deleteTarget}
        danger
        title="Delete this project?"
        description={`“${deleteTarget?.title}” and its local analysis will be permanently removed from this browser. This action cannot be undone.`}
        confirmLabel="Delete project"
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteProject}
      />
      <CommandPalette
        open={commandOpen}
        projects={projects}
        onClose={() => setCommandOpen(false)}
        navigate={navigate}
        openProject={openProject}
      />
      <ToastViewport
        items={toasts}
        dismiss={(id) =>
          setToasts((items) => items.filter((item) => item.id !== id))
        }
      />
    </div>
  )
}
