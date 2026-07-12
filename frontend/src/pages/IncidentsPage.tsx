import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { errorMessage, incidentApi, rcaApi, userApi } from '../api'
import type {
  IncidentResponse, IncidentStatus, Page, Priority, RcaResult, UserResponse,
} from '../api'
import { PrioritySeverity, StatusChip } from '../components/Chips'
import { useAuth } from '../context/AuthContext'
import { minutesUntil, timeAgo } from '../lib/format'

/** Stitch design: "Incident Inventory - Collapsible Navigation" (docs/design/stitch/html/02-incident-inventory.html). */

const PAGE_SIZE = 15

function slaCountdown(inc: IncidentResponse): string {
  if (inc.status === 'RESOLVED' || inc.status === 'CLOSED') return 'done'
  const mins = minutesUntil(inc.slaDeadline)
  if (mins === null) return '—'
  if (mins < 0 || inc.slaBreached) return 'EXPIRED'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

function slaProgress(inc: IncidentResponse): number {
  const start = new Date(inc.createdAt).getTime()
  const end = new Date(inc.slaDeadline).getTime()
  if (end <= start) return 100
  return Math.min(100, Math.max(0, Math.round(((Date.now() - start) / (end - start)) * 100)))
}

function CreateIncidentModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (inc: IncidentResponse) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('P3')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onCreated(await incidentApi.create({ title, description, priority }))
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-md" role="dialog" aria-modal="true" aria-label="Declare new incident">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true"></div>
      <form onSubmit={submit} className="relative glass-panel rounded-lg w-full max-w-[32rem] p-lg space-y-md" style={{ boxShadow: '0 0 32px rgba(0,0,0,0.4)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-headline-sm font-semibold flex items-center gap-sm">
            <span className="material-symbols-outlined text-error-strong" aria-hidden="true">emergency_home</span>
            Declare Incident
          </h3>
          <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface cursor-pointer" aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex flex-col gap-xs">
          <label htmlFor="inc-title" className="text-label-md text-on-surface-variant uppercase tracking-widest">Title</label>
          <input
            id="inc-title" required value={title} onChange={(e) => setTitle(e.target.value)}
            className="bg-background border border-outline-variant/50 p-sm rounded text-body-sm focus:outline-none focus:border-primary transition-colors"
            placeholder="Login failure on production"
          />
        </div>
        <div className="flex flex-col gap-xs">
          <label htmlFor="inc-desc" className="text-label-md text-on-surface-variant uppercase tracking-widest">Description</label>
          <textarea
            id="inc-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
            className="bg-background border border-outline-variant/50 p-sm rounded text-body-sm focus:outline-none focus:border-primary transition-colors resize-y"
            placeholder="What is broken, since when, and who is impacted?"
          />
        </div>
        <div className="flex flex-col gap-xs">
          <label htmlFor="inc-priority" className="text-label-md text-on-surface-variant uppercase tracking-widest">Priority</label>
          <select
            id="inc-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}
            className="bg-background border border-outline-variant/50 p-sm rounded text-body-sm focus:outline-none focus:border-primary transition-colors"
          >
            <option value="P1">P1 — Critical (4h SLA)</option>
            <option value="P2">P2 — High (8h SLA)</option>
            <option value="P3">P3 — Medium (24h SLA)</option>
            <option value="P4">P4 — Low (72h SLA)</option>
          </select>
        </div>
        {error && <p role="alert" className="text-error text-body-sm">{error}</p>}
        <div className="flex justify-end gap-sm pt-sm">
          <button type="button" onClick={onClose} className="px-lg py-sm border border-outline-variant rounded text-body-sm hover:border-outline transition-colors cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={busy || !title.trim()} className="px-lg py-sm bg-primary text-on-primary font-bold rounded text-body-sm hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? 'Creating…' : 'Create Incident'}
          </button>
        </div>
      </form>
    </div>
  )
}

function RcaPanel({ incident }: { incident: IncidentResponse | null }) {
  const navigate = useNavigate()
  const [rca, setRca] = useState<RcaResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!incident) { setRca(null); return }
    let cancelled = false
    setLoading(true)
    rcaApi.forIncident(incident.id)
      .then((r) => { if (!cancelled) setRca(r) })
      .catch(() => { if (!cancelled) setRca(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [incident])

  return (
    <div className="glass-panel rounded flex flex-col h-full sticky top-[80px]">
      <div className="p-lg border-b border-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary" aria-hidden="true">neurology</span>
          <h3 className="text-headline-sm font-semibold">RCA Preview</h3>
        </div>
        <span className="px-sm py-xs bg-primary-container text-on-primary rounded text-xs font-bold">RULE ENGINE</span>
      </div>

      <div className="p-lg space-y-xl overflow-y-auto flex-1">
        {!incident && (
          <p className="text-body-sm text-on-surface-variant">Select an incident row to run automatic root-cause analysis on its attached logs.</p>
        )}
        {incident && (
          <>
            <div className="space-y-sm">
              <span className="font-mono-label text-mono-label text-on-surface-variant uppercase tracking-widest">
                Active analysis for {incident.incidentNumber}
              </span>
              <p className="text-body-md leading-relaxed text-on-surface">{incident.title}</p>
              {rca && (
                <p className="text-body-sm text-on-surface-variant">
                  Scanned <code className="bg-surface-container-high px-1 rounded font-mono-label text-secondary">{rca.analyzedLogCount}</code> log
                  entries — {rca.errorCount} errors, {rca.warnCount} warnings.
                </p>
              )}
            </div>

            {loading && <div className="h-24 shimmer rounded" aria-busy="true" />}

            {!loading && rca && rca.findings.length === 0 && (
              <p className="text-body-sm text-on-surface-variant">
                No rule matched the attached logs. Upload logs to this incident to enable analysis.
              </p>
            )}

            {!loading && rca && rca.findings.map((f, i) => (
              <div key={f.rule} className={`p-md bg-surface-container-low border-l-4 rounded-r ${i === 0 ? 'border-error' : 'border-outline opacity-70'}`}>
                <div className="flex justify-between items-start mb-sm gap-sm">
                  <span className="text-body-md font-bold text-primary">{f.likelyRootCause}</span>
                  <span className={`font-mono-label text-mono-label font-bold whitespace-nowrap ${i === 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                    {f.matchCount} matches
                  </span>
                </div>
                <p className="text-body-sm text-on-surface-variant">Rule: {f.rule}</p>
                {f.suggestedActions.length > 0 && (
                  <ul className="mt-sm space-y-xs">
                    {f.suggestedActions.map((a) => (
                      <li key={a} className="flex items-center gap-xs text-body-sm text-on-surface">
                        <span className="material-symbols-outlined text-secondary text-[16px]" aria-hidden="true">bolt</span>
                        {a}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {!loading && rca && rca.kbMatches.length > 0 && (
              <div className="space-y-md">
                <span className="font-mono-label text-mono-label text-on-surface-variant uppercase tracking-widest">Knowledge Base Matches</span>
                <div className="flex flex-col gap-sm">
                  {rca.kbMatches.map((kb) => (
                    <button
                      key={kb.kbNumber}
                      onClick={() => navigate('/kb')}
                      className="flex items-center justify-between p-sm border border-outline-variant rounded hover:bg-surface-container-high transition-colors text-body-sm text-left cursor-pointer"
                    >
                      <span><span className="font-mono-label text-secondary">{kb.kbNumber}</span> — {kb.title}</span>
                      <span className="material-symbols-outlined text-secondary" aria-hidden="true">menu_book</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {incident && (
        <div className="mt-auto p-lg border-t border-outline-variant bg-surface-container-low">
          <button
            onClick={() => navigate(`/incidents/${incident.id}`)}
            className="w-full py-sm bg-primary text-on-primary font-bold rounded hover:opacity-90 transition-opacity flex items-center justify-center gap-sm cursor-pointer"
          >
            <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
            Open Incident Workbench
          </button>
        </div>
      )}
    </div>
  )
}

export default function IncidentsPage() {
  const { user, hasRole } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState<Page<IncidentResponse> | null>(null)
  const [analysts, setAnalysts] = useState<UserResponse[]>([])
  const [selected, setSelected] = useState<IncidentResponse | null>(null)
  const [showCreate, setShowCreate] = useState(params.get('declare') === '1')
  const isAnalyst = hasRole('ANALYST', 'ADMIN')

  const q = params.get('q') ?? ''
  const priority = params.get('priority') ?? ''
  const status = params.get('status') ?? ''
  const analystFilter = params.get('analyst') ?? ''
  const pageNo = Number(params.get('page') ?? '0')

  const setParam = useCallback((key: string, value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value); else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })
  }, [setParams])

  const load = useCallback(async () => {
    const data = await incidentApi.list({
      q: q || undefined,
      priority: (priority || undefined) as Priority | undefined,
      status: (status || undefined) as IncidentStatus | undefined,
      assignedToId: analystFilter && analystFilter !== 'unassigned' ? Number(analystFilter) : undefined,
      page: pageNo,
      size: PAGE_SIZE,
      sort: 'createdAt,desc',
    })
    const content = analystFilter === 'unassigned'
      ? data.content.filter((i) => i.assignedToId === null)
      : data.content
    setPage({ ...data, content })
    setSelected((sel) => sel && content.some((i) => i.id === sel.id) ? sel : content[0] ?? null)
  }, [q, priority, status, analystFilter, pageNo])

  useEffect(() => { load().catch(() => setPage(null)) }, [load])
  useEffect(() => {
    if (isAnalyst) userApi.analysts().then(setAnalysts).catch(() => {})
  }, [isAnalyst])

  // tick every second so SLA countdowns stay live
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const exportCsv = useCallback(() => {
    if (!page) return
    const head = ['Number', 'Title', 'Priority', 'Status', 'Assigned', 'Created', 'SLA Deadline', 'Breached']
    const rows = page.content.map((i) => [
      i.incidentNumber, `"${i.title.replaceAll('"', '""')}"`, i.priority, i.status,
      i.assignedToName ?? 'Unassigned', i.createdAt, i.slaDeadline, i.slaBreached,
    ])
    const csv = [head, ...rows].map((r) => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `incidents-page${pageNo + 1}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [page, pageNo])

  const total = page?.totalElements ?? 0
  const fromN = total === 0 ? 0 : pageNo * PAGE_SIZE + 1
  const toN = Math.min(total, (pageNo + 1) * PAGE_SIZE)

  const subtitle = useMemo(() => {
    if (!page) return 'Loading inventory…'
    const active = page.content.filter((i) => !['RESOLVED', 'CLOSED'].includes(i.status)).length
    return `Monitoring ${total} incidents (${active} active on this page) across the platform.`
  }, [page, total])

  return (
    <div className="p-xl space-y-xl">
      {/* Header actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-md">
        <div>
          <h2 className="text-headline-lg font-bold tracking-tight">Incident Inventory</h2>
          <p className="text-on-surface-variant text-body-md">{subtitle}</p>
        </div>
        <div className="flex gap-md w-full sm:w-auto">
          <button
            onClick={exportCsv}
            className="flex-1 sm:flex-none flex items-center justify-center gap-sm px-lg py-sm bg-surface-container-lowest border border-outline-variant rounded text-body-sm hover:border-outline transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">ios_share</span>
            Export CSV
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-sm px-lg py-sm bg-surface-container-high border border-white/10 rounded text-primary font-bold hover:bg-surface-bright transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
            New Incident
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-lg">
        {/* Table section */}
        <div className={`col-span-12 ${isAnalyst ? 'xl:col-span-8' : ''} space-y-lg`}>
          {/* Filters strip */}
          <div className="glass-panel p-md rounded flex flex-wrap gap-lg items-center">
            <div className="flex flex-wrap items-center gap-sm">
              <span className="font-mono-label text-mono-label text-on-surface-variant uppercase tracking-widest">Filter by:</span>
              <select
                value={priority} onChange={(e) => setParam('priority', e.target.value)} aria-label="Filter by priority"
                className="bg-surface-container-lowest border border-outline-variant text-body-sm py-xs px-sm rounded focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">All Priorities</option>
                <option value="P1">P1 — Critical</option>
                <option value="P2">P2 — High</option>
                <option value="P3">P3 — Medium</option>
                <option value="P4">P4 — Low</option>
              </select>
              <select
                value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Filter by status"
                className="bg-surface-container-lowest border border-outline-variant text-body-sm py-xs px-sm rounded focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">All Statuses</option>
                {(['OPEN', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED'] as const).map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
              {isAnalyst && (
                <select
                  value={analystFilter} onChange={(e) => setParam('analyst', e.target.value)} aria-label="Filter by analyst"
                  className="bg-surface-container-lowest border border-outline-variant text-body-sm py-xs px-sm rounded focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="">All Analysts</option>
                  {user?.role === 'ANALYST' && <option value={String(user.id)}>Me</option>}
                  <option value="unassigned">Unassigned</option>
                  {analysts.filter((a) => a.id !== user?.id).map((a) => (
                    <option key={a.id} value={String(a.id)}>{a.name}</option>
                  ))}
                </select>
              )}
              {q && (
                <button
                  onClick={() => setParam('q', '')}
                  className="flex items-center gap-xs px-sm py-xs bg-surface-container-high rounded text-body-sm cursor-pointer hover:bg-surface-bright transition-colors"
                  title="Clear search"
                >
                  “{q}” <span className="material-symbols-outlined text-[14px]" aria-hidden="true">close</span>
                </button>
              )}
            </div>
            <div className="ml-auto flex items-center gap-sm text-on-surface-variant font-mono-label text-mono-label">
              <span className="text-primary">{fromN}-{toN}</span> of {total}
              <div className="flex gap-xs ml-md">
                <button
                  disabled={pageNo === 0}
                  onClick={() => setParam('page', String(pageNo - 1))}
                  className="p-xs hover:text-primary transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button
                  disabled={!page || page.last}
                  onClick={() => setParam('page', String(pageNo + 1))}
                  className="p-xs hover:text-primary transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          </div>

          {/* Inventory table */}
          <div className="glass-panel rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    {['ID', 'Priority', 'Incident Title', 'Status', 'Analyst', 'SLA', 'Updated'].map((h) => (
                      <th key={h} className="px-md py-sm font-mono-label text-mono-label text-on-surface-variant uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {!page && (
                    <tr><td colSpan={7} className="p-lg"><div className="h-24 shimmer rounded" aria-busy="true" /></td></tr>
                  )}
                  {page?.content.length === 0 && (
                    <tr><td colSpan={7} className="p-lg text-center text-body-sm text-on-surface-variant">No incidents match the current filters.</td></tr>
                  )}
                  {page?.content.map((inc) => {
                    const countdown = slaCountdown(inc)
                    const pct = slaProgress(inc)
                    const isSel = selected?.id === inc.id
                    return (
                      <tr
                        key={inc.id}
                        onClick={() => setSelected(inc)}
                        onDoubleClick={() => navigate(`/incidents/${inc.id}`)}
                        className={`cursor-pointer transition-colors group ${isSel ? 'bg-surface-container-high/40' : 'hover:bg-surface-variant/30'}`}
                      >
                        <td className="px-md py-md font-mono-label text-body-sm">#{inc.incidentNumber}</td>
                        <td className="px-md py-md"><PrioritySeverity priority={inc.priority} /></td>
                        <td
                          className="px-md py-md text-body-md font-medium text-on-surface group-hover:text-primary"
                          onClick={(e) => { e.stopPropagation(); navigate(`/incidents/${inc.id}`) }}
                        >
                          {inc.title}
                        </td>
                        <td className="px-md py-md"><StatusChip status={inc.status} /></td>
                        <td className="px-md py-md text-body-sm text-on-surface-variant">{inc.assignedToName ?? 'Unassigned'}</td>
                        <td className="px-md py-md">
                          {countdown === 'done' ? (
                            <span className="material-symbols-outlined text-on-surface-variant" aria-label="SLA met" >check</span>
                          ) : (
                            <div className="flex flex-col gap-xs">
                              <span className={`font-mono-label text-mono-label font-bold ${countdown === 'EXPIRED' || pct > 80 ? 'text-error' : 'text-secondary'}`}>
                                {countdown}
                              </span>
                              <div className={`w-16 h-1 rounded-full overflow-hidden ${countdown === 'EXPIRED' ? 'bg-error/20' : 'bg-surface-container-high'}`}>
                                <div
                                  className={`h-full ${countdown === 'EXPIRED' || pct > 80 ? 'bg-error' : 'bg-secondary'}`}
                                  style={{ width: `${pct}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-md py-md font-mono-label text-mono-label text-on-surface-variant">{timeAgo(inc.updatedAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RCA side panel — analysts/admins only (endpoint is role-guarded) */}
        {isAnalyst && (
          <div className="col-span-12 xl:col-span-4">
            <RcaPanel incident={selected} />
          </div>
        )}
      </div>

      {showCreate && (
        <CreateIncidentModal
          onClose={() => { setShowCreate(false); setParam('declare', '') }}
          onCreated={(inc) => {
            setShowCreate(false)
            setParam('declare', '')
            load().then(() => setSelected(inc)).catch(() => {})
          }}
        />
      )}
    </div>
  )
}
