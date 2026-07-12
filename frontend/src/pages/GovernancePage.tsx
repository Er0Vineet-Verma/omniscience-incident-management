import { useEffect, useMemo, useState } from 'react'
import { slaApi, reportApi, dashboardApi, escalationApi, errorMessage } from '../api'
import type {
  SlaRuleResponse, SlaComplianceReport, SlaBuckets, EscalationResponse, AnalystReport, Priority,
} from '../api'
import { fmtHoursAsDuration } from '../lib/format'

/**
 * Stitch design: "Operational Governance Center" (docs/design/stitch/html/10-governance.html;
 * formerly "SLA Settings"). All numbers are real: SLA rules are editable via slaApi.updateRule,
 * per-priority compliance comes from the server SLA report, breaches from dashboard sla-buckets,
 * escalation counts from the escalation feed. The design's "Target Response" column is omitted —
 * the backend stores no response-time, and we don't surface mocked figures.
 */

const PRIORITY_LABEL: Record<Priority, string> = { P1: 'P1 Critical', P2: 'P2 High', P3: 'P3 Medium', P4: 'P4 Low' }
const PRIORITY_CHIP: Record<Priority, string> = {
  P1: 'bg-error/10 border-error/20 text-error',
  P2: 'bg-primary/10 border-primary/20 text-primary',
  P3: 'bg-secondary/10 border-secondary/20 text-secondary',
  P4: 'bg-surface-variant/50 border-outline-variant text-on-surface-variant',
}
const PRIORITY_ORDER: Priority[] = ['P1', 'P2', 'P3', 'P4']

export default function GovernancePage() {
  const [rules, setRules] = useState<SlaRuleResponse[]>([])
  const [sla, setSla] = useState<SlaComplianceReport | null>(null)
  const [buckets, setBuckets] = useState<SlaBuckets | null>(null)
  const [escalations, setEscalations] = useState<EscalationResponse[]>([])
  const [analysts, setAnalysts] = useState<AnalystReport[]>([])
  const [drafts, setDrafts] = useState<Record<number, number>>({})
  const [savingId, setSavingId] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    Promise.all([
      slaApi.rules(),
      reportApi.slaCompliance(),
      dashboardApi.slaBuckets(),
      escalationApi.list().catch(() => [] as EscalationResponse[]),
      reportApi.analysts().catch(() => [] as AnalystReport[]),
    ])
      .then(([r, s, b, e, a]) => { setRules(r); setSla(s); setBuckets(b); setEscalations(e); setAnalysts(a) })
      .catch(() => setError(true))
  }, [])

  const complianceByPriority = useMemo(() => {
    const map = new Map<Priority, number>()
    sla?.byPriority.forEach((row) => map.set(row.priority, row.compliancePercent))
    return map
  }, [sla])

  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)),
    [rules],
  )

  const escalated24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return escalations.filter((e) => new Date(e.escalatedAt).getTime() >= cutoff).length
  }, [escalations])

  const escalationByLevel = useMemo(() => {
    const count = (to: EscalationResponse['escalatedTo']) => escalations.filter((e) => e.escalatedTo === to).length
    return { teamLead: count('TEAM_LEAD'), manager: count('MANAGER'), critical: count('CRITICAL_ALERT') }
  }, [escalations])

  const avgResolution = useMemo(() => {
    const resolved = analysts.reduce((n, a) => n + a.resolvedTotal, 0)
    if (resolved === 0) return 0
    return analysts.reduce((n, a) => n + a.avgResolutionHours * a.resolvedTotal, 0) / resolved
  }, [analysts])

  async function saveRule(rule: SlaRuleResponse) {
    const next = drafts[rule.id]
    if (next == null || next === rule.resolutionTimeHours || next <= 0) return
    setSavingId(rule.id)
    setNotice(null)
    try {
      const updated = await slaApi.updateRule(rule.id, next)
      setRules((rs) => rs.map((r) => (r.id === updated.id ? updated : r)))
      setDrafts((d) => { const rest = { ...d }; delete rest[rule.id]; return rest })
      setNotice(`${PRIORITY_LABEL[rule.priority]} target updated to ${updated.resolutionTimeHours}h.`)
    } catch (err) {
      setNotice(errorMessage(err))
    } finally {
      setSavingId(null)
    }
  }

  const complianceTone = (p: number | undefined) =>
    p == null ? 'text-on-surface-variant' : p >= 99 ? 'text-primary' : p >= 95 ? 'text-secondary' : 'text-error'

  if (error) {
    return <div className="p-lg"><p role="alert" className="text-error text-body-sm">Failed to load governance data — admin role required.</p></div>
  }

  return (
    <div className="p-lg space-y-lg">
      {/* Header */}
      <div>
        <h1 className="text-headline-lg font-semibold tracking-tight text-on-surface">Operational Governance Center</h1>
        <p className="text-body-md text-on-surface-variant max-w-3xl">
          Manage SLA policies, escalation strategies, compliance targets, and operational service governance.
        </p>
      </div>

      {/* KPI row */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-md">
        <Kpi icon="verified" label="SLA Compliance" value={sla ? `${sla.compliancePercent.toFixed(1)}%` : '—'} />
        <Kpi icon="policy" label="Active Policies" value={rules.length} />
        <Kpi icon="warning" label="Current Breaches" value={buckets?.fail ?? '—'} tone="error" />
        <Kpi icon="trending_up" label="Escalated (24h)" value={escalated24h} />
        <Kpi icon="timer" label="Avg Resolution" value={fmtHoursAsDuration(avgResolution)} />
        <Kpi icon="task_alt" label="Resolved In SLA" value={sla?.resolvedWithinSla ?? '—'} />
      </section>

      {notice && (
        <p className="text-body-sm text-secondary glass-panel rounded px-md py-sm" role="status">{notice}</p>
      )}

      {/* Main bento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* SLA policy definitions (editable) */}
        <section className="lg:col-span-2 glass-panel rounded-lg overflow-hidden flex flex-col">
          <div className="px-lg py-md border-b border-white/5 flex items-center justify-between bg-surface-container-low/50">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">rule</span>
              <h3 className="text-label-md uppercase tracking-widest text-on-surface">SLA Policy Definitions</h3>
            </div>
            <span className="px-xs py-[2px] bg-white/10 text-[10px] font-mono-label rounded-sm">EDITABLE</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="text-on-surface-variant/60 text-[10px] uppercase tracking-wider border-b border-white/5">
                  <th className="px-lg py-md font-medium">Priority</th>
                  <th className="px-lg py-md font-medium">Target Resolution (hours)</th>
                  <th className="px-lg py-md font-medium">Escalation Path</th>
                  <th className="px-lg py-md font-medium text-right">Compliance</th>
                  <th className="px-lg py-md font-medium"><span className="sr-only">Save</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedRules.map((rule) => {
                  const draft = drafts[rule.id]
                  const value = draft ?? rule.resolutionTimeHours
                  const dirty = draft != null && draft !== rule.resolutionTimeHours && draft > 0
                  const pct = complianceByPriority.get(rule.priority)
                  return (
                    <tr key={rule.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-lg py-md">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest border inline-flex items-center ${PRIORITY_CHIP[rule.priority]}`}>
                          {PRIORITY_LABEL[rule.priority]}
                        </span>
                      </td>
                      <td className="px-lg py-md">
                        <div className="flex items-center gap-xs">
                          <input
                            type="number"
                            min={1}
                            value={value}
                            aria-label={`Target resolution hours for ${PRIORITY_LABEL[rule.priority]}`}
                            onChange={(e) => setDrafts((d) => ({ ...d, [rule.id]: Number(e.target.value) }))}
                            className="w-20 bg-surface-container-low border border-white/10 rounded px-sm py-xs text-body-sm font-mono-label text-on-surface focus:outline-none focus:border-secondary"
                          />
                          <span className="text-on-surface-variant text-body-sm">h</span>
                        </div>
                      </td>
                      <td className="px-lg py-md font-mono-label text-body-sm text-on-surface-variant">L1 → L2 → L3</td>
                      <td className="px-lg py-md text-right">
                        <div className="flex flex-col items-end gap-xs">
                          <span className={`text-body-sm font-semibold ${complianceTone(pct)}`}>
                            {pct == null ? 'n/a' : `${pct.toFixed(1)}%`}
                          </span>
                          <div className="w-24 h-1 bg-surface-container-highest">
                            <div className={`h-full ${pct != null && pct >= 95 ? 'bg-primary' : 'bg-error'}`} style={{ width: `${pct ?? 0}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-lg py-md text-right">
                        <button
                          onClick={() => saveRule(rule)}
                          disabled={!dirty || savingId === rule.id}
                          className="text-[10px] uppercase tracking-widest px-sm py-xs rounded border border-white/10 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:border-primary enabled:hover:text-primary text-on-surface-variant"
                        >
                          {savingId === rule.id ? 'Saving…' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Escalation path */}
        <section className="glass-panel rounded-lg p-lg">
          <div className="flex items-center gap-sm mb-lg">
            <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">account_tree</span>
            <h3 className="text-label-md uppercase tracking-widest text-on-surface">Escalation Path</h3>
          </div>
          <div className="relative flex flex-col gap-md">
            <div className="absolute left-6 top-6 bottom-6 w-px bg-outline-variant z-0" aria-hidden="true"></div>
            <EscalationStep level="L1" title="Analyst Triage" detail="Auto-assigned on creation (round-robin)" count={null} />
            <EscalationStep level="L2" title="Team Lead" detail="On SLA breach" count={escalationByLevel.teamLead} />
            <EscalationStep level="L3" title="Manager" detail="Sustained breach" count={escalationByLevel.manager} />
            <EscalationStep level="L4" title="Critical Alert" detail="Highest severity" count={escalationByLevel.critical} />
          </div>
        </section>
      </div>
    </div>
  )
}

function Kpi({ icon, label, value, tone }: { icon: string; label: string; value: string | number; tone?: 'error' }) {
  const accent = tone === 'error' ? 'text-error' : 'text-on-surface-variant'
  const border = tone === 'error' ? 'border-error/20' : 'border-white/5'
  return (
    <div className={`bg-surface-container-low border ${border} rounded-lg p-md hover:bg-surface-container transition-colors`}>
      <div className={`flex items-center gap-sm mb-md ${accent}`}>
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{icon}</span>
        <h3 className="text-label-md uppercase tracking-wider">{label}</h3>
      </div>
      <div className={`text-[28px] leading-none font-bold font-mono-label ${tone === 'error' ? 'text-error' : 'text-on-surface'}`}>{value}</div>
    </div>
  )
}

function EscalationStep({ level, title, detail, count }: { level: string; title: string; detail: string; count: number | null }) {
  return (
    <div className="relative z-10 flex items-start gap-md">
      <div className="w-12 h-12 rounded bg-surface-container-high border border-outline-variant flex items-center justify-center shrink-0">
        <span className="font-mono-label text-primary">{level}</span>
      </div>
      <div className="flex-1 pt-1">
        <div className="flex justify-between items-baseline mb-xs gap-sm">
          <h4 className="text-label-md text-on-surface">{title}</h4>
          {count != null && <span className="font-mono-label text-[10px] text-on-surface-variant">{count} total</span>}
        </div>
        <p className="text-body-sm text-on-surface-variant">{detail}</p>
      </div>
    </div>
  )
}
