import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  dashboardApi, errorMessage, incidentApi, logApi, rcaApi,
} from '../api'
import type {
  IncidentResponse, LogLevel, LogResponse, LogStats, LogUploadResult, RcaResult,
} from '../api'
import { fmtDateTime } from '../lib/format'

/** Stitch design: "Log Analysis Center v4" (docs/design/stitch/html/04-log-analysis.html). */

const LEVELS: (LogLevel | '')[] = ['', 'FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG']
const LEVEL_CLS: Record<string, string> = {
  FATAL: 'text-error-strong', ERROR: 'text-error-strong', WARN: 'text-warning',
  INFO: 'text-info', DEBUG: 'text-on-surface-variant', TRACE: 'text-on-surface-variant',
}

function VolumeChart({ logs }: { logs: LogResponse[] }) {
  const buckets = useMemo(() => {
    if (logs.length === 0) return [] as { label: string; count: number }[]
    const times = logs.map((l) => new Date(l.timestamp).getTime())
    const min = Math.min(...times)
    const max = Math.max(...times)
    const span = Math.max(1, max - min)
    const n = 12
    const counts = Array(n).fill(0)
    for (const t of times) counts[Math.min(n - 1, Math.floor(((t - min) / span) * n))] += 1
    return counts.map((count, i) => ({
      label: new Date(min + (span / n) * i).toLocaleString(undefined, { month: 'short', day: 'numeric' }),
      count,
    }))
  }, [logs])
  const max = Math.max(1, ...buckets.map((b) => b.count))
  return (
    <div className="relative flex items-end justify-between h-32 gap-xs" role="img" aria-label="Log volume over time">
      {buckets.length === 0 && <p className="text-body-sm text-on-surface-variant m-auto">No log data in range.</p>}
      {buckets.map((b, i) => (
        <div
          key={i}
          title={`${b.label}: ${b.count} lines`}
          className={`flex-1 bg-info rounded-t-xs opacity-50 hover:opacity-90 transition-opacity ${b.count === max ? 'border-t-2 border-info' : ''}`}
          style={{ height: `${Math.max(4, (b.count / max) * 100)}%` }}
        ></div>
      ))}
    </div>
  )
}

function SeverityGrid({ stats }: { stats: LogStats | null }) {
  const tiles = useMemo(() => {
    if (!stats) return []
    const total = Math.max(1, stats.TOTAL)
    const mk = (lvl: LogLevel, cls: string) => ({
      cls,
      n: Math.round(((stats[lvl] ?? 0) / total) * 16),
      count: stats[lvl] ?? 0,
      lvl,
    })
    const groups = [
      mk('ERROR', 'bg-error-strong'), mk('FATAL', 'bg-error-strong'),
      mk('WARN', 'bg-warning'), mk('INFO', 'bg-info'), mk('DEBUG', 'bg-outline'),
    ]
    const out: { cls: string; opacity: number }[] = []
    for (const g of groups) for (let i = 0; i < g.n && out.length < 16; i++) out.push({ cls: g.cls, opacity: 0.25 + Math.random() * 0.55 })
    while (out.length < 16) out.push({ cls: 'bg-info', opacity: 0.08 })
    return out
  }, [stats])
  return (
    <>
      <div className="grid grid-cols-4 grid-rows-4 gap-sm flex-1" aria-hidden="true">
        {tiles.map((t, i) => (
          <div key={i} className={`${t.cls} rounded-xs`} style={{ opacity: t.opacity }}></div>
        ))}
      </div>
      <div className="mt-md flex justify-between font-mono-label text-mono-label text-on-surface-variant">
        <span>ERR {stats ? (stats.ERROR ?? 0) + (stats.FATAL ?? 0) : 0} · WARN {stats?.WARN ?? 0}</span>
        <span>INFO {stats?.INFO ?? 0} · TOTAL {stats?.TOTAL ?? 0}</span>
      </div>
    </>
  )
}

function UploadDialog({ incidents, onClose, onDone }: {
  incidents: IncidentResponse[]
  onClose: () => void
  onDone: (r: LogUploadResult) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [incidentId, setIncidentId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onDone(await logApi.upload(file, incidentId ? Number(incidentId) : undefined))
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-md" role="dialog" aria-modal="true" aria-label="Upload log file">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true"></div>
      <div className="relative glass-panel rounded-lg w-full max-w-[28rem] p-lg space-y-md">
        <div className="flex items-center justify-between">
          <h3 className="text-headline-sm font-semibold flex items-center gap-sm">
            <span className="material-symbols-outlined text-info" aria-hidden="true">upload_file</span>
            Log Upload
          </h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface cursor-pointer" aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <label className="block border border-dashed border-outline-variant rounded-lg p-lg text-center cursor-pointer hover:border-info transition-colors">
          <input
            type="file" accept=".log,.txt" className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <span className="material-symbols-outlined text-[32px] text-on-surface-variant" aria-hidden="true">draft</span>
          <p className="text-body-sm text-on-surface mt-sm">{file ? file.name : 'Click to choose a .log or .txt file (max 10 MB)'}</p>
        </label>
        <div className="flex flex-col gap-xs">
          <label htmlFor="upload-incident" className="text-label-md text-on-surface-variant uppercase tracking-widest">Attach to incident (optional)</label>
          <select
            id="upload-incident" value={incidentId} onChange={(e) => setIncidentId(e.target.value)}
            className="bg-background border border-outline-variant/50 p-sm rounded text-body-sm focus:outline-none focus:border-info cursor-pointer"
          >
            <option value="">— standalone upload —</option>
            {incidents.map((i) => (
              <option key={i.id} value={String(i.id)}>{i.incidentNumber} · {i.title.slice(0, 50)}</option>
            ))}
          </select>
        </div>
        {error && <p role="alert" className="text-error text-body-sm">{error}</p>}
        <div className="flex justify-end gap-sm">
          <button onClick={onClose} className="px-lg py-sm border border-outline-variant rounded text-body-sm hover:border-outline transition-colors cursor-pointer">Cancel</button>
          <button
            onClick={submit} disabled={!file || busy}
            className="px-lg py-sm bg-info text-black font-bold rounded text-body-sm hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Parsing…' : 'Upload & Parse'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LogsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [logs, setLogs] = useState<LogResponse[]>([])
  const [stats, setStats] = useState<LogStats | null>(null)
  const [incidents, setIncidents] = useState<IncidentResponse[]>([])
  const [activeIncidents, setActiveIncidents] = useState(0)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadResult, setUploadResult] = useState<LogUploadResult | null>(null)
  const [live, setLive] = useState(false)
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [regexMode, setRegexMode] = useState(false)
  const [drawer, setDrawer] = useState<{ line: LogResponse; rca: RcaResult | null } | null>(null)
  const terminalRef = useRef<HTMLDivElement>(null)

  const level = (params.get('level') ?? '') as LogLevel | ''
  const incidentId = params.get('incidentId')

  const load = useCallback(async () => {
    const [pg, st, sum] = await Promise.all([
      logApi.list({
        level: level || undefined,
        incidentId: incidentId ? Number(incidentId) : undefined,
        q: !regexMode && search.trim() ? search.trim() : undefined,
        size: 200,
      }),
      logApi.stats(),
      dashboardApi.summary().catch(() => null),
    ])
    setLogs(pg.content)
    setStats(st)
    if (sum) setActiveIncidents(sum.openIncidents + sum.inProgress)
  }, [level, incidentId, search, regexMode])

  useEffect(() => { load().catch(() => {}) }, [load])
  useEffect(() => {
    incidentApi.list({ size: 50, sort: 'createdAt,desc' }).then((p) => setIncidents(p.content)).catch(() => {})
  }, [])
  useEffect(() => {
    if (!live) return
    const t = setInterval(() => load().catch(() => {}), 5000)
    return () => clearInterval(t)
  }, [live, load])

  const visible = useMemo(() => {
    let list = logs
    if (regexMode && search.trim()) {
      try {
        const re = new RegExp(search.trim(), 'i')
        list = logs.filter((l) => re.test(l.message))
      } catch { /* invalid regex — show unfiltered until corrected */ }
    }
    return [...list].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }, [logs, regexMode, search])

  const errorRate = stats && stats.TOTAL > 0
    ? (((stats.ERROR ?? 0) + (stats.FATAL ?? 0)) / stats.TOTAL) * 100
    : 0

  const openDrawer = useCallback(async (line: LogResponse) => {
    setDrawer({ line, rca: null })
    try {
      const rca = line.incidentId
        ? await rcaApi.forIncident(line.incidentId)
        : await rcaApi.analyze(visible.map((l) => `${l.logLevel} ${l.message}`).slice(0, 200))
      setDrawer({ line, rca })
    } catch {
      setDrawer({ line, rca: null })
    }
  }, [visible])

  const exportLogs = useCallback(() => {
    const text = visible.map((l) => `${l.timestamp} ${l.logLevel} ${l.message}`).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    a.download = 'log-export.log'
    a.click()
    URL.revokeObjectURL(a.href)
  }, [visible])

  const setParam = (key: string, value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value); else next.delete(key)
      return next
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-lg">
      {/* Bento stats */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-lg mb-lg">
        <div className="md:col-span-8 bg-surface-container-low border border-white/5 rounded-lg p-lg relative overflow-hidden min-h-[240px]">
          <div className="flex justify-between items-start mb-md">
            <div>
              <h3 className="text-headline-sm font-medium text-on-surface">Log Volume Timeline</h3>
              <p className="text-on-surface-variant text-body-sm">Distribution of stored log entries over time</p>
            </div>
            {incidentId && (
              <Link to="/logs" className="px-md py-xs bg-surface-variant border border-outline-variant text-body-sm rounded-lg hover:border-info transition-colors">
                Clear incident filter
              </Link>
            )}
          </div>
          <VolumeChart logs={visible} />
        </div>
        <div className="md:col-span-4 bg-surface-container-low border border-white/5 rounded-lg p-lg min-h-[240px] flex flex-col">
          <h3 className="text-headline-sm font-medium text-on-surface mb-xs">Severity Distribution</h3>
          <p className="text-on-surface-variant text-body-sm mb-md">All stored events</p>
          <SeverityGrid stats={stats} />
        </div>
      </section>

      {/* Toolbar */}
      <section className="flex flex-wrap items-center justify-between gap-md mb-md">
        <div className="flex flex-wrap items-center gap-sm">
          <button
            onClick={() => setShowUpload(true)}
            className="bg-info text-black px-lg py-sm font-bold rounded-lg flex items-center gap-sm hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-info/10 cursor-pointer"
          >
            <span className="material-symbols-outlined" aria-hidden="true">upload_file</span>
            <span className="text-body-md">Log Upload</span>
          </button>
          <div className="h-8 w-px bg-outline-variant mx-sm" aria-hidden="true"></div>
          <div className="flex bg-surface-container-low border border-white/5 rounded-lg p-[2px]">
            {LEVELS.map((l) => (
              <button
                key={l || 'all'}
                onClick={() => setParam('level', l)}
                className={`px-md py-sm rounded text-body-sm transition-colors cursor-pointer ${level === l ? 'bg-surface-variant text-on-surface' : 'text-on-surface-variant hover:bg-surface-variant'}`}
              >
                {l === '' ? 'All' : l.charAt(0) + l.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-lg flex-wrap">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]" aria-hidden="true">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg pl-xl pr-md py-xs text-body-sm w-64 focus:outline-none focus:border-info transition-colors"
              placeholder={regexMode ? 'Regex: error_code:[4-5]\\d{2}' : 'Search log messages…'}
              aria-label="Search logs"
            />
          </div>
          <button
            onClick={() => setRegexMode((v) => !v)}
            className={`flex items-center gap-sm transition-colors cursor-pointer ${regexMode ? 'text-info' : 'text-on-surface-variant hover:text-on-surface'}`}
            title="Toggle client-side regex filtering"
          >
            <span className="material-symbols-outlined" aria-hidden="true">filter_list</span>
            <span className="text-body-sm">Regex {regexMode ? 'On' : 'Off'}</span>
          </button>
          <label className="flex items-center gap-sm cursor-pointer">
            <span className="text-body-sm text-on-surface-variant">Live Stream</span>
            <input
              type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)}
              className="w-10 h-5 appearance-none rounded-full bg-surface-container-highest border border-outline-variant relative cursor-pointer transition-colors checked:bg-info/40 before:content-[''] before:absolute before:top-[1px] before:left-[2px] before:w-4 before:h-4 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-[18px]"
            />
          </label>
        </div>
      </section>

      {/* Terminal stream */}
      <section className="bg-surface-container-low border border-white/5 rounded-lg overflow-hidden flex flex-col h-[500px]">
        <div className="bg-surface-container-high px-lg py-sm border-b border-outline-variant flex justify-between items-center">
          <div className="flex gap-md">
            <span className="flex items-center gap-xs font-mono-label text-mono-label text-on-surface-variant">
              <span className={`w-2 h-2 rounded-full ${live ? 'bg-info animate-pulse' : 'bg-outline'}`} aria-hidden="true"></span>
              {live ? 'STREAMING (5s poll)' : 'SNAPSHOT'} · {visible.length} LINES
            </span>
            {incidentId && <span className="font-mono-label text-mono-label text-on-surface-variant hidden sm:inline">FILTER: INCIDENT #{incidentId}</span>}
          </div>
          <div className="flex gap-md">
            <button onClick={exportLogs} title="Download visible logs" aria-label="Download logs" className="cursor-pointer">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-on-surface">download</span>
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(visible.map((l) => `${l.timestamp} ${l.logLevel} ${l.message}`).join('\n'))}
              title="Copy visible logs" aria-label="Copy logs" className="cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-on-surface">content_copy</span>
            </button>
          </div>
        </div>
        <div ref={terminalRef} className="flex-1 overflow-y-auto p-md font-mono text-body-sm leading-relaxed">
          {visible.length === 0 && (
            <p className="text-on-surface-variant p-md">No log entries match. Upload a .log/.txt file to get started.</p>
          )}
          {visible.map((l) => (
            <div
              key={l.id}
              onClick={() => openDrawer(l)}
              className={`grid grid-cols-[120px_60px_1fr] sm:grid-cols-[160px_80px_1fr] gap-md py-xs border-b border-white/5 cursor-pointer hover:bg-surface-variant/30 transition-colors ${l.logLevel === 'ERROR' || l.logLevel === 'FATAL' ? 'bg-error-strong/5' : ''}`}
            >
              <span className="text-on-surface-variant opacity-60 font-mono-label">{fmtDateTime(l.timestamp)}</span>
              <span className={`font-bold font-mono-label ${LEVEL_CLS[l.logLevel]}`}>[{l.logLevel}]</span>
              <span className="text-on-surface font-mono-label break-all">{l.message}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom summary */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-lg mt-lg">
        <div className="bg-surface-container-low border border-white/5 p-lg rounded-lg">
          <p className="text-on-surface-variant font-mono-label text-mono-label uppercase tracking-widest mb-xs">Active Incidents</p>
          <div className="flex items-baseline gap-md">
            <h4 className="text-headline-lg font-bold text-error-strong font-mono">{String(activeIncidents).padStart(2, '0')}</h4>
            <Link to="/incidents?status=OPEN" className="font-mono-label text-mono-label text-error-strong px-sm py-px bg-error-strong/10 rounded hover:bg-error-strong/20 transition-colors">View Queue</Link>
          </div>
        </div>
        <div className="bg-surface-container-low border border-white/5 p-lg rounded-lg">
          <p className="text-on-surface-variant font-mono-label text-mono-label uppercase tracking-widest mb-xs">Error Rate</p>
          <div className="flex items-baseline gap-md">
            <h4 className="text-headline-lg font-bold text-on-surface font-mono">{errorRate.toFixed(1)}%</h4>
            <span className="font-mono-label text-mono-label text-on-surface-variant">of stored lines</span>
          </div>
        </div>
        <div className="bg-surface-container-low border border-white/5 p-lg rounded-lg">
          <p className="text-on-surface-variant font-mono-label text-mono-label uppercase tracking-widest mb-xs">Lines Ingested</p>
          <div className="flex items-baseline gap-md">
            <h4 className="text-headline-lg font-bold text-on-surface font-mono">{stats?.TOTAL ?? 0}</h4>
            <span className="font-mono-label text-mono-label text-on-surface-variant">All time</span>
          </div>
        </div>
        <div className="bg-surface-container-low border border-white/5 p-lg rounded-lg">
          <p className="text-on-surface-variant font-mono-label text-mono-label uppercase tracking-widest mb-xs">Warnings</p>
          <div className="flex items-baseline gap-md">
            <h4 className="text-headline-lg font-bold text-warning font-mono">{stats?.WARN ?? 0}</h4>
            <span className="font-mono-label text-mono-label text-info px-sm py-px bg-info/10 rounded">Monitored</span>
          </div>
        </div>
      </section>

      {/* RCA drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-[400px] bg-surface-container-high border-l border-outline-variant z-50 shadow-2xl overflow-y-auto transition-transform duration-300 ${drawer ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!drawer}
      >
        {drawer && (
          <div className="p-lg">
            <div className="flex items-center justify-between mb-xl">
              <div className="flex items-center gap-sm">
                <span className="material-symbols-outlined text-info" aria-hidden="true">auto_awesome</span>
                <h2 className="text-headline-sm font-medium text-on-surface">RCA Preview</h2>
              </div>
              <button onClick={() => setDrawer(null)} className="p-1 hover:bg-surface-variant rounded-md transition-colors cursor-pointer" aria-label="Close drawer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-lg">
              <div className="bg-background rounded-lg border border-outline-variant p-md">
                <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mb-md">Engine Insights & Diagnosis</p>
                <div className="mb-lg">
                  <h3 className="text-body-sm text-on-surface-variant mb-xs">Potential Cause</h3>
                  <p className="text-headline-sm text-error-strong font-bold">
                    {drawer.rca?.findings[0]?.likelyRootCause ?? (drawer.rca ? 'No rule matched' : 'Analyzing…')}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-md">
                  <div className="bg-surface-container-low p-sm rounded border border-outline-variant/30">
                    <p className="text-on-surface-variant text-[10px] uppercase font-bold mb-xs">Matches</p>
                    <p className="text-body-lg font-mono text-info">{drawer.rca?.findings[0]?.matchCount ?? 0}</p>
                  </div>
                  <div className="bg-surface-container-low p-sm rounded border border-outline-variant/30">
                    <p className="text-on-surface-variant text-[10px] uppercase font-bold mb-xs">KB Match</p>
                    <p className="text-body-lg font-mono text-on-surface">{drawer.rca?.kbMatches[0]?.kbNumber ?? '—'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-md">
                <div className="flex items-center justify-between py-xs border-b border-outline-variant/20">
                  <span className="text-on-surface-variant text-body-sm">Selected Line</span>
                  <span className={`font-mono-label font-bold ${LEVEL_CLS[drawer.line.logLevel]}`}>[{drawer.line.logLevel}]</span>
                </div>
                <div className="flex items-center justify-between py-xs border-b border-outline-variant/20 gap-md">
                  <span className="text-on-surface-variant text-body-sm shrink-0">Source File</span>
                  <span className="text-on-surface font-mono-label truncate">{drawer.line.source}</span>
                </div>
                <div className="flex items-center justify-between py-xs border-b border-outline-variant/20">
                  <span className="text-on-surface-variant text-body-sm">Errors in scope</span>
                  <span className="text-on-surface font-mono font-bold bg-surface-variant px-sm rounded">{drawer.rca?.errorCount ?? 0}</span>
                </div>
              </div>

              {drawer.rca && drawer.rca.findings[0] && (
                <div>
                  <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mb-sm">Recommended Actions</p>
                  <div className="space-y-sm">
                    {drawer.rca.findings[0].suggestedActions.map((a) => (
                      <div key={a} className="w-full text-left p-sm bg-surface-variant border border-outline-variant rounded flex items-center justify-between">
                        <span className="text-body-sm">{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {drawer.line.incidentId && (
                <button
                  onClick={() => navigate(`/incidents/${drawer.line.incidentId}`)}
                  className="w-full mt-lg bg-info text-black font-bold py-md rounded-lg hover:brightness-110 transition-all flex items-center justify-center gap-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">description</span>
                  View Full Investigation
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showUpload && (
        <UploadDialog
          incidents={incidents}
          onClose={() => setShowUpload(false)}
          onDone={(r) => { setShowUpload(false); setUploadResult(r); load().catch(() => {}) }}
        />
      )}

      {uploadResult && (
        <div className="fixed bottom-lg left-1/2 -translate-x-1/2 z-50 glass-panel rounded-lg px-lg py-md flex items-center gap-lg shadow-2xl" role="status">
          <span className="material-symbols-outlined text-accent" aria-hidden="true">check_circle</span>
          <p className="text-body-sm">
            <span className="font-bold">{uploadResult.source}</span> parsed: {uploadResult.parsed}/{uploadResult.totalLines} lines —
            <span className="text-error-strong"> {uploadResult.errors} errors</span>,
            <span className="text-warning"> {uploadResult.warnings} warnings</span>,
            <span className="text-info"> {uploadResult.infos} info</span>
          </p>
          <button onClick={() => setUploadResult(null)} className="text-on-surface-variant hover:text-on-surface cursor-pointer" aria-label="Dismiss">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}
    </div>
  )
}
