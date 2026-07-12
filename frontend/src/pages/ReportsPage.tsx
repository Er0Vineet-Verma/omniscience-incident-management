import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { incidentApi, reportApi, userApi } from '../api'
import type {
  AnalystReport, MonthlyIncidentReport, SlaComplianceReport, UserResponse,
} from '../api'
import { fmtHoursAsDuration } from '../lib/format'

/**
 * Stitch design: "Analyst Workload Center" (docs/design/stitch/html/05-analyst-workload.html).
 * Per-analyst SLA% and P1 load come from the server-side report — no client sampling.
 */

interface Row extends AnalystReport {
  status: { label: string; dot: string }
  slaPct: number | null
  p1Open: number
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function workloadStatus(openNow: number, p1Open: number): { label: string; dot: string } {
  if (p1Open > 0) return { label: 'High Alert', dot: 'bg-error-strong' }
  if (openNow > 5) return { label: 'Overloaded', dot: 'bg-error animate-pulse' }
  if (openNow >= 3) return { label: 'At Capacity', dot: 'bg-primary animate-pulse' }
  return { label: 'Available', dot: 'bg-white/20' }
}

export default function ReportsPage() {
  const navigate = useNavigate()
  const [analysts, setAnalysts] = useState<AnalystReport[]>([])
  const [analystUsers, setAnalystUsers] = useState<UserResponse[]>([])
  const [sla, setSla] = useState<SlaComplianceReport | null>(null)
  const [monthly, setMonthly] = useState<MonthlyIncidentReport | null>(null)
  const [inProgress, setInProgress] = useState(0)
  const [error, setError] = useState(false)

  useEffect(() => {
    Promise.all([
      reportApi.analysts(),
      reportApi.slaCompliance(),
      reportApi.monthly(),
      incidentApi.list({ status: 'IN_PROGRESS', size: 1 }).then((p) => p.totalElements),
      userApi.analysts().catch(() => []),
    ])
      .then(([a, s, m, prog, au]) => {
        setAnalysts(a); setSla(s); setMonthly(m); setInProgress(prog); setAnalystUsers(au)
      })
      .catch(() => setError(true))
  }, [])

  const rows: Row[] = useMemo(() => analysts.map((a) => ({
    ...a,
    slaPct: a.resolvedTotal > 0 ? a.slaCompliancePercent : null,
    p1Open: a.p1OpenCount,
    status: workloadStatus(a.openNow, a.p1OpenCount),
  })), [analysts])

  const openTotal = rows.reduce((n, r) => n + r.openNow, 0)
  const avgLoad = rows.length ? openTotal / rows.length : 0
  const maxOpen = Math.max(1, ...rows.map((r) => r.openNow))
  const totalResolved = rows.reduce((n, r) => n + r.resolvedTotal, 0)
  const totalAssigned = rows.reduce((n, r) => n + r.assignedTotal, 0)
  const efficiency = totalAssigned > 0 ? Math.round((totalResolved / totalAssigned) * 100) : 0
  const weightedMttr = totalResolved > 0
    ? rows.reduce((n, r) => n + r.avgResolutionHours * r.resolvedTotal, 0) / totalResolved
    : 0

  const slaTone = (p: number | null) =>
    p === null ? 'text-on-surface-variant' : p >= 99 ? 'text-primary' : p >= 95 ? 'text-secondary' : 'text-error'
  const slaBar = (p: number | null) =>
    p === null ? 'bg-outline-variant' : p >= 99 ? 'bg-primary' : p >= 95 ? 'bg-secondary' : 'bg-error'

  const exportCsv = () => {
    const head = ['Analyst', 'Email', 'Assigned', 'Open Now', 'Resolved', 'Avg Resolution (h)', 'SLA %']
    const lines = rows.map((r) => [
      r.analystName, r.email, r.assignedTotal, r.openNow, r.resolvedTotal,
      r.avgResolutionHours.toFixed(2), r.slaPct === null ? 'n/a' : r.slaPct.toFixed(1),
    ])
    const summary = [
      [], ['Overall SLA compliance %', sla?.compliancePercent ?? ''],
      ['Month', `${monthly?.year}-${monthly?.month}`],
      ['Monthly created', monthly?.totalCreated ?? ''], ['Monthly resolved', monthly?.totalResolved ?? ''],
    ]
    const csv = [head, ...lines, ...summary].map((r) => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `analyst-report-${monthly?.year}-${monthly?.month}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (error) {
    return <div className="p-xl"><p role="alert" className="text-error text-body-sm">Failed to load reports — analyst/admin role required.</p></div>
  }

  return (
    <div className="p-lg space-y-lg">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h1 className="text-headline-lg font-semibold tracking-tight text-on-surface">Workload Intelligence</h1>
          <p className="text-body-md text-on-surface-variant">Real-time resource utilization and ticket distribution across the operation.</p>
        </div>
        <div className="flex gap-sm">
          <div className="flex items-center gap-xs px-md py-sm glass-panel text-label-md rounded">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">calendar_month</span>
            {monthly ? new Date(monthly.year, monthly.month - 1).toLocaleString(undefined, { month: 'long', year: 'numeric' }) : '…'}
          </div>
          <button
            onClick={exportCsv}
            className="flex items-center gap-xs px-md py-sm bg-primary text-on-primary text-label-md font-bold rounded hover:opacity-90 transition-all active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">download</span>
            Export Report
          </button>
        </div>
      </div>

      {/* Metric bento */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-lg">
        <div className="glass-panel p-lg flex flex-col justify-between rounded-lg group hover:border-primary/20 transition-all">
          <div className="flex justify-between items-start mb-md">
            <div className="p-sm bg-surface-container-low border border-white/5 rounded">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors" aria-hidden="true">group</span>
            </div>
            <span className="text-xs font-mono-label text-on-surface-variant">Live Status</span>
          </div>
          <div>
            <div className="text-on-surface-variant text-label-md uppercase tracking-wider mb-xs">Total Analysts</div>
            <div className="text-[40px] leading-none font-bold">{rows.length}</div>
          </div>
          <div className="mt-md flex items-center text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-sm mr-xs" aria-hidden="true">trending_flat</span>
            {analystUsers.filter((u) => u.status === 'ACTIVE').length} active in rotation
          </div>
        </div>

        <div className="glass-panel p-lg flex flex-col justify-between rounded-lg group hover:border-primary/20 transition-all">
          <div className="flex justify-between items-start mb-md">
            <div className="p-sm bg-surface-container-low border border-white/5 rounded">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors" aria-hidden="true">confirmation_number</span>
            </div>
            <span className={`text-xs font-mono-label ${openTotal > 10 ? 'text-error' : 'text-on-surface-variant'}`}>queue</span>
          </div>
          <div>
            <div className="text-on-surface-variant text-label-md uppercase tracking-wider mb-xs">Open Tickets</div>
            <div className="text-[40px] leading-none font-bold">{openTotal}</div>
          </div>
          <div className={`mt-md flex items-center text-xs ${openTotal > 10 ? 'text-error' : 'text-on-surface-variant'}`}>
            <span className="material-symbols-outlined text-sm mr-xs" aria-hidden="true">{openTotal > 10 ? 'warning' : 'check_circle'}</span>
            {openTotal > 10 ? 'Above critical threshold' : 'Within capacity'}
          </div>
        </div>

        <div className="glass-panel p-lg flex flex-col justify-between rounded-lg group hover:border-primary/20 transition-all">
          <div className="flex justify-between items-start mb-md">
            <div className="p-sm bg-surface-container-low border border-white/5 rounded">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors" aria-hidden="true">analytics</span>
            </div>
            <span className="text-xs font-mono-label text-on-surface-variant">Avg/Op</span>
          </div>
          <div>
            <div className="text-on-surface-variant text-label-md uppercase tracking-wider mb-xs">Avg Load</div>
            <div className="text-[40px] leading-none font-bold">{avgLoad.toFixed(1)}</div>
          </div>
          <div className="mt-md w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="bg-primary h-full" style={{ width: `${Math.min(100, (avgLoad / 8) * 100)}%` }}></div>
          </div>
        </div>

        <div className="glass-panel p-lg flex flex-col justify-between rounded-lg group hover:border-primary/20 transition-all">
          <div className="flex justify-between items-start mb-md">
            <div className="p-sm bg-surface-container-low border border-white/5 rounded">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors" aria-hidden="true">verified</span>
            </div>
            <span className="text-xs font-mono-label text-accent">SLA Active</span>
          </div>
          <div>
            <div className="text-on-surface-variant text-label-md uppercase tracking-wider mb-xs">SLA Perf</div>
            <div className="text-[40px] leading-none font-bold">
              {sla ? sla.compliancePercent.toFixed(1) : '—'}<span className="text-body-md">%</span>
            </div>
          </div>
          <div className={`mt-md flex items-center text-xs ${sla && sla.compliancePercent >= 95 ? 'text-accent' : 'text-error'}`}>
            <span className="material-symbols-outlined text-sm mr-xs" aria-hidden="true">{sla && sla.compliancePercent >= 95 ? 'check_circle' : 'warning'}</span>
            {sla ? `${sla.resolvedWithinSla}/${sla.totalResolved} resolved within SLA` : 'Loading'}
          </div>
        </div>
      </section>

      {/* Distribution + shift health */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <div className="lg:col-span-2 glass-panel rounded-lg overflow-hidden flex flex-col">
          <div className="px-lg py-md border-b border-white/5 flex justify-between items-center bg-surface-container-low/50">
            <h3 className="text-label-md uppercase tracking-widest text-on-surface">Queue Distribution Per Analyst</h3>
            <div className="flex gap-xs" aria-hidden="true">
              <span className="w-3 h-3 bg-white/10"></span>
              <span className="w-3 h-3 bg-white/20"></span>
              <span className="w-3 h-3 bg-white/60"></span>
              <span className="w-3 h-3 bg-primary"></span>
            </div>
          </div>
          <div className="p-lg flex-1 min-h-[320px] flex items-end justify-around gap-sm relative">
            <div className="absolute inset-x-lg inset-y-lg flex flex-col justify-between pointer-events-none opacity-5" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => <div key={i} className="border-t border-white"></div>)}
            </div>
            {rows.length === 0 && <p className="text-body-sm text-on-surface-variant m-auto">No analyst data.</p>}
            {rows.map((r) => (
              <div key={r.analystId} className="flex-1 max-w-24 flex flex-col items-center gap-sm group h-full justify-end">
                <span className="text-[10px] font-mono-label opacity-0 group-hover:opacity-100 transition-opacity">{r.openNow} open</span>
                <div
                  className={`w-full transition-all relative cursor-pointer ${r.p1Open > 0 ? 'bg-error/30 hover:bg-error/50' : 'bg-white/10 hover:bg-primary/20'}`}
                  style={{ height: `${Math.max(6, (r.openNow / maxOpen) * 85)}%` }}
                  onClick={() => navigate(`/incidents?analyst=${r.analystId}`)}
                  title={`${r.analystName}: ${r.openNow} open (${r.p1Open} P1)`}
                >
                  {r.p1Open > 0 && <div className="absolute inset-x-0 bottom-0 bg-error/60" style={{ height: `${(r.p1Open / Math.max(1, r.openNow)) * 100}%` }}></div>}
                </div>
                <span className={`text-[10px] font-mono-label uppercase opacity-40 group-hover:opacity-100 transition-opacity ${r.p1Open > 0 ? 'text-error' : ''}`}>
                  {r.analystName.split(' ')[0]}.{r.analystName.split(' ')[1]?.[0] ?? ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-lg flex flex-col">
          <div className="px-lg py-md border-b border-white/5 bg-surface-container-low/50">
            <h3 className="text-label-md uppercase tracking-widest text-on-surface">Shift Health</h3>
          </div>
          <div className="p-lg space-y-lg flex-1">
            <div className="relative w-40 h-40 mx-auto">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36" role="img" aria-label={`Resolution efficiency ${efficiency}%`}>
                <circle className="stroke-white/5" cx="18" cy="18" fill="none" r="16" strokeWidth="3"></circle>
                <circle className="stroke-primary" cx="18" cy="18" fill="none" r="16" strokeDasharray={`${efficiency}, 100`} strokeWidth="3"></circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[40px] font-bold leading-none">{efficiency}%</span>
                <span className="text-[10px] font-mono-label opacity-60">RESOLVED RATIO</span>
              </div>
            </div>
            <div className="space-y-sm">
              <div className="flex justify-between items-center text-body-sm">
                <span className="text-on-surface-variant">In Progress Now</span>
                <span className="font-mono-label text-primary">{inProgress}</span>
              </div>
              <div className="flex justify-between items-center text-body-sm">
                <span className="text-on-surface-variant">Resolved This Month</span>
                <span className="font-mono-label">{monthly?.totalResolved ?? '—'}</span>
              </div>
              <div className="flex justify-between items-center text-body-sm">
                <span className="text-on-surface-variant">Created This Month</span>
                <span className="font-mono-label">{monthly?.totalCreated ?? '—'}</span>
              </div>
              <div className="flex justify-between items-center text-body-sm">
                <span className="text-on-surface-variant">Avg Resolution</span>
                <span className="font-mono-label">{fmtHoursAsDuration(weightedMttr)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Performance registry */}
      <section className="glass-panel rounded-lg overflow-hidden">
        <div className="px-lg py-md border-b border-white/5 flex justify-between items-center bg-surface-container-low/50">
          <div className="flex items-center gap-md">
            <h3 className="text-label-md uppercase tracking-widest text-on-surface">Performance Registry</h3>
            <span className="px-xs py-[2px] bg-white/10 text-[10px] font-mono-label rounded-sm">LIVE_DATA</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="text-on-surface-variant/60 text-[10px] uppercase tracking-wider border-b border-white/5">
                <th className="px-lg py-md font-medium">Analyst Identity</th>
                <th className="px-lg py-md font-medium">Workload Status</th>
                <th className="px-lg py-md font-medium text-right">Open Now</th>
                <th className="px-lg py-md font-medium text-right">Assigned Total</th>
                <th className="px-lg py-md font-medium text-right">Resolved</th>
                <th className="px-lg py-md font-medium text-right">SLA Performance</th>
                <th className="px-lg py-md font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr key={r.analystId} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-lg py-md">
                    <div className="flex items-center gap-md">
                      <div className="w-8 h-8 bg-surface-container-highest border border-white/10 flex items-center justify-center rounded">
                        <span className="font-bold text-xs text-on-surface">{initials(r.analystName)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-body-sm font-semibold text-on-surface">{r.analystName}</span>
                        <span className="text-[10px] font-mono-label text-on-surface-variant uppercase">{r.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-lg py-md">
                    <div className="flex items-center gap-sm">
                      <span className={`w-2 h-2 rounded-full ${r.status.dot}`} aria-hidden="true"></span>
                      <span className="text-body-sm text-on-surface-variant">{r.status.label}</span>
                    </div>
                  </td>
                  <td className="px-lg py-md text-right font-mono-label text-body-sm">{r.openNow}</td>
                  <td className="px-lg py-md text-right font-mono-label text-body-sm">{r.assignedTotal}</td>
                  <td className="px-lg py-md text-right font-mono-label text-body-sm">{r.resolvedTotal}</td>
                  <td className="px-lg py-md text-right">
                    <div className="flex flex-col items-end gap-xs">
                      <span className={`text-body-sm font-semibold ${slaTone(r.slaPct)}`}>
                        {r.slaPct === null ? 'n/a' : `${r.slaPct.toFixed(1)}%`}
                      </span>
                      <div className="w-24 h-1 bg-surface-container-highest">
                        <div className={`h-full ${slaBar(r.slaPct)}`} style={{ width: `${r.slaPct ?? 0}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-lg py-md text-right">
                    <button
                      onClick={() => navigate(`/incidents?analyst=${r.analystId}`)}
                      className="text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-lg py-md border-t border-white/5 bg-surface-container-lowest/50 flex justify-between items-center">
          <span className="text-[10px] font-mono-label text-on-surface-variant uppercase">Displaying {rows.length} analysts</span>
        </div>
      </section>
    </div>
  )
}
