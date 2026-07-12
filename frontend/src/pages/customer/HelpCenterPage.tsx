import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { kbApi } from '../../api'
import type { KbResponse } from '../../api'

const CATEGORIES = [
  { key: 'Getting', icon: 'rocket_launch', title: 'Getting Started', desc: 'Set up your account and basics' },
  { key: 'How', icon: 'menu_book', title: 'How-To Guides', desc: 'Step-by-step tutorials' },
  { key: 'FAQ', icon: 'quiz', title: 'FAQ', desc: 'Quick answers to common questions' },
  { key: 'Trouble', icon: 'build', title: 'Troubleshooting', desc: 'Fix common issues' },
]

/** Customer Help Center (docs/design/stitch/customer/screenshots/05) — feeds from GET /api/kb/help. */
export default function HelpCenterPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [articles, setArticles] = useState<KbResponse[]>([])
  const [q, setQ] = useState(params.get('q') ?? '')
  const [selected, setSelected] = useState<KbResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { kbApi.help().then(setArticles).catch(() => {}).finally(() => setLoading(false)) }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return articles
    return articles.filter((a) =>
      [a.title, a.issueDescription, a.resolution, a.keywords].filter(Boolean).some((f) => (f as string).toLowerCase().includes(s)),
    )
  }, [articles, q])

  return (
    <div className="space-y-10">
      <div className="text-center pt-4">
        <h1 className="cx-display text-[36px] font-bold text-[#191c1e]">How can we help?</h1>
        <p className="text-[#444748] mt-2">Find answers, guides, and solutions.</p>
        <div className="relative max-w-[36rem] mx-auto mt-6">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#747878] text-[22px]" aria-hidden="true">search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for articles, guides, or keywords…"
            aria-label="Search help articles"
            className="w-full bg-white border border-[#e1e2e4] rounded-full py-3.5 pl-12 pr-4 text-[#191c1e] focus:outline-none focus:border-black shadow-sm placeholder:text-[#747878]"
          />
        </div>
      </div>

      {!q && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => setQ(c.key)} className="text-left rounded-2xl border border-[#e1e2e4] bg-white p-5 hover:border-[#c4c7c7] hover:shadow-sm transition-all cursor-pointer">
              <span className="material-symbols-outlined text-[#191c1e] text-[24px]" aria-hidden="true">{c.icon}</span>
              <h3 className="font-semibold text-[#191c1e] mt-3">{c.title}</h3>
              <p className="text-sm text-[#444748] mt-1">{c.desc}</p>
            </button>
          ))}
        </div>
      )}

      <div>
        <h2 className="cx-display text-lg font-semibold text-[#191c1e] mb-3">{q ? `Results (${filtered.length})` : 'Popular Articles'}</h2>
        <div className="rounded-2xl border border-[#e1e2e4] bg-white divide-y divide-[#eef0f2]">
          {loading && <p className="p-5 text-sm text-[#747878]">Loading…</p>}
          {!loading && filtered.length === 0 && <p className="p-5 text-sm text-[#747878]">No articles found. Try a different search, or contact support below.</p>}
          {filtered.map((a) => (
            <button key={a.id} onClick={() => setSelected(a)} className="w-full text-left flex items-center gap-4 p-4 hover:bg-[#f8f9fb] transition-colors cursor-pointer group">
              <span className="material-symbols-outlined text-[#747878] text-[20px]" aria-hidden="true">article</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#191c1e]">{a.title}</p>
                <p className="text-sm text-[#444748] truncate">{a.issueDescription || a.resolution}</p>
              </div>
              <span className="material-symbols-outlined text-[#c4c7c7] group-hover:text-[#191c1e] transition-colors" aria-hidden="true">chevron_right</span>
            </button>
          ))}
        </div>
      </div>

      <div className="cx-obsidian rounded-3xl p-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-white">
        <div>
          <h3 className="cx-display text-xl font-semibold">Still need assistance?</h3>
          <p className="text-white/70 text-sm mt-1">Our support team is ready to help you resolve complex issues.</p>
        </div>
        <button onClick={() => navigate('/portal/requests?new=1')} className="inline-flex items-center gap-2 bg-white text-black text-sm font-semibold px-5 py-3 rounded-full hover:opacity-90 cursor-pointer whitespace-nowrap">
          Contact Support <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
        </button>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label={selected.title} onClick={() => setSelected(null)}>
          <div className="cx bg-white rounded-3xl w-full max-w-[40rem] max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <h2 className="cx-display text-xl font-bold text-[#191c1e]">{selected.title}</h2>
              <button onClick={() => setSelected(null)} aria-label="Close" className="text-[#747878] hover:text-black cursor-pointer"><span className="material-symbols-outlined" aria-hidden="true">close</span></button>
            </div>
            {selected.issueDescription && <p className="text-sm text-[#444748] mt-3">{selected.issueDescription}</p>}
            <div className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#747878] mb-1">Solution</h4>
              <p className="text-[#191c1e] whitespace-pre-wrap">{selected.resolution}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
