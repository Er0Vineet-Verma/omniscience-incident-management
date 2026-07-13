import { useEffect, useMemo, useState } from 'react'
import { auditApi } from '../api'
import type { AuditResponse, AuditStats, AuditAction, Page } from '../api'
import { fmtDateTime } from '../lib/format'

/**
 * Stitch design: "Audit Center & Forensic Investigation" (screenshot
 * docs/design/stitch/screenshots/12-audit-center.png — the screen's stored Stitch
 * htmlCode is stale dashboard markup, so this was built from the screenshot).
 * Header metrics come from the DB-aggregated GET /api/audit/stats; the Event
 * Explorer streams the real paged audit log. No mocked numbers.
 */

const PAGE_SIZE = 50

const ALL_ACTIONS: AuditAction[] = [
  'CREATED', 'UPDATED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'ASSIGNED',
  'ESCALATED', 'RESOLVED', 'CLOSED', 'DELETED', 'LOG_UPLOADED',
]

function actionLabel(a: AuditAction): string {
  return a.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function actionTone(a: AuditAction): string {
  switch (a) {
    case 'DELETED': return 'bg-error/10 border-error/30 text-error'
    case 'ESCALATED': return 'bg-warning/10 border-warning/40 text-warning'
    case 'CREATED':
    case 'RESOLVED':
    case 'CLOSED': return 'bg-primary/10 border-primary/30 text-primary'
    default: return 'bg-secondary/10 border-secondary/30 text-secondary'
  }
}

function severityOf(a: AuditAction): { label: string; tone: string } {
  if (a === 'DELETED') return { label: 'Critical', tone: 'text-error' }
  if (a === 'ESCALATED') return { label: 'High', tone: 'text-warning' }
  return { label: 'Normal', tone: 'text-on-surface-variant' }
}

function detailOf(e: AuditResponse): string {
  if (e.fieldName) {
    const from = e.oldValue ?? '—'
    const to = e.newValue ?? '—'
    return `${e.fieldName}: ${from} → ${to}`
  }
  return e.newValue ?? '—'
}

export default function AuditCenterPage() {
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [pageData, setPageData] = useState<Page<AuditResponse> | null>(null)
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')
  const [actionFilter, setActionFilter] = useState<AuditAction | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    auditApi.stats().then(setStats).catch(() => setError(true))
  }, [])

  useEffect(() => {
    setLoading(true)
    auditApi.list(page, PAGE_SIZE)
      .then(setPageData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [page])

  const events = useMemo(() => pageData?.content ?? [], [pageData])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return events.filter((e) => {
      if (actionFilter && e.action !== actionFilter) return false
      if (!q) return true
      return [e.performedBy, e.entityType, e.fieldName, e.oldValue, e.newValue, String(e.entityId)]
        .filter(Boolean)
        .some((f) => (f as string).toLowerCase().includes(q))
    })
  }, [events, query, actionFilter])

  const exportCsv = () => {
    const head = ['Timestamp', 'Actor', 'Action', 'Target', 'Detail']
    const lines = filtered.map((e) => [
      e.timestamp, e.performedBy, e.action,
      `${e.entityType}${e.entityId != null ? ' #' + e.entityId : ''}`,
      detailOf(e).replace(/,/g, ';'),
    ])
    const csv = [head, ...lines].map((r) => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `audit-log-page-${page + 1}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const timeline = useMemo(
    () => events.filter((e) => ['ESCALATED', 'DELETED', 'STATUS_CHANGED', 'RESOLVED'].includes(e.action)).slice(0, 6),
    [events],
  )

  if (error && !stats) {
    return <div className="p-lg"><p role="alert" className="text-error text-body-sm">Failed to load audit data — admin role required.</p></div>
  }

  return (
    <div className="p-lg space-y-lg">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h1 className="text-headline-lg font-semibold tracking-tight text-on-surface">Audit Center</h1>
          <p className="text-body-md text-on-surface-variant max-w-3xl">
            Complete history of operational, administrative, and compliance events across the platform.
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-xs px-md py-sm bg-primary text-on-primary text-label-md font-bold rounded hover:opacity-90 transition-all active:scale-95 cursor-pointer self-start"
        >
          <span className="material-symbols-outlined text-sm" aria-hidden="true">download</span>
          Export
        </button>
      </div>

      {/* Metric cards */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-md">
        <Kpi icon="database" label="Total Events" value={stats ? stats.totalEvents.toLocaleString() : '—'} />
        <Kpi icon="today" label="Events Today" value={stats ? stats.eventsToday.toLocaleString() : '—'} />
        <Kpi icon="trending_up" label="Escalations" value={stats?.escalations ?? '—'} tone="warning" />
        <Kpi icon="task_alt" label="Resolved" value={stats?.resolved ?? '—'} />
        <Kpi icon="delete" label="Deletions" value={stats?.deletions ?? '—'} tone="error" />
        <Kpi icon="group" label="Distinct Actors" value={stats?.distinctActors ?? '—'} />
      </section>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Event explorer */}
        <section className="lg:col-span-2 glass-panel rounded-lg overflow-hidden flex flex-col">
          <div className="px-lg py-md border-b border-white/5 bg-surface-container-low/50 flex flex-wrap items-center gap-sm justify-between">
            <h3 className="text-label-md uppercase tracking-widest text-on-surface">Event Explorer</h3>
            <div className="flex flex-wrap items-center gap-sm">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as AuditAction | '')}
                aria-label="Filter by action"
                className="bg-surface-container-low border border-white/10 rounded px-sm py-xs text-body-sm text-on-surface focus:outline-none focus:border-secondary cursor-pointer"
              >
                <option value="">All actions</option>
                {ALL_ACTIONS.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
              </select>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]" aria-hidden="true">search</span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter logs…"
                  aria-label="Filter audit events"
                  className="bg-surface-container-low border border-white/10 rounded py-xs pl-8 pr-3 text-body-sm text-on-surface focus:outline-none focus:border-secondary w-40"
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="text-on-surface-variant/60 text-[10px] uppercase tracking-wider border-b border-white/5">
                  <th className="px-lg py-md font-medium">Timestamp</th>
                  <th className="px-lg py-md font-medium">Actor</th>
                  <th className="px-lg py-md font-medium">Action</th>
                  <th className="px-lg py-md font-medium">Target</th>
                  <th className="px-lg py-md font-medium">Detail</th>
                  <th className="px-lg py-md font-medium text-right">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono-label">
                {loading && (
                  <tr><td colSpan={6} className="px-lg py-lg text-center text-body-sm text-on-surface-variant">Loading events…</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-lg py-lg text-center text-body-sm text-on-surface-variant">No events match the filter.</td></tr>
                )}
                {!loading && filtered.map((e) => {
                  const sev = severityOf(e.action)
                  return (
                    <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-lg py-md text-[11px] text-on-surface-variant whitespace-nowrap">{fmtDateTime(e.timestamp)}</td>
                      <td className="px-lg py-md text-[11px] text-on-surface whitespace-nowrap">{e.performedBy}</td>
                      <td className="px-lg py-md">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${actionTone(e.action)}`}>
                          {actionLabel(e.action)}
                        </span>
                      </td>
                      <td className="px-lg py-md text-[11px] text-on-surface-variant whitespace-nowrap">
                        {e.entityType}{e.entityId != null ? ` #${e.entityId}` : ''}
                      </td>
                      <td className="px-lg py-md text-[11px] text-on-surface-variant max-w-[260px] truncate" title={detailOf(e)}>{detailOf(e)}</td>
                      <td className={`px-lg py-md text-right text-[11px] ${sev.tone}`}>{sev.label}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="px-lg py-md border-t border-white/5 bg-surface-container-lowest/50 flex items-center justify-between">
            <span className="text-[10px] font-mono-label text-on-surface-variant uppercase">
              {pageData ? `Page ${pageData.number + 1} of ${Math.max(1, pageData.totalPages)} · ${pageData.totalElements.toLocaleString()} events` : '…'}
              {(query || actionFilter) && ` · ${filtered.length} shown`}
            </span>
            <div className="flex gap-xs">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={!pageData || pageData.first}
                className="px-sm py-xs rounded border border-white/10 text-[10px] uppercase tracking-widest text-on-surface-variant transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:text-primary enabled:hover:border-primary"
              >Prev</button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!pageData || pageData.last}
                className="px-sm py-xs rounded border border-white/10 text-[10px] uppercase tracking-widest text-on-surface-variant transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:text-primary enabled:hover:border-primary"
              >Next</button>
            </div>
          </div>
        </section>

        {/* Right rail */}
        <div className="flex flex-col gap-lg">
          <section className="glass-panel rounded-lg p-lg">
            <h3 className="text-label-md uppercase tracking-widest text-on-surface mb-lg">Operational Timeline</h3>
            <div className="relative flex flex-col gap-md">
              {timeline.length === 0 && <p className="text-body-sm text-on-surface-variant">No notable events on this page.</p>}
              {timeline.length > 0 && <div className="absolute left-[5px] top-2 bottom-2 w-px bg-outline-variant" aria-hidden="true"></div>}
              {timeline.map((e) => (
                <div key={e.id} className="relative z-10 flex items-start gap-md">
                  <span className={`mt-1 w-[11px] h-[11px] rounded-full shrink-0 border-2 border-surface ${e.action === 'DELETED' ? 'bg-error' : e.action === 'ESCALATED' ? 'bg-warning' : 'bg-secondary'}`} aria-hidden="true"></span>
                  <div className="flex-1">
                    <div className="flex justify-between gap-sm">
                      <span className="text-body-sm text-on-surface">{actionLabel(e.action)}</span>
                      <span className="font-mono-label text-[10px] text-on-surface-variant whitespace-nowrap">{fmtDateTime(e.timestamp)}</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant">{e.entityType}{e.entityId != null ? ` #${e.entityId}` : ''} · {e.performedBy}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-panel rounded-lg p-lg relative overflow-hidden">
            <div className="absolute right-[-20px] top-[-20px] opacity-10" aria-hidden="true">
              <span className="material-symbols-outlined text-[120px] text-primary">neurology</span>
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-sm">
                <h3 className="text-label-md uppercase tracking-widest text-on-surface">Audit Intelligence</h3>
                <span className="px-xs py-[2px] bg-white/10 text-[10px] font-mono-label rounded-sm text-on-surface-variant">COMING SOON</span>
              </div>
              <p className="text-body-sm text-on-surface-variant">
                ML-driven anomaly detection for operational patterns and security threats — planned for the AI phase.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Kpi({ icon, label, value, tone }: { icon: string; label: string; value: string | number; tone?: 'error' | 'warning' }) {
  const accent = tone === 'error' ? 'text-error' : tone === 'warning' ? 'text-warning' : 'text-on-surface-variant'
  const valueColor = tone === 'error' ? 'text-error' : tone === 'warning' ? 'text-warning' : 'text-on-surface'
  const border = tone === 'error' ? 'border-error/20' : tone === 'warning' ? 'border-warning/20' : 'border-white/5'
  return (
    <div className={`bg-surface-container-low border ${border} rounded-lg p-md hover:bg-surface-container transition-colors`}>
      <div className={`flex items-center gap-sm mb-md ${accent}`}>
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{icon}</span>
        <h3 className="text-label-md uppercase tracking-wider">{label}</h3>
      </div>
      <div className={`text-[28px] leading-none font-bold font-mono-label ${valueColor}`}>{value}</div>
    </div>
  )
}
