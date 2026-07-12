import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi, infraApi, logApi } from '../api'
import type { InfraMetrics, LogResponse, LogStats, TrendPoint } from '../api'
import { fmtDateTime, timeAgo } from '../lib/format'

/** Stitch design: "Infrastructure System Health" (docs/design/stitch/html/06-infrastructure.html). */

function fmtUptime(s: number): string {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
}

const LOG_CLS: Record<string, string> = {
  ERROR: 'text-error-strong', FATAL: 'text-error-strong', WARN: 'text-warning',
  INFO: 'text-success', DEBUG: 'text-on-surface-variant', TRACE: 'text-on-surface-variant',
}

function Node({ icon, label, status }: { icon: string; label: string; status: 'ok' | 'warn' | 'down' }) {
  const ring = status === 'ok' ? 'border-primary/30' : status === 'warn' ? 'border-warning/50' : 'border-error-strong/60'
  const tone = status === 'ok' ? 'text-on-surface-variant' : status === 'warn' ? 'text-warning' : 'text-error-strong'
  return (
    <div className="flex flex-col items-center gap-sm z-10">
      <div className={`w-20 h-20 rounded-full border-2 ${ring} bg-surface-container flex items-center justify-center relative transition-all duration-500 hover:border-primary`}>
        <span className={`material-symbols-outlined ${status === 'ok' ? 'opacity-60' : tone}`} style={{ fontSize: 30 }} aria-hidden="true">{icon}</span>
        {status !== 'ok' && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4" aria-hidden="true">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status === 'warn' ? 'bg-warning' : 'bg-error-strong'}`}></span>
            <span className={`relative inline-flex rounded-full h-4 w-4 ${status === 'warn' ? 'bg-warning' : 'bg-error-strong'}`}></span>
          </span>
        )}
      </div>
      <span className={`font-mono-label text-mono-label uppercase tracking-widest ${tone}`}>{label}</span>
    </div>
  )
}

export default function InfraPage() {
  const [m, setM] = useState<InfraMetrics | null>(null)
  const [stats, setStats] = useState<LogStats | null>(null)
  const [recent, setRecent] = useState<LogResponse[]>([])
  const [trends, setTrends] = useState<TrendPoint[]>([])
  const [apiLatency, setApiLatency] = useState(0)
  const [down, setDown] = useState(false)

  const load = useCallback(async () => {
    try {
      const t0 = performance.now()
      const metrics = await infraApi.metrics()
      setApiLatency(Math.max(1, Math.round(performance.now() - t0)))
      setM(metrics)
      setDown(false)
      logApi.stats().then(setStats).catch(() => {})
      logApi.list({ size: 3 }).then((p) => setRecent(p.content)).catch(() => {})
      dashboardApi.trends(25).then(setTrends).catch(() => {})
    } catch {
      setDown(true)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [load])

  const heapPct = m ? Math.round((m.heapUsedMb / Math.max(1, m.heapMaxMb)) * 100) : 0
  const errorRate = stats && stats.TOTAL > 0 ? (((stats.ERROR ?? 0) + (stats.FATAL ?? 0)) / stats.TOTAL) * 100 : 0
  const dbWarn = m !== null && (m.dbStatus !== 'UP' || m.dbLatencyMs > 100)
  const heapWarn = heapPct > 85
  const degradations = (dbWarn ? 1 : 0) + (heapWarn ? 1 : 0)
  const maxTrend = Math.max(1, ...trends.map((t) => t.created))

  return (
    <div className="flex-1 overflow-y-auto p-lg relative">
      {/* Status chips */}
      <div className="flex items-center gap-md mb-lg flex-wrap">
        <span className="text-headline-sm font-bold tracking-tight text-on-surface">SYSTEM HEALTH</span>
        {down ? (
          <span className="inline-flex items-center gap-xs px-sm py-1 bg-error-strong/10 text-error-strong font-mono-label text-mono-label uppercase border border-error-strong/20 rounded-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-error-strong animate-pulse" aria-hidden="true"></span>
            Backend Unreachable
          </span>
        ) : (
          <>
            <span className="inline-flex items-center gap-xs px-sm py-1 bg-success/10 text-success font-mono-label text-mono-label uppercase border border-success/20 rounded-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden="true"></span>
              Operational
            </span>
            {degradations > 0 && (
              <span className="inline-flex items-center gap-xs px-sm py-1 bg-warning/10 text-warning font-mono-label text-mono-label uppercase border border-warning/20 rounded-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" aria-hidden="true"></span>
                {degradations} Degradation{degradations > 1 ? 's' : ''}
              </span>
            )}
          </>
        )}
        <span className="ml-auto font-mono-label text-mono-label text-on-surface-variant uppercase">
          {m ? `${m.osName} · Java ${m.javaVersion} · profile: ${m.dbProfile}` : ''}
        </span>
      </div>

      <div className="grid grid-cols-12 gap-lg max-w-[1600px] mx-auto">
        {/* Metric cards */}
        <section className="col-span-12 grid grid-cols-2 md:grid-cols-4 gap-md">
          <div className="glass-panel p-md flex flex-col gap-xs rounded-lg">
            <span className="text-label-md text-on-surface-variant uppercase tracking-widest opacity-60">Uptime</span>
            <div className="flex items-end gap-xs">
              <span className="text-headline-md font-semibold text-primary">{m ? fmtUptime(m.uptimeSeconds) : '—'}</span>
            </div>
            <div className="w-full bg-surface-container-highest h-1 mt-sm">
              <div className="bg-primary h-full w-full transition-all duration-1000"></div>
            </div>
          </div>
          <div className="glass-panel p-md flex flex-col gap-xs rounded-lg">
            <span className="text-label-md text-on-surface-variant uppercase tracking-widest opacity-60">DB Latency</span>
            <div className="flex items-end gap-xs">
              <span className={`text-headline-md font-semibold ${dbWarn ? 'text-warning' : 'text-primary'}`}>{m?.dbLatencyMs ?? '—'}</span>
              <span className="text-label-md text-on-surface-variant pb-1">ms</span>
            </div>
            <div className="w-full bg-surface-container-highest h-1 mt-sm overflow-hidden">
              <div className={`h-full transition-all duration-1000 ${dbWarn ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${Math.min(100, (m?.dbLatencyMs ?? 0) / 2)}%` }}></div>
            </div>
          </div>
          <div className="glass-panel p-md flex flex-col gap-xs rounded-lg">
            <span className="text-label-md text-on-surface-variant uppercase tracking-widest opacity-60">Log Error Rate</span>
            <div className="flex items-end gap-xs">
              <span className="text-headline-md font-semibold text-primary">{errorRate.toFixed(1)}</span>
              <span className="text-label-md text-on-surface-variant pb-1">%</span>
            </div>
            <div className="w-full bg-surface-container-highest h-1 mt-sm">
              <div className="bg-primary/40 h-full transition-all duration-1000" style={{ width: `${Math.min(100, errorRate)}%` }}></div>
            </div>
          </div>
          <div className="glass-panel p-md flex flex-col gap-xs rounded-lg">
            <span className="text-label-md text-on-surface-variant uppercase tracking-widest opacity-60">JVM Heap</span>
            <div className="flex items-end gap-xs">
              <span className={`text-headline-md font-semibold ${heapWarn ? 'text-warning' : 'text-primary'}`}>{heapPct}</span>
              <span className="text-label-md text-on-surface-variant pb-1">% of {m ? Math.round(m.heapMaxMb / 1024 * 10) / 10 : 0} GB</span>
            </div>
            <div className="w-full bg-surface-container-highest h-1 mt-sm">
              <div className={`h-full transition-all duration-1000 ${heapWarn ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${heapPct}%` }}></div>
            </div>
          </div>
        </section>

        {/* Dependency topology */}
        <section className="col-span-12 lg:col-span-8 glass-panel relative min-h-[420px] p-lg overflow-hidden rounded-lg">
          <div className="flex justify-between items-start mb-lg">
            <div>
              <h3 className="text-headline-sm font-medium text-on-surface">Dependency Topology</h3>
              <p className="text-body-sm text-on-surface-variant">Live service orchestration graph — polled every 10s</p>
            </div>
            <button
              onClick={load}
              className="w-8 h-8 flex items-center justify-center border border-white/10 hover:bg-surface-container-high transition-colors cursor-pointer rounded"
              title="Refresh metrics" aria-label="Refresh metrics"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            </button>
          </div>
          <div className="absolute inset-0 top-24 flex items-center justify-center gap-xl px-xl flex-wrap">
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" preserveAspectRatio="none" aria-hidden="true">
              <line x1="18%" y1="50%" x2="36%" y2="50%" stroke="white" strokeDasharray="4 4" strokeWidth="1" />
              <line x1="46%" y1="50%" x2="62%" y2="50%" stroke="white" strokeDasharray="4 4" strokeWidth="1" />
              <line x1="70%" y1="50%" x2="86%" y2="50%" stroke="white" strokeDasharray="4 4" strokeWidth="1" />
            </svg>
            <Node icon="web" label="React Frontend" status="ok" />
            <Node icon="hub" label="Spring Boot API" status={down ? 'down' : 'ok'} />
            <Node icon="lock" label="JWT Auth" status={down ? 'down' : 'ok'} />
            <Node icon="database" label={m ? `${m.dbProfile === 'dev' ? 'H2' : 'MySQL'} Database` : 'Database'} status={down || m?.dbStatus !== 'UP' ? 'down' : dbWarn ? 'warn' : 'ok'} />
          </div>
        </section>

        {/* Service status + recent logs */}
        <section className="col-span-12 lg:col-span-4 flex flex-col gap-md">
          <div className="glass-panel p-lg flex-1 rounded-lg">
            <div className="flex justify-between items-center mb-md">
              <h3 className="text-headline-sm font-medium text-on-surface">Service Status</h3>
              <span className="text-label-md text-on-surface-variant">4 Total</span>
            </div>
            <div className="space-y-xs">
              {[
                { name: 'REST API', sub: `localhost:8080 · ${m?.threadCount ?? '—'} threads`, ok: !down, latency: `${apiLatency}ms` },
                { name: m?.dbProfile === 'dev' ? 'H2 Database' : 'MySQL Database', sub: m?.dbStatus === 'UP' ? 'connection pool healthy' : 'connection failed', ok: m?.dbStatus === 'UP', warn: dbWarn, latency: `${m?.dbLatencyMs ?? '—'}ms` },
                { name: 'SLA Scheduler', sub: m?.slaLastSweepAt ? `last sweep ${timeAgo(m.slaLastSweepAt)} · ${m.slaLastSweepOverdue} overdue` : '60s cadence · awaiting first sweep', ok: m?.slaSchedulerEnabled ?? false, latency: m?.slaLastSweepAt ? timeAgo(m.slaLastSweepAt) : 'ENABLED' },
                { name: 'Log Parser', sub: `${stats?.TOTAL ?? 0} lines stored`, ok: true, latency: 'READY' },
              ].map((s) => (
                <div key={s.name} className={`flex items-center justify-between p-sm transition-colors border-b border-white/5 h-16 ${s.warn ? 'bg-warning/5' : ''}`}>
                  <div className="flex items-center gap-md">
                    <span className={`material-symbols-outlined ${s.ok ? (s.warn ? 'text-warning' : 'text-success') : 'text-error-strong'}`} aria-hidden="true">
                      {s.ok ? (s.warn ? 'warning' : 'check_circle') : 'error'}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-body-md text-on-surface">{s.name}</span>
                      <span className={`font-mono-label text-mono-label opacity-70 ${s.warn ? 'text-warning' : 'text-on-surface-variant'}`}>{s.sub}</span>
                    </div>
                  </div>
                  <span className={`font-mono-label text-mono-label ${s.warn ? 'text-warning' : 'text-on-surface-variant'}`}>{s.latency}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel p-lg rounded-lg">
            <div className="flex items-center justify-between mb-sm">
              <span className="text-label-md text-on-surface-variant uppercase tracking-widest opacity-60">Recent Logs</span>
              <Link to="/logs" aria-label="Open log analysis">
                <span className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors" style={{ fontSize: 16 }}>open_in_new</span>
              </Link>
            </div>
            <div className="space-y-xs font-mono-label text-mono-label">
              {recent.length === 0 && <p className="text-on-surface-variant">No logs stored.</p>}
              {recent.map((l) => (
                <div key={l.id} className={`flex gap-md ${l.logLevel === 'WARN' ? 'text-warning' : 'opacity-70'}`}>
                  <span className="text-on-surface-variant whitespace-nowrap">{fmtDateTime(l.timestamp).slice(-5)}</span>
                  <span className={`font-bold ${LOG_CLS[l.logLevel]}`}>[{l.logLevel}]</span>
                  <span className="truncate">{l.message}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Incident volume trend */}
        <section className="col-span-12 glass-panel p-lg rounded-lg mb-xl">
          <div className="flex justify-between items-center mb-lg">
            <h3 className="text-headline-sm font-medium text-on-surface">Incident Volume Trend</h3>
            <div className="flex gap-md text-on-surface-variant font-mono-label uppercase tracking-widest text-[10px]">
              <div className="flex items-center gap-xs"><span className="w-2 h-2 bg-primary" aria-hidden="true"></span> Created / day (last 25d)</div>
            </div>
          </div>
          <div className="h-32 w-full flex items-end gap-1">
            {trends.map((t) => (
              <div
                key={t.date}
                title={`${t.date}: ${t.created} created, ${t.resolved} resolved`}
                className="flex-1 bg-primary/20 transition-all duration-300 hover:bg-success cursor-pointer"
                style={{ height: `${Math.max(4, (t.created / maxTrend) * 100)}%` }}
              ></div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
