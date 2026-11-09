type ObsValue = string | number | boolean | null | undefined
export type ObsPayload = Record<string, ObsValue | ObsValue[] | Record<string, ObsValue>>

interface ObsEvent {
  name: string
  ts: string
  path?: string
  payload?: ObsPayload
}

const ENDPOINT = (import.meta.env.VITE_OBSERVABILITY_URL as string | undefined)?.trim() || ""
const MAX_QUEUE = 50
const queue: ObsEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function canSend(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined"
}

function scheduleFlush() {
  if (flushTimer || !ENDPOINT || !queue.length) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flush()
  }, 1500)
}

async function flush(): Promise<void> {
  if (!ENDPOINT || !queue.length || !canSend()) return
  const batch = queue.splice(0, MAX_QUEUE)
  const body = JSON.stringify({ events: batch })
  try {
    if (typeof navigator.sendBeacon === "function") {
      const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }))
      if (ok) return
    }
  } catch {
    // fall through to fetch
  }
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    })
  } catch {
    // Observability must never break the app; drop on transport failure.
  }
}

if (canSend()) {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush()
  })
  window.addEventListener("pagehide", () => {
    void flush()
  })
}

export function trackEvent(name: string, payload?: ObsPayload): void {
  try {
    const event: ObsEvent = {
      name,
      ts: new Date().toISOString(),
      path: canSend() ? window.location.pathname : undefined,
      payload,
    }
    if (import.meta.env.DEV) {
      console.debug("[observability]", name, payload ?? {})
    }
    if (!ENDPOINT) return // safe no-op when no sink is configured
    queue.push(event)
    if (queue.length >= MAX_QUEUE) void flush()
    else scheduleFlush()
  } catch {
    // never throw from observability
  }
}

/** Compatibility hook (P5.18): record a resource/path interaction. */
export async function trackResource(path: string, metadata?: ObsPayload): Promise<void> {
  trackEvent("resource", { path, ...(metadata ?? {}) })
}
