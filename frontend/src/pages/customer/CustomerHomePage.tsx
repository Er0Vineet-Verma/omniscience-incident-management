import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { incidentApi } from '../../api'
import type { IncidentResponse, MySummary } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { StatusPill } from '../../components/customer/cxui'
import { timeAgo } from '../../lib/format'

/** Customer Home — "Omniscience Support" (docs/design/stitch/customer/screenshots/02). */
export default function CustomerHomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [summary, setSummary] = useState<MySummary | null>(null)
  const [recent, setRecent] = useState<IncidentResponse[]>([])
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    incidentApi.mySummary().then(setSummary).catch(() => setError(true))
    incidentApi.list({ size: 5, sort: 'updatedAt,desc' }).then((p) => setRecent(p.content)).catch(() => {})
  }, [])

  const firstName = user?.name?.split(' ')[0] ?? 'there'
  const active = (summary?.open ?? 0) + (summary?.inProgress ?? 0) + (summary?.pending ?? 0)

  const cards = [
    { label: 'Open Requests', value: summary?.open ?? 0, icon: 'inbox' },
    { label: 'In Progress', value: summary?.inProgress ?? 0, icon: 'autorenew' },
    { label: 'Resolved', value: summary?.resolved ?? 0, icon: 'task_alt' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="cx-display text-[32px] font-bold text-[#191c1e]">Welcome back, {firstName}</h1>
          <p className="text-[#444748] mt-1">Your support requests, all in one place.</p>
        </div>
        <button
          onClick={() => navigate('/portal/requests?new=1')}
          className="self-start inline-flex items-center gap-2 bg-black text-white text-sm font-semibold px-5 py-3 rounded-full hover:opacity-90 transition-opacity cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span> Create Support Request
        </button>
      </div>

      <div className="rounded-3xl border border-[#e1e2e4] bg-white p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[#f2f4f6] flex items-center justify-center mx-auto mb-3">
          <span className={`material-symbols-outlined ${active > 0 ? 'text-amber-500' : 'text-emerald-500'}`} style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
            {active > 0 ? 'pending_actions' : 'check_circle'}
          </span>
        </div>
        <p className="text-[#191c1e] font-medium">
          {error ? 'Welcome to your support portal.' : active > 0 ? `You have ${active} active request${active > 1 ? 's' : ''} in progress.` : 'All caught up — no open requests right now.'}
        </p>
        <p className="text-sm text-[#747878] mt-1">Our team typically responds within a few hours.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link key={c.label} to="/portal/requests" className="rounded-2xl border border-[#e1e2e4] bg-white p-5 hover:border-[#c4c7c7] transition-colors">
            <div className="flex items-center gap-2 text-[#747878] text-xs font-medium uppercase tracking-wide">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{c.icon}</span>{c.label}
            </div>
            <div className="cx-display text-[32px] font-bold text-[#191c1e] mt-2">{c.value}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <form
            onSubmit={(e) => { e.preventDefault(); navigate(`/portal/help${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`) }}
            className="relative"
          >
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#747878] text-[20px]" aria-hidden="true">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search help articles…"
              aria-label="Search help articles"
              className="w-full bg-white border border-[#e1e2e4] rounded-full py-3 pl-12 pr-4 text-sm text-[#191c1e] focus:outline-none focus:border-black transition-colors placeholder:text-[#747878]"
            />
          </form>
          <div className="rounded-2xl border border-[#e1e2e4] bg-white p-5">
            <h3 className="text-sm font-semibold text-[#191c1e] mb-3">Quick Resources</h3>
            <div className="space-y-1">
              {[['menu_book', 'Getting Started'], ['help', 'FAQ & Troubleshooting'], ['forum', 'Browse Help Center']].map(([icon, label]) => (
                <Link key={label} to="/portal/help" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-[#444748] hover:bg-[#f2f4f6] hover:text-[#191c1e] transition-colors">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{icon}</span>{label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e1e2e4] bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#191c1e]">Recent Updates</h3>
            <Link to="/portal/requests" className="text-xs text-[#444748] hover:text-black">View all</Link>
          </div>
          <div className="divide-y divide-[#eef0f2]">
            {recent.length === 0 && <p className="text-sm text-[#747878] py-2">No requests yet.</p>}
            {recent.map((r) => (
              <Link key={r.id} to={`/portal/requests/${r.id}`} className="flex items-center gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#747878]">{r.incidentNumber}</span>
                    <StatusPill status={r.status} />
                  </div>
                  <p className="text-sm text-[#191c1e] truncate mt-0.5">{r.title}</p>
                </div>
                <span className="text-xs text-[#747878] whitespace-nowrap">{timeAgo(r.updatedAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
