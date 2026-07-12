import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { incidentApi, attachmentApi, csatApi, errorMessage } from '../../api'
import type { AttachmentResponse, CommentResponse, CsatResponse, IncidentResponse } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { StatusPill, priorityLabel } from '../../components/customer/cxui'
import { fmtDateTime, timeAgo } from '../../lib/format'

const TIMELINE = ['Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed']

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

/** Customer Request Detail (docs/design/stitch/customer/screenshots/04). */
export default function RequestDetailPage() {
  const { id } = useParams()
  const reqId = Number(id)
  const { user } = useAuth()

  const [incident, setIncident] = useState<IncidentResponse | null>(null)
  const [comments, setComments] = useState<CommentResponse[]>([])
  const [attachments, setAttachments] = useState<AttachmentResponse[]>([])
  const [csat, setCsat] = useState<CsatResponse | null>(null)
  const [reply, setReply] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [ratingDraft, setRatingDraft] = useState(0)
  const [csatComment, setCsatComment] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const inc = await incidentApi.get(reqId)
      setIncident(inc)
      incidentApi.comments(reqId).then(setComments).catch(() => {})
      attachmentApi.list(reqId).then(setAttachments).catch(() => {})
      csatApi.get(reqId).then(setCsat).catch(() => {})
    } catch {
      setNotFound(true)
    }
  }, [reqId])

  useEffect(() => { load() }, [load])

  const currentStep = useMemo(() => {
    if (!incident) return 0
    const s = incident.status
    if (s === 'CLOSED') return 4
    if (s === 'RESOLVED') return 3
    if (s === 'IN_PROGRESS' || s === 'PENDING') return 2
    if (incident.assignedToId) return 1
    return 0
  }, [incident])

  const act = useCallback(async (fn: () => Promise<unknown>) => {
    setErr(null); setBusy(true)
    try { await fn(); await load() } catch (e) { setErr(errorMessage(e)) } finally { setBusy(false) }
  }, [load])

  async function sendReply(e: FormEvent) {
    e.preventDefault()
    if (!reply.trim() && !pendingFile) return
    setBusy(true); setErr(null)
    try {
      if (reply.trim()) {
        const c = await incidentApi.addComment(reqId, reply.trim())
        if (pendingFile) await attachmentApi.upload(reqId, pendingFile, c.id)
      } else if (pendingFile) {
        await attachmentApi.upload(reqId, pendingFile)
      }
      setReply(''); setPendingFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await load()
    } catch (e) { setErr(errorMessage(e)) } finally { setBusy(false) }
  }

  async function openAttachment(a: AttachmentResponse) {
    try {
      const blob = await attachmentApi.download(reqId, a.id)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) { setErr(errorMessage(e)) }
  }

  async function submitCsat() {
    if (ratingDraft < 1) return
    await act(() => csatApi.submit(reqId, { rating: ratingDraft, comment: csatComment.trim() || undefined }))
  }

  if (notFound) {
    return (
      <div className="text-center py-16">
        <p className="text-[#444748]">We couldn't find that request.</p>
        <Link to="/portal/requests" className="text-sm font-semibold text-black hover:underline mt-2 inline-block">Back to My Requests</Link>
      </div>
    )
  }
  if (!incident) return <p className="text-[#747878] text-sm">Loading…</p>

  const resolved = incident.status === 'RESOLVED'
  const closedOrResolved = resolved || incident.status === 'CLOSED'

  return (
    <div className="space-y-6">
      <Link to="/portal/requests" className="inline-flex items-center gap-1 text-sm text-[#444748] hover:text-black">
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span> My Requests
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <span className="font-mono text-xs text-[#747878]">{incident.incidentNumber}</span>
          <h1 className="cx-display text-[28px] font-bold text-[#191c1e]">{incident.title}</h1>
        </div>
        {resolved && (
          <div className="flex gap-2">
            <button onClick={() => act(() => incidentApi.reopen(reqId))} disabled={busy}
              className="px-4 py-2.5 rounded-full border border-[#e1e2e4] text-sm font-medium text-[#444748] hover:text-black hover:border-[#c4c7c7] transition-colors cursor-pointer disabled:opacity-50">
              Reopen
            </button>
            <button onClick={() => act(() => incidentApi.confirmClose(reqId))} disabled={busy}
              className="px-4 py-2.5 rounded-full bg-black text-white text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50">
              Confirm &amp; Close
            </button>
          </div>
        )}
      </div>

      {err && <p className="text-[#ba1a1a] text-sm bg-[#ffe0dd] rounded-xl px-4 py-2">{err}</p>}

      {/* Summary strip */}
      <div className="rounded-2xl border border-[#e1e2e4] bg-white p-5 grid grid-cols-2 md:grid-cols-5 gap-4">
        <Meta label="Status"><StatusPill status={incident.status} /></Meta>
        <Meta label="Priority"><span className="text-sm text-[#191c1e]">{priorityLabel(incident.priority)}</span></Meta>
        <Meta label="Created"><span className="text-sm text-[#191c1e]">{fmtDateTime(incident.createdAt).split(',')[0]}</span></Meta>
        <Meta label="Assigned Team"><span className="text-sm text-[#191c1e]">{incident.assignedToName ?? 'Support Team'}</span></Meta>
        <Meta label="Latest Update"><span className="text-sm text-[#191c1e]">{timeAgo(incident.updatedAt)}</span></Meta>
      </div>

      {/* Progress timeline */}
      <div className="rounded-2xl border border-[#e1e2e4] bg-white p-5">
        <div className="flex items-center justify-between">
          {TIMELINE.map((label, i) => (
            <div key={label} className="flex-1 flex flex-col items-center relative">
              {i > 0 && <span className={`absolute right-1/2 top-3 h-0.5 w-full ${i <= currentStep ? 'bg-black' : 'bg-[#e1e2e4]'}`} aria-hidden="true"></span>}
              <span className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[12px] ${i <= currentStep ? 'bg-black text-white' : 'bg-[#e7e8ea] text-[#747878]'}`}>
                {i < currentStep ? <span className="material-symbols-outlined text-[14px]" aria-hidden="true">check</span> : i + 1}
              </span>
              <span className={`mt-2 text-[11px] text-center ${i <= currentStep ? 'text-[#191c1e] font-medium' : 'text-[#747878]'}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation */}
        <div className="lg:col-span-2 rounded-2xl border border-[#e1e2e4] bg-white flex flex-col">
          <div className="p-4 border-b border-[#eef0f2]">
            <h3 className="font-semibold text-[#191c1e]">Conversation</h3>
          </div>
          <div className="p-4 space-y-4 max-h-[28rem] overflow-y-auto">
            {comments.length === 0 && <p className="text-sm text-[#747878]">No messages yet. Add a reply to start the conversation.</p>}
            {comments.map((c) => {
              const mine = c.authorEmail === user?.email
              return (
                <div key={c.id} className={`flex gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${mine ? 'bg-black text-white' : 'bg-[#d0e1fb] text-[#26425f]'}`}>{initials(c.authorName)}</div>
                  <div className={`max-w-[75%] ${mine ? 'items-end text-right' : ''} flex flex-col`}>
                    <div className={`rounded-2xl px-4 py-2.5 text-sm ${mine ? 'bg-[#191c1e] text-white rounded-tr-sm' : 'bg-[#f2f4f6] text-[#191c1e] rounded-tl-sm'}`}>
                      <p className="whitespace-pre-wrap">{c.body}</p>
                    </div>
                    <span className="text-[11px] text-[#747878] mt-1">{mine ? 'You' : c.authorName} · {timeAgo(c.createdAt)}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <form onSubmit={sendReply} className="p-3 border-t border-[#eef0f2] flex items-end gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach file"
              className="w-10 h-10 rounded-full hover:bg-[#f2f4f6] flex items-center justify-center text-[#747878] hover:text-black transition-colors cursor-pointer shrink-0">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">attach_file</span>
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)} />
            <div className="flex-1">
              {pendingFile && (
                <div className="flex items-center gap-1 text-xs text-[#444748] mb-1">
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">description</span>{pendingFile.name}
                  <button type="button" onClick={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = '' }} className="text-[#747878] hover:text-black cursor-pointer">✕</button>
                </div>
              )}
              <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply…" aria-label="Reply"
                className="w-full bg-[#f8f9fb] border border-[#e1e2e4] rounded-full px-4 py-2.5 text-sm text-[#191c1e] focus:outline-none focus:border-black" />
            </div>
            <button type="submit" disabled={busy || (!reply.trim() && !pendingFile)}
              className="inline-flex items-center gap-1 bg-black text-white text-sm font-semibold px-4 py-2.5 rounded-full hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer shrink-0">
              Send <span className="material-symbols-outlined text-[16px]" aria-hidden="true">send</span>
            </button>
          </form>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          {/* CSAT */}
          {closedOrResolved && (
            <div className="rounded-2xl border border-[#e1e2e4] bg-white p-5">
              <h3 className="font-semibold text-[#191c1e] mb-1">How did we do?</h3>
              {csat ? (
                <div className="text-sm text-[#444748]">
                  <div className="flex gap-0.5 my-1" aria-label={`You rated ${csat.rating} of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className="material-symbols-outlined text-[20px] text-amber-500" style={{ fontVariationSettings: n <= csat.rating ? "'FILL' 1" : "'FILL' 0" }} aria-hidden="true">star</span>
                    ))}
                  </div>
                  {csat.comment && <p className="italic">“{csat.comment}”</p>}
                  <p className="text-xs text-[#747878] mt-1">Thanks for your feedback!</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-[#444748] mb-2">Rate your support experience.</p>
                  <div className="flex gap-0.5 mb-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setRatingDraft(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`} className="cursor-pointer">
                        <span className="material-symbols-outlined text-[26px] text-amber-500" style={{ fontVariationSettings: n <= ratingDraft ? "'FILL' 1" : "'FILL' 0" }} aria-hidden="true">star</span>
                      </button>
                    ))}
                  </div>
                  <textarea value={csatComment} onChange={(e) => setCsatComment(e.target.value)} rows={2} placeholder="Optional comment…"
                    className="w-full bg-[#f8f9fb] border border-[#e1e2e4] rounded-xl px-3 py-2 text-sm text-[#191c1e] focus:outline-none focus:border-black resize-y" />
                  <button onClick={submitCsat} disabled={busy || ratingDraft < 1}
                    className="mt-2 w-full bg-black text-white text-sm font-semibold py-2.5 rounded-full hover:opacity-90 disabled:opacity-40 cursor-pointer">Submit rating</button>
                </div>
              )}
            </div>
          )}

          {/* Attachments */}
          <div className="rounded-2xl border border-[#e1e2e4] bg-white p-5">
            <h3 className="font-semibold text-[#191c1e] mb-2">Attachments</h3>
            {attachments.length === 0 ? (
              <p className="text-sm text-[#747878]">None yet. Use the clip icon in the reply box to add one.</p>
            ) : (
              <div className="space-y-1">
                {attachments.map((a) => (
                  <button key={a.id} onClick={() => openAttachment(a)} className="w-full text-left flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-[#f2f4f6] transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-[18px] text-[#747878]" aria-hidden="true">description</span>
                    <span className="text-sm text-[#191c1e] truncate flex-1">{a.filename}</span>
                    <span className="material-symbols-outlined text-[16px] text-[#747878]" aria-hidden="true">download</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Need more help */}
          <div className="rounded-2xl border border-[#e1e2e4] bg-white p-5">
            <h3 className="font-semibold text-[#191c1e] mb-2">Need more help?</h3>
            <Link to="/portal/help" className="flex items-center gap-2 text-sm text-[#444748] hover:text-black">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">menu_book</span> Browse the Help Center
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[#747878] mb-1">{label}</p>
      {children}
    </div>
  )
}
