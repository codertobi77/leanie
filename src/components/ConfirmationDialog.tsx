import { AlertTriangle, X } from "lucide-react"
import { useEffect, useRef } from "react"
import { useLang } from "../lib/i18n"

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useLang()
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose, open])
  if (!open) return null
  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      onMouseDown={onClose}
    >
      <div
        className="modal-card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <span
            className={`grid size-10 place-items-center rounded-xl ${
              danger ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
            }`}
          >
            <AlertTriangle size={19} />
          </span>
          <button
            onClick={onClose}
            className="icon-button"
            aria-label={t("a11y.closeDialog")}
          >
            <X size={18} />
          </button>
        </div>
        <h2
          id="dialog-title"
          className="mt-5 text-xl font-semibold tracking-[-0.03em] text-slate-950"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button ref={cancelRef} onClick={onClose} className="btn-secondary">
            {cancelLabel ?? t("common.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className={danger ? "btn-danger" : "btn-primary"}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
