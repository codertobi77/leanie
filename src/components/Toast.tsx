import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react"
import { useLang } from "../lib/i18n"

export type ToastKind = "success" | "error" | "warning" | "info"
export interface ToastItem {
  id: string
  kind: ToastKind
  title: string
  message?: string
}

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
}

export function ToastViewport({
  items,
  dismiss,
}: {
  items: ToastItem[]
  dismiss: (id: string) => void
}) {
  const { t } = useLang()
  return (
    <div
      className="toast-viewport"
      aria-live="polite"
      aria-label={t("a11y.notificationsRegion")}
    >
      {items.map((toast) => {
        const Icon = icons[toast.kind]
        return (
          <div
            key={toast.id}
            className={`toast toast-${toast.kind}`}
            role="status"
          >
            <Icon size={18} />
            <div className="min-w-0 flex-1">
              <p>{toast.title}</p>
              {toast.message && <span>{toast.message}</span>}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              aria-label={t("a11y.dismissNotification")}
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
