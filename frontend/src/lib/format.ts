/** Shared formatting helpers for the ops UI. */

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return 'now'
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

/** Elapsed time as HH:MM:SS (design's "Time Open" column). */
export function elapsed(iso: string | null | undefined): string {
  if (!iso) return '—'
  let s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  s -= m * 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

/** Minutes until an SLA deadline (negative = past deadline). */
export function minutesUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000)
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function fmtHoursAsDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '—'
  if (hours < 1) return `${Math.round(hours * 60)}m`
  return `${hours.toFixed(1)}h`
}
