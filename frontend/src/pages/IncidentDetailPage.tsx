import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  auditApi, errorMessage, escalationApi, incidentApi, logApi, rcaApi,
} from '../api'
import type {
  AuditResponse, CommentResponse, EscalationResponse, IncidentResponse,
  IncidentUpdateRequest, LogResponse, Priority, RcaResult,
} from '../api'
import { useAuth } from '../context/AuthContext'
import { elapsed, fmtDateTime, minutesUntil, timeAgo } from '../lib/format'

/** Stitch design: "Incident Details & Intelligence" (docs/design/stitch/html/03-incident-details.html). */

type Tab = 'overview' | 'timeline' | 'evidence' | 'rca'

const AUDIT_ICON: Record<string, string> = {
  CREATED: 'add', ASSIGNED: 'person', STATUS_CHANGED: 'visibility', PRIORITY_CHANGED: 'low_priority',
  ESCALATED: 'priority_high', RESOLVED: 'check_circle', CLOSED: 'lock', UPDATED: 'edit',
  DELETED: 'delete', LOG_UPLOADED: 'upload_file',
}

const LOG_LEVEL_CLS: Record<string, string> = {
  ERROR: 'text-error-strong', FATAL: 'text-error-strong', WARN: 'text-warning',
  INFO: 'text-secondary', DEBUG: 'text-on-surface-variant', TRACE: 'text-on-surface-variant',
}

const ESCALATED_TO_LABEL: Record<string, string> = {
  TEAM_LEAD: 'Team Lead', MANAGER: 'Manager', CRITICAL_ALERT: 'Critical Alert',
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function LifecycleTimeline({ incident }: { incident: IncidentResponse }) {
  const steps = useMemo(() => {
    const done = (cond: boolean) => cond
    const list = [
      { label: 'Created', done: true },
      { label: 'Assigned', done: incident.assignedToId !== null },
      { label: 'Investigating', done: ['IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED'].includes(incident.status) },
    ]
    if (incident.escalationLevel >= 1) list.push({ label: 'Escalated L1', done: true })
    if (incident.escalationLevel >= 2) list.push({ label: 'Escalated L2', done: true })
    if (incident.escalationLevel >= 3) list.push({ label: 'Escalated L3', done: true })
    list.push({ label: 'Resolved', done: done(incident.resolvedAt !== null) })
    list.push({ label: 'Closed', done: done(incident.closedAt !== null) })
    return list
  }, [incident])

  const lastDone = steps.reduce((acc, s, i) => (s.done ? i : acc), 0)
  const progress = steps.length > 1 ? (lastDone / (steps.length - 1)) * 100 : 0

  return (
    <section className="px-xl py-lg border-b border-white/5 bg-surface-container-lowest">
      <div className="relative flex items-center justify-between max-w-[64rem] mx-auto">
        <div className="absolute left-0 top-2 w-full h-px bg-white/10" aria-hidden="true"></div>
        <div className="absolute left-0 top-2 h-px bg-primary" style={{ width: `${progress}%` }} aria-hidden="true"></div>
        {steps.map((s, i) => (
          <div key={s.label} className={`relative z-10 flex flex-col items-center gap-sm ${s.done ? '' : 'opacity-40'}`}>
            {s.done ? (
              <div className={`w-4 h-4 rounded-full bg-primary flex items-center justify-center ${i === lastDone && !incident.closedAt ? 'status-pulse' : ''}`}>
                <span className="material-symbols-outlined text-[10px] text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">check</span>
              </div>
            ) : (
              <div className="w-4 h-4 rounded-full bg-surface-container-highest border border-white/20"></div>
            )}
            <span className={`text-label-md ${s.done ? 'text-primary' : 'text-on-surface-variant'}`}>{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function IncidentDetailPage() {
  const { id } = useParams()
  const incidentId = Number(id)
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()
  const isAnalyst = hasRole('ANALYST', 'ADMIN')
  const isAdmin = hasRole('ADMIN')

  const [incident, setIncident] = useState<IncidentResponse | null>(null)
  const [audit, setAudit] = useState<AuditResponse[]>([])
  const [comments, setComments] = useState<CommentResponse[]>([])
  const [logs, setLogs] = useState<LogResponse[]>([])
  const [rca, setRca] = useState<RcaResult | null>(null)
  const [similar, setSimilar] = useState<IncidentResponse[]>([])
  const [escalations, setEscalations] = useState<EscalationResponse[]>([])
  const [tab, setTab] = useState<Tab>('overview')
  const [comment, setComment] = useState('')
  const [actionErr, setActionErr] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [editForm, setEditForm] = useState<{ title: string; description: string; priority: Priority; rootCause: string } | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const load = useCallback(async () => {
    try {
      const inc = await incidentApi.get(incidentId)
      setIncident(inc)
      const [cm, lg] = await Promise.all([
        incidentApi.comments(incidentId).catch(() => []),
        logApi.byIncident(incidentId).catch(() => []),
      ])
      setComments(cm)
      setLogs(lg)
      if (isAnalyst) {
        auditApi.byIncident(incidentId).then(setAudit).catch(() => {})
        rcaApi.forIncident(incidentId).then(setRca).catch(() => {})
        escalationApi.byIncident(incidentId).then(setEscalations).catch(() => {})
        const firstWord = inc.title.split(/\s+/).find((w) => w.length > 4) ?? inc.title
        incidentApi.search(firstWord)
          .then((res) => setSimilar(res.filter((r) => r.id !== inc.id).slice(0, 3)))
          .catch(() => {})
      }
    } catch {
      setNotFound(true)
    }
  }, [incidentId, isAnalyst])

  useEffect(() => { load() }, [load])

  const act = useCallback(async (fn: () => Promise<unknown>) => {
    setActionErr(null)
    try { await fn(); await load() } catch (e) { setActionErr(errorMessage(e)) }
  }, [load])

  async function postComment(e: FormEvent) {
    e.preventDefault()
    if (!comment.trim()) return
    await act(() => incidentApi.addComment(incidentId, comment.trim()))
    setComment('')
  }

  function openEdit() {
    if (!incident) return
    setActionErr(null)
    setEditForm({
      title: incident.title,
      description: incident.description ?? '',
      priority: incident.priority,
      rootCause: incident.rootCause ?? '',
    })
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editForm || !incident) return
    if (!editForm.title.trim()) { setActionErr('Title is required.'); return }
    setSavingEdit(true)
    setActionErr(null)
    try {
      const payload: IncidentUpdateRequest = {
        title: editForm.title.trim(),
        description: editForm.description,
        priority: editForm.priority,
        rootCause: editForm.rootCause,
      }
      await incidentApi.update(incident.id, payload)
      setEditForm(null)
      await load()
    } catch (err) {
      setActionErr(errorMessage(err))
    } finally {
      setSavingEdit(false)
    }
  }

  async function deleteIncident() {
    if (!incident) return
    if (!window.confirm(`Delete ${incident.incidentNumber}? This permanently removes the incident and its attached logs.`)) return
    setActionErr(null)
    try {
      await incidentApi.remove(incident.id)
      navigate('/incidents')
    } catch (err) {
      setActionErr(errorMessage(err))
    }
  }

  if (notFound) {
    return (
      <div className="p-xl">
        <p className="text-body-md text-on-surface-variant">Incident not found or not visible to your role.</p>
        <Link to="/incidents" className="text-primary text-body-sm hover:underline">Back to inventory</Link>
      </div>
    )
  }
  if (!incident) {
    return <div className="p-xl"><div className="h-40 shimmer rounded glass-panel" aria-busy="true" /></div>
  }

  const slaMins = minutesUntil(incident.slaDeadline)
  const slaActive = !incident.resolvedAt && !incident.closedAt
  const slaRiskLabel = !slaActive
    ? 'Met'
    : incident.slaBreached || (slaMins !== null && slaMins < 0)
      ? 'BREACHED'
      : slaMins !== null && slaMins <= 60 ? `High (${slaMins}m left)` : `Nominal (${Math.round((slaMins ?? 0) / 60)}h left)`
  const slaRiskCls = slaActive && (incident.slaBreached || (slaMins !== null && slaMins <= 60)) ? 'text-error' : 'text-on-surface'

  const canAssignToMe = isAnalyst && user && incident.assignedToId !== user.id && user.role === 'ANALYST'
  const topFinding = rca?.findings[0] ?? null

  return (
    <div className="flex flex-col flex-1">
      {/* Status ribbon */}
      <section className="glass-panel border-t-0 border-x-0 p-md flex flex-wrap items-center justify-between gap-md z-10">
        <div className="flex flex-wrap items-center gap-xl">
          <div>
            <div className="flex items-center gap-sm">
              <h1 className="text-headline-sm font-semibold text-on-surface">{incident.incidentNumber}</h1>
              <span className={`font-mono-label text-[10px] px-sm py-0.5 rounded-sm uppercase flex items-center gap-xs ${incident.priority === 'P1' ? 'bg-error-container text-on-error-container shadow-[0_0_8px_rgba(255,180,171,0.4)]' : 'bg-surface-container-highest text-on-surface'}`}>
                {incident.priority === 'P1' && <span className="w-1.5 h-1.5 bg-on-error-container rounded-full status-pulse" aria-hidden="true"></span>}
                {incident.priority} {incident.priority === 'P1' ? 'Critical' : incident.priority === 'P2' ? 'High' : incident.priority === 'P3' ? 'Medium' : 'Low'}
              </span>
            </div>
            <p className="text-on-surface-variant text-label-md mt-1">{incident.title}</p>
          </div>
          <div className="flex flex-wrap gap-xl border-l border-white/5 pl-xl">
            <div>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Status</p>
              <p className="text-label-md text-on-surface">
                {incident.status.replace('_', ' ')}{incident.escalationLevel > 0 ? `, Escalated L${incident.escalationLevel}` : ''}
              </p>
            </div>
            <div>
              <p className={`text-[10px] uppercase tracking-wider ${slaRiskCls === 'text-error' ? 'text-error' : 'text-on-surface-variant'}`}>SLA Risk</p>
              <p className={`text-label-md ${slaRiskCls}`}>{slaRiskLabel}</p>
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Created</p>
              <p className="text-label-md text-on-surface">{fmtDateTime(incident.createdAt)}</p>
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Owner</p>
              <p className="text-label-md text-on-surface">{incident.assignedToName ?? 'Unassigned'}</p>
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Time Open</p>
              <p className="text-label-md text-on-surface">{elapsed(incident.createdAt)}</p>
            </div>
          </div>
        </div>
        {isAnalyst && (
          <div className="flex items-center gap-sm">
            {canAssignToMe && (
              <button
                onClick={() => act(() => incidentApi.assign(incident.id, user.id))}
                className="bg-surface-container-high border border-white/10 px-md py-sm text-label-md hover:bg-surface-container-highest transition-colors cursor-pointer rounded"
              >
                Assign to Me
              </button>
            )}
            {incident.status === 'OPEN' && (
              <button
                onClick={() => act(() => incidentApi.setStatus(incident.id, 'IN_PROGRESS'))}
                className="bg-surface-container-high border border-white/10 px-md py-sm text-label-md hover:bg-surface-container-highest transition-colors cursor-pointer rounded"
              >
                Start Investigation
              </button>
            )}
            {slaActive && (
              <button
                onClick={() => {
                  const notes = window.prompt('Resolution notes:')
                  if (notes !== null) act(() => incidentApi.setStatus(incident.id, 'RESOLVED', notes || undefined))
                }}
                className="bg-primary text-on-primary px-md py-sm text-label-md font-bold hover:opacity-90 transition-opacity cursor-pointer rounded"
              >
                Resolve Incident
              </button>
            )}
            {incident.status === 'RESOLVED' && (
              <button
                onClick={() => act(() => incidentApi.close(incident.id))}
                className="bg-accent text-black px-md py-sm text-label-md font-bold hover:opacity-90 transition-opacity cursor-pointer rounded"
              >
                Close Incident
              </button>
            )}
            <button
              onClick={openEdit}
              className="bg-surface-container-high border border-white/10 px-md py-sm text-label-md hover:bg-surface-container-highest transition-colors cursor-pointer rounded"
            >
              Edit
            </button>
            {isAdmin && (
              <button
                onClick={deleteIncident}
                className="border border-error/30 text-error px-md py-sm text-label-md hover:bg-error/10 transition-colors cursor-pointer rounded"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </section>

      {actionErr && (
        <p role="alert" className="px-xl py-sm text-error text-body-sm bg-error-container/10 border-b border-error-container/30">{actionErr}</p>
      )}

      <LifecycleTimeline incident={incident} />

      <div className="flex flex-1 overflow-hidden flex-col xl:flex-row">
        {/* Tabs + content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex border-b border-white/5 px-xl bg-surface-container-low overflow-x-auto">
            {(['overview', 'timeline', 'evidence', 'rca'] as Tab[])
              .filter((t) => t !== 'rca' && t !== 'timeline' ? true : isAnalyst)
              .map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-md py-sm text-label-md capitalize transition-all cursor-pointer border-b-2 ${tab === t ? 'text-primary border-primary bg-surface-container-low' : 'text-on-surface-variant border-transparent hover:text-on-surface'}`}
                >
                  {t === 'rca' ? 'RCA' : t === 'timeline' ? 'Audit Timeline' : t}
                </button>
              ))}
          </div>

          <div className="flex-1 overflow-y-auto p-xl flex flex-col gap-lg">
            {tab === 'overview' && (
              <div className="glass-panel p-md rounded-lg space-y-md">
                <h3 className="text-label-md uppercase tracking-widest text-on-surface-variant">Description</h3>
                <p className="text-body-md text-on-surface whitespace-pre-wrap">{incident.description || 'No description provided.'}</p>
                {incident.rootCause && (
                  <>
                    <h3 className="text-label-md uppercase tracking-widest text-on-surface-variant pt-sm">Root Cause</h3>
                    <p className="text-body-md text-on-surface whitespace-pre-wrap">{incident.rootCause}</p>
                  </>
                )}
                {incident.resolutionNotes && (
                  <>
                    <h3 className="text-label-md uppercase tracking-widest text-on-surface-variant pt-sm">Resolution Notes</h3>
                    <p className="text-body-md text-on-surface whitespace-pre-wrap">{incident.resolutionNotes}</p>
                  </>
                )}
                <div className="flex gap-xl pt-sm text-body-sm text-on-surface-variant">
                  <span>Reported by <span className="text-on-surface">{incident.createdByName}</span></span>
                  {incident.resolvedAt && <span>Resolved {timeAgo(incident.resolvedAt)}</span>}
                  {incident.closedAt && <span>Closed {timeAgo(incident.closedAt)}</span>}
                </div>
              </div>
            )}

            {tab === 'timeline' && isAnalyst && (
              <div className="glass-panel p-md rounded-lg">
                <h3 className="text-label-md uppercase tracking-widest text-on-surface-variant mb-md">Audit Logs</h3>
                {audit.length === 0 && <p className="text-body-sm text-on-surface-variant">No audit entries.</p>}
                <div className="space-y-md relative before:absolute before:left-[11px] before:top-2 before:bottom-0 before:w-px before:bg-white/5">
                  {audit.map((a) => (
                    <div key={a.id} className="flex gap-md relative">
                      <div className="w-6 h-6 rounded-full bg-surface-container-high border border-white/10 flex items-center justify-center z-10 mt-1 shrink-0">
                        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{AUDIT_ICON[a.action] ?? 'circle'}</span>
                      </div>
                      <div>
                        <p className={`font-mono-label text-label-md ${a.action === 'ESCALATED' ? 'text-error' : 'text-on-surface'}`}>
                          {fmtDateTime(a.timestamp)} — {a.action.replace('_', ' ')}
                        </p>
                        <p className="text-body-sm text-on-surface-variant">
                          {a.fieldName ? `${a.fieldName}: ` : ''}
                          {a.oldValue ? `${a.oldValue} → ` : ''}{a.newValue ?? ''} · by {a.performedBy}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'evidence' && (
              <div className="glass-panel rounded-lg overflow-hidden">
                <div className="p-md border-b border-white/5 bg-surface-container-low flex justify-between items-center">
                  <h3 className="text-label-md uppercase tracking-widest text-on-surface-variant">Attached Logs ({logs.length})</h3>
                  {isAnalyst && (
                    <Link to={`/logs?incidentId=${incident.id}`} className="text-[10px] uppercase text-on-surface-variant hover:text-primary transition-colors">
                      Open in Log Analysis
                    </Link>
                  )}
                </div>
                {logs.length === 0 ? (
                  <p className="p-md text-body-sm text-on-surface-variant">No logs attached. Upload logs from the Log Analysis center with this incident selected.</p>
                ) : (
                  <div className="divide-y divide-white/5 max-h-[28rem] overflow-y-auto">
                    {logs.map((l) => (
                      <div key={l.id} className="px-md py-sm flex gap-md items-baseline hover:bg-surface-variant/30 transition-colors">
                        <span className="font-mono-label text-[10px] text-on-surface-variant whitespace-nowrap">{fmtDateTime(l.timestamp)}</span>
                        <span className={`font-mono-label text-[10px] font-bold w-12 ${LOG_LEVEL_CLS[l.logLevel]}`}>{l.logLevel}</span>
                        <span className="font-mono-label text-body-sm text-on-surface">{l.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'rca' && isAnalyst && (
              <div className="glass-panel p-md rounded-lg space-y-md">
                <h3 className="text-label-md uppercase tracking-widest text-on-surface-variant">Rule-Based Root Cause Analysis</h3>
                {!rca || rca.findings.length === 0 ? (
                  <p className="text-body-sm text-on-surface-variant">No findings — attach logs containing error patterns to enable analysis.</p>
                ) : rca.findings.map((f, i) => (
                  <div key={f.rule} className={`p-md bg-surface-container-low border-l-4 rounded-r ${i === 0 ? 'border-error' : 'border-outline opacity-70'}`}>
                    <div className="flex justify-between items-start mb-sm gap-md">
                      <span className="text-body-md font-bold text-primary">{f.likelyRootCause}</span>
                      <span className="font-mono-label text-label-md font-bold text-error whitespace-nowrap">{f.matchCount} matches</span>
                    </div>
                    <p className="text-body-sm text-on-surface-variant mb-sm">Rule: {f.rule}</p>
                    <ul className="space-y-xs">
                      {f.suggestedActions.map((aTxt) => (
                        <li key={aTxt} className="flex items-center gap-xs text-body-sm">
                          <span className="material-symbols-outlined text-primary text-[16px]" aria-hidden="true">bolt</span>{aTxt}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* Collaborative Intel — comments */}
            <div className="glass-panel rounded-lg flex flex-col">
              <div className="p-md border-b border-white/5 bg-surface-container-low flex justify-between items-center">
                <h3 className="text-label-md uppercase tracking-widest text-on-surface-variant">Collaborative Intel</h3>
                <span className="text-[10px] text-on-surface-variant">{comments.length} comment{comments.length === 1 ? '' : 's'}</span>
              </div>
              <div className="p-md space-y-md max-h-[24rem] overflow-y-auto">
                {comments.length === 0 && <p className="text-body-sm text-on-surface-variant">No comments yet — start the investigation thread.</p>}
                {comments.map((c) => (
                  <div key={c.id} className={`flex gap-md ${c.authorEmail === user?.email ? 'ml-xl' : ''}`}>
                    <div className="w-8 h-8 rounded bg-secondary-container flex items-center justify-center shrink-0">
                      <span className="text-on-secondary-container font-bold text-xs">{initials(c.authorName)}</span>
                    </div>
                    <div className={`bg-surface-container-high p-sm rounded-lg flex-1 ${c.authorEmail === user?.email ? 'border-l-2 border-primary/20' : ''}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-label-md text-on-surface font-semibold">{c.authorName}</span>
                        <span className="text-[10px] text-on-surface-variant">{timeAgo(c.createdAt)}</span>
                      </div>
                      <p className="text-body-sm text-on-surface-variant whitespace-pre-wrap">{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={postComment} className="p-md border-t border-white/5 flex gap-sm">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="flex-1 bg-surface-container-lowest border border-white/10 rounded px-md py-sm text-body-sm focus:border-primary focus:outline-none transition-colors"
                  placeholder="Add comment..."
                  aria-label="Add comment"
                />
                <button
                  type="submit"
                  disabled={!comment.trim()}
                  className="bg-surface-container-highest p-sm rounded border border-white/10 hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Post comment"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right rail: Incident Intelligence (analysts/admins) */}
        {isAnalyst && (
          <aside className="w-full xl:w-[360px] border-t xl:border-t-0 xl:border-l border-white/5 bg-surface overflow-y-auto flex flex-col shrink-0">
            <div className="p-md border-b border-white/5 bg-surface-container-low flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">psychology</span>
              <h2 className="text-label-md uppercase tracking-widest text-on-surface">Incident Intelligence</h2>
            </div>

            <div className="p-md border-b border-white/5 bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex justify-between items-start mb-sm">
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Engine Root Cause</p>
                {topFinding && (
                  <span className="text-[10px] font-mono-label text-primary bg-primary/10 px-sm py-0.5 rounded">{topFinding.matchCount} log matches</span>
                )}
              </div>
              <p className="text-headline-sm font-medium text-on-surface leading-tight">
                {topFinding?.likelyRootCause ?? incident.rootCause ?? 'No root cause identified yet'}
              </p>
              {topFinding && <p className="text-body-sm text-on-surface-variant mt-sm">Rule triggered: {topFinding.rule}</p>}
            </div>

            <div className="p-md border-b border-white/5">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-md">Telemetry Evidence</p>
              <div className="grid grid-cols-2 gap-sm">
                <div className="bg-surface-container-low p-sm rounded border border-white/5">
                  <p className="text-[10px] text-on-surface-variant uppercase">Matched Logs</p>
                  <p className="text-label-md text-on-surface">{rca?.analyzedLogCount ?? logs.length} Events</p>
                </div>
                <div className="bg-surface-container-low p-sm rounded border border-white/5">
                  <p className="text-[10px] text-on-surface-variant uppercase">Errors / Warnings</p>
                  <p className="text-label-md text-on-surface">{rca?.errorCount ?? 0} / {rca?.warnCount ?? 0}</p>
                </div>
                <Link to={`/logs?incidentId=${incident.id}`} className="col-span-2 bg-surface-container-low p-sm rounded border border-white/5 flex justify-between items-center hover:border-white/20 transition-colors">
                  <div>
                    <p className="text-[10px] text-on-surface-variant uppercase">Log Stream</p>
                    <p className="font-mono-label text-label-md text-error">{incident.incidentNumber}_EVIDENCE</p>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">open_in_new</span>
                </Link>
              </div>
            </div>

            {escalations.length > 0 && (
              <div className="p-md border-b border-white/5">
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-md">Escalation History</p>
                <div className="space-y-md">
                  {escalations.map((e) => (
                    <div key={e.id} className="flex gap-md items-start">
                      <div className="w-9 h-9 rounded bg-surface-container-high border border-white/10 flex items-center justify-center shrink-0">
                        <span className="font-mono-label text-[11px] text-primary">L{e.level}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-sm">
                          <span className="text-label-md text-on-surface">{ESCALATED_TO_LABEL[e.escalatedTo] ?? e.escalatedTo}</span>
                          <span className="font-mono-label text-[10px] text-on-surface-variant whitespace-nowrap">{timeAgo(e.escalatedAt)}</span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant">{e.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {similar.length > 0 && (
              <div className="p-md border-b border-white/5">
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-md">Historical Similarity</p>
                <div className="space-y-sm">
                  {similar.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setTab('overview'); navigate(`/incidents/${s.id}`) }}
                      className="w-full flex justify-between items-center p-sm rounded bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer group text-left"
                    >
                      <div>
                        <p className="text-label-md text-on-surface">{s.incidentNumber}</p>
                        <p className="text-[10px] text-on-surface-variant">
                          {s.resolvedAt ? `Resolved ${timeAgo(s.resolvedAt)}` : s.status.replace('_', ' ')}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono-label text-on-surface-variant group-hover:text-primary transition-colors">keyword match</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {topFinding && topFinding.suggestedActions.length > 0 && (
              <div className="p-md border-b border-white/5">
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-md">Recommended Remediation</p>
                <div className="space-y-xs">
                  {topFinding.suggestedActions.map((aTxt) => (
                    <div key={aTxt} className="w-full flex items-center gap-sm p-sm rounded bg-surface-container-highest border border-white/10">
                      <span className="material-symbols-outlined text-primary text-[18px]" aria-hidden="true">bolt</span>
                      <span className="text-label-md">{aTxt}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rca && rca.kbMatches.length > 0 && (
              <div className="p-md">
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-md">Reference Materials</p>
                {rca.kbMatches.map((kb) => (
                  <Link key={kb.kbNumber} to="/kb" className="block p-sm rounded bg-surface-container-low border border-white/5 hover:border-white/10 transition-colors mb-sm">
                    <div className="flex items-center gap-sm mb-xs">
                      <span className="material-symbols-outlined text-on-surface-variant text-[18px]" aria-hidden="true">book</span>
                      <span className="text-label-md text-on-surface">{kb.kbNumber} {kb.title}</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant line-clamp-2">{kb.resolution}</p>
                  </Link>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {editForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-md"
          role="dialog" aria-modal="true" aria-label="Edit incident"
          onClick={() => setEditForm(null)}
        >
          <form
            onSubmit={saveEdit}
            className="glass-panel rounded-lg w-full max-w-[40rem] max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-lg py-md border-b border-white/5 sticky top-0 bg-surface-container-low/80 backdrop-blur-md">
              <h2 className="text-headline-sm text-on-surface">Edit {incident.incidentNumber}</h2>
              <button type="button" onClick={() => setEditForm(null)} aria-label="Close" className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
              </button>
            </div>
            <div className="px-lg py-md space-y-md">
              <label className="block">
                <span className="text-label-md uppercase tracking-wider text-on-surface-variant mb-xs block">Title</span>
                <input type="text" value={editForm.title} required onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full bg-surface-container-low border border-white/10 rounded px-md py-sm text-body-sm text-on-surface focus:outline-none focus:border-primary" />
              </label>
              <label className="block">
                <span className="text-label-md uppercase tracking-wider text-on-surface-variant mb-xs block">Priority</span>
                <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as Priority })} className="w-full bg-surface-container-low border border-white/10 rounded px-md py-sm text-body-sm text-on-surface focus:outline-none focus:border-primary cursor-pointer">
                  <option value="P1">P1 — Critical</option>
                  <option value="P2">P2 — High</option>
                  <option value="P3">P3 — Medium</option>
                  <option value="P4">P4 — Low</option>
                </select>
              </label>
              <label className="block">
                <span className="text-label-md uppercase tracking-wider text-on-surface-variant mb-xs block">Description</span>
                <textarea value={editForm.description} rows={3} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full bg-surface-container-low border border-white/10 rounded px-md py-sm text-body-sm text-on-surface focus:outline-none focus:border-primary resize-y" />
              </label>
              <label className="block">
                <span className="text-label-md uppercase tracking-wider text-on-surface-variant mb-xs block">Root Cause</span>
                <textarea value={editForm.rootCause} rows={2} onChange={(e) => setEditForm({ ...editForm, rootCause: e.target.value })} className="w-full bg-surface-container-low border border-white/10 rounded px-md py-sm text-body-sm text-on-surface focus:outline-none focus:border-primary resize-y" />
              </label>
            </div>
            <div className="flex justify-end gap-sm px-lg py-md border-t border-white/5 sticky bottom-0 bg-surface-container-low/80 backdrop-blur-md">
              <button type="button" onClick={() => setEditForm(null)} className="px-md py-sm rounded border border-white/10 text-label-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">Cancel</button>
              <button type="submit" disabled={savingEdit} className="px-md py-sm rounded bg-primary text-on-primary text-label-md font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{savingEdit ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
