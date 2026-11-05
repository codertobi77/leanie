import {
  ArrowRight,
  FileText,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { Project, Screen } from "../types"

export function CommandPalette({
  open,
  projects,
  onClose,
  navigate,
  openProject,
}: {
  open: boolean
  projects: Project[]
  onClose: () => void
  navigate: (screen: Screen) => void
  openProject: (project: Project) => void
}) {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const items = useMemo(() => {
    const base = [
      {
        id: "overview",
        label: "Open overview",
        hint: "Navigate",
        icon: LayoutDashboard,
        run: () => navigate("overview"),
      },
      {
        id: "new",
        label: "Create a new project",
        hint: "Action",
        icon: Plus,
        run: () => navigate("new"),
      },
      {
        id: "projects",
        label: "Browse all projects",
        hint: "Navigate",
        icon: FileText,
        run: () => navigate("projects"),
      },
      {
        id: "settings",
        label: "Open settings",
        hint: "Navigate",
        icon: Settings,
        run: () => navigate("settings"),
      },
      ...projects.map((project) => ({
        id: project.id,
        label: project.title,
        hint: project.status,
        icon: FileText,
        run: () => openProject(project),
      })),
    ]
    return base.filter((item) =>
      item.label.toLowerCase().includes(query.toLowerCase()),
    )
  }, [navigate, openProject, projects, query])

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
            placeholder="Search projects or jump to…"
            aria-label="Search commands"
          />
          <button onClick={onClose} aria-label="Close command palette">
            <X size={16} />
          </button>
        </div>
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
              <p>No matching projects or commands</p>
              <span>Try a different title or destination.</span>
            </div>
          )}
        </div>
        <div className="palette-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  )
}
