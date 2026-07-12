import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { incidentApi } from '../api'
import type { Role } from '../api'

/**
 * Shared layout from the Stitch designs: collapsible sidebar (Ctrl+B),
 * top bar with global search (Ctrl+K), telemetry footer, emergency FAB.
 */

interface NavItem {
  to: string
  icon: string
  label: string
  roles?: Role[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: 'dashboard', label: 'Dashboard' },
  { to: '/incidents', icon: 'warning', label: 'Incidents' },
  { to: '/logs', icon: 'list_alt', label: 'Log Analysis', roles: ['ANALYST', 'ADMIN'] },
  { to: '/infra', icon: 'account_tree', label: 'Infrastructure', roles: ['ANALYST', 'ADMIN'] },
  { to: '/kb', icon: 'menu_book', label: 'Knowledge Base' },
  { to: '/reports', icon: 'assessment', label: 'Reports', roles: ['ANALYST', 'ADMIN'] },
  { to: '/admin/users', icon: 'group', label: 'Users', roles: ['ADMIN'] },
  { to: '/admin/governance', icon: 'gavel', label: 'Governance', roles: ['ADMIN'] },
  { to: '/admin/audit', icon: 'fact_check', label: 'Audit Center', roles: ['ADMIN'] },
]

const COLLAPSE_KEY = 'ims_sidebar_collapsed'

export default function AppShell() {
  const { user, hasRole, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === 'true')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const [clock, setClock] = useState(() => new Date())

  const toggleSidebar = useCallback(() => {
    if (window.innerWidth <= 1024) {
      setMobileOpen((v) => !v)
    } else {
      setCollapsed((v) => {
        localStorage.setItem(COLLAPSE_KEY, String(!v))
        return !v
      })
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleSidebar() }
      if (e.ctrlKey && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    const t = setInterval(() => setClock(new Date()), 30000)
    return () => { window.removeEventListener('keydown', onKey); clearInterval(t) }
  }, [toggleSidebar])

  const runSearch = useCallback(async () => {
    const q = search.trim()
    if (!q) return
    setSearch('')
    // Exact incident-number lookup jumps straight to the incident; otherwise keyword search.
    const m = q.match(/^#?\s*inc[-\s]?(\d+)$/i)
    if (m) {
      try {
        const inc = await incidentApi.getByNumber(`INC-${m[1]}`)
        navigate(`/incidents/${inc.id}`)
        return
      } catch { /* not an exact match — fall through to keyword search */ }
    }
    navigate(`/incidents?q=${encodeURIComponent(q)}`)
  }, [search, navigate])

  const sidebarWidth = collapsed ? 'lg:w-[72px]' : 'lg:w-[280px]'
  const mainMargin = collapsed ? 'lg:ml-[72px]' : 'lg:ml-[280px]'

  const visibleNav = NAV_ITEMS.filter((i) => !i.roles || hasRole(...i.roles))

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      {/* Sidebar */}
      <aside
        className={`w-[280px] ${sidebarWidth} h-screen flex flex-col bg-surface-dim border-r border-outline-variant fixed left-0 top-0 py-lg px-md z-40 overflow-hidden transition-all duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className="mb-xl px-sm flex items-center justify-between">
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-headline-md font-bold text-on-surface whitespace-nowrap">OpsCenter</h1>
              <p className="text-body-sm text-on-surface-variant opacity-70 whitespace-nowrap">Enterprise Tier</p>
            </div>
          )}
          <button
            className="lg:hidden text-on-surface-variant hover:text-on-surface cursor-pointer"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <button
            className="hidden lg:flex p-sm hover:bg-surface-variant rounded transition-colors items-center justify-center cursor-pointer"
            onClick={toggleSidebar}
            title="Toggle Sidebar (Ctrl+B)"
            aria-label="Toggle sidebar"
          >
            <span className="material-symbols-outlined text-on-surface">menu</span>
          </button>
        </div>

        <nav className="flex-1 space-y-xs">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={collapsed ? item.label : undefined}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-md p-sm transition-colors relative ${
                  isActive
                    ? 'text-primary font-bold border-r-2 border-primary bg-surface-variant'
                    : 'text-on-surface-variant font-medium hover:bg-surface-variant hover:text-on-surface'
                }`
              }
            >
              <span className="material-symbols-outlined shrink-0" aria-hidden="true">{item.icon}</span>
              {!collapsed && <span className="text-body-md whitespace-nowrap">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto pt-lg border-t border-outline-variant space-y-xs">
          <div className="flex items-center gap-md p-sm text-on-surface-variant" title={user?.email}>
            <span className="material-symbols-outlined shrink-0" aria-hidden="true">admin_panel_settings</span>
            {!collapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-body-sm whitespace-nowrap text-on-surface">{user?.name}</span>
                <span className="font-mono-label text-[10px] uppercase">{user?.role}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => { logout(); navigate('/login') }}
            title="Sign out"
            className="w-full flex items-center gap-md p-sm text-on-surface-variant hover:bg-surface-variant hover:text-error transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined shrink-0" aria-hidden="true">logout</span>
            {!collapsed && <span className="text-body-sm whitespace-nowrap">Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main wrapper */}
      <div className={`flex-1 ml-0 ${mainMargin} flex flex-col min-h-screen transition-all duration-200`}>
        <header className="sticky top-0 w-full z-20 flex justify-between items-center px-lg py-sm bg-surface border-b border-outline-variant gap-md">
          <div className="flex items-center gap-md flex-1">
            <button
              className="lg:hidden text-on-surface-variant hover:text-on-surface cursor-pointer"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="relative w-full max-w-[32rem] hidden md:block">
              <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]" aria-hidden="true">
                search
              </span>
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
                className="w-full bg-background border border-outline-variant rounded p-xs pl-xl text-body-sm focus:border-primary focus:outline-none transition-all placeholder:opacity-50"
                placeholder="Global search... (Ctrl+K)"
                type="text"
                aria-label="Global incident search"
              />
              <div className="absolute right-sm top-1/2 -translate-y-1/2 flex items-center gap-[2px]" aria-hidden="true">
                <span className="px-1.5 py-0.5 rounded border border-outline-variant bg-surface-container-high font-mono-label text-[10px] text-on-surface-variant">Ctrl</span>
                <span className="px-1.5 py-0.5 rounded border border-outline-variant bg-surface-container-high font-mono-label text-[10px] text-on-surface-variant">K</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-lg">
            <div className="flex items-center gap-sm pl-md border-l border-outline-variant">
              <span className="font-mono-label text-mono-label text-on-surface-variant hidden sm:inline uppercase">
                {user?.email}
              </span>
              <span className="material-symbols-outlined text-on-surface" aria-hidden="true">account_circle</span>
            </div>
          </div>
        </header>

        <Outlet />

        <footer className="mt-auto border-t border-outline-variant bg-surface-container-lowest px-lg py-xs flex justify-between items-center">
          <div className="flex items-center gap-xl">
            <div className="flex items-center gap-xs">
              <span className="font-mono-label text-[10px] text-on-surface-variant uppercase">Session:</span>
              <span className="font-mono-label text-[10px] text-success">{user?.role}</span>
            </div>
            <div className="flex items-center gap-xs">
              <span className="font-mono-label text-[10px] text-on-surface-variant uppercase">Stream:</span>
              <span className="font-mono-label text-[10px] text-success">Connected</span>
            </div>
          </div>
          <div className="text-on-surface-variant font-mono-label text-[10px]">
            LAST REFRESH: {clock.toISOString().replace('T', ' ').substring(0, 19)} UTC
          </div>
        </footer>
      </div>

      {/* Emergency FAB — Declare Incident */}
      <button
        onClick={() => navigate('/incidents?declare=1')}
        className="fixed bottom-lg right-lg w-14 h-14 bg-error-container text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-50 group cursor-pointer"
        aria-label="Declare incident"
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
          emergency_home
        </span>
        <span className="absolute right-full mr-sm bg-error-container text-white text-label-md px-md py-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none uppercase tracking-widest">
          Declare Incident
        </span>
      </button>
    </div>
  )
}
