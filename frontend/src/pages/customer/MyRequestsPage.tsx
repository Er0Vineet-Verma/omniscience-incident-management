import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { incidentApi, errorMessage } from '../../api'
import type { IncidentResponse, IncidentStatus, Priority } from '../../api'
import { StatusPill, priorityLabel } from '../../components/customer/cxui'
import { timeAgo } from '../../lib/format'

const FILTERS: { key: string; label: string; match: (s: IncidentStatus) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'open', label: 'Open', match: (s) => s === 'OPEN' },
  { key: 'in_progress', label: 'In Progress', match: (s) => s === 'IN_PROGRESS' },
  { key: 'awaiting', label: 'Awaiting You', match: (s) => s === 'PENDING' },
  { key: 'resolved', label: 'Resolved', match: (s) => s === 'RESOLVED' || s === 'CLOSED' },
]

/** Customer "My Requests" (docs/design/stitch/customer/screenshots/03). */
export default function MyRequestsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [items, setItems] = useState<IncidentResponse[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [creating, setCreating] = useState(params.get('new') === '1')
  const [form, setForm] = useState({ title: '', description: '', priority: 'P3' as Priority })
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)

  useEffect(() => {
    incidentApi.list({ size: 50, sort: 'updatedAt,desc' })
      .then((p) => setItems(p.content)).catch(() => setError(true)).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!
    return items.filter((i) => f.match(i.status))
  }, [items, filter])

  const featured = useMemo(
    () => filtered.find((i) => (i.priority === 'P1' || i.status === 'PENDING') && i.status !== 'CLOSED' && i.status !== 'RESOLVED') ?? null,
    [filtered],
  )
  const rest = useMemo(() => filtered.filter((i) => i !== featured), [filtered, featured])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setFormErr('Please describe your issue in the title.'); return }
    setSaving(true); setFormErr(null)
    try {
      const created = await incidentApi.create({ title: form.title.trim(), description: form.description, priority: form.priority })
      setCreating(false)
      navigate(`/portal/requests/${created.id}`)
    } catch (err) { setFormErr(errorMessage(err)) } finally { setSaving(false) }
  }
  function openCreate() { setForm({ title: '', description: '', priority: 'P3' }); setFormErr(null); setCreating(true) }
  function closeCreate() { setCreating(false); if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }) } }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="cx-display text-[32px] font-bold text-[#191c1e]">My Requests</h1>
          <p className="text-[#444748] mt-1">Track and manage your support requests.</p>
        </div>
        <button onClick={openCreate} className="self-start inline-flex items-center gap-2 bg-black text-white text-sm font-semibold px-5 py-3 rounded-full hover:opacity-90 transition-opacity cursor-pointer">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span> Create Support Request
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${filter === f.key ? 'bg-black text-white border-black' : 'bg-white text-[#444748] border-[#e1e2e4] hover:border-[#c4c7c7]'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-[#ba1a1a] text-sm">Couldn't load your requests.</p>}
      {!error && loading && <p className="text-[#747878] text-sm">Loading…</p>}
      {!loading && filtered.length === 0 && !error && (
        <div className="rounded-2xl border border-dashed border-[#c4c7c7] bg-white p-10 text-center">
          <p className="text-[#444748]">No requests here yet.</p>
          <button onClick={openCreate} className="mt-3 text-sm font-semibold text-black hover:underline cursor-pointer">Create your first request →</button>
        </div>
      )}

      {featured && (
        <Link to={`/portal/requests/${featured.id}`} className="block cx-obsidian rounded-3xl p-6 text-white group">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-mono text-xs text-white/60">{featured.incidentNumber}</span>
            <StatusPill status={featured.status} />
            <span className="text-xs text-white/70">{priorityLabel(featured.priority)} priority</span>
          </div>
          <h3 className="cx-display text-xl font-semibold mb-1">{featured.title}</h3>
          <p className="text-sm text-white/70 line-clamp-2">{featured.description || 'Our team is on it.'}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-white/50">Updated {timeAgo(featured.updatedAt)}</span>
            <span className="inline-flex items-center gap-1 bg-white text-black text-sm font-semibold px-4 py-2 rounded-full group-hover:opacity-90">
              Respond Now <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
            </span>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rest.map((r) => (
          <Link key={r.id} to={`/portal/requests/${r.id}`} className="rounded-2xl border border-[#e1e2e4] bg-white p-5 hover:border-[#c4c7c7] hover:shadow-sm transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs text-[#747878]">{r.incidentNumber}</span>
              <StatusPill status={r.status} />
            </div>
            <h3 className="font-semibold text-[#191c1e] mb-1">{r.title}</h3>
            <p className="text-sm text-[#444748] line-clamp-2">{r.description || '—'}</p>
            <div className="mt-4 flex items-center justify-between text-xs text-[#747878]">
              <span>Updated {timeAgo(r.updatedAt)}</span>
              <span className="inline-flex items-center gap-1 text-[#191c1e] font-medium">View Details <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span></span>
            </div>
          </Link>
        ))}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Create support request" onClick={closeCreate}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="cx bg-white rounded-3xl w-full max-w-[34rem] p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="cx-display text-xl font-bold text-[#191c1e]">Create Support Request</h2>
              <button type="button" onClick={closeCreate} aria-label="Close" className="text-[#747878] hover:text-black cursor-pointer"><span className="material-symbols-outlined" aria-hidden="true">close</span></button>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-[#191c1e]">What do you need help with?</span>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Can't access my dashboard"
                className="mt-1 w-full bg-[#f8f9fb] border border-[#e1e2e4] rounded-xl px-4 py-3 text-sm text-[#191c1e] focus:outline-none focus:border-black" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[#191c1e]">Details</span>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Tell us what's happening…"
                className="mt-1 w-full bg-[#f8f9fb] border border-[#e1e2e4] rounded-xl px-4 py-3 text-sm text-[#191c1e] focus:outline-none focus:border-black resize-y" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[#191c1e]">Urgency</span>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
                className="mt-1 w-full bg-[#f8f9fb] border border-[#e1e2e4] rounded-xl px-4 py-3 text-sm text-[#191c1e] focus:outline-none focus:border-black cursor-pointer">
                <option value="P4">Low — general question</option>
                <option value="P3">Medium — affecting my work</option>
                <option value="P2">High — blocking me</option>
                <option value="P1">Critical — urgent outage</option>
              </select>
            </label>
            {formErr && <p className="text-[#ba1a1a] text-sm">{formErr}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={closeCreate} className="px-4 py-2.5 rounded-full border border-[#e1e2e4] text-sm font-medium text-[#444748] hover:text-black cursor-pointer">Cancel</button>
              <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-full bg-black text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer">{saving ? 'Submitting…' : 'Submit Request'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
