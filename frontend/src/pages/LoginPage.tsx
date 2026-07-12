import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { errorMessage, publicApi } from '../api'
import type { PublicStats } from '../api'

/**
 * Two login worlds behind one screen. A "Customer / Operations" toggle slides between:
 *  - Customer: light, calm "Omniscience Support" panel (self-service signup → CUSTOMER role).
 *  - Operations: the dark "Mission Control" console (sign-in only; ops accounts are admin-provisioned).
 * Either panel authenticates the same way; the post-login redirect is driven by the real role
 * returned by the server (CUSTOMER → /portal, everyone else → ops console), so the toggle is
 * purely cosmetic and a customer can never land in the ops console by picking the wrong tab.
 */

type Portal = 'customer' | 'operations'

const TICKER = [
  { color: 'bg-accent', text: 'SLA Monitor · Active', cls: 'text-on-surface-variant' },
  { color: 'bg-secondary', text: 'Round-Robin Assignment · Online', cls: 'text-on-surface-variant' },
  { color: 'bg-accent', text: 'Audit Trail · Recording', cls: 'text-on-surface-variant' },
  { color: 'bg-primary/40', text: 'RBAC · Enforced', cls: 'text-on-surface-variant' },
]

const CAPABILITIES = [
  { icon: 'schedule', cls: 'text-accent', title: 'SLA Monitor running', meta: 'Engine: SlaMonitorScheduler · 60s sweep' },
  { icon: 'hub', cls: 'text-secondary', title: 'Round-robin assignment', meta: 'Auto-routes incidents to analysts' },
  { icon: 'list_alt', cls: 'text-on-surface-variant', title: 'Audit logging enabled', meta: 'Every state change recorded' },
  { icon: 'shield', cls: 'text-accent', title: 'JWT auth + RBAC', meta: 'Stateless, role-based access' },
]

function StatCard({ label, value, tone = 'text-primary', extra = '' }: {
  label: string; value: string; tone?: string; extra?: string
}) {
  return (
    <div className={`glass-panel p-lg flex flex-col gap-xs rounded-lg ${extra}`}>
      <span className={`text-label-md uppercase tracking-widest ${tone === 'text-error' ? 'text-error' : 'text-on-surface-variant'}`}>
        {label}
      </span>
      <span className={`text-[42px] leading-tight font-bold ${tone}`}>{value}</span>
    </div>
  )
}

/** Customer | Operations switch, themed for whichever panel hosts it. */
function PortalToggle({ portal, onChoose, variant }: { portal: Portal; onChoose: (p: Portal) => void; variant: 'light' | 'dark' }) {
  const dark = variant === 'dark'
  return (
    <div role="tablist" aria-label="Login type" className={`inline-flex p-1 rounded-full ${dark ? 'bg-surface-container/60 border border-outline-variant/20' : 'bg-[#f2f4f6] border border-[#e1e2e4]'}`}>
      {(['customer', 'operations'] as Portal[]).map((p) => {
        const active = portal === p
        return (
          <button
            key={p}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChoose(p)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              active
                ? dark ? 'bg-primary text-background' : 'bg-black text-white'
                : dark ? 'text-on-surface-variant hover:text-on-surface' : 'text-[#747878] hover:text-[#191c1e]'
            }`}
          >
            {p === 'customer' ? 'Customer' : 'Operations'}
          </button>
        )
      })}
    </div>
  )
}

function Field({ id, label, type, value, onChange, placeholder, autoComplete }: {
  id: string; label: string; type: string; value: string; onChange: (v: string) => void; placeholder: string; autoComplete?: string
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-[#191c1e]">{label}</span>
      <input
        id={id} type={type} required autoComplete={autoComplete} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-[#f8f9fb] border border-[#e1e2e4] rounded-xl px-4 py-3 text-sm text-[#191c1e] focus:outline-none focus:border-black transition-colors placeholder:text-[#747878]"
      />
    </label>
  )
}

interface PanelProps {
  portal: Portal
  onChoose: (p: Portal) => void
  mode: 'login' | 'register'
  setMode: (m: 'login' | 'register') => void
  name: string; setName: (v: string) => void
  email: string; setEmail: (v: string) => void
  password: string; setPassword: (v: string) => void
  error: string | null
  busy: boolean
  granted: string | null
  onSubmit: (e: FormEvent) => void
}

/** Light, soothing "Omniscience Support" sign-in (customer self-service). */
function CustomerPanel(p: PanelProps) {
  return (
    <div className="cx w-1/2 shrink-0 h-full overflow-y-auto flex bg-[#f8f9fb]">
      {/* Obsidian welcome hero (desktop) */}
      <div className="hidden lg:flex w-[55%] p-8 xl:p-12">
        <div className="cx-obsidian rounded-[2rem] w-full h-full p-12 flex flex-col justify-between text-white">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-white text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">ac_unit</span>
            <span className="cx-display text-lg font-semibold">Omniscience Support</span>
          </div>
          <div>
            <h1 className="cx-display text-[44px] leading-[1.05] font-bold">Help, when<br />you need it.</h1>
            <p className="text-white/70 mt-4 max-w-[22rem]">Submit requests, follow every update, and reach our team — all in one calm place.</p>
            <ul className="mt-8 space-y-3">
              {[['inbox', 'Track all your requests in real time'], ['forum', 'Message our analysts directly'], ['menu_book', 'Search the Help Center anytime']].map(([icon, text]) => (
                <li key={text} className="flex items-center gap-3 text-white/80 text-sm">
                  <span className="material-symbols-outlined text-[20px] text-white/60" aria-hidden="true">{icon}</span>{text}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-white/40 text-xs">Omniscience · Incident Intelligence Platform</p>
        </div>
      </div>

      {/* Auth card */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        <div className={`w-full max-w-[24rem] transition-all duration-500 ${p.granted ? 'opacity-0 translate-y-3' : ''}`}>
          <div className="flex justify-center mb-6"><PortalToggle portal={p.portal} onChoose={p.onChoose} variant="light" /></div>
          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            <span className="material-symbols-outlined text-black" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">ac_unit</span>
            <span className="cx-display text-lg font-semibold text-[#191c1e]">Omniscience Support</span>
          </div>
          <div className="bg-white border border-[#e1e2e4] rounded-3xl p-7 shadow-sm">
            <h2 className="cx-display text-2xl font-bold text-[#191c1e]">{p.mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            <p className="text-sm text-[#747878] mt-1">{p.mode === 'login' ? 'Sign in to manage your support requests.' : 'Get help and track your requests in one place.'}</p>
            <form className="mt-6 space-y-4" onSubmit={p.onSubmit} noValidate>
              {p.mode === 'register' && (
                <Field id="cx-name" label="Full name" type="text" value={p.name} onChange={p.setName} placeholder="Jane Doe" autoComplete="name" />
              )}
              <Field id="cx-email" label="Email" type="email" value={p.email} onChange={p.setEmail} placeholder="you@company.com" autoComplete="email" />
              <Field id="cx-password" label="Password" type="password" value={p.password} onChange={p.setPassword} placeholder="••••••••" autoComplete={p.mode === 'login' ? 'current-password' : 'new-password'} />
              {p.error && (
                <p role="alert" className="flex items-center gap-2 text-sm text-[#ba1a1a] bg-[#ffdad6]/40 border border-[#ffdad6] rounded-xl px-3 py-2">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">error</span>{p.error}
                </p>
              )}
              <button
                type="submit" disabled={p.busy}
                className="w-full bg-black text-white rounded-full py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer flex items-center justify-center gap-2"
              >
                {p.busy ? 'Please wait…' : p.mode === 'login' ? 'Sign In' : 'Create Account'}
                {!p.busy && <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>}
              </button>
            </form>
            <p className="text-sm text-[#747878] text-center mt-5">
              {p.mode === 'login' ? 'New here? ' : 'Already have an account? '}
              <button type="button" onClick={() => p.setMode(p.mode === 'login' ? 'register' : 'login')} className="text-black font-semibold hover:underline cursor-pointer">
                {p.mode === 'login' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </div>
          <p className="text-center text-xs text-[#747878] mt-5">
            On the response team?{' '}
            <button type="button" onClick={() => p.onChoose('operations')} className="font-medium text-[#191c1e] hover:underline cursor-pointer">Operations sign-in</button>
          </p>
        </div>

        {/* Post-login transition (light) */}
        <div className={`absolute inset-0 bg-[#f8f9fb] flex items-center justify-center transition-opacity duration-500 ${p.granted ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} aria-hidden={!p.granted}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center">
              <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">check</span>
            </div>
            <p className="cx-display text-lg font-semibold text-[#191c1e]">Signing you in…</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Dark "Mission Control" console sign-in (operations; accounts provisioned by admins). */
function OperationsPanel(p: PanelProps & { stats: PublicStats | null }) {
  return (
    <div className="bg-background text-on-surface w-1/2 shrink-0 h-full overflow-hidden flex">
      {/* Mission Control sidebar (left 65%) */}
      <div className="hidden md:flex w-[65%] h-full relative overflow-hidden border-r border-outline-variant/30 flex-col">
        <div className="relative z-10 w-full h-full p-xl flex flex-col gap-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-md">
              <span className="material-symbols-outlined text-primary text-[32px]" aria-hidden="true">hub</span>
              <h1 className="text-headline-md font-semibold tracking-tight">Mission Control</h1>
            </div>
            <div className="flex items-center gap-sm bg-surface-container/50 px-md py-sm rounded border border-outline-variant/20">
              <span className="w-2 h-2 rounded-full bg-accent status-pulse" aria-hidden="true"></span>
              <span className="font-mono-label text-mono-label uppercase tracking-widest text-on-surface-variant">
                Global Sync: Active
              </span>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-lg flex-1 min-h-0 items-center">
            <div className="col-span-8 flex flex-col gap-lg min-h-0">
              <div className="grid grid-cols-2 gap-md">
                <StatCard label="Open Incidents" value={p.stats ? String(p.stats.openIncidents) : '—'} extra="shimmer" />
                <StatCard label="Critical Priority" value={p.stats ? String(p.stats.p1Open).padStart(2, '0') : '—'} tone="text-error" />
                <StatCard label="SLA Compliance" value={p.stats ? `${p.stats.slaCompliancePercent.toFixed(1)}%` : '—'} />
                <StatCard label="Analysts On Duty" value={p.stats ? String(p.stats.analystsOnDuty).padStart(2, '0') : '—'} />
              </div>

              <div className="flex-1 glass-panel rounded-lg p-lg relative overflow-hidden">
                <div className="flex justify-between items-center mb-md">
                  <h3 className="text-headline-sm font-medium">Managed Incidents</h3>
                  <div className="flex gap-xs" aria-hidden="true">
                    <div className="w-8 h-4 bg-outline-variant/20 rounded-sm"></div>
                    <div className="w-8 h-4 bg-primary/20 rounded-sm"></div>
                  </div>
                </div>
                <svg className="absolute inset-0 w-full h-full opacity-15" aria-hidden="true">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#444749" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
                <div className="relative z-10 w-full h-full flex items-center justify-center border border-dashed border-outline-variant/30 rounded">
                  <span className="font-mono-label text-mono-label text-on-surface-variant">
                    {p.stats ? `INCIDENTS_TRACKED // ${p.stats.totalIncidents.toLocaleString()}` : 'INITIALIZING_STREAM…'}
                  </span>
                </div>
              </div>
            </div>

            <div className="col-span-4 flex flex-col gap-lg">
              <div className="flex-1 glass-panel rounded-lg overflow-hidden flex flex-col">
                <div className="p-md border-b border-outline-variant/20 bg-surface-container/30">
                  <h3 className="text-label-md uppercase tracking-widest">Platform Capabilities</h3>
                </div>
                <div className="flex-1 overflow-hidden p-md">
                  <div className="scrolling-feed flex flex-col gap-md">
                    {[...CAPABILITIES, ...CAPABILITIES].map((a, i) => (
                      <div key={i} className="flex items-start gap-md p-md bg-surface-container-low rounded border border-outline-variant/10">
                        <span className={`material-symbols-outlined text-sm ${a.cls}`} aria-hidden="true">{a.icon}</span>
                        <div className="flex flex-col">
                          <span className="text-body-sm text-primary">{a.title}</span>
                          <span className="font-mono-label text-[10px] text-on-surface-variant">{a.meta}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-lg p-lg border-l-2 border-primary">
                <div className="flex items-center gap-md mb-md">
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                    verified_user
                  </span>
                  <h4 className="text-label-md uppercase tracking-widest">Enterprise Shield</h4>
                </div>
                <ul className="flex flex-col gap-sm">
                  <li className="flex items-center gap-sm text-body-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-xs" aria-hidden="true">key</span> JWT Authentication
                  </li>
                  <li className="flex items-center gap-sm text-body-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-xs" aria-hidden="true">shield</span> Role-Based Access Control
                  </li>
                  <li className="flex items-center gap-sm text-body-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-xs" aria-hidden="true">list_alt</span> Audit Logging Enabled
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Authentication panel (right 35%) */}
      <div className="w-full md:w-[35%] h-full bg-surface-dim flex flex-col relative overflow-hidden">
        <div className="w-full bg-surface-container-low/80 backdrop-blur-md border-b border-outline-variant/20 py-2 px-md overflow-hidden whitespace-nowrap">
          <div className="marquee-content flex items-center gap-xl">
            {[...TICKER, ...TICKER].map((t, i) => (
              <div key={i} className="flex items-center gap-sm whitespace-nowrap">
                <span className={`w-1.5 h-1.5 rounded-full ${t.color}`} aria-hidden="true"></span>
                <span className={`font-mono-label text-[11px] uppercase tracking-wider ${t.cls}`}>{t.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-lg">
          <div className={`w-full max-w-[24rem] flex flex-col gap-xl fade-in items-center transition-all duration-500 ${p.granted ? 'opacity-0 translate-y-4' : ''}`}>
            <PortalToggle portal={p.portal} onChoose={p.onChoose} variant="dark" />
            <div className="flex flex-col gap-md text-center">
              <div className="flex justify-center items-center gap-md">
                <div className="w-10 h-10 bg-primary flex items-center justify-center rounded">
                  <span className="material-symbols-outlined text-background text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                    analytics
                  </span>
                </div>
                <h2 className="text-headline-lg font-semibold tracking-tighter text-primary">Omniscience</h2>
              </div>
              <p className="text-body-md text-on-surface-variant">Incident Intelligence Platform</p>
            </div>

            <form className="flex flex-col gap-lg w-full" onSubmit={p.onSubmit} noValidate>
              <div className="flex flex-col gap-md">
                <div className="flex flex-col gap-xs">
                  <label htmlFor="ops-email" className="text-label-md text-on-surface-variant uppercase tracking-widest pl-1">
                    Corporate Email
                  </label>
                  <input
                    id="ops-email" type="email" required autoComplete="email"
                    className="bg-background border border-outline-variant/30 text-on-surface p-md rounded-lg focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-variant/30 text-body-sm"
                    placeholder="name@enterprise.com" value={p.email} onChange={(e) => p.setEmail(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-xs">
                  <label htmlFor="ops-password" className="text-label-md text-on-surface-variant uppercase tracking-widest pl-1">
                    Password
                  </label>
                  <input
                    id="ops-password" type="password" required autoComplete="current-password"
                    className="bg-background border border-outline-variant/30 text-on-surface p-md rounded-lg focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-variant/30 text-body-sm"
                    placeholder="••••••••" value={p.password} onChange={(e) => p.setPassword(e.target.value)}
                  />
                </div>
              </div>

              {p.error && (
                <div role="alert" className="flex items-center gap-sm border border-error/40 bg-error/10 text-error text-body-sm rounded-lg p-md">
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">error</span>
                  {p.error}
                </div>
              )}

              <button
                type="submit" disabled={p.busy}
                className="bg-primary text-background text-label-md py-md rounded-lg uppercase tracking-widest font-bold hover:bg-on-surface transition-all active:scale-[0.98] flex justify-center items-center gap-md group cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {p.busy ? 'Authenticating…' : 'Access Workspace'}
                <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform" aria-hidden="true">
                  arrow_forward
                </span>
              </button>
            </form>

            <p className="text-body-sm text-on-surface-variant text-center">
              Accounts are provisioned by your administrator.<br />
              Need help instead?{' '}
              <button type="button" onClick={() => p.onChoose('customer')} className="text-primary font-bold hover:underline cursor-pointer">Customer sign-in</button>
            </p>
          </div>
        </div>

        <div className="w-full bg-surface-container-high border-t border-outline-variant/30 p-md flex items-center justify-between">
          <div className="flex items-center gap-lg">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono-label text-[9px] text-on-surface-variant/70 uppercase">Incidents</span>
              <span className="font-mono-label text-[12px] text-primary font-bold">{p.stats ? p.stats.totalIncidents.toLocaleString() : '—'}</span>
            </div>
            <div className="w-px h-6 bg-outline-variant/20" aria-hidden="true"></div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono-label text-[9px] text-on-surface-variant/70 uppercase">SLA</span>
              <span className="font-mono-label text-[12px] text-accent font-bold">{p.stats ? `${p.stats.slaCompliancePercent.toFixed(1)}%` : '—'}</span>
            </div>
            <div className="w-px h-6 bg-outline-variant/20" aria-hidden="true"></div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono-label text-[9px] text-on-surface-variant/70 uppercase">Analysts</span>
              <span className="font-mono-label text-[12px] text-primary font-bold">{p.stats ? String(p.stats.analystsOnDuty).padStart(2, '0') : '—'}</span>
            </div>
          </div>
          <div className="flex items-center gap-sm">
            <span className="w-2 h-2 rounded-full bg-accent status-pulse" aria-hidden="true"></span>
            <span className="font-mono-label text-[10px] text-on-surface-variant uppercase">Operational</span>
          </div>
        </div>

        <div
          className={`absolute inset-0 bg-surface-dim z-50 flex items-center justify-center transition-opacity duration-500 ${p.granted ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-hidden={!p.granted}
        >
          <div className="flex flex-col items-center gap-lg">
            <div className="w-16 h-0.5 bg-outline-variant/20 relative overflow-hidden rounded-full">
              <div className="absolute inset-0 bg-primary shimmer w-1/2"></div>
            </div>
            <div className="flex flex-col items-center gap-sm">
              <span className="text-label-md text-on-surface-variant uppercase tracking-widest">Welcome Back</span>
              <div className="flex items-center gap-md bg-surface-container p-md rounded-lg border border-primary/20 scale-110">
                <span className="material-symbols-outlined text-primary" aria-hidden="true">manage_accounts</span>
                <div className="flex flex-col">
                  <span className="text-headline-sm font-medium text-primary">{p.granted}</span>
                  <span className="font-mono-label text-[10px] text-on-surface-variant">Session Initialized</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [portal, setPortal] = useState<Portal>('customer')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [granted, setGranted] = useState<string | null>(null)
  const [stats, setStats] = useState<PublicStats | null>(null)

  useEffect(() => { publicApi.stats().then(setStats).catch(() => {}) }, [])

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname

  function choosePortal(p: Portal) {
    if (p === 'operations') setMode('login') // ops accounts are admin-provisioned, no self-signup
    setError(null)
    setPortal(p)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const user = mode === 'login'
        ? await login(email, password)
        : await register(name, email, password, 'CUSTOMER')
      setGranted(user.role)
      const dest = user.role === 'CUSTOMER'
        ? '/portal'
        : from && !from.startsWith('/portal') ? from : '/'
      setTimeout(() => navigate(dest, { replace: true }), 1000)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const panelProps: PanelProps = {
    portal, onChoose: choosePortal, mode, setMode, name, setName, email, setEmail,
    password, setPassword, error, busy, granted, onSubmit: handleSubmit,
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      <div
        className="flex h-full w-[200%] cx-slide"
        style={{ transform: portal === 'customer' ? 'translateX(0)' : 'translateX(-50%)' }}
      >
        <CustomerPanel {...panelProps} />
        <OperationsPanel {...panelProps} stats={stats} />
      </div>
    </div>
  )
}
