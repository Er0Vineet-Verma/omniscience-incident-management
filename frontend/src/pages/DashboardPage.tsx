import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  dashboardApi, escalationApi, incidentApi, reportApi,
} from '../api'
import type {
  ChartSlice, DashboardSummary, EscalationResponse, IncidentResponse, SlaBuckets, TrendPoint,
} from '../api'
import { PriorityChip, StatusText } from '../components/Chips'
import { elapsed, fmtHoursAsDuration, minutesUntil, timeAgo } from '../lib/format'

/**
 * Stitch design: "Operational Dashboard v4" (docs/design/stitch/html/01-dashboard.html).
 * All aggregates (SLA buckets, heatmap, counts) are computed server-side so the
 * dashboard stays correct at thousands of incidents.
 */

const REFRESH_MS = 30000
const ACTIVE = ['OPEN', 'IN_PROGRESS', 'PENDING'] as const

interface DashboardData {
  summary: DashboardSummary
  priorities: ChartSlice[]
  statuses: ChartSlice[]
  trends: TrendPoint[]
  recent: IncidentResponse[]
  queue: IncidentResponse[]
  escalations: EscalationResponse[]
  slaBuckets: SlaBuckets
  heatmap: number[][]
  slaCompliance: number
  mttrHours: number
}

const PRIORITY_COLORS: Record<string, string> = {
  P1: '#EF4444', P2: '#ffffff', P3: '#8e9193', P4: '#444749',
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#EF4444', IN_PROGRESS: '#38bdf8', PENDING: '#FBBF24', RESOLVED: '#22C55E', CLOSED: '#8e9193',
}

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function HeatmapCard({ grid }: { grid: number[][] }) {
  const max = Math.max(1, ...grid.flat())
  const cellCls = (v: number) => {
    if (v === 0) return 'bg-surface-container-high'
    const r = v / max
    if (r < 0.4) return 'bg-secondary-container'
    if (r < 0.75) return 'bg-secondary'
    return 'bg-primary'
  }
  return (
    <div className="col-span-12 lg:col-span-8 glass-panel rounded-lg p-lg">
      <div className="flex justify-between items-center mb-md">
        <h3 className="text-label-md font-semibold">Incident Density Heatmap (28d)</h3>
        <div className="flex gap-xs items-center" aria-hidden="true">
          <div className="w-2 h-2 bg-surface-container-high rounded-xs"></div>
          <div className="w-2 h-2 bg-secondary-container rounded-xs"></div>
          <div className="w-2 h-2 bg-secondary rounded-xs"></div>
          <div className="w-2 h-2 bg-primary rounded-xs"></div>
        </div>
      </div>
      <div className="space-y-xs overflow-x-auto">
        <div className="flex gap-xs pl-xl">
          {['00', '06', '12', '18'].map((h) => (
            <div key={h} className="w-full text-center font-mono-label text-[10px] text-on-surface-variant">{h}</div>
          ))}
        </div>
        <div className="space-y-xs">
          {grid.map((row, di) => (
            <div key={DAYS[di]} className="flex gap-xs items-center">
              <span className="w-8 font-mono-label text-[10px] text-on-surface-variant">{DAYS[di]}</span>
              <div className="flex flex-1 gap-xs">
                {row.map((v, hi) => (
                  <div
                    key={hi}
                    title={`${DAYS[di]} ${String(hi).padStart(2, '0')}:00 — ${v} incident${v === 1 ? '' : 's'}`}
                    className={`h-4 flex-1 ${cellCls(v)} rounded-xs opacity-80 transition-all hover:opacity-100 hover:outline hover:outline-white cursor-pointer`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DonutCard({ title, data, colors, ariaLabel }: {
  title: string; data: ChartSlice[]; colors: Record<string, string>; ariaLabel: string
}) {
  const total = Math.max(1, data.reduce((n, p) => n + p.value, 0))
  const C = 2 * Math.PI * 40
  let offset = 0
  const segments = data.map((p) => {
    const len = (p.value / total) * C
    const seg = { ...p, len, offset }
    offset += len
    return seg
  })
  return (
    <div className="col-span-12 lg:col-span-4 glass-panel flex flex-col rounded-lg p-lg">
      <h3 className="text-label-md font-semibold mb-md">{title}</h3>
      <div className="flex-1 flex items-center justify-between">
        <div className="relative w-24 h-24 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" role="img" aria-label={ariaLabel}>
            <circle cx="50" cy="50" fill="transparent" r="40" stroke="#353535" strokeWidth="12" />
            {segments.map((s) => (
              <circle
                key={s.label} cx="50" cy="50" fill="transparent" r="40"
                stroke={colors[s.label] ?? '#8e9193'}
                strokeDasharray={`${s.len} ${C - s.len}`}
                strokeDashoffset={-s.offset}
                strokeWidth="12"
              />
            ))}
          </svg>
        </div>
        <div className="flex-1 ml-md space-y-xs">
          {segments.map((s) => (
            <div key={s.label} className="flex justify-between items-center text-[11px]">
              <div className="flex items-center gap-xs">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[s.label] ?? '#8e9193' }} aria-hidden="true"></span>
                <span className="text-body-sm">{s.label.replace(/_/g, ' ')}</span>
              </div>
              <span className="font-mono-label">{String(s.value).padStart(2, '0')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TrendCard({ trends }: { trends: TrendPoint[] }) {
  const path = (key: 'created' | 'resolved') => {
    if (trends.length === 0) return ''
    const max = Math.max(1, ...trends.map((t) => Math.max(t.created, t.resolved)))
    const stepX = 1000 / Math.max(1, trends.length - 1)
    return trends
      .map((t, i) => `${i === 0 ? 'M' : 'L'}${Math.round(i * stepX)},${Math.round(95 - (t[key] / max) * 85)}`)
      .join(' ')
  }
  return (
    <div className="glass-panel rounded-lg p-lg">
      <div className="flex justify-between items-center mb-md">
        <h3 className="text-label-md font-semibold">Resolution Throughput</h3>
        <div className="flex gap-md text-on-surface-variant font-mono-label text-[10px]">
          <div className="flex items-center gap-xs"><span className="w-2 h-px bg-primary" aria-hidden="true"></span>CREATED</div>
          <div className="flex items-center gap-xs"><span className="w-2 h-px bg-success" aria-hidden="true"></span>RESOLVED</div>
        </div>
      </div>
      <div className="h-32 relative overflow-hidden">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 100" role="img" aria-label="Incidents created vs resolved trend">
          <path d={path('created')} fill="none" opacity="0.6" stroke="white" strokeLinejoin="round" strokeWidth="1.5" />
          <path d={path('resolved')} fill="none" stroke="#22C55E" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      const [summary, priorities, statuses, trends, recentPage, p1Page, p2Page, escalations, slaBuckets, heatmap, sla, analysts] = await Promise.all([
        dashboardApi.summary(),
        dashboardApi.priorityDistribution(),
        dashboardApi.statusDistribution(),
        dashboardApi.trends(14),
        incidentApi.list({ size: 4, sort: 'updatedAt,desc' }),
        incidentApi.list({ priority: 'P1', size: 10, sort: 'slaDeadline,asc' }),
        incidentApi.list({ priority: 'P2', size: 10, sort: 'slaDeadline,asc' }),
        escalationApi.list().catch(() => [] as EscalationResponse[]),
        dashboardApi.slaBuckets(),
        dashboardApi.heatmap(28),
        reportApi.slaCompliance().catch(() => null),
        reportApi.analysts().catch(() => []),
      ])
      const resolved = analysts.filter((a) => a.resolvedTotal > 0)
      const mttr = resolved.length
        ? resolved.reduce((n, a) => n + a.avgResolutionHours * a.resolvedTotal, 0) / resolved.reduce((n, a) => n + a.resolvedTotal, 0)
        : 0
      const queue = [...p1Page.content, ...p2Page.content]
        .filter((i) => (ACTIVE as readonly string[]).includes(i.status))
        .sort((a, b) => a.priority.localeCompare(b.priority) || a.slaDeadline.localeCompare(b.slaDeadline))
        .slice(0, 6)
      setData({
        summary, priorities, statuses, trends,
        recent: recentPage.content,
        queue, escalations, slaBuckets, heatmap,
        slaCompliance: sla?.compliancePercent ?? 100,
        mttrHours: mttr,
      })
      setError(false)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  const escalationLevels = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0 }
    for (const e of data?.escalations ?? []) counts[e.level as 1 | 2 | 3] = (counts[e.level as 1 | 2 | 3] ?? 0) + 1
    return counts
  }, [data])

  if (!data) {
    return (
      <main className="p-lg max-w-[1600px] mx-auto w-full" aria-busy="true">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-panel rounded-lg h-20 shimmer" />
          ))}
        </div>
        {error && (
          <p role="alert" className="mt-lg text-error text-body-sm">
            Failed to reach the backend — retrying every 30s.
          </p>
        )}
      </main>
    )
  }

  const s = data.summary
  const b = data.slaBuckets
  return (
    <main className="p-lg max-w-[1600px] mx-auto w-full space-y-lg">
      {/* Status header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="text-headline-lg font-semibold text-on-surface leading-tight">Operations Dashboard</h2>
          <p className="text-body-sm text-on-surface-variant">Real-time incident monitoring and throughput analysis.</p>
        </div>
        <div className="flex gap-sm">
          <div className="flex items-center gap-xs px-sm py-xs bg-surface-container-high rounded border border-outline-variant">
            <span className={`w-2 h-2 rounded-full animate-pulse ${s.slaBreaches > 0 ? 'bg-error-strong' : 'bg-accent'}`} aria-hidden="true"></span>
            <span className="font-mono-label text-mono-label uppercase tracking-widest text-on-surface">
              {s.slaBreaches > 0 ? `${s.slaBreaches} SLA Breach${s.slaBreaches > 1 ? 'es' : ''} Active` : 'Global Systems Nominal'}
            </span>
          </div>
          <button
            onClick={() => navigate('/reports')}
            className="px-md py-xs bg-accent text-black text-label-md font-semibold rounded hover:opacity-90 transition-opacity uppercase tracking-widest cursor-pointer"
          >
            Export Report
          </button>
        </div>
      </div>

      {/* High-density summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-sm">
        <Link to="/incidents?status=OPEN" className="glass-panel flex flex-col gap-xs rounded-lg p-lg hover:bg-surface-variant/40 transition-colors">
          <span className="font-mono-label text-[10px] text-on-surface-variant uppercase">Open</span>
          <div className="flex items-baseline gap-xs">
            <span className="text-headline-sm font-bold">{s.openIncidents}</span>
            <span className="font-mono-label text-[10px] text-on-surface-variant">+{s.inProgress} active</span>
          </div>
        </Link>
        <Link to="/incidents?priority=P1" className="glass-panel flex flex-col gap-xs border-l-2 border-l-error-strong rounded-lg p-lg hover:bg-surface-variant/40 transition-colors">
          <span className="font-mono-label text-[10px] uppercase text-error-strong">Critical</span>
          <div className="flex items-baseline gap-xs">
            <span className="text-headline-sm font-bold text-error-strong">{String(s.p1Open).padStart(2, '0')}</span>
          </div>
        </Link>
        <div className="glass-panel flex flex-col gap-xs rounded-lg p-lg">
          <span className="font-mono-label text-[10px] text-on-surface-variant uppercase">SLA%</span>
          <div className="flex items-baseline gap-xs">
            <span className="text-headline-sm font-bold text-accent">{data.slaCompliance.toFixed(1)}</span>
          </div>
        </div>
        <div className="glass-panel flex flex-col gap-xs rounded-lg p-lg">
          <span className="font-mono-label text-[10px] text-on-surface-variant uppercase">MTTR</span>
          <div className="flex items-baseline gap-xs">
            <span className="text-headline-sm font-bold">{fmtHoursAsDuration(data.mttrHours)}</span>
          </div>
        </div>
        <div className="col-span-2 glass-panel p-md flex flex-col justify-between rounded-lg">
          <span className="font-mono-label text-[10px] text-on-surface-variant uppercase mb-xs">SLA Tracking (all active)</span>
          <div className="flex gap-md">
            <div className="flex flex-col">
              <span className="text-headline-sm font-bold text-success">{b.healthy}</span>
              <span className="font-mono-label text-[9px] text-on-surface-variant">HEALTHY</span>
            </div>
            <div className="flex flex-col">
              <span className="text-headline-sm font-bold text-warning">{b.risk}</span>
              <span className="font-mono-label text-[9px] text-on-surface-variant">RISK</span>
            </div>
            <div className="flex flex-col">
              <span className="text-headline-sm font-bold text-error-strong">{String(b.fail).padStart(2, '0')}</span>
              <span className="font-mono-label text-[9px] text-on-surface-variant">FAIL</span>
            </div>
          </div>
        </div>
        <div className="col-span-2 glass-panel p-md flex flex-col justify-between rounded-lg">
          <span className="font-mono-label text-[10px] text-on-surface-variant uppercase mb-xs">Escalations</span>
          <div className="flex gap-md">
            {[1, 2, 3].map((lvl) => (
              <div key={lvl} className="flex flex-col">
                <span className={`text-headline-sm font-bold ${lvl === 3 && escalationLevels[3] > 0 ? 'text-error-strong' : ''}`}>
                  {String(escalationLevels[lvl as 1 | 2 | 3]).padStart(2, '0')}
                </span>
                <span className="font-mono-label text-[9px] text-on-surface-variant">L{lvl}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-md">
        {/* Main visuals */}
        <div className="col-span-12 lg:col-span-9 space-y-md">
          <div className="grid grid-cols-12 gap-md">
            <HeatmapCard grid={data.heatmap} />
            <DonutCard title="Priority Distribution" data={data.priorities} colors={PRIORITY_COLORS} ariaLabel="Priority distribution donut chart" />
          </div>
          <div className="grid grid-cols-12 gap-md">
            <div className="col-span-12 lg:col-span-8"><TrendCard trends={data.trends} /></div>
            <DonutCard title="Status Distribution" data={data.statuses} colors={STATUS_COLORS} ariaLabel="Status distribution donut chart" />
          </div>
        </div>

        {/* Recent activity */}
        <div className="col-span-12 lg:col-span-3">
          <div className="glass-panel h-full flex flex-col rounded-lg">
            <div className="p-md border-b border-outline-variant flex justify-between items-center">
              <h3 className="text-label-md font-semibold uppercase tracking-wider">Recent Activity</h3>
              <span className="material-symbols-outlined text-on-surface-variant text-sm" aria-hidden="true">history</span>
            </div>
            <div className="flex-1 divide-y divide-outline-variant/30 overflow-y-auto">
              {data.recent.map((inc) => (
                <Link key={inc.id} to={`/incidents/${inc.id}`} className="block p-md hover:bg-surface-variant transition-colors group">
                  <div className="flex justify-between mb-1">
                    <span className="font-mono-label text-[10px] text-primary font-bold">{inc.incidentNumber}</span>
                    <PriorityChip priority={inc.priority} />
                  </div>
                  <p className="text-body-sm text-on-surface leading-snug mb-2 line-clamp-2">{inc.title}</p>
                  <div className="flex justify-between items-center">
                    <span className="font-mono-label text-[9px] text-on-surface-variant uppercase">
                      <StatusText status={inc.status} /> • {timeAgo(inc.updatedAt)}
                    </span>
                    <span className="text-[18px] material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors" aria-hidden="true">
                      arrow_right_alt
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <Link
              to="/incidents"
              className="w-full p-md border-t border-outline-variant font-mono-label text-[10px] text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-all text-center"
            >
              VIEW ALL INCIDENTS
            </Link>
          </div>
        </div>
      </div>

      {/* Priority alert queue */}
      <div className="glass-panel rounded-lg">
        <div className="p-md border-b border-outline-variant flex justify-between items-center">
          <h3 className="text-label-md font-semibold uppercase tracking-wider">Priority Alert Queue</h3>
          <Link to="/incidents" className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-xs">
            <span className="text-[10px] uppercase font-semibold">View full queue</span>
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                {['ID', 'Priority', 'Incident Name', 'SLA Status', 'Assigned', 'Time Open'].map((h, i) => (
                  <th key={h} className={`font-mono-label text-[10px] text-on-surface-variant uppercase p-sm ${i === 5 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {data.queue.length === 0 && (
                <tr><td colSpan={6} className="p-md text-body-sm text-on-surface-variant text-center">No P1/P2 incidents in the queue — all clear.</td></tr>
              )}
              {data.queue.map((inc) => {
                const mins = minutesUntil(inc.slaDeadline)
                return (
                  <tr
                    key={inc.id}
                    onClick={() => navigate(`/incidents/${inc.id}`)}
                    className="hover:bg-surface-variant/50 transition-colors cursor-pointer"
                  >
                    <td className="font-mono-label text-body-sm font-bold p-sm">{inc.incidentNumber}</td>
                    <td className="p-sm"><PriorityChip priority={inc.priority} /></td>
                    <td className="text-body-sm p-sm">{inc.title}</td>
                    <td className="p-sm">
                      <div className="flex items-center gap-xs">
                        {inc.slaBreached || (mins !== null && mins < 0) ? (
                          <>
                            <span className="material-symbols-outlined text-error-strong text-[18px]" aria-hidden="true">warning</span>
                            <span className="text-body-sm text-error-strong">Breached</span>
                          </>
                        ) : mins !== null && mins <= 60 ? (
                          <>
                            <span className="material-symbols-outlined text-warning text-[18px]" aria-hidden="true">timer</span>
                            <span className="text-body-sm">{mins}m remaining</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-success text-[18px]" aria-hidden="true">check_circle</span>
                            <span className="text-body-sm">Compliant</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="text-body-sm p-sm">{inc.assignedToName ?? 'Unassigned'}</td>
                    <td className="font-mono-label text-body-sm text-right p-sm">{elapsed(inc.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
