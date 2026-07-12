import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { kbApi, errorMessage } from '../api'
import type { KbResponse, KbRequest } from '../api'
import { useAuth } from '../context/AuthContext'
import { timeAgo, fmtDateTime } from '../lib/format'

/**
 * Stitch design: "Knowledge Intelligence Library" (docs/design/stitch/html/11-knowledge-base.html).
 * Real data from kbApi.list(); search + category chips filter client-side. Category chips are
 * derived from the articles' own keywords so they always reflect real content (no mocked taxonomy).
 * Admins can author/edit/delete articles (kbApi.create/update/remove).
 */

function keywordsOf(article: KbResponse): string[] {
  return (article.keywords ?? '')
    .split(/[,;]+|\s{2,}/)
    .map((k) => k.trim())
    .filter(Boolean)
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const EMPTY_FORM: KbRequest = { title: '', issueDescription: '', rootCause: '', resolution: '', keywords: '' }

export default function KnowledgeBasePage() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole('ADMIN')

  const [articles, setArticles] = useState<KbResponse[]>([])
  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [selected, setSelected] = useState<KbResponse | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  // Author/edit form ({ id: null } = create, { id } = edit).
  const [form, setForm] = useState<{ id: number | null; data: KbRequest } | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    return kbApi.list().then(setArticles).catch(() => setError(true)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { reload() }, [reload])

  // Distinct keywords across all articles, ranked by frequency, for the filter chips.
  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of articles) {
      for (const k of keywordsOf(a)) {
        const key = k.toLowerCase()
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k]) => k)
  }, [articles])

  const mostReferencedId = useMemo(() => {
    let top: KbResponse | null = null
    for (const a of articles) if (!top || a.timesUsed > top.timesUsed) top = a
    return top && top.timesUsed > 0 ? top.id : null
  }, [articles])

  const newestId = useMemo(() => {
    let top: KbResponse | null = null
    for (const a of articles) if (!top || a.createdAt > top.createdAt) top = a
    return top?.id ?? null
  }, [articles])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return articles.filter((a) => {
      if (activeCat && !keywordsOf(a).some((k) => k.toLowerCase() === activeCat)) return false
      if (!q) return true
      return [a.title, a.issueDescription, a.rootCause, a.resolution, a.keywords, a.kbNumber]
        .filter(Boolean)
        .some((f) => (f as string).toLowerCase().includes(q))
    })
  }, [articles, query, activeCat])

  function badge(a: KbResponse): { label: string; tone: string; icon: string } | null {
    if (a.id === mostReferencedId) return { label: 'Most Referenced', tone: 'text-on-surface-variant', icon: 'visibility' }
    if (a.id === newestId) return { label: 'Recently Added', tone: 'text-secondary', icon: 'fiber_new' }
    return null
  }

  // Open the detail modal, then refresh from the server for the latest version.
  function openDetail(a: KbResponse) {
    setSelected(a)
    kbApi.get(a.id).then(setSelected).catch(() => {})
  }

  function openCreate() {
    setFormError(null)
    setForm({ id: null, data: { ...EMPTY_FORM } })
  }

  function openEdit(a: KbResponse) {
    setFormError(null)
    setSelected(null)
    setForm({
      id: a.id,
      data: {
        title: a.title,
        issueDescription: a.issueDescription ?? '',
        rootCause: a.rootCause ?? '',
        resolution: a.resolution,
        keywords: a.keywords ?? '',
      },
    })
  }

  async function saveForm(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!form.data.title.trim() || !form.data.resolution.trim()) {
      setFormError('Title and resolution are required.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (form.id == null) await kbApi.create(form.data)
      else await kbApi.update(form.id, form.data)
      setForm(null)
      await reload()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function deleteArticle(a: KbResponse) {
    if (!window.confirm(`Delete ${a.kbNumber} "${a.title}"? This cannot be undone.`)) return
    try {
      await kbApi.remove(a.id)
      setSelected(null)
      await reload()
    } catch (err) {
      window.alert(errorMessage(err))
    }
  }

  return (
    <div className="p-lg space-y-lg">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h1 className="text-headline-lg font-semibold tracking-tight text-on-surface">Knowledge Intelligence Library</h1>
          <p className="text-body-md text-on-surface-variant max-w-3xl">
            Central repository of runbooks, incident resolutions, SOPs, root cause analyses, and operational knowledge.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center gap-xs px-md py-sm bg-primary text-on-primary text-label-md font-bold rounded hover:opacity-90 transition-all active:scale-95 cursor-pointer self-start"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">add</span>
            New Article
          </button>
        )}
      </div>

      {/* Search + category filters */}
      <section className="glass-panel rounded-lg p-lg flex flex-col gap-md">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[22px]" aria-hidden="true">search</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Query article titles, keywords, root causes, or resolutions…"
            aria-label="Search the knowledge base"
            className="w-full bg-surface-container-low border border-white/10 rounded py-3 pl-12 pr-4 text-body-md text-on-surface focus:outline-none focus:border-secondary transition-colors placeholder:text-on-surface-variant/60"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-sm">
            <button
              onClick={() => setActiveCat(null)}
              className={`px-md py-xs rounded border text-label-md transition-colors cursor-pointer ${activeCat === null ? 'bg-secondary-container/20 border-secondary text-secondary' : 'bg-surface-container-low border-white/10 text-on-surface-variant hover:text-on-surface'}`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCat(activeCat === c ? null : c)}
                className={`px-md py-xs rounded border text-label-md transition-colors cursor-pointer ${activeCat === c ? 'bg-secondary-container/20 border-secondary text-secondary' : 'bg-surface-container-low border-white/10 text-on-surface-variant hover:text-on-surface'}`}
              >
                {cap(c)}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* States */}
      {error && <p role="alert" className="text-error text-body-sm">Failed to load the knowledge base.</p>}
      {!error && loading && <p className="text-body-sm text-on-surface-variant">Loading articles…</p>}
      {!error && !loading && (
        <p className="text-[10px] font-mono-label text-on-surface-variant uppercase tracking-wider">
          {filtered.length} of {articles.length} articles
        </p>
      )}

      {/* Article cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-lg">
        {!loading && filtered.length === 0 && !error && (
          <p className="text-body-sm text-on-surface-variant col-span-full">No articles match your search.</p>
        )}
        {filtered.map((a) => {
          const b = badge(a)
          return (
            <button
              key={a.id}
              onClick={() => openDetail(a)}
              className="text-left glass-panel rounded-lg p-md flex flex-col justify-between group hover:border-primary/20 transition-all cursor-pointer min-h-[180px]"
            >
              <div>
                <div className="flex items-center justify-between mb-sm">
                  <span className={`font-mono-label text-[10px] uppercase tracking-wider ${b ? b.tone : 'text-on-surface-variant'}`}>
                    {b ? b.label : a.kbNumber}
                  </span>
                  <span className={`material-symbols-outlined text-[16px] ${b ? b.tone : 'text-outline-variant'}`} aria-hidden="true">
                    {b ? b.icon : 'menu_book'}
                  </span>
                </div>
                <h3 className="text-headline-sm text-on-surface mb-xs">{a.title}</h3>
                <p className="text-body-sm text-on-surface-variant line-clamp-2">
                  {a.issueDescription || a.resolution}
                </p>
              </div>
              <div className="mt-md flex items-center justify-between border-t border-white/5 pt-sm">
                <div className="flex items-center gap-lg">
                  <div>
                    <span className="block font-mono-label text-[10px] text-outline-variant uppercase">Uses</span>
                    <span className="text-label-md text-on-surface">{a.timesUsed}</span>
                  </div>
                  <div>
                    <span className="block font-mono-label text-[10px] text-outline-variant uppercase">Added</span>
                    <span className="text-label-md text-on-surface">{timeAgo(a.createdAt)}</span>
                  </div>
                  <div className="hidden sm:block">
                    <span className="block font-mono-label text-[10px] text-outline-variant uppercase">Author</span>
                    <span className="text-label-md text-on-surface">{a.createdBy}</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant group-hover:text-primary transition-colors" aria-hidden="true">arrow_forward</span>
              </div>
            </button>
          )
        })}
      </section>

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-md"
          role="dialog"
          aria-modal="true"
          aria-label={selected.title}
          onClick={() => setSelected(null)}
        >
          <div
            className="glass-panel rounded-lg w-full max-w-[42rem] max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-md px-lg py-md border-b border-white/5 sticky top-0 bg-surface-container-low/80 backdrop-blur-md">
              <div>
                <span className="font-mono-label text-[10px] text-on-surface-variant uppercase">{selected.kbNumber}</span>
                <h2 className="text-headline-sm text-on-surface">{selected.title}</h2>
              </div>
              <div className="flex items-center gap-xs shrink-0">
                {isAdmin && (
                  <>
                    <button
                      onClick={() => openEdit(selected)}
                      className="px-sm py-xs rounded border border-white/10 text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-primary hover:border-primary transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteArticle(selected)}
                      className="px-sm py-xs rounded border border-error/30 text-[10px] uppercase tracking-widest text-error hover:bg-error/10 transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                  className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
                </button>
              </div>
            </div>
            <div className="px-lg py-md space-y-md">
              {selected.issueDescription && <Field label="Issue" value={selected.issueDescription} />}
              {selected.rootCause && <Field label="Root Cause" value={selected.rootCause} />}
              <Field label="Resolution" value={selected.resolution} />
              {selected.keywords && (
                <div>
                  <h4 className="text-label-md uppercase tracking-wider text-on-surface-variant mb-xs">Keywords</h4>
                  <div className="flex flex-wrap gap-xs">
                    {keywordsOf(selected).map((k) => (
                      <span key={k} className="px-sm py-[2px] bg-surface-container-highest text-[10px] font-mono-label rounded-sm text-on-surface-variant">{k}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-lg pt-sm border-t border-white/5 text-body-sm text-on-surface-variant">
                <span>Author: <span className="text-on-surface">{selected.createdBy}</span></span>
                <span>Added: <span className="text-on-surface">{fmtDateTime(selected.createdAt)}</span></span>
                <span>Times used: <span className="text-on-surface">{selected.timesUsed}</span></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Author / edit form modal */}
      {form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-md"
          role="dialog"
          aria-modal="true"
          aria-label={form.id == null ? 'New article' : 'Edit article'}
          onClick={() => setForm(null)}
        >
          <form
            onSubmit={saveForm}
            className="glass-panel rounded-lg w-full max-w-[42rem] max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-lg py-md border-b border-white/5 sticky top-0 bg-surface-container-low/80 backdrop-blur-md">
              <h2 className="text-headline-sm text-on-surface">{form.id == null ? 'New Article' : 'Edit Article'}</h2>
              <button type="button" onClick={() => setForm(null)} aria-label="Close" className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
              </button>
            </div>
            <div className="px-lg py-md space-y-md">
              <FormField label="Title *">
                <input
                  type="text" value={form.data.title} required
                  onChange={(e) => setForm({ ...form, data: { ...form.data, title: e.target.value } })}
                  className="w-full bg-surface-container-low border border-white/10 rounded px-md py-sm text-body-sm text-on-surface focus:outline-none focus:border-secondary"
                />
              </FormField>
              <FormField label="Issue Description">
                <textarea
                  value={form.data.issueDescription} rows={2}
                  onChange={(e) => setForm({ ...form, data: { ...form.data, issueDescription: e.target.value } })}
                  className="w-full bg-surface-container-low border border-white/10 rounded px-md py-sm text-body-sm text-on-surface focus:outline-none focus:border-secondary resize-y"
                />
              </FormField>
              <FormField label="Root Cause">
                <textarea
                  value={form.data.rootCause} rows={2}
                  onChange={(e) => setForm({ ...form, data: { ...form.data, rootCause: e.target.value } })}
                  className="w-full bg-surface-container-low border border-white/10 rounded px-md py-sm text-body-sm text-on-surface focus:outline-none focus:border-secondary resize-y"
                />
              </FormField>
              <FormField label="Resolution *">
                <textarea
                  value={form.data.resolution} required rows={3}
                  onChange={(e) => setForm({ ...form, data: { ...form.data, resolution: e.target.value } })}
                  className="w-full bg-surface-container-low border border-white/10 rounded px-md py-sm text-body-sm text-on-surface focus:outline-none focus:border-secondary resize-y"
                />
              </FormField>
              <FormField label="Keywords (comma-separated)">
                <input
                  type="text" value={form.data.keywords}
                  placeholder="database, timeout, connection"
                  onChange={(e) => setForm({ ...form, data: { ...form.data, keywords: e.target.value } })}
                  className="w-full bg-surface-container-low border border-white/10 rounded px-md py-sm text-body-sm text-on-surface focus:outline-none focus:border-secondary placeholder:text-on-surface-variant/40"
                />
              </FormField>
              {formError && <p role="alert" className="text-error text-body-sm">{formError}</p>}
            </div>
            <div className="flex justify-end gap-sm px-lg py-md border-t border-white/5 sticky bottom-0 bg-surface-container-low/80 backdrop-blur-md">
              <button type="button" onClick={() => setForm(null)} className="px-md py-sm rounded border border-white/10 text-label-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-md py-sm rounded bg-primary text-on-primary text-label-md font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? 'Saving…' : form.id == null ? 'Create Article' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h4 className="text-label-md uppercase tracking-wider text-on-surface-variant mb-xs">{label}</h4>
      <p className="text-body-md text-on-surface whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-label-md uppercase tracking-wider text-on-surface-variant mb-xs block">{label}</span>
      {children}
    </label>
  )
}
