import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { Project, Screen } from "../types"
import { useLang, type DictKey } from "../lib/i18n"

type PaletteItem = {
  id: string
  label: string
  hint: string
  icon: typeof LayoutDashboard
  run: () => void
}

const STATUS_KEYS = ["Draft", "Analyzing", "Plan ready", "Validated"] as const

/**
 * Parses the raw query into a text term plus structured filters:
 *   `is:draft tag:qa` + free text.
 */
function parseQuery(raw: string) {
  const tokens = raw.split(/\s+/).filter(Boolean)
  const status: string | null = null
  let statusFilter: string | null = null
  let tagFilter: string | null = null
  const text: string[] = []
  for (const token of tokens) {
    const lower = token.toLowerCase()
    if (lower.startsWith("is:") || lower.startsWith("status:")) {
      const value = lower.slice(lower.indexOf(":") + 1)
      const match = STATUS_KEYS.find((s) => s.toLowerCase().startsWith(value))
      if (match) statusFilter = match
      else text.push(token)
    } else if (lower.startsWith("tag:")) {
      tagFilter = lower.slice(4)
    } else {
      text.push(token)
    }
  }
  return { text: text.join(" ").toLowerCase(), statusFilter, tagFilter, status }
}

export function CommandPalette({
  open,
  projects,
  onClose,
  navigate,
  openProject,
  theme,
  toggleTheme,
}: {
  open: boolean
  projects: Project[]
  onClose: () => void
  navigate: (screen: Screen) => void
  openProject: (project: Project) => void
  theme: "light" | "dark"
  toggleTheme: () => void
}) {
  const { t } = useLang()
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const { text, statusFilter, tagFilter } = useMemo(() => parseQuery(query), [query])

  const items = useMemo<PaletteItem[]>(() => {
    const base: PaletteItem[] = [
      {
        id: "overview",
        label: t("palette.openOverview"),
        hint: t("palette.hintNavigate"),
        icon: LayoutDashboard,
        run: () => navigate("overview"),
      },
      {
        id: "new",
        label: t("palette.newProject"),
        hint: t("palette.hintAction"),
        icon: Plus,
        run: () => navigate("new"),
      },
      {
        id: "projects",
        label: t("palette.browseProjects"),
        hint: t("palette.hintNavigate"),
        icon: FileText,
        run: () => navigate("projects"),
      },
      {
        id: "settings",
        label: t("palette.openSettings"),
        hint: t("palette.hintNavigate"),
        icon: Settings,
        run: () => navigate("settings"),
      },
      {
        id: "admin",
        label: t("palette.openAdmin"),
        hint: t("palette.hintNavigate"),
        icon: BarChart3,
        run: () => navigate("admin"),
      },
      {
        id: "theme",
        label: t("palette.toggleTheme"),
        hint: t("palette.hintTheme"),
        icon: theme === "dark" ? Sun : Moon,
        run: toggleTheme,
      },
    ]
    const filteredProjects = projects
      .filter((project) =>
        statusFilter ? project.status === statusFilter : true,
      )
      .filter((project) =>
        tagFilter
          ? (project.tags ?? []).some((tag) =>
              tag.toLowerCase().includes(tagFilter),
            )
          : true,
      )
      .filter((project) =>
        text
          ? project.title.toLowerCase().includes(text) ||
            project.objective.toLowerCase().includes(text)
          : true,
      )
      .map((project) => ({
        id: project.id,
        label: project.title,
        hint: t(`status.${project.status}` as DictKey),
        icon: FileText,
        run: () => openProject(project),
      }))
    const all = [...base, ...filteredProjects]
    return text || statusFilter || tagFilter
      ? all.filter((item) => item.label.toLowerCase().includes(text))
      : all
  }, [navigate, openProject, projects, query, t, text, statusFilter, tagFilter, theme, toggleTheme])

  useEffect(() => {
    if (!open) return
    setQuery("")
    setActive(0)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])
  useEffect(() => setActive(0), [query])
  useEffect(() => {
    if (!open) return
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
      if (event.key === "ArrowDown") {
        event.preventDefault()
        setActive((value) => Math.min(value + 1, items.length - 1))
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        setActive((value) => Math.max(value - 1, 0))
      }
      if (event.key === "Enter" && items[active]) {
        items[active].run()
        onClose()
      }
    }
    window.addEventListener("keydown", keydown)
    return () => window.removeEventListener("keydown", keydown)
  }, [active, items, onClose, open])
  if (!open) return null
  const hasFilters = Boolean(statusFilter || tagFilter)
  return (
    <div className="palette-overlay" onMouseDown={onClose}>
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="palette-search">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("palette.placeholder")}
            aria-label={t("palette.searchLabel")}
          />
          <button onClick={onClose} aria-label={t("palette.close")}>
            <X size={16} />
          </button>
        </div>
        {hasFilters && (
          <div className="palette-filters">
            <span>{t("palette.filteredBy")}:</span>
            {statusFilter && (
              <span className="palette-filter-chip">
                <CheckCircle2 size={11} /> is:{statusFilter.toLowerCase()}
              </span>
            )}
            {tagFilter && (
              <span className="palette-filter-chip">tag:{tagFilter}</span>
            )}
          </div>
        )}
        <div className="palette-results" role="listbox">
          {items.length ? (
            items.map((item, index) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  className={active === index ? "active" : ""}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => {
                    item.run()
                    onClose()
                  }}
                  role="option"
                  aria-selected={active === index}
                >
                  <span className="palette-icon">
                    <Icon size={16} />
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                  <small>{item.hint}</small>
                  <ArrowRight size={14} />
                </button>
              )
            })
          ) : (
            <div className="palette-empty">
              <Search size={22} />
              <p>{t("palette.noResults")}</p>
              <span>{t("palette.noResultsHint")}</span>
            </div>
          )}
        </div>
        <div className="palette-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> {t("palette.navigateHint")}
          </span>
          <span>
            <kbd>↵</kbd> {t("palette.openHint")}
          </span>
          <span>
            <kbd>esc</kbd> {t("palette.closeHint")}
          </span>
          <span className="ml-auto hidden sm:inline">
            {t("palette.filterStatusHint")}
          </span>
        </div>
      </div>
    </div>
  )
}
