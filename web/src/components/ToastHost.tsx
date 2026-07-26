import { useEffect, useState } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export type ToastItem = {
  id: number
  kind: ToastKind
  message: string
}

type Props = {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}

const AUTO_MS: Record<ToastKind, number> = {
  success: 3000,
  info: 3000,
  error: 8000,
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const ms = AUTO_MS[toast.kind]
    if (!ms) return
    const t = window.setTimeout(() => onDismiss(toast.id), ms)
    return () => window.clearTimeout(t)
  }, [toast.id, toast.kind, onDismiss])

  return (
    <div className={`toast toast-${toast.kind}`} role="status">
      <span className="toast-message">{toast.message}</span>
      <button
        type="button"
        className="toast-dismiss"
        aria-label="Закрыть"
        onClick={() => onDismiss(toast.id)}
      >
        ×
      </button>
    </div>
  )
}

export function ToastHost({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null
  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

let toastSeq = 0

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const push = (kind: ToastKind, message: string) => {
    const id = ++toastSeq
    setToasts((prev) => [...prev, { id, kind, message }])
  }

  return {
    toasts,
    dismiss,
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message),
    info: (message: string) => push('info', message),
  }
}
