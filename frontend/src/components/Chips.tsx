import type { IncidentStatus, Priority } from '../api'

/** Priority chip per the Stitch design: P1 uses the error container, others neutral. */
export function PriorityChip({ priority }: { priority: Priority }) {
  const cls = priority === 'P1'
    ? 'bg-error-container text-on-error-container'
    : priority === 'P2'
      ? 'bg-surface-container-highest text-on-surface'
      : 'bg-surface-container-high text-on-surface-variant'
  return (
    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-xs ${cls}`}>{priority}</span>
  )
}

const STATUS_CLS: Record<IncidentStatus, string> = {
  OPEN: 'text-error-strong',
  IN_PROGRESS: 'text-secondary',
  PENDING: 'text-warning',
  RESOLVED: 'text-success',
  CLOSED: 'text-on-surface-variant',
}

export function StatusText({ status }: { status: IncidentStatus }) {
  return (
    <span className={`font-mono-label text-[9px] uppercase font-bold ${STATUS_CLS[status]}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

/** Bordered status chip used in the inventory table (Stitch screen 02). */
export function StatusChip({ status }: { status: IncidentStatus }) {
  const cls: Record<IncidentStatus, string> = {
    OPEN: 'bg-error-container/20 border-error-container text-error',
    IN_PROGRESS: 'bg-secondary-container/20 border-secondary-container text-secondary',
    PENDING: 'bg-warning/10 border-warning/40 text-warning',
    RESOLVED: 'bg-surface-variant border-outline-variant text-on-surface-variant',
    CLOSED: 'bg-surface-variant border-outline-variant text-on-surface-variant',
  }
  return (
    <span className={`px-sm py-xs border rounded text-xs font-bold uppercase whitespace-nowrap ${cls[status]}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

/** Severity rendering for the inventory's Priority column: dot + word. */
export function PrioritySeverity({ priority }: { priority: Priority }) {
  const map: Record<Priority, { label: string; dot: string; text: string; pulse?: boolean }> = {
    P1: { label: 'Critical', dot: 'bg-error', text: 'text-error', pulse: true },
    P2: { label: 'High', dot: 'bg-secondary', text: 'text-secondary' },
    P3: { label: 'Medium', dot: 'bg-outline', text: 'text-on-surface-variant' },
    P4: { label: 'Low', dot: 'bg-outline-variant', text: 'text-on-surface-variant' },
  }
  const m = map[priority]
  return (
    <span className={`flex items-center gap-sm font-semibold text-body-sm ${m.text}`}>
      <span className={`w-2 h-2 rounded-full inline-block ${m.dot} ${m.pulse ? 'animate-pulse' : ''}`} aria-hidden="true"></span>
      {m.label}
    </span>
  )
}
