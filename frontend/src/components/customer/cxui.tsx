import type { IncidentStatus, Priority } from '../../api'

/** Customer-friendly status mapping (plain language, soft pills). */
export const STATUS_META: Record<IncidentStatus, { label: string; cls: string; dot: string }> = {
  OPEN: { label: 'Open', cls: 'bg-[#d0e1fb] text-[#26425f]', dot: 'bg-[#3b6ea5]' },
  IN_PROGRESS: { label: 'In Progress', cls: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  PENDING: { label: 'Awaiting You', cls: 'bg-[#ffe0dd] text-[#93000a]', dot: 'bg-[#ba1a1a]' },
  RESOLVED: { label: 'Resolved', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  CLOSED: { label: 'Closed', cls: 'bg-[#e7e8ea] text-[#444748]', dot: 'bg-[#747878]' },
}

export function StatusPill({ status }: { status: IncidentStatus }) {
  const m = STATUS_META[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} aria-hidden="true"></span>{m.label}
    </span>
  )
}

const PRIORITY_LABEL: Record<Priority, string> = { P1: 'Critical', P2: 'High', P3: 'Medium', P4: 'Low' }
export function priorityLabel(p: Priority): string { return PRIORITY_LABEL[p] }

export function CustomerBrand({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="material-symbols-outlined text-black text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">ac_unit</span>
      <span className="cx-display text-[17px] font-bold text-[#191c1e]">Omniscience Support</span>
    </div>
  )
}
