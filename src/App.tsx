import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Bell,
  Bot,
  Boxes,
  BrainCircuit,
  CalendarDays,
  Command,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  Cpu,
  Download,
  FileText,
  Gauge,
  GripVertical,
  Home,
  Info,
  Languages,
  LayoutDashboard,
  Layers,
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
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react"
import { RealtimeProvider, useLiveQuery } from "@neon/realtime-react"
import type { SealedLiveQuery } from "@neon/realtime/client"
import { Brand } from "./components/Brand"
import { CommandPalette } from "./components/CommandPalette"
import { ConfirmationDialog } from "./components/ConfirmationDialog"
import { AdminCouncilDiagram, CouncilDiagram, type CouncilStage } from "./components/CouncilDiagram"
import {
  ToastViewport,
  type ToastItem,
  type ToastKind,
} from "./components/Toast"
import { analysts, cloneDemoPlan, demoProject } from "./data"
import type {
  BenchmarkRunRow,
  CouncilConfig,
  CouncilConfigStep,
  CouncilStepDetail,
  CouncilStepName,
  LeanieProvider,
  MetricsPayload,
  ModelMetrics,
  ModelRun,
  Phase,
  Project,
  ProjectFormData,
  ProviderModel,
  Risk,
  RunsResponse,
  Screen,
  Task,
} from "./types"
import { useAuth } from "./lib/auth"
import { hasNeon, requireNeon, neonClient } from "./lib/neon"
import {
  realtimeClient,
  realtimeEnabled,
  fetchSealedBenchmarkRun,
  callNeonFunction,
} from "./lib/realtime"
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
  heartbeatSharePresence,
  loadSharePresence,
} from "./lib/projectsRepo"
import { parseCsvRows } from "./lib/csv"
import { createId } from "./lib/id"
import {
  formatDate,
  formatToday,
  useLang,
  type DictKey,
} from "./lib/i18n"

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
const navItems: { id: Screen; label: import("./lib/i18n").DictKey; icon: typeof Home }[] = [
  { id: "overview", label: "nav.overview", icon: LayoutDashboard },
  { id: "projects", label: "nav.projects", icon: FileText },
  { id: "new", label: "nav.new", icon: Plus },
  { id: "settings", label: "nav.settings", icon: Settings },
  { id: "admin", label: "nav.admin", icon: BarChart3 },
]

function fmtDate(value: string, lang: "en" | "fr" = "en") {
  return formatDate(value, lang)
}

const statusKey: Record<Project["status"], DictKey> = {
  Draft: "status.Draft",
  Analyzing: "status.Analyzing",
  "Plan ready": "status.Plan ready",
  Validated: "status.Validated",
}

const eventKey: Record<Project["status"], DictKey> = {
  Draft: "topbar.eventBrief",
  Analyzing: "topbar.eventBrief",
  "Plan ready": "topbar.eventCouncil",
  Validated: "topbar.eventValidated",
}

function projectTaskCount(project: Project) {
  return project.phases.reduce((total, phase) => total + phase.tasks.length, 0)
}

function projectProgress(project: Project) {
  const tasks = project.phases.flatMap((phase) => phase.tasks)
  if (!tasks.length) return 0
  const done = tasks.filter((task) => task.completed).length
  return Math.round((done / tasks.length) * 100)
}

/** 0 = untouched (accent), 1 = in review (warning), 2 = approved (positive). */
function reviewState(status: Project["status"]) {
  return status === "Analyzing" ? 1 : status === "Validated" ? 2 : 0
}

function StatusPill({ status }: { status: Project["status"] }) {
  const { t } = useLang()
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
      {t(`status.${status}` as import("./lib/i18n").DictKey)}
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
  const { t } = useLang()
  return (
    <div className="landing-shell min-h-screen overflow-hidden">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#101827]/95 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-[1240px] items-center justify-between px-5 lg:px-8">
          <Brand light />
          <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="#process" className="hover:text-white">
              {t("landing.howItWorks")}
            </a>
            <a href="#council" className="hover:text-white">
              {t("landing.aiCouncil")}
            </a>
            <a href="#benefits" className="hover:text-white">
              {t("landing.benefits")}
            </a>
          </nav>
          <button
            onClick={() => enter("overview")}
            className="rounded-lg bg-[#f8fbff] px-4 py-2.5 text-sm font-semibold text-[#101827] transition hover:bg-blue-50"
          >
            {t("landing.getStarted")}
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
                <Sparkles size={13} /> {t("landing.eyebrow")}
              </div>
              <h1 className="mt-7 text-[clamp(3.2rem,7vw,6.6rem)] font-medium leading-[0.94] tracking-[-0.065em]">
                {t("landing.title1")}
                <br />
                <span className="text-[#9bb2ff]">{t("landing.title2")}</span>
                <br />
                {t("landing.title3")}
              </h1>
              <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-slate-300">
                {t("landing.subtitle")}
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  onClick={() => enter("new")}
                  className="btn-light group"
                >
                  {t("landing.startPlanning")}{" "}
                  <ArrowRight
                    size={16}
                    className="transition group-hover:translate-x-0.5"
                  />
                </button>
                <a href="#process" className="btn-dark-outline">
                  {t("landing.discover")} <ArrowDown size={15} />
                </a>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                {t("landing.prototypeNote")}
              </p>
            </div>

            <div className="relative mx-auto mt-16 max-w-5xl rounded-[24px] border border-white/10 bg-[#172338] p-2 shadow-[0_40px_100px_rgba(0,0,0,.4)]">
              <div className="rounded-[18px] border border-white/8 bg-[#111c2d] p-5 sm:p-8">
                <div className="flex items-center justify-between border-b border-white/8 pb-5">
                  <div className="text-left">
                    <p className="text-xs text-slate-500">{t("landing.councilSession")}</p>
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
          <div className="landing-container">
            <div className="section-heading">
              <span>01 / PROCESS</span>
              <h2>
                From open question
                <br />
                to executable direction.
              </h2>
              <p>
                LeanIE Plan introduces productive tension before commitment, then
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
          <div className="landing-container">
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
          </div>
        </section>

        <section className="px-5 pb-20 lg:px-8">
          <div className="landing-cta mx-auto max-w-[1240px] rounded-[24px] border border-[#648bff]/15 bg-[#e9edff] px-6 py-16 text-center sm:px-12 lg:py-20">
            <p className="landing-cta-kicker text-xs font-semibold tracking-[.18em] text-[#526fd2]">
              START WITH BETTER QUESTIONS
            </p>
            <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-medium tracking-[-.045em] text-[#101827] sm:text-5xl">
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
      <footer className="border-t border-slate-200 bg-white dark:border-[rgb(255,255,255,0.09)] dark:bg-[#141f30]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <Brand />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("landing.footerTagline")}
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
  projects,
  selectedId,
  notify,
}: {
  screen: Screen
  navigate: (s: Screen) => void
  mobileOpen: boolean
  close: () => void
  collapsed: boolean
  toggleCollapsed: () => void
  projects: Project[]
  selectedId: string
  notify: (kind: ToastKind, title: string, message?: string) => void
}) {
  const { t } = useLang()
  const selected = projects.find((p) => p.id === selectedId)
  const initials = selected
    ? selected.title
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0))
        .join("")
        .toUpperCase()
    : "LP"
  const storageBytes = new Blob([localStorage.getItem(STORAGE_KEY) ?? ""]).size
  const storagePct = Math.min(100, Math.round((storageBytes / (5 * 1024 * 1024)) * 100))
  return (
    <>
      {mobileOpen && (
        <button
          className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden"
          aria-label={t("nav.openNavigation")}
          onClick={close}
        />
      )}
      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-50 lg:translate-x-0 ${
          collapsed ? "is-collapsed" : ""
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="sidebar-row">
          <div className="sidebar-brand">
            <Brand light />
          </div>
          <button
            onClick={close}
            className="icon-button text-slate-400 lg:hidden"
            aria-label={t("nav.closeMenu")}
          >
            <X size={18} />
          </button>
        </div>
        {selected && (
          <button
            className="project-switcher"
            onClick={() => {
              navigate("projects")
              close()
            }}
          >
            <span className="switcher-icon">{initials}</span>
            <span className="project-copy">
              <small>{t("nav.activeProject")}</small>
              <b>{selected.title}</b>
            </span>
            <ChevronRight size={14} />
          </button>
        )}
        <nav className="flex-1 overflow-y-auto">
          <div className="nav-list">
            <div className="nav-kicker">{t("nav.workspace")}</div>
            <button
              onClick={() => {
                navigate("overview")
                close()
              }}
              className={screen === "overview" ? "active" : ""}
            >
              <LayoutDashboard size={16} />
              <span className="sidebar-label">{t("nav.overview")}</span>
            </button>
            <button
              onClick={() => {
                navigate("projects")
                close()
              }}
              className={
                screen === "projects" ||
                ["council", "results", "plan"].includes(screen)
                  ? "active"
                  : ""
              }
            >
              <FileText size={16} />
              <span className="sidebar-label">{t("nav.projects")}</span>
              <em>{projects.length}</em>
            </button>
            <button
              onClick={() => {
                navigate("new")
                close()
              }}
              className={screen === "new" ? "active" : ""}
            >
              <Plus size={16} />
              <span className="sidebar-label">{t("nav.new")}</span>
            </button>
          </div>
          <div className="nav-list nav-section">
            <div className="nav-kicker">{t("nav.kickerAdmin")}</div>
            <button
              onClick={() => {
                navigate("admin")
                close()
              }}
              className={screen === "admin" ? "active" : ""}
            >
              <BarChart3 size={16} />
              <span className="sidebar-label">{t("nav.admin")}</span>
            </button>
          </div>
        </nav>
        <div className="sidebar-bottom">
          <button
            onClick={() => {
              navigate("settings")
              close()
            }}
            className={screen === "settings" ? "active" : ""}
          >
            <Settings size={16} />
            <span className="sidebar-label">{t("nav.settings")}</span>
          </button>
          <button
            onClick={() => {
              notify("info", t("nav.help"), t("dashboard.prototypeNote"))
              close()
            }}
          >
            <Info size={16} />
            <span className="sidebar-label">{t("nav.help")}</span>
          </button>
          <button
            onClick={toggleCollapsed}
            className="sidebar-collapse hidden lg:flex"
            aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
          >
            <ChevronRight size={14} />
            <span className="sidebar-label">{t("nav.collapse")}</span>
          </button>
          <div className="storage">
            <div>
              <span>{t("nav.storage")}</span>
              <b>{Math.max(1, Math.round(storageBytes / 1024))} KB / 5 MB</b>
            </div>
            <div className="storage-track">
              <i style={{ width: `${storagePct}%` }} />
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

function AppHeader({
  title,
  menu,
  projects,
  navigate,
  theme,
  toggleTheme,
  openCommand,
}: {
  title: string
  menu: () => void
  projects: Project[]
  navigate: (s: Screen) => void
  theme: "light" | "dark"
  toggleTheme: () => void
  openCommand: () => void
}) {
  const { t, lang, setLang } = useLang()
  const auth = useAuth()
  const [notifsOpen, setNotifsOpen] = useState(false)
  const events = projects
    .slice()
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 3)
  const initials = auth.user?.name
    ? auth.user.name
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0))
        .join("")
        .toUpperCase()
    : (auth.user?.email ?? "LP").slice(0, 2).toUpperCase()
  return (
    <header className="topbar">
      <div className="topbar-title">
        <button
          className="icon-button menu-button"
          onClick={menu}
          aria-label={t("nav.openNavigation")}
        >
          <Menu size={18} />
        </button>
        <div>
          <button
            className="topbar-product"
            onClick={() => navigate("landing")}
          >
            {t("nav.product")}
          </button>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="topbar-actions">
        {notifsOpen && (
          <button
            className="fixed inset-0 z-40"
            style={{ background: "transparent" }}
            aria-label={t("topbar.notifications")}
            onClick={() => setNotifsOpen(false)}
          />
        )}
        <button
          className="icon-button"
          onClick={openCommand}
          aria-label={t("a11y.openCommandPalette")}
        >
          <Search size={15} />
        </button>
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          aria-label={
            theme === "dark"
              ? t("settings.switchToLight")
              : t("settings.switchToDark")
          }
        >
          <Sun size={13} />
          <span className={theme === "dark" ? "toggle-on" : ""} />
          <Moon size={13} />
        </button>
        <button
          className="language-button"
          onClick={() => setLang(lang === "fr" ? "en" : "fr")}
          aria-label={t("settings.languageTitle")}
        >
          <Languages size={13} />
          {lang.toUpperCase()}
        </button>
        <span className="notification-wrap">
          <button
            className="icon-button notification-button"
            onClick={() => setNotifsOpen((value) => !value)}
            aria-label={t("topbar.notifications")}
          >
            <Bell size={15} />
            {events.length > 0 && <i />}
          </button>
          {notifsOpen && (
            <div className="notification-popover">
              <div>
                <b>{t("topbar.notifications")}</b>
                <button
                  onClick={() => setNotifsOpen(false)}
                  aria-label={t("nav.closeMenu")}
                >
                  <X size={14} />
                </button>
              </div>
              {events.length > 0 ? (
                events.map((project) => (
                  <p key={project.id}>
                    {project.status === "Validated" ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <FileText size={14} />
                    )}
                    <span>
                      {t(eventKey[project.status])}
                      <small>
                        {project.title} · {fmtDate(project.updatedAt, lang)}
                      </small>
                    </span>
                  </p>
                ))
              ) : (
                <div className="notification-empty">
                  {t("topbar.noNotifications")}
                </div>
              )}
            </div>
          )}
        </span>
        <button
          className="avatar-button"
          onClick={() => navigate("settings")}
          aria-label={t("nav.settings")}
        >
          <span>{initials}</span>
          <ChevronDown size={12} />
        </button>
      </div>
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
  const [filter, setFilter] = useState<"all" | "ready" | "validated">("all")
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 320)
    return () => clearTimeout(timer)
  }, [])
  const { t, lang } = useLang()
  if (loading) return <DashboardSkeleton />
  const sorted = projects
    .slice()
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
  const focus =
    sorted.find(
      (p) => p.status === "Analyzing" || p.status === "Plan ready",
    ) ?? sorted[0]
  const queue = sorted.filter((p) => p.status === "Plan ready").slice(0, 3)
  const filtered =
    filter === "all"
      ? sorted
      : sorted.filter((p) =>
          filter === "ready"
            ? p.status === "Plan ready"
            : p.status === "Validated",
        )
  const totalTasks = projects.reduce((sum, p) => sum + projectTaskCount(p), 0)
  const totalRisks = projects.reduce((sum, p) => sum + p.risks.length, 0)
  const averageProgress = projects.length
    ? Math.round(
        projects.reduce((sum, p) => sum + projectProgress(p), 0) /
          projects.length,
      )
    : 0
  const metrics = [
    {
      label: t("dashboard.totalProjects"),
      value: projects.length,
      small: `${totalTasks} ${t("dashboard.tasksCount")}`,
    },
    {
      label: t("dashboard.plansReady"),
      value: projects.filter((p) => p.status === "Plan ready").length,
      small: t("dashboard.queueTitle"),
    },
    {
      label: t("dashboard.validated"),
      value: projects.filter((p) => p.status === "Validated").length,
      small: `${averageProgress}% ${t("dashboard.progressLabel")}`,
    },
    {
      label: t("dashboard.inAnalysis"),
      value: projects.filter((p) => p.status === "Analyzing").length,
      small: t("landing.aiCouncil"),
    },
  ]
  return (
    <div className="page">
      <div className="welcome-row">
        <div>
          <p className="page-kicker">
            <i className="desk-live-dot" />
            {t("dashboard.eyebrow")}
          </p>
          <h2>{t("dashboard.greeting")}</h2>
          <p className="welcome-copy">{t("dashboard.tagline")}</p>
        </div>
        <div className="desk-header-actions">
          <span>{formatToday(lang)}</span>
          <button onClick={() => navigate("new")} className="btn-primary">
            <Plus size={14} />
            {t("dashboard.createProject")}
          </button>
        </div>
      </div>

      <div className="metrics-grid">
        {metrics.map((metric) => (
          <div key={metric.label} className="metric-cell">
            <span>{metric.label}</span>
            <strong>
              <AnimatedNumber value={metric.value} />
            </strong>
            <small>{metric.small}</small>
          </div>
        ))}
      </div>

      <div className="desk-focus-layout">
        {focus && (
          <section className="focus-review">
            <div className="section-rule">
              <span>01 — {t("dashboard.continueLabel")}</span>
              <span>{fmtDate(focus.updatedAt, lang)}</span>
            </div>
            <div className="focus-project">
              <div className="focus-project-meta">
                <span>
                  {focus.targetDate
                    ? `${t("dashboard.targetLabel")} · ${fmtDate(
                        focus.targetDate,
                        lang,
                      )}`
                    : t("dashboard.noTarget")}
                </span>
                <StatusPill status={focus.status} />
              </div>
              <h3>{focus.title}</h3>
              <p>{focus.objective}</p>
              <div className="document-comparison">
                <div className="source-paper">
                  <div className="source-paper-header">
                    <FileText size={11} />
                    <span>{t("dashboard.paperBrief")}</span>
                    <small>{fmtDate(focus.createdAt, lang)}</small>
                  </div>
                  <p className="paper-kicker">{t("dashboard.tasksCount")}</p>
                  <div className="source-number">
                    {projectTaskCount(focus)}
                    <span>{t("dashboard.taskLabel")}</span>
                  </div>
                  <p className="source-excerpt">{focus.outcome}</p>
                  <div className="paper-lines">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <div className="source-paper">
                  <div className="source-paper-header">
                    <Scale size={11} />
                    <span>{t("dashboard.paperCouncil")}</span>
                    <small>{fmtDate(focus.updatedAt, lang)}</small>
                  </div>
                  <p className="paper-kicker">{t("dashboard.risksCount")}</p>
                  <div
                    className={`source-number ${
                      focus.risks.length > 0 ? "discrepant" : ""
                    }`}
                  >
                    {focus.risks.length}
                    <span>{t("dashboard.risksCount")}</span>
                  </div>
                  <p className="source-excerpt">
                    {focus.risks[0]?.title ?? focus.objective}
                  </p>
                  <div className="paper-lines">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                {focus.risks.length > 0 && (
                  <span className="comparison-link">≠</span>
                )}
              </div>
              <div className="focus-footer">
                <span>
                  <i className="reviewer-initials">LP</i>
                  {t("dashboard.continueLabel")}
                </span>
                <button onClick={() => select(focus)}>
                  {t("dashboard.continueLabel")} <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </section>
        )}
        <section className="decision-queue">
          <div className="section-rule">
            <span>02 — {t("dashboard.queueTitle")}</span>
            <span>0{queue.length}</span>
          </div>
          <p className="queue-intro">{t("dashboard.queueIntro")}</p>
          {queue.map((project) => (
            <button
              key={project.id}
              className="queue-item"
              onClick={() => select(project)}
            >
              <div>
                <i
                  className={`queue-status ${
                    project.risks.length > 1 ? "queue-status-high" : ""
                  }`}
                />
                <span>{t(statusKey[project.status])}</span>
                <span className="mono">
                  {project.risks.length} {t("dashboard.risksCount")}
                </span>
              </div>
              <h4>{project.title}</h4>
              <p>{project.objective}</p>
              <ArrowRight size={13} />
            </button>
          ))}
          {!queue.length && (
            <p className="queue-intro">{t("dashboard.queueEmpty")}</p>
          )}
          <button className="queue-all" onClick={() => navigate("projects")}>
            {t("dashboard.viewAll")} <ArrowRight size={12} />
          </button>
        </section>
      </div>

      <section className="review-register">
        <div className="register-heading">
          <div>
            <h3>{t("dashboard.recentProjects")}</h3>
            <span>
              {filtered.length} / {projects.length}
            </span>
          </div>
          <button className="text-button" onClick={() => navigate("projects")}>
            {t("dashboard.viewAll")} <ArrowRight size={13} />
          </button>
        </div>
        <div className="register-tabs">
          {(
            [
              {
                id: "all",
                label: t("dashboard.filterAll"),
                count: projects.length,
              },
              {
                id: "ready",
                label: t("dashboard.filterReady"),
                count: projects.filter((p) => p.status === "Plan ready")
                  .length,
              },
              {
                id: "validated",
                label: t("dashboard.filterValidated"),
                count: projects.filter((p) => p.status === "Validated").length,
              },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={filter === item.id ? "active" : ""}
              onClick={() => setFilter(item.id)}
            >
              {item.label} <span>{item.count}</span>
            </button>
          ))}
        </div>
        <div className="register-table-head">
          <span>{t("table.project")}</span>
          <span>{t("table.status")}</span>
          <span>{t("table.tasks")}</span>
          <span>{t("dashboard.progressLabel")}</span>
          <span>{t("table.updated")}</span>
          <span />
        </div>
        {filtered.length ? (
          filtered.map((project) => (
            <button
              key={project.id}
              className="register-row"
              onClick={() => select(project)}
            >
              <span className="register-project">
                <span className="register-project-id">
                  {project.id.slice(0, 4).toUpperCase()}
                </span>
                <span>
                  <b>{project.title}</b>
                  <small>
                    {t(statusKey[project.status])} · {project.risks.length}{" "}
                    {t("dashboard.risksCount")}
                  </small>
                </span>
              </span>
              <span
                className={`register-state register-state-${reviewState(
                  project.status,
                )}`}
              >
                <i />
                {t(statusKey[project.status])}
              </span>
              <span className="register-count">
                {projectTaskCount(project)}
                <small>{t("dashboard.taskLabel")}</small>
              </span>
              <span className="register-coverage">
                <span>
                  <i style={{ width: `${projectProgress(project)}%` }} />
                </span>
                <b>{projectProgress(project)}%</b>
              </span>
              <time>{fmtDate(project.updatedAt, lang)}</time>
              <ChevronRight size={14} />
            </button>
          ))
        ) : (
          <p className="queue-intro">{t("dashboard.queueEmpty")}</p>
        )}
      </section>

      <div className="desk-footer">
        <span>
          <ShieldCheck size={12} />
          {t("dashboard.prototypeNote")}
        </span>
        <span className="mono">{t("dashboard.footerNote")}</span>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  const { t } = useLang()
  return (
    <div className="page" aria-label={t("a11y.loadingDashboard")}>
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
  const { t } = useLang()
  return (
    <div className="empty-state">
      <span>
        <Lightbulb size={19} />
      </span>
      <h3>{t("empty.title")}</h3>
      <p>{t("empty.body")}</p>
      <button onClick={() => navigate("new")} className="btn-primary mt-4">
        <Plus size={14} />
        {t("empty.cta")}
      </button>
    </div>
  )
}

function MissingProject({ navigate }: { navigate: (screen: Screen) => void }) {
  const { t } = useLang()
  return (
    <div className="page">
      <div className="empty-state">
        <span>
          <AlertCircle size={19} />
        </span>
        <h3>{t("missing.title")}</h3>
        <p>{t("missing.body")}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button onClick={() => navigate("projects")} className="btn-secondary">
            {t("missing.browse")}
          </button>
          <button onClick={() => navigate("new")} className="btn-primary">
            <Plus size={14} />
            {t("nav.new")}
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
  const { t, lang } = useLang()
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
      <p className="page-kicker">{t("projects.kicker")}</p>
      <h2 className="page-title">{t("projects.title")}</h2>
      <div className="toolbar">
        <div className="search-field">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("projects.searchPlaceholder")}
            aria-label={t("projects.searchLabel")}
          />
        </div>
        <div className="control-group">
          <input
            ref={importRef}
            type="file"
            accept=".json,.csv,.md,.markdown,text/csv,text/markdown,application/json"
            hidden
            aria-label={t("projects.import")}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onImport(file)
              event.target.value = ""
            }}
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="control"
            aria-label={t("projects.filterStatus")}
          >
            <option value="all">{t("projects.allStatuses")}</option>
            {(["Draft", "Analyzing", "Plan ready", "Validated"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}` as DictKey)}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="control"
            aria-label={t("projects.sortLabel")}
          >
            <option value="updated-desc">{t("projects.sortNewest")}</option>
            <option value="updated-asc">{t("projects.sortOldest")}</option>
            <option value="title">{t("projects.sortTitle")}</option>
            <option value="status">{t("projects.sortStatus")}</option>
          </select>
          <input
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            placeholder={t("projects.tagFilter")}
            aria-label={t("projects.filterTag")}
            className="control"
            style={{ width: 120 }}
          />
          <button
            onClick={() => importRef.current?.click()}
            className="control"
          >
            <Download size={13} />
            {t("projects.import")}
          </button>
          <button onClick={() => navigate("new")} className="btn-primary">
            <Plus size={14} />
            {t("projects.newProject")}
          </button>
        </div>
      </div>
      {projects.length ? (
        <div className="panel table-panel">
          <div className="data-table">
            <div className="table-head">
              <span>{t("table.project")}</span>
              <span>{t("table.status")}</span>
              <span>{t("table.tasks")}</span>
              <span>{t("table.updated")}</span>
              <span />
            </div>
            {filtered.map((p) => (
              <div
                key={p.id}
                className="table-line"
                onClick={() => open(p)}
                role="row"
              >
                <button
                  className="table-project"
                  onClick={(event) => {
                    event.stopPropagation()
                    open(p)
                  }}
                  aria-label={`${t("common.open")} ${p.title}`}
                >
                  <i>
                    <FileText size={15} />
                  </i>
                  <b>{p.title}</b>
                  <small>
                    {t(statusKey[p.status])} · {p.phases.length} ×{" "}
                    {t("dashboard.taskLabel")} — {p.objective}
                  </small>
                </button>
                <span className={`review-state review-state-${reviewState(p.status)}`}>
                  {t(statusKey[p.status])}
                </span>
                <span className="table-meta">{projectTaskCount(p)}</span>
                <time className="table-cell-muted">
                  {fmtDate(p.updatedAt, lang)}
                </time>
                <span className="flex justify-end gap-1">
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      remove(p)
                    }}
                    className="icon-button"
                    aria-label={`${t("common.delete")} ${p.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      open(p)
                    }}
                    className="icon-button"
                    aria-label={`${t("common.open")} ${p.title}`}
                  >
                    <ArrowRight size={14} />
                  </button>
                </span>
              </div>
            ))}
            {!filtered.length && (
              <p className="page-subtitle">{t("projects.noMatches")}</p>
            )}
          </div>
        </div>
      ) : (
        <EmptyState navigate={navigate} />
      )}
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
  const { t } = useLang()
  const steps = [t("form.step1"), t("form.step2"), t("form.step3")]
  const update = (key: keyof ProjectFormData, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: "" }))
  }
  const validateStep = () => {
    const next: Record<string, string> = {}
    if (step === 0) {
      if (!form.title.trim()) next.title = t("form.errTitle")
      if (form.objective.trim().length < 20)
        next.objective = t("form.errObjective")
      if (form.context.trim().length < 20)
        next.context = t("form.errContext")
      if (!form.outcome.trim()) next.outcome = t("form.errOutcome")
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
        {t("form.backToOverview")}
      </button>
      <div className="mt-7">
        <p className="page-kicker">{t("form.kicker")}</p>
        <h2 className="page-title max-w-2xl">
          {t("form.heading")}
        </h2>
        <p className="page-subtitle max-w-2xl">
          {t("form.subheading")}
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
            {step ? t("form.back") : t("form.cancel")}
          </button>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400">{t("form.stepOf", { n: step + 1 })}</span>
            <button type="submit" className="btn-primary">
              {step === 2 ? (
                <>
                  {t("form.createProject")} <Sparkles size={16} />
                </>
              ) : (
                <>
                  {t("form.next")} <ArrowRight size={16} />
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
  const { t } = useLang()
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
    <div className="page page-enter">
      <div className="panel progress-card">
        <p className="page-kicker">
          {paused ? t("council.paused") : failed ? t("council.errorTitle") : t("council.active")}
        </p>
        <div className="analysis-orbit">
          <Sparkles size={22} />
        </div>
        <h3>{project.title}</h3>
        <p>{t("council.subtitle")}</p>
        <div className="big-progress">
          <span>
            <i style={{ width: `${(stage + 1) * 20}%` }} />
          </span>
          <b>{(stage + 1) * 20}%</b>
        </div>
        <div className="stage-list">
          {stages.map((label, index) => (
            <div
              key={label}
              className={
                index === stage ? "current" : index < stage ? "complete" : ""
              }
            >
              <span>
                {index < stage ? <Check size={12} /> : `0${index + 1}`}
              </span>
              <p>
                <b>{label}</b>
                {index === stage && (
                  <em>
                    {failed
                      ? t("council.retry")
                      : paused
                        ? t("council.paused")
                        : t("council.processing")}
                  </em>
                )}
                {index === stage && (
                  <small>
                    {t("council.stageOf")
                      .replace("{n}", String(stage + 1))
                      .replace("{stage}", stages[stage])}
                  </small>
                )}
              </p>
            </div>
          ))}
        </div>
        <div className="mock-banner">
          <i className="pulse-dot" />
          {t("council.demoNotice")}
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
          {t("council.timingNote")}
        </span>
        {!failed && (
          <button
            className="text-slate-400 underline decoration-slate-700 underline-offset-4 hover:text-slate-200"
            onClick={() => setFailed(true)}
          >
            {t("council.errorPreview")}
          </button>
        )}
      </div>
      {failed && (
        <div className="error-state mt-5">
          <AlertCircle size={18} />
          <div>
            <strong>{t("council.errorTitle")}</strong>
            <p>
              {t("council.errorBody")}
            </p>
          </div>
          <button onClick={replay}>{t("council.retry")}</button>
        </div>
      )}
    </div>
  )
}

function Results({ project, plan }: { project: Project; plan: () => void }) {
  const { t } = useLang()
  return (
    <div className="page max-w-5xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-emerald-700">
            <CheckCircle2 size={14} />
            {t("results.kicker")}
          </div>
          <h2 className="page-title mt-3">{project.title}</h2>
          <p className="page-subtitle">{t("results.subtitle")}</p>
        </div>
        <button onClick={plan} className="btn-primary">
          {t("results.openPlan")} <ArrowRight size={16} />
        </button>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <InfoCard label={t("results.providedByYou")} tone="blue" text={project.objective} />
        <InfoCard label={t("results.aiAssumption")} tone="amber" text={t("results.assumptionDemo")} />
        <InfoCard label={t("results.councilRecommendation")} tone="green" text={t("results.recommendationDemo")} />
      </div>
      <ReportSection icon={FileText} title={t("results.executiveSummary")}>
        <p>{t("results.execBody")}</p>
      </ReportSection>
      <div className="grid gap-4 lg:grid-cols-3">
        <Assessment title={t("results.strategic")} rating={t("results.ratingStrong")} body={t("results.strategicBody")} />
        <Assessment title={t("results.feasibility")} rating={t("results.ratingConditional")} body={t("results.feasibilityBody")} />
        <Assessment title={t("results.criticalReview")} rating={t("results.ratingFlags3")} body={t("results.criticalBody")} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ReportSection icon={CheckCircle2} title={t("results.agreements")} compact>
          <ul className="report-list">
            <li>{t("results.agreement1")}</li>
            <li>{t("results.agreement2")}</li>
            <li>{t("results.agreement3")}</li>
          </ul>
        </ReportSection>
        <ReportSection icon={Zap} title={t("results.disagreements")} compact accent>
          <div className="space-y-4">
            <div>
              <span className="argument-label">{t("results.strategyLabel")}</span>
              <p>{t("results.strategyBody")}</p>
            </div>
            <div>
              <span className="argument-label">{t("results.feasCritLabel")}</span>
              <p>{t("results.feasCritBody")}</p>
            </div>
            <div className="resolution">
              <Scale size={15} />
              <p>
                <strong>{t("results.arbiterResolutionLabel")}</strong> {t("results.arbiterResolutionBody")}
              </p>
            </div>
          </div>
        </ReportSection>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ReportSection icon={Lightbulb} title={t("results.assumptions")} compact>
          <ul className="report-list numbered">
            {(project.assumptions ?? []).map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </ReportSection>
        <ReportSection icon={ShieldAlert} title={t("results.risks")} compact>
          <div className="space-y-3">
            {project.risks.map((r) => (
              <div
                key={r.title}
                className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm"
              >
                <span>{r.title}</span>
                <span className="status status-amber">
                  {t(`likelihood.${r.likelihood}` as any) || r.likelihood}
                </span>
              </div>
            ))}
            {!project.risks.length && (
              <p className="pt-1 text-xs leading-5 text-slate-500">
                {t("results.noRisks")}
              </p>
            )}
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
              {t("results.finalRecommendation")}
            </p>
            <h3 className="mt-1 text-xl font-medium">{t("results.proceedGated")}</h3>
          </div>
        </div>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300">{t("results.finalBody")}</p>
        <button onClick={plan} className="btn-light mt-6">
          {t("results.reviewPlan")} <ArrowRight size={16} />
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
  const { t, lang } = useLang()
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
  const [shareRole, setShareRole] = useState<"editor" | "viewer">("editor")
  const [shareExpiryDays, setShareExpiryDays] = useState(0)
  const [invites, setInvites] = useState<any[]>([])
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">
("editor")
  const [inviting, setInviting] = useState(false)
  const [presence, setPresence] = useState<any[]>([])
  const invitesUrl = import.meta.env.VITE_NEON_FUNCTION_INVITES_BASE_URL as string | undefined
  const [versions, setVersions] = useState<any[]>([])
  const [loadingVersions, setLoadingVersions] = useState(true)
  const auth = useAuth()
  useEffect(() => {
    const token = shareToken ?? getActiveShareToken()
    if (!token) return
    const interval = window.setInterval(async () => {
      try {
        const remote = await refreshSharedProject(token)
        if (!remote || remote.id !== project.id) return
        if (remote.revision === project.revision) return
        // Do not clobber recent local edits: only adopt the remote copy when it is
        // genuinely newer than what is on screen.
        const remoteTs = Date.parse(remote.updatedAt || "")
        const localTs = Date.parse(project.updatedAt || "")
        if (Number.isFinite(remoteTs) && Number.isFinite(localTs) && remoteTs <= localTs) return
        updateProject(remote)
      } catch (error) {
        console.warn("Shared plan refresh failed", error)
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
      notify("info", t("toast.signInRequired"), t("toast.signInToShare"))
      return
    }
    setSharing(true)
    try {
      const token = createId()
      const expiresAt = shareExpiryDays > 0 ? new Date(Date.now() + shareExpiryDays * 86_400_000).toISOString() : null
      await createProjectShare(project.id, token, auth.user.id, shareRole, expiresAt)
      const url = `${window.location.origin}${window.location.pathname}#shared/${token}`
      setShareUrl(url)
      setActiveShareToken(token)
      await navigator.clipboard.writeText(url).catch(() => {})
      notify("success", t("toast.shareCreated"), `${url}${expiresAt ? ` (${expiresAt})` : ""}`)
    } catch (error) {
      notify("error", t("toast.shareFailed"), String(error))
    } finally {
      setSharing(false)
    }
  }

  const loadInvites = async () => {
    if (!invitesUrl) return
    try {
      const payload = await callNeonFunction<{ invites: any[] }>(invitesUrl, {
        action: "list",
        projectId: project.id,
      })
      setInvites(payload?.invites ?? [])
    } catch {
      // ignore
    }
  }

  const createInvite = async () => {
    const invitesUrlLocal = invitesUrl
    if (!invitesUrlLocal || !auth.user) {
      notify("info", t("toast.signInRequired"), t("toast.signInToInvite"))
      return
    }
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const invite = await callNeonFunction<any>(invitesUrlLocal, {
        action: "create",
        projectId: project.id,
        inviteeEmail: inviteEmail.trim(),
        inviterId: auth.user.id,
        role: inviteRole,
      })
      await loadInvites()
      const link = `${window.location.origin}${window.location.pathname}#invite/${invite.token}`
      try {
        await navigator.clipboard.writeText(link)
      } catch {
        // ignore
      }
      notify("success", t("toast.inviteCreated"), link)
      setInviteEmail("")
    } catch (error) {
      notify("error", t("toast.inviteFailed"), String(error))
    } finally {
      setInviting(false)
    }
  }

  const revokeInvite = async (id: string) => {
    if (!invitesUrl) return
    try {
      await callNeonFunction(invitesUrl, { action: "revoke", id })
      await loadInvites()
    } catch (error) {
      notify("error", t("toast.revokeFailed"), String(error))
    }
  }

  // Presence heartbeat + polling while editing a shared project.
  useEffect(() => {
    const token = getActiveShareToken() ?? (shareUrl ? shareUrl.split("#shared/")[1] : null)
    if (!token) return
    let active = true
    const run = async () => {
      await heartbeatSharePresence(token, auth.user?.id ?? null, auth.user?.email ?? null)
      const list = await loadSharePresence(token)
      if (active) setPresence(list)
    }
    run()
    const interval = window.setInterval(run, 8000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [shareUrl, auth.user?.id])

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
          id: createId(),
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
      notify("error", t("toast.neonUnavailable"), t("toast.configNeonFirst"))
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
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      notify("info", t("toast.signInRequired"), t("toast.signInToStore"))
      return
    }
    try {
      const ext = type === "md" ? "md" : "csv"
      const content =
        type === "md"
          ? `# ${project.title}\n\n${project.objective}\n\n${(project.phases ?? [])
              .map((phase) => `## ${phase.title}\n\n${phase.tasks.map((task) => `- ${task.title}: ${task.description}`).join("\n")}`)
              .join("\n\n")}`
          : `phase,task,priority,duration,dependency,deliverable\n${(project.phases ?? [])
              .flatMap((phase) => phase.tasks.map((task) => `${JSON.stringify(phase.title)},${JSON.stringify(task.title)},${task.priority},${task.duration},${JSON.stringify(task.dependency)},${JSON.stringify(task.deliverable)}`))
              .join("\n")}`
      const path = `${user.id}/${project.id}-${Date.now()}.${ext}`
      const uploadResult = await callNeonFunction<{ path: string; url: string }>(baseUrl, {
        path,
        content,
        contentType: type === "md" ? "text/markdown" : "text/csv",
      })
      const { data: saved, error } = await neonClient.from("leanie_exports").insert({
        user_id: user.id,
        project_id: project.id,
        format: type,
        storage_path: uploadResult?.path ?? path,
      }).select().single()
      if (error) throw error
      setExportOpen(false)
      await navigator.clipboard.writeText(uploadResult?.url ?? "").catch(() => {})
      notify("success", "Export stored", `Stored at ${uploadResult?.path ?? path}; URL copied.`)
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
  @page { margin: 18mm; size: A4; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: #101827; font-size: 12px; }
  h1 { font-size: 30px; margin: 0; letter-spacing: -0.02em; }
  h2 { font-size: 17px; margin-top: 26px; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 6px; break-after: avoid; }
  h3 { font-size: 14px; margin: 18px 0 4px; break-after: avoid; }
  p, li { line-height: 1.55; }
  ul { padding-left: 18px; }
  .cover { page-break-after: always; display: flex; flex-direction: column; justify-content: center; min-height: 240mm; }
  .cover .brand { font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #526fd2; margin-bottom: 26px; }
  .cover .meta-grid { margin-top: 34px; border-top: 1px solid #e2e8f0; padding-top: 14px; display: grid; grid-template-columns: 130px 1fr; row-gap: 6px; font-size: 11px; }
  .cover .meta-grid dt { color: #64748b; font-weight: 600; }
  .cover .status-pill { display: inline-block; border: 1px solid #c7d2fe; background: #eef2ff; color: #526fd2; border-radius: 999px; padding: 3px 10px; font-size: 10px; font-weight: 600; }
  .meta { color: #475569; font-size: 11px; margin: 6px 0 18px; }
  .task, .risk { border: 1px solid #e2e8f0; border-radius: 10px; padding: 11px 13px; margin: 8px 0; break-inside: avoid; page-break-inside: avoid; }
  .task strong, .risk strong { display: block; font-size: 12.5px; }
  .small { color: #475569; font-size: 10.5px; margin-top: 4px; }
  .phase-objective { color: #475569; font-size: 11.5px; margin: 2px 0 10px; }
  .tag { display: inline-block; border: 1px solid #e2e8f0; background: #f8fafc; color: #475569; border-radius: 999px; padding: 2px 9px; font-size: 10px; margin-right: 5px; }
  footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; color: #94a3b8; font-size: 10px; }
</style>
</head>
<body>
  <section class="cover">
    <div class="brand">LeanIE Plan · Lean Intelligence Engine</div>
    <h1>${escapeHtml(project.title)}</h1>
    <p class="meta">Plan export generated ${escapeHtml(fmtDate(new Date().toISOString()))}</p>
    <div class="meta-grid">
      <dt>Status</dt><dd><span class="status-pill">${escapeHtml(project.status)}</span></dd>
      ${project.targetDate ? `<dt>Target date</dt><dd>${escapeHtml(project.targetDate)}</dd>` : ""}
      ${project.budget ? `<dt>Budget</dt><dd>${escapeHtml(project.budget)}</dd>` : ""}
      <dt>Phases / tasks</dt><dd>${project.phases.length} phases · ${project.phases.reduce((sum, phase) => sum + phase.tasks.length, 0)} tasks</dd>
      ${(project.tags ?? []).length ? `<dt>Tags</dt><dd>${(project.tags ?? []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</dd>` : ""}
    </div>
  </section>
  <h2>Project overview</h2>
  <p>${escapeHtml(project.objective)}</p>
  ${project.context ? `<h2>Context</h2><p>${escapeHtml(project.context)}</p>` : ""}
  <h2>Expected outcome</h2>
  <p>${escapeHtml(project.outcome)}</p>
  <h2>Phases and tasks</h2>
  ${project.phases
    .map(
      (phase) => `
      <h3>${escapeHtml(phase.title)}</h3>
      <p class="phase-objective">${escapeHtml(phase.objective)}</p>
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
  <footer>Generated by LeanIE Plan — LeanIE suite · LiteTECH Solutions · ${escapeHtml(fmtDate(new Date().toISOString()))}</footer>
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
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <StatusPill status={project.status} />
            <span className="text-xs text-slate-400">
              {t("common.updated")} {fmtDate(project.updatedAt, lang)}
            </span>
          </div>
          <textarea
            className="title-input mt-3"
            value={project.title}
            onChange={(e) => patch({ title: e.target.value })}
            aria-label={t("plan.projectTitleAria")}
            rows={1}
          />
          <p className="mt-2 text-sm text-slate-500">{t("plan.editableNote")}</p>
          <div className="plan-progress mt-4">
            <div>
              <span>{t("plan.projectProgress")}</span>
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
              {t("plan.export")} <ChevronDown size={14} />
            </button>
            {exportOpen && (
              <div className="export-menu">
                <button onClick={() => exportFile("md")}>
                  Markdown <span>.md</span>
                </button>
                <button onClick={() => exportFile("csv")}>
                  {t("plan.taskData")} <span>.csv</span>
                </button>
                <button onClick={() => exportToNeon("md")}>
                  {t("plan.cloudCopy")} <span>.md</span>
                </button>
                <button onClick={printPlan}>
                  {t("plan.pdfReport")} <span>.pdf</span>
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
            {project.status === "Validated" ? t("plan.planValidated") : t("plan.validatePlan")}
          </button>
        </div>
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_280px]">
        <div>
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="block-label">{t("plan.projectOverview")}</p>
            <textarea
              className="editable-overview"
              value={project.objective}
              onChange={(e) => patch({ objective: e.target.value })}
              aria-label={t("plan.objectiveAria")}
            />
            <div className="mt-5 flex flex-wrap gap-5 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <CalendarDays size={14} />
                {project.targetDate ? fmtDate(project.targetDate, lang) : t("plan.noFixedDeadline")}
              </span>
              <span className="flex items-center gap-1.5">
                <ListChecks size={14} />
                {t("plan.phasesTasks", {
                  phases: project.phases.length,
                  tasks: project.phases.reduce((n, p) => n + p.tasks.length, 0),
                })}
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
                      {t("plan.addTask")}
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
              {t("plan.assumptionCheck")}
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
                 {t("plan.rerunCouncil")}
               </button>
             )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold">Success criteria</h3>
            <ul className="mt-4 space-y-3 text-xs leading-5 text-slate-600">
              {(project.successCriteria ?? []).map((criterion, index) => (
                <li key={`${criterion}-${index}`} className="flex items-start gap-2">
                  <Check size={14} className="mt-1 shrink-0 text-emerald-600" />
                  <textarea
                    value={criterion}
                    onChange={(event) => putSuccessCriterion(index, event.target.value)}
                    rows={1}
                    className="criterion-area min-w-0 flex-1 border-b border-transparent py-0.5 text-xs leading-5 outline-none focus:border-slate-300"
                    aria-label="Success criterion"
                  />
                  <button
                    onClick={() => removeSuccessCriterion(index)}
                    className="mt-0.5 shrink-0 text-red-500"
                    type="button"
                    aria-label={t("plan.removeCriterionAria")}
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={newSuccessCriterion}
                onChange={(event) => setNewSuccessCriterion(event.target.value)}
                placeholder="Add criterion"
                className="min-w-[8rem] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
              <button type="button" onClick={addSuccessCriterion} className="btn-secondary shrink-0">
                <Plus size={13} />
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold">{t("plan.isolatedStep")}</h3>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              Re-run only one Council step and patch the completed plan.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <select
                value={replayStep}
                onChange={(event) => setReplayStep(event.target.value)}
                className="min-w-[10rem] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
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
                className="btn-secondary whitespace-normal"
              >
                {replaying ? t("common.running") : t("plan.replayStep")}
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold">{t("plan.risksMitigation")}</h3>
            <div className="mt-4 space-y-4">
              {project.risks.map((risk, index) => (
                <div key={`${risk.title}-${index}`} className="space-y-1">
                  <div className="flex flex-wrap items-start gap-2">
                    <textarea
                      value={risk.title}
                      onChange={(event) => updateRisk(index, { title: event.target.value })}
                      rows={1}
                      className="criterion-area min-w-0 flex-1 border-b border-transparent py-0.5 text-xs font-medium leading-5 outline-none focus:border-slate-300"
                      aria-label="Risk title"
                    />
                    <select
                      value={risk.likelihood}
                      onChange={(event) =>
                        updateRisk(index, { likelihood: event.target.value as Risk["likelihood"] })
                      }
                      className="shrink-0 rounded-md border border-slate-200 bg-white text-[10px]"
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                    </select>
                    <button
                      onClick={() => removeRisk(index)}
                      className="shrink-0 text-red-500"
                      type="button"
                      aria-label="Remove risk"
                    >
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
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={newRiskTitle}
                onChange={(event) => setNewRiskTitle(event.target.value)}
                placeholder="New risk"
                className="min-w-[8rem] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
              <button type="button" onClick={addRisk} className="btn-secondary shrink-0">
                <Plus size={13} />
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold">{t("plan.sharingVersions")}</h3>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              Share the current plan and restore a previous snapshot.
            </p>
            {auth.user ? (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_auto]">
                  <select
                    value={shareRole}
                    onChange={(e) => setShareRole(e.target.value as any)}
                    className="settings-select"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                  <select
                    value={shareExpiryDays}
                    onChange={(e) => setShareExpiryDays(Number(e.target.value))}
                    className="settings-select"
                  >
                    <option value={0}>No expiry</option>
                    <option value={1}>1 day</option>
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                  </select>
                  <button type="button" onClick={createShare} disabled={sharing} className="btn-secondary">
                    {sharing ? "Creating..." : "Create share link"}
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-3 text-[11px] leading-5 text-slate-500">
                Sign in to create a share link.
              </p>
            )}
            {shareUrl && <p className="mt-2 break-all text-xs text-blue-700">{shareUrl}</p>}

            {/* Invites */}
            {auth.user && (
              <div className="mt-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-600">Invite collaborators</h4>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="collaborator@email.com"
                    className="settings-select"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="settings-select"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button
                    type="button"
                    onClick={createInvite}
                    className="btn-secondary"
                    disabled={inviting || !inviteEmail.trim()}
                  >
                    {inviting ? "…" : "Invite"}
                  </button>
                </div>
                {invites.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {invites.map((invite) => (
                      <li
                        key={invite.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600"
                      >
                        <span className="truncate">
                          {invite.invitee_email} · {invite.role} · {invite.status}
                        </span>
                        {invite.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => revokeInvite(invite.id)}
                            className="btn-secondary text-xs"
                          >
                            Revoke
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Presence */}
            {getActiveShareToken() && (
              <div className="mt-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-600">Collaborators viewing</h4>
                <ul className="space-y-1">
                  {presence.length === 0 && (
                    <li className="text-[11px] text-slate-500">Only you right now.</li>
                  )}
                  {presence.map((p) => (
                    <li key={p.userId} className="text-[11px] text-slate-500">
                      {p.email || p.userId} · last seen {new Date(p.lastSeenAt).toLocaleTimeString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
        title={t("dialog.validateTitle")}
        description={t("dialog.validateDesc")}
        confirmLabel={t("plan.validatePlan")}
        onClose={() => setConfirmValidation(false)}
        onConfirm={() => {
          patch({ status: "Validated" })
          setConfirmValidation(false)
          notify("success", t("toast.planValidated"), t("toast.planValidatedMsg"))
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
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const priorityLabel = t(`priority.${task.priority}` as any) || task.priority
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
              ? t("plan.markIncomplete", { title: task.title })
              : t("plan.markComplete", { title: task.title })
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
            aria-label={t("plan.taskTitleAria")}
          />
          <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span
              className={`priority priority-${task.priority.toLowerCase()}`}
            >
              {priorityLabel}
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
            aria-label={t("plan.moveTaskUp")}
          >
            <ArrowUp size={14} />
          </button>
          <button
            disabled={index === total - 1}
            onClick={() => move(1)}
            className="icon-button"
            aria-label={t("plan.moveTaskDown")}
          >
            <ArrowDown size={14} />
          </button>
          <button
            onClick={() => setOpen(!open)}
            className="icon-button"
            aria-label={open ? t("plan.collapseDetails") : t("plan.expandDetails")}
            aria-expanded={open}
          >
            <ChevronDown size={14} className={open ? "rotate-180" : ""} />
          </button>
        </div>
      </div>
      {open && (
        <div className="ml-6 mt-4 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          <label className="mini-field sm:col-span-2">
            {t("plan.description")}
            <textarea
              value={task.description}
              onChange={(e) => update({ description: e.target.value })}
              rows={2}
            />
          </label>
          <label className="mini-field">
            {t("plan.priority")}
            <select
              value={task.priority}
              onChange={(e) =>
                update({ priority: e.target.value as Task["priority"] })
              }
            >
              <option value="High">{t("priority.High")}</option>
              <option value="Medium">{t("priority.Medium")}</option>
              <option value="Low">{t("priority.Low")}</option>
            </select>
          </label>
          <label className="mini-field">
            {t("plan.duration")}
            <input
              value={task.duration}
              onChange={(e) => update({ duration: e.target.value })}
            />
          </label>
          <label className="mini-field">
            {t("plan.dependency")}
            <input
              aria-label={t("plan.taskDependencyAria")}
              value={task.dependency}
              onChange={(e) => update({ dependency: e.target.value })}
            />
          </label>
          <label className="mini-field">
            {t("plan.requiredResource")}
            <input
              value={task.resource}
              onChange={(e) => update({ resource: e.target.value })}
            />
          </label>
          <label className="mini-field sm:col-span-2">
            {t("plan.deliverable")}
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
            {t("plan.removeTask")}
          </button>
        </div>
      )}
    </div>
  )
}

type SettingsTab = "appearance" | "account" | "data" | "about"

const settingsTabs: { id: SettingsTab; label: import("./lib/i18n").DictKey; icon: typeof Home }[] = [
  { id: "appearance", label: "settings.tabAppearance", icon: Sun },
  { id: "account", label: "settings.tabAccount", icon: User },
  { id: "data", label: "settings.tabData", icon: ShieldAlert },
  { id: "about", label: "settings.tabAbout", icon: Info },
]

function SettingsScreen({
  theme,
  setTheme,
}: {
  theme: "light" | "dark"
  setTheme: (theme: "light" | "dark") => void
}) {
  const auth = useAuth()
  const { t, lang, setLang } = useLang()
  const [tab, setTab] = useState<SettingsTab>("appearance")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [profileName, setProfileName] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [resetEmail, setResetEmail] = useState("")
  const [resetToken, setResetToken] = useState("")
  const [resetNewPassword, setResetNewPassword] = useState("")
  const [sessions, setSessions] = useState<any[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor")
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  useEffect(() => {
    if (auth.user?.name) setProfileName(auth.user.name)
  }, [auth.user?.name])
  const signIn = async () => {
    const error = await auth.signIn(email, password)
    setAuthMessage(error ?? t("settings.signedInOk"))
    if (!error) {
      setEmail("")
      setPassword("")
    }
  }
  const signUp = async () => {
    const error = await auth.signUp(email, password)
    setAuthMessage(error ?? t("settings.accountCreated"))
  }
  const signOut = async () => {
    await auth.signOut()
    setAuthMessage(t("settings.signedOut"))
  }
  return (
    <div className="page">
      <p className="page-kicker">{t("settings.kicker")}</p>
      <h2 className="page-title">{t("settings.title")}</h2>
      <p className="page-subtitle">{t("settings.subtitle")}</p>

      <div className="settings-layout">
        <nav className="settings-nav">
          {settingsTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              <Icon size={15} />
              <span>{t(label)}</span>
            </button>
          ))}
        </nav>
        <div className="panel settings-card">
          <h3>
            {t(
              settingsTabs.find((item) => item.id === tab)?.label ??
                "settings.title",
            )}
          </h3>
          <p>
            {t(
              (
                {
                  appearance: "settings.appearanceBody",
                  account: "settings.accountBody",
                  data: "settings.dataBody",
                  about: "settings.aboutBody",
                } as const
              )[tab] ?? "settings.preferencesBody",
            )}
          </p>
          <div>
          {tab === "appearance" && (
          <>
            <Setting
              icon={Sun}
              title={t("settings.themeTitle")}
              description={t("settings.themeDesc")}
            >
              <div className="segmented">
                {(["light", "dark"] as const).map((themeOption) => (
                  <button
                    key={themeOption}
                    onClick={() => setTheme(themeOption)}
                    className={theme === themeOption ? "selected" : ""}
                  >
                    {themeOption === "light"
                      ? t("settings.light")
                      : t("settings.dark")}
                  </button>
                ))}
              </div>
            </Setting>
            <Setting
              icon={Languages}
              title={t("settings.languageTitle")}
              description={t("settings.languageDesc")}
            >
              <div className="segmented">
                {(["en", "fr"] as const).map((langOption) => (
                  <button
                    key={langOption}
                    onClick={() => setLang(langOption)}
                    className={lang === langOption ? "selected" : ""}
                  >
                    {langOption === "en"
                      ? t("settings.english")
                      : t("settings.french")}
                  </button>
                ))}
              </div>
            </Setting>
          </>
        )}

        {tab === "account" && (
          <>
            {auth.user ? (
              <>
                <Setting icon={User} title="Profile" description="Update your display name and email.">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="text-xs text-slate-500">{auth.user.email ?? auth.user.id}</span>
                    <input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="Display name"
                      className="settings-select"
                    />
                    <button
                      onClick={async () => {
                        setAuthBusy(true)
                        const err = await auth.updateUser(profileName.trim())
                        setAuthMessage(err ?? "Profile updated.")
                        setAuthBusy(false)
                      }}
                      className="btn-secondary"
                      disabled={authBusy || !profileName.trim()}
                    >
                      Save name
                    </button>
                  </div>
                </Setting>

                <Setting
                  icon={ShieldAlert}
                  title="Password"
                  description="Change your password and revoke other sessions."
                >
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      className="settings-select"
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="settings-select"
                    />
                    <button
                      onClick={async () => {
                        setAuthBusy(true)
                        const err = await auth.changePassword(currentPassword, newPassword)
                        setAuthMessage(err ?? "Password changed.")
                        if (!err) {
                          setCurrentPassword("")
                          setNewPassword("")
                        }
                        setAuthBusy(false)
                      }}
                      className="btn-secondary"
                      disabled={authBusy || !currentPassword || !newPassword}
                    >
                      Change password
                    </button>
                  </div>
                </Setting>

                <Setting
                  icon={Bot}
                  title="Password recovery"
                  description="Request a reset link by email; or paste the token you received."
                >
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="Email to send reset link"
                      className="settings-select"
                    />
                    <button
                      onClick={async () => {
                        setAuthBusy(true)
                        const err = await auth.requestPasswordReset(resetEmail.trim())
                        setAuthMessage(err ?? "Reset email sent (if the account exists).")
                        setAuthBusy(false)
                      }}
                      className="btn-secondary"
                      disabled={authBusy || !resetEmail.trim()}
                    >
                      Send reset link
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Reset token"
                      className="settings-select"
                    />
                    <input
                      type="password"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      placeholder="New password"
                      className="settings-select"
                    />
                    <button
                      onClick={async () => {
                        setAuthBusy(true)
                        const err = await auth.resetPassword(resetToken.trim(), resetNewPassword)
                        setAuthMessage(err ?? "Password reset.")
                        if (!err) {
                          setResetToken("")
                          setResetNewPassword("")
                        }
                        setAuthBusy(false)
                      }}
                      className="btn-secondary"
                      disabled={authBusy || !resetToken.trim() || !resetNewPassword}
                    >
                      Reset password
                    </button>
                  </div>
                </Setting>

                <Setting
                  icon={Sun}
                  title="Active sessions"
                  description="Review and revoke sessions on other devices."
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={async () => {
                        setSessionsLoading(true)
                        setSessions(await auth.listSessions())
                        setSessionsLoading(false)
                      }}
                      className="btn-secondary"
                      disabled={sessionsLoading}
                    >
                      {sessionsLoading ? "Loading…" : "Refresh sessions"}
                    </button>
                    <button
                      onClick={async () => {
                        setAuthBusy(true)
                        const err = await auth.revokeOtherSessions()
                        setAuthMessage(err ?? "Other sessions revoked.")
                        setSessions(await auth.listSessions())
                        setAuthBusy(false)
                      }}
                      className="btn-secondary"
                      disabled={authBusy}
                    >
                      Revoke others
                    </button>
                  </div>
                  {sessions.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {sessions.map((session, index) => (
                        <li
                          key={session.token || index}
                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                        >
                          <span className="truncate">
                            {session.userAgent || "Unknown device"}{" "}
                            {session.ipAddress ? `· ${session.ipAddress}` : ""}
                          </span>
                          <button
                            onClick={async () => {
                              const err = await auth.revokeSession(session.token)
                              if (err) setAuthMessage(err)
                              else setSessions((list) => list.filter((item) => item.token !== session.token))
                            }}
                            className="btn-secondary text-xs"
                          >
                            Revoke
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Setting>

                <Setting
                  icon={Info}
                  title={t("settings.dangerZone")}
                  description={t("settings.dangerDesc")}
                >
                  <button
                    onClick={() => setDeleteAccountOpen(true)}
                    className="btn-secondary text-red-600"
                    disabled={authBusy}
                  >
                    {t("settings.deleteAccount")}
                  </button>
                </Setting>

                <ConfirmationDialog
                  open={deleteAccountOpen}
                  title={t("dialog.deleteAccountTitle")}
                  description={t("dialog.deleteAccountDesc")}
                  confirmLabel={t("settings.deleteAccount")}
                  danger
                  onClose={() => setDeleteAccountOpen(false)}
                  onConfirm={async () => {
                    setDeleteAccountOpen(false)
                    setAuthBusy(true)
                    const err = await auth.deleteAccount()
                    setAuthMessage(err ?? t("settings.accountDeleted"))
                    setAuthBusy(false)
                  }}
                />

                <div className="settings-actions">
                  <button onClick={signOut} className="btn-secondary">
                    {t("common.signOut")}
                  </button>
                </div>
              </>
            ) : (
              <Setting
                icon={User}
                title="Account"
                description="Sign in to save projects, shares and exports in Neon."
              >
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
              </Setting>
            )}
            {authMessage && <p className="text-xs text-slate-500">{authMessage}</p>}
          </>
        )}

        {tab === "data" && (
          <>
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
          </>
        )}

        {tab === "about" && (
          <>
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
              icon={Info}
              title="Application"
              description="LeanIE Plan — part of the LeanIE suite (Lean Intelligence Engine) by LiteTECH Solutions. Early-stage frontend prototype."
            >
              <span className="text-xs text-slate-400">Version 0.1</span>
            </Setting>
          </>
        )}
          </div>
        </div>
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
    <div className="setting-row">
      <div>
        <b className="flex items-center gap-2">
          <Icon size={14} />
          {title}
        </b>
        <span>{description}</span>
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

type AdminTab = "metrics" | "council" | "providers"

const adminTabs: { id: AdminTab; label: string; icon: typeof Home }[] = [
  { id: "metrics", label: "Metrics", icon: BarChart3 },
  { id: "council", label: "AI Council", icon: Layers },
  { id: "providers", label: "Providers", icon: Boxes },
]

const COUNCIL_STEP_LABELS: Record<CouncilStepName, string> = {
  strategic: "Strategic Analyst",
  feasibility: "Feasibility Analyst",
  critique: "Critical Reviewer",
  arbiter: "Arbiter",
}

const COUNCIL_STEP_HINTS: Record<CouncilStepName, string> = {
  strategic: "Builds the phased execution plan from the brief.",
  feasibility: "Challenges the plan against real constraints.",
  critique: "Independent review: assumptions, risks, red flags.",
  arbiter: "Synthesizes all perspectives into the final plan.",
}

const emptyPlan: Record<CouncilStepName, CouncilConfigStep> = {
  strategic: { providerId: "", model: "" },
  feasibility: { providerId: "", model: "" },
  critique: { providerId: "", model: "" },
  arbiter: { providerId: "", model: "" },
}

const emptyRunsFilters = {
  provider: "",
  model: "",
  step: "",
  mode: "",
  json: "",
  q: "",
  range: "all",
}

const PIPELINE_FLOW: CouncilStepName[] = ["strategic", "feasibility", "critique", "arbiter"]

function modelIdOf(model: string | ProviderModel): string {
  return typeof model === "string" ? model : model.id
}

function SubTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string; icon: typeof Home }[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-2" role="tablist">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
            value === id
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
          }`}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  )
}

function AdminScreen({
  notify,
}: {
  notify: (kind: ToastKind, title: string, message?: string) => void
}) {
  const [tab, setTab] = useState<AdminTab>("metrics")
  const [providers, setProviders] = useState<LeanieProvider[]>([])

  const reloadProviders = useCallback(async () => {
    try {
      const payload = await callNeonFunction<{ providers: LeanieProvider[] }>(
        import.meta.env.VITE_NEON_FUNCTION_PROVIDERS_BASE_URL as string | undefined,
        null,
        "GET",
      )
      setProviders(payload?.providers ?? [])
    } catch {
      // The Providers tab surfaces its own error state.
    }
  }, [])

  useEffect(() => {
    reloadProviders()
  }, [reloadProviders])

  return (
    <div className="page max-w-5xl">
      <p className="page-kicker">MODEL OBSERVABILITY</p>
      <h2 className="page-title">Admin</h2>
      <p className="page-subtitle">
        Configure model providers, design Council configurations, benchmark
        them live and publish the best setup to production.
      </p>

      <SubTabs
        tabs={adminTabs}
        value={tab}
        onChange={(id) => setTab(id as AdminTab)}
      />

      {tab === "metrics" && <MetricsTab notify={notify} />}
      {tab === "council" && <CouncilTab notify={notify} providers={providers} />}
      {tab === "providers" && (
        <ProvidersTab notify={notify} providers={providers} reload={reloadProviders} />
      )}
    </div>
  )
}

function MetricsTab({
  notify,
}: {
  notify: (kind: ToastKind, title: string, message?: string) => void
}) {
  const metricsUrl = import.meta.env.VITE_NEON_FUNCTION_METRICS_BASE_URL as
    | string
    | undefined
  const [data, setData] = useState<MetricsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runsData, setRunsData] = useState<RunsResponse | null>(null)
  const [runsLoading, setRunsLoading] = useState(true)
  const [runsError, setRunsError] = useState<string | null>(null)
  const [filters, setFilters] = useState(emptyRunsFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const loadModels = useCallback(async () => {
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
    loadModels()
  }, [loadModels])

  // Runs are fetched server-side with filters + pagination; the query string
  // is the single source of truth, debounced to avoid a request per keystroke.
  const runsQuery = useMemo(() => {
    const params = new URLSearchParams({
      view: "runs",
      page: String(page),
      pageSize: String(pageSize),
    })
    for (const [key, value] of Object.entries(filters)) {
      if (value && value !== "all") params.set(key, value)
    }
    return params.toString()
  }, [filters, page, pageSize])

  useEffect(() => {
    if (!metricsUrl) {
      setRunsLoading(false)
      setRunsError("Metrics endpoint is not configured.")
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setRunsLoading(true)
      setRunsError(null)
      try {
        const response = await fetch(`${metricsUrl}?${runsQuery}`)
        if (!response.ok) throw new Error(`Runs request failed (${response.status})`)
        const payload = (await response.json()) as RunsResponse
        if (!cancelled) setRunsData(payload)
      } catch (err) {
        if (!cancelled) setRunsError(String(err))
      } finally {
        if (!cancelled) setRunsLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [metricsUrl, runsQuery])

  const setFilter = (key: keyof typeof emptyRunsFilters, value: string) => {
    setFilters((previous) => {
      const next = { ...previous, [key]: value }
      if (key === "provider") next.model = ""
      return next
    })
    setPage(1)
  }

  const providerOptions = useMemo(
    () => Array.from(new Set((data?.models ?? []).map((model) => model.provider))),
    [data],
  )
  const modelOptions = useMemo(() => {
    const models = data?.models ?? []
    const scoped = filters.provider
      ? models.filter((model) => model.provider === filters.provider)
      : models
    return Array.from(new Set(scoped.map((model) => model.model)))
  }, [data, filters.provider])

  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) => value && value !== "all",
  )

  return (
    <>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {data
            ? `${data.models.length} provider/model combination${data.models.length === 1 ? "" : "s"} measured`
            : !loading && !error
              ? "No metrics data yet."
              : "\u00A0"}
        </p>
        <button onClick={loadModels} className="btn-secondary" disabled={loading}>
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

      {!loading && !error && data && data.models.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">No provider measurements recorded yet.</p>
      )}

      {data?.models.map((model) => (
        <ModelCard key={`${model.provider}/${model.model}`} model={model} />
      ))}

      <div className="dashboard-panel mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-950">Recent runs</h3>
          {runsData && (
            <p className="text-xs text-slate-500">
              {runsData.total} run{runsData.total === 1 ? "" : "s"} matched
            </p>
          )}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={filters.q}
            onChange={(event) => setFilter("q", event.target.value)}
            placeholder="Search brief, model, error…"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 lg:col-span-2"
          />
          <select
            value={filters.provider}
            onChange={(event) => setFilter("provider", event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900"
          >
            <option value="">All providers</option>
            {providerOptions.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
          <select
            value={filters.model}
            onChange={(event) => setFilter("model", event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900"
          >
            <option value="">All models</option>
            {modelOptions.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          <select
            value={filters.step}
            onChange={(event) => setFilter("step", event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900"
          >
            <option value="">All steps</option>
            {["full", "strategic", "feasibility", "critique", "arbiter", "probe"].map((step) => (
              <option key={step} value={step}>
                {step}
              </option>
            ))}
          </select>
          <select
            value={filters.mode}
            onChange={(event) => setFilter("mode", event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900"
          >
            <option value="">All modes</option>
            {["live", "error", "demo"].map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
          <select
            value={filters.json}
            onChange={(event) => setFilter("json", event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900"
          >
            <option value="">Any JSON result</option>
            <option value="valid">JSON valid</option>
            <option value="invalid">JSON invalid</option>
          </select>
          <select
            value={filters.range}
            onChange={(event) => setFilter("range", event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900"
          >
            <option value="all">All time</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <button
            onClick={() => {
              setFilters(emptyRunsFilters)
              setPage(1)
            }}
            className="btn-secondary"
            disabled={!hasActiveFilters}
          >
            <X size={14} />
            Reset filters
          </button>
        </div>

        {runsError ? (
          <p className="mt-5 text-xs text-slate-500">{runsError}</p>
        ) : runsLoading ? (
          <p className="mt-5 text-xs text-slate-500">Loading runs…</p>
        ) : runsData && runsData.runs.length > 0 ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-3 font-semibold">When</th>
                  <th className="py-2 pr-3 font-semibold">Provider</th>
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
                {runsData.runs.map((run) => (
                  <tr key={run.id} className="border-b border-slate-100">
                    <td className="whitespace-nowrap py-2 pr-3">
                      {new Date(run.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3">{run.provider}</td>
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
        ) : (
          <p className="mt-5 text-xs text-slate-500">No runs match these filters.</p>
        )}

        {runsData && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>
                Page {runsData.page} of {runsData.pages}
              </span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value))
                  setPage(1)
                }}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
              >
                {[10, 15, 25, 50].map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="btn-secondary"
                disabled={runsLoading || page <= 1}
              >
                Previous
              </button>
              <button
                onClick={() => setPage((value) => Math.min(runsData.pages, value + 1))}
                className="btn-secondary"
                disabled={runsLoading || page >= runsData.pages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function CouncilTab({
  notify,
  providers,
}: {
  notify: (kind: ToastKind, title: string, message?: string) => void
  providers: LeanieProvider[]
}) {
  const configsUrl = import.meta.env.VITE_NEON_FUNCTION_CONFIGS_BASE_URL as
    | string
    | undefined
  const benchUrl = import.meta.env.VITE_NEON_FUNCTION_BENCH_BASE_URL as
    | string
    | undefined
  const [configs, setConfigs] = useState<CouncilConfig[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(true)
  const [configId, setConfigId] = useState("")
  const [configName, setConfigName] = useState("")
  const [plan, setPlan] = useState<Record<CouncilStepName, CouncilConfigStep>>(emptyPlan)
  const [saving, setSaving] = useState(false)
  const [benchStep, setBenchStep] = useState<"full" | CouncilStepName>("full")
  const [runId, setRunId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [finalResult, setFinalResult] = useState<any>(null)

  const loadConfigs = useCallback(async () => {
    if (!configsUrl) {
      setLoadingConfigs(false)
      return
    }
    setLoadingConfigs(true)
    try {
      const payload = await callNeonFunction<{ configs: CouncilConfig[] }>(
        configsUrl,
        null,
        "GET",
      )
      setConfigs(payload?.configs ?? [])
    } catch (err) {
      notify("error", "Could not load configs", String(err))
    } finally {
      setLoadingConfigs(false)
    }
  }, [configsUrl, notify])

  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  const loadConfigIntoEditor = (config: CouncilConfig) => {
    setConfigId(config.id)
    setConfigName(config.name)
    setPlan({
      ...emptyPlan,
      ...Object.fromEntries(
        PIPELINE_FLOW.map((step) => [
          step,
          config.steps?.[step] ?? { providerId: "", model: "" },
        ]),
      ),
    } as Record<CouncilStepName, CouncilConfigStep>)
  }

  const newDraft = () => {
    setConfigId("")
    setConfigName("")
    setPlan(emptyPlan)
  }

  const saveConfig = async () => {
    if (!configsUrl || saving) return
    setSaving(true)
    try {
      const payload = await callNeonFunction<{ id: string }>(configsUrl, {
        action: "save",
        id: configId || undefined,
        name: configName,
        steps: plan,
      })
      setConfigId(payload.id)
      await loadConfigs()
      notify("success", "Config saved", "Draft stored. Publish it to make it the production setup.")
    } catch (err) {
      notify("error", "Save failed", String(err))
    } finally {
      setSaving(false)
    }
  }

  const publishConfig = async (id: string) => {
    if (!configsUrl) return
    setSaving(true)
    try {
      await callNeonFunction(configsUrl, { action: "publish", id })
      await loadConfigs()
      notify("success", "Config published", "The production Council now uses this configuration.")
    } catch (err) {
      notify("error", "Publish failed", String(err))
    } finally {
      setSaving(false)
    }
  }

  const unpublishConfig = async () => {
    if (!configsUrl) return
    setSaving(true)
    try {
      await callNeonFunction(configsUrl, { action: "unpublish" })
      await loadConfigs()
      notify("success", "Config unpublished", "The Council falls back to the default provider.")
    } catch (err) {
      notify("error", "Unpublish failed", String(err))
    } finally {
      setSaving(false)
    }
  }

  const deleteConfig = async (id: string) => {
    if (!configsUrl) return
    setSaving(true)
    try {
      await callNeonFunction(configsUrl, { action: "delete", id })
      if (configId === id) newDraft()
      await loadConfigs()
      notify("success", "Config deleted", "")
    } catch (err) {
      notify("error", "Delete failed", String(err))
    } finally {
      setSaving(false)
    }
  }

  const startRun = async () => {
    if (!benchUrl || running) return
    const id = createId()
    setRunId(id)
    setFinalResult(null)
    setRunning(true)
    try {
      const payload = await callNeonFunction<any>(benchUrl, {
        runId: id,
        brief: sampleBrief,
        step: benchStep,
        configId: configId || undefined,
        steps: plan,
      })
      setFinalResult(payload)
      if (payload?.metrics) {
        notify(
          "success",
          "Benchmark complete",
          `${payload.metrics.provider ?? ""} · ${payload.metrics.model} · ${payload.metrics.latencyMs} ms`,
        )
      } else {
        notify("warning", "Benchmark finished", "The bench returned no metrics.")
      }
    } catch (err) {
      notify("error", "Benchmark failed", String(err))
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      {!realtimeEnabled && (
        <div className="info-card info-amber mt-6">
          <span>LIVE UPDATES OFF</span>
          <p>
            Realtime is not configured (VITE_NEON_REALTIME_URL). Benchmarks
            still run, but progress only appears once the run completes.
          </p>
        </div>
      )}

      <div className="dashboard-panel mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Council pipeline</h3>
            <p className="mt-1 text-xs text-slate-500">
              Assign a provider and model to every step, then benchmark the
              whole configuration live.
            </p>
          </div>
          {runId && (
            <span className="status status-green">
              <Activity size={12} />
              run {runId.slice(0, 8)}
            </span>
          )}
        </div>
        {runId && realtimeEnabled ? (
          <BenchmarkMonitor runId={runId}>
            {(run, connection) => <AdminCouncilDiagram run={run} connection={connection} />}
          </BenchmarkMonitor>
        ) : (
          <AdminCouncilDiagram run={null} connection={runId ? "connecting" : null} />
        )}

        <p className="mt-3 text-[11px] text-slate-400">
          Assign a provider and model to each step below — click any node in
          the diagram to inspect its live metrics during a run.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {PIPELINE_FLOW.map((step) => {
            const provider = providers.find((item) => item.id === plan[step].providerId)
            return (
              <div key={step} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {COUNCIL_STEP_LABELS[step]}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">{COUNCIL_STEP_HINTS[step]}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select
                    value={plan[step].providerId}
                    onChange={(event) =>
                      setPlan({
                        ...plan,
                        [step]: { providerId: event.target.value, model: "" },
                      })
                    }
                    disabled={running}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-900"
                  >
                    <option value="">Provider…</option>
                    {providers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={plan[step].model}
                    onChange={(event) =>
                      setPlan({ ...plan, [step]: { ...plan[step], model: event.target.value } })
                    }
                    disabled={running || !plan[step].providerId}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-900"
                  >
                    <option value="">Model…</option>
                    {(provider?.models ?? []).map((model) => {
                      const id = modelIdOf(model)
                      return (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="dashboard-panel mt-6">
        <h3 className="text-sm font-semibold text-slate-950">Run benchmark</h3>
        <p className="mt-1 text-xs text-slate-500">
          Runs the pipeline on a standard sample brief. Progress streams live
          into the diagram above. Cold starts can take 10–30 seconds.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <select
            value={benchStep}
            onChange={(event) => setBenchStep(event.target.value as typeof benchStep)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900"
          >
            <option value="full">Full council</option>
            <option value="strategic">Strategic only</option>
            <option value="feasibility">Feasibility only</option>
            <option value="critique">Critique only</option>
            <option value="arbiter">Arbiter (full + synthesis)</option>
          </select>
          <button onClick={startRun} className="btn-primary" disabled={running}>
            <Play size={14} />
            {running ? "Running…" : "Run benchmark"}
          </button>
        </div>
        {finalResult && <TestResultView result={finalResult} />}
      </div>

      <div className="dashboard-panel mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-950">Configurations</h3>
          <button onClick={newDraft} className="btn-secondary">
            <Plus size={14} />
            New draft
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={configName}
            onChange={(event) => setConfigName(event.target.value)}
            placeholder="Configuration name"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900"
          />
          <div className="flex gap-2">
            <button onClick={saveConfig} className="btn-secondary" disabled={saving}>
              {saving ? "Saving…" : "Save draft"}
            </button>
            {configId && (
              <button
                onClick={() => configs.find((c) => c.id === configId)?.status === "published"
                  ? unpublishConfig()
                  : publishConfig(configId)}
                className="btn-primary"
                disabled={saving}
              >
                {configs.find((c) => c.id === configId)?.status === "published"
                  ? "Unpublish"
                  : "Publish"}
              </button>
            )}
          </div>
        </div>
        {loadingConfigs ? (
          <p className="mt-4 text-xs text-slate-500">Loading configurations…</p>
        ) : configs.length === 0 ? (
          <p className="mt-4 text-xs text-slate-500">
            No saved configuration yet. Assign providers above and save a draft.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {configs.map((config) => (
              <li key={config.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                    {config.name}
                    {config.status === "published" && (
                      <span className="status status-green">published</span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {PIPELINE_FLOW.map((step) => config.steps?.[step]?.model || "—").join(" · ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => loadConfigIntoEditor(config)} className="btn-secondary">
                    Load
                  </button>
                  <button
                    onClick={() => deleteConfig(config.id)}
                    className="btn-secondary text-red-600"
                    aria-label={`Delete ${config.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function BenchmarkMonitor({
  runId,
  children,
}: {
  runId: string
  children: (run: BenchmarkRunRow | null, connection: string) => ReactNode
}) {
  const [sealed, setSealed] = useState<SealedLiveQuery<BenchmarkRunRow> | null>(null)
  const [sealError, setSealError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSealed(null)
    setSealError(null)
    fetchSealedBenchmarkRun(runId).then(
      (sealedQuery) => {
        if (!cancelled) setSealed(sealedQuery)
      },
      (error: unknown) => {
        if (!cancelled) setSealError(String(error))
      },
    )
    return () => {
      cancelled = true
    }
  }, [runId])

  if (sealError) return <>{children(null, `unavailable — ${sealError}`)}</>
  if (!sealed) return <>{children(null, "connecting")}</>
  return (
    <RealtimeProvider client={realtimeClient!}>
      <LiveRunView sealedQuery={sealed} runId={runId}>
        {children}
      </LiveRunView>
    </RealtimeProvider>
  )
}

function LiveRunView({
  sealedQuery,
  runId,
  children,
}: {
  sealedQuery: SealedLiveQuery<BenchmarkRunRow>
  runId: string
  children: (run: BenchmarkRunRow | null, connection: string) => ReactNode
}) {
  const refreshQuery = useCallback(() => fetchSealedBenchmarkRun(runId), [runId])
  const { data, status, error } = useLiveQuery(sealedQuery, { refreshQuery })
  const connection = error
    ? `error — ${error.message}`
    : status === "live"
      ? "live"
      : status === "stale"
        ? "renewing"
        : status
  return <>{children(data?.[0] ?? null, connection)}</>
}

function ProvidersTab({
  notify,
  providers,
  reload,
}: {
  notify: (kind: ToastKind, title: string, message?: string) => void
  providers: LeanieProvider[]
  reload: () => Promise<void>
}) {
  const providersUrl = import.meta.env.VITE_NEON_FUNCTION_PROVIDERS_BASE_URL as
    | string
    | undefined
  const [name, setName] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [testModels, setTestModels] = useState<Record<string, string>>({})
  const [testResults, setTestResults] = useState<
    Record<string, { ok: boolean; latencyMs: number; tokens: { prompt: number; completion: number; total: number }; error: string | null } | null>
  >({})
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const act = async (body: Record<string, unknown>, success?: [string, string]) => {
    if (!providersUrl) {
      notify("error", "Not configured", "VITE_NEON_FUNCTION_PROVIDERS_BASE_URL is missing.")
      return false
    }
    setBusyId(String(body.id ?? ""))
    try {
      await callNeonFunction(providersUrl, body)
      await reload()
      if (success) notify("success", success[0], success[1])
      return true
    } catch (err) {
      notify("error", "Provider action failed", String(err))
      return false
    } finally {
      setBusyId(null)
    }
  }

  const createProvider = async () => {
    if (!name.trim() || !baseUrl.trim() || creating) return
    setCreating(true)
    const ok = await act({ action: "create", name, baseUrl, apiKey }, [
      "Provider created",
      "Fetch its models, then test one before publishing.",
    ])
    if (ok) {
      setName("")
      setBaseUrl("")
      setApiKey("")
    }
    setCreating(false)
  }

  const testProviderModel = async (provider: LeanieProvider) => {
    const model = testModels[provider.id]
    if (!model) {
      notify("warning", "Pick a model", "Select a model to test first.")
      return
    }
    setBusyId(provider.id)
    setTestResults((previous) => ({ ...previous, [provider.id]: null }))
    try {
      const result = await callNeonFunction<{
        ok: boolean
        latencyMs: number
        tokens: { prompt: number; completion: number; total: number }
        error: string | null
      }>(providersUrl, { action: "test", id: provider.id, model })
      setTestResults((previous) => ({ ...previous, [provider.id]: result }))
      notify(
        result.ok ? "success" : "warning",
        result.ok ? "Model responds" : "Model test failed",
        result.ok
          ? `${model} · ${result.latencyMs} ms · ${result.tokens.total} tokens`
          : result.error ?? "Unknown error",
      )
    } catch (err) {
      notify("error", "Test failed", String(err))
      setTestResults((previous) => ({
        ...previous,
        [provider.id]: { ok: false, latencyMs: 0, tokens: { prompt: 0, completion: 0, total: 0 }, error: String(err) },
      }))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="dashboard-panel mt-6">
        <h3 className="text-sm font-semibold text-slate-950">Add a provider</h3>
        <p className="mt-1 text-xs text-slate-500">
          Any OpenAI-compatible chat endpoint works: NVIDIA NIM, OpenRouter,
          Groq, Together, Ollama, OpenAI… API keys are stored server-side and
          never sent back to the browser.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Display name (e.g. NVIDIA NIM)"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900"
          />
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="Base URL (e.g. https://integrate.api.nvidia.com/v1)"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900"
          />
          <input
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="API key (nvapi-…)"
            type="password"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 sm:col-span-2"
          />
        </div>
        <button
          onClick={createProvider}
          className="btn-primary mt-4"
          disabled={creating || !name.trim() || !baseUrl.trim()}
        >
          <Plus size={14} />
          {creating ? "Creating…" : "Create provider"}
        </button>
      </div>

      {providers.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          No provider configured yet. Add one above to power the Council.
        </p>
      ) : (
        providers.map((provider) => {
          const busy = busyId === provider.id
          const testResult = testResults[provider.id]
          return (
            <div key={provider.id} className="dashboard-panel mt-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <Cpu size={15} className="text-slate-400" />
                    {provider.name}
                    <span className={`status ${provider.status === "published" ? "status-green" : "status-amber"}`}>
                      {provider.status}
                    </span>
                  </p>
                  <p className="mt-1 break-all text-xs text-slate-500">{provider.baseUrl}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Key {provider.hasKey ? provider.apiKeyMasked : "not set"} ·{" "}
                    {provider.models.length} model{provider.models.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => act({ action: "models", id: provider.id }, [
                      "Models fetched",
                      `${provider.name}: model list refreshed.`,
                    ])}
                    className="btn-secondary"
                    disabled={busy}
                  >
                    <RotateCw size={14} className={busy ? "animate-spin" : ""} />
                    Fetch models
                  </button>
                  <button
                    onClick={() =>
                      act(
                        { action: "publish", id: provider.id, published: provider.status !== "published" },
                        provider.status === "published"
                          ? ["Provider unpublished", `${provider.name} moved back to testing.`]
                          : ["Provider published", `${provider.name} is now available to configs.`],
                      )
                    }
                    className="btn-secondary"
                    disabled={busy}
                  >
                    {provider.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                  {confirmDeleteId === provider.id ? (
                    <button
                      onClick={() => {
                        setConfirmDeleteId(null)
                        act({ action: "delete", id: provider.id }, ["Provider deleted", provider.name])
                      }}
                      className="btn-secondary text-red-600"
                      disabled={busy}
                    >
                      Confirm delete
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(provider.id)}
                      className="btn-secondary text-red-600"
                      aria-label={`Delete ${provider.name}`}
                      disabled={busy}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              {provider.models.length > 0 && (
                <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
                  <select
                    value={testModels[provider.id] ?? ""}
                    onChange={(event) =>
                      setTestModels((previous) => ({ ...previous, [provider.id]: event.target.value }))
                    }
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900"
                  >
                    <option value="">Choose a model to test…</option>
                    {provider.models.map((model) => {
                      const id = modelIdOf(model)
                      return (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      )
                    })}
                  </select>
                  <button
                    onClick={() => testProviderModel(provider)}
                    className="btn-secondary"
                    disabled={busy || !testModels[provider.id]}
                  >
                    <Play size={14} />
                    {busy ? "Testing…" : "Test"}
                  </button>
                </div>
              )}
              {testResult && (
                <div
                  className={`mt-3 rounded-lg border p-3 text-xs ${
                    testResult.ok
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {testResult.ok
                    ? `✓ Responded in ${testResult.latencyMs} ms · ${testResult.tokens.total} tokens (${testResult.tokens.prompt} prompt / ${testResult.tokens.completion} completion)`
                    : `✗ ${testResult.error ?? "Test failed"}`}
                </div>
              )}
            </div>
          )
        })
      )}
    </>
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
            {model.provider} · {model.runs} run{model.runs === 1 ? "" : "s"} · last{" "}
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
            <AdminStat
              label="Provider"
              value={metrics.configName ?? metrics.provider ?? "—"}
              small
            />
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
  const { t } = useLang()
  const [screen, setScreen] = useState<Screen>(() => {
    const hash = location.hash.slice(1)
    if (hash.startsWith("shared/") || hash.startsWith("invite/")) return "shared"
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
        setSelectedId((current) => (current && next.some((p) => p.id === current) ? current : next[0]?.id ?? ""))
        setProjectsLoading(false)
        void syncOfflineProjects()
          .then(() => loadProjects(auth.user?.id ?? null))
          .then((synced) => {
            if (!active || !synced.length) return
            // Merge to avoid clobbering edits made while the background sync ran.
            setProjects((current) => {
              const byId = new Map(synced.map((p) => [p.id, p]))
              const merged = current.map((p) => {
                const remote = byId.get(p.id)
                if (!remote) return p
                return Date.parse(remote.updatedAt || "") > Date.parse(p.updatedAt || "") ? remote : p
              })
              for (const p of synced) if (!current.some((c) => c.id === p.id)) merged.push(p)
              return merged
            })
          })
          .catch((error) => console.warn("Background project sync failed", error))
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

  // Multi-device sync: periodically refresh from Neon when signed-in, and
  // flush the offline queue. Also refresh on tab focus.
  useEffect(() => {
    if (!auth.user?.id) return
    let active = true
    const refresh = async () => {
      try {
        await syncOfflineProjects()
        const fresh = await loadProjects(auth.user!.id)
        if (!active || !fresh.length) return
        // Merge to avoid clobbering edits made while the background sync ran.
        setProjects((current) => {
          const byId = new Map(fresh.map((p) => [p.id, p]))
          const merged = current.map((p) => {
            const remote = byId.get(p.id)
            if (!remote) return p
            return Date.parse(remote.updatedAt || "") > Date.parse(p.updatedAt || "") ? remote : p
          })
          for (const p of fresh) if (!current.some((c) => c.id === p.id)) merged.push(p)
          return merged
        })
      } catch (error) {
        console.warn("Multi-device sync failed", error)
      }
    }
    const interval = window.setInterval(refresh, 30000)
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      active = false
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [auth.user?.id])

  useEffect(() => {
    try {
      localStorage.setItem("leanie-theme", theme)
    } catch {
      // ignore storage errors
    }
    document.documentElement.style.colorScheme = theme
    document.documentElement.dataset.theme = theme
  }, [theme])
  useEffect(() => {
    try {
      localStorage.setItem("leanie-sidebar", collapsed ? "collapsed" : "expanded")
    } catch {
      // ignore storage errors
    }
  }, [collapsed])
  useEffect(() => {
    if (screen !== "shared") return
    let raw = location.hash.slice(1)
    const isInvite = raw.startsWith("invite/")
    const token = isInvite ? raw.slice("invite/".length) : raw.slice("shared/".length)
    if (!token) return
    setSharedLoading(true)
    const proceed = (shareTok: string) => {
      loadSharedProject(shareTok).then((project) => {
        if (!project) {
          notify("error", "Shared plan unavailable", "The link is invalid or expired.")
          return
        }
        setSharedProject(project)
        setProjects([project])
        setSelectedId(project.id)
        setShareToken(shareTok)
        setScreen("plan")
        history.replaceState(null, "", "#plan")
      }).catch(() => notify("error", "Shared plan unavailable", "Could not load this plan."))
    }
    if (isInvite && auth.user?.id) {
      const invitesUrl = import.meta.env.VITE_NEON_FUNCTION_INVITES_BASE_URL as string | undefined
      if (!invitesUrl) {
        setSharedLoading(false)
        notify("error", "Shared plan unavailable", "Invites not configured.")
        return
      }
      callNeonFunction<any>(invitesUrl, {
        action: "accept",
        token,
        userId: auth.user.id,
        userEmail: auth.user.email,
      })
        .then((result) => {
          proceed(result?.token ?? token)
        })
        .catch((error) => notify("error", "Invite accept failed", String(error)))
        .finally(() => setSharedLoading(false))
      return
    }
    if (isInvite && !auth.user) {
      setSharedLoading(false)
      notify("info", "Sign in required", "Sign in to accept this invitation.")
      return
    }
    proceed(token)
  }, [screen, auth.user?.id])
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
      const id = createId()
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
      const now = new Date().toISOString()
      let project: Project

      if (file.name.toLowerCase().endsWith(".json")) {
        const source = JSON.parse(text) as Partial<Project>
        project = {
          id: createId(),
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
      } else if (file.name.toLowerCase().endsWith(".csv")) {
        const rows = parseCsvRows(text)
        const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase())
        const taskIdx = header.indexOf("task") >= 0 ? header.indexOf("task") : header.indexOf("title")
        const phaseIdx = header.indexOf("phase")
        const tasks: Array<{ id: string; title: string; description: string; priority: any; duration: string; dependency: string; resource: string; deliverable: string }> = []
        for (let i = 1; i < rows.length; i++) {
          const cols = (rows[i] ?? []).map((c) => c.trim())
          const title = taskIdx >= 0 ? cols[taskIdx] : cols[0]
          if (!title) continue
          tasks.push({
            id: createId(),
            title,
            description: (phaseIdx >= 0 ? cols[phaseIdx] : "Imported task") ?? "",
            priority: "Medium",
            duration: "1 week",
            dependency: "None",
            resource: "Unassigned",
            deliverable: "Defined output",
          })
        }
        project = {
          id: createId(),
          title: file.name.replace(/\\.csv$/i, ""),
          objective: "Imported project",
          context: `Imported ${tasks.length} tasks from CSV.`,
          outcome: "Review imported plan",
          createdAt: now,
          updatedAt: now,
          status: "Draft",
          phases: [
            {
              id: createId(),
              title: "Imported phase",
              objective: "Tasks imported from CSV",
              tasks,
            },
          ],
          risks: [],
          assumptions: [],
          successCriteria: [],
          tags: ["imported"],
        }
      } else {
        // Markdown import
        const lines = text.split(/\\r?\\n/)
        let title = file.name.replace(/\\.(md|markdown)$/i, "")
        const sections: string[] = []
        for (const line of lines) {
          if (line.startsWith("# ")) title = line.replace(/^#\\s+/, "").trim() || title
          else if (line.trim()) sections.push(line)
        }
        const objective = sections.slice(0, 3).join(" ").slice(0, 400) || "Imported project"
        project = {
          id: createId(),
          title,
          objective,
          context: sections.join("\\n").slice(0, 2000),
          outcome: "Review imported plan",
          createdAt: now,
          updatedAt: now,
          status: "Draft",
          phases: [
            {
              id: createId(),
              title: "Discovery",
              objective: "Phase extracted from imported markdown",
              tasks: [
                {
                  id: createId(),
                  title: "Review imported content",
                  description: sections.slice(0, 5).join(" ") || "Imported markdown.",
                  priority: "Medium",
                  duration: "1 week",
                  dependency: "None",
                  resource: "Unassigned",
                  deliverable: "Validated brief",
                },
              ],
            },
          ],
          risks: [],
          assumptions: [],
          successCriteria: [],
          tags: ["imported"],
        }
      }

      setProjects((p) => [project, ...p])
      setSelectedId(project.id)
      await saveProject(project, auth.user?.id ?? null)
      if (auth.user?.id) saveProjectVersion(project, "imported", auth.user.id)
      openProject(project)
      notify("success", "Project imported", "The file was imported as a new project.")
    } catch (error) {
      notify("error", "Import failed", String(error))
    }
  }

  const createProject = (form: ProjectFormData) => {
    const plan = cloneDemoPlan()
    const now = new Date().toISOString()
    const project: Project = {
      ...form,
      id: createId(),
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
        if (auth.user?.id) saveProjectVersion(updated, "shared-update", auth.user.id)
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
          {sharedLoading ? t("shared.loading") : t("shared.unavailable")}
        </div>
      </div>
    )
  }
  const title =
    screen === "overview"
      ? t("nav.overview")
      : screen === "projects"
        ? t("nav.projects")
        : screen === "new"
          ? t("nav.new")
          : screen === "settings"
            ? t("nav.settings")
            : screen === "admin"
              ? t("nav.admin")
              : (selected?.title ?? "Project")
  return (
    <div className={`app-shell theme-${theme}`}>
      <a href="#main-content" className="skip-link">
        {t("a11y.skipToContent")}
      </a>
      <Sidebar
        screen={screen}
        navigate={navigate}
        mobileOpen={mobileOpen}
        close={() => setMobileOpen(false)}
        collapsed={collapsed}
        toggleCollapsed={() => setCollapsed((value) => !value)}
        projects={projects}
        selectedId={selectedId}
        notify={notify}
      />
      <main id="main-content" className={`app-main ${collapsed ? "sidebar-collapsed" : ""}`}>
        <AppHeader
          title={title}
          menu={() => setMobileOpen(true)}
          projects={projects}
          navigate={navigate}
          theme={theme}
          toggleTheme={() =>
            setTheme((value) => (value === "dark" ? "light" : "dark"))
          }
          openCommand={() => setCommandOpen(true)}
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
        title={t("dialog.deleteProjectTitle")}
        description={t("dialog.deleteProjectDesc", { title: deleteTarget?.title ?? "" })}
        confirmLabel={t("common.delete")}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteProject}
      />
      <CommandPalette
        open={commandOpen}
        projects={projects}
        onClose={() => setCommandOpen(false)}
        navigate={navigate}
        openProject={openProject}
        theme={theme}
        toggleTheme={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
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
