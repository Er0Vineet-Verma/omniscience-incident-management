import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { CustomerBrand } from './cxui'

const NAV = [
  { to: '/portal', label: 'Home', end: true },
  { to: '/portal/requests', label: 'My Requests', end: false },
  { to: '/portal/help', label: 'Help Center', end: false },
]

/** Light top-nav shell for the customer "Omniscience Support" portal. */
export default function CustomerShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="cx min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-[#e1e2e4]">
        <div className="max-w-[1100px] mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <NavLink to="/portal" aria-label="Omniscience Support home"><CustomerBrand /></NavLink>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                    isActive ? 'bg-[#edeef0] text-[#191c1e]' : 'text-[#444748] hover:text-[#191c1e] hover:bg-[#f2f4f6]'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-[#444748]">{user?.name}</span>
            <button
              onClick={() => { logout(); navigate('/login') }}
              aria-label="Sign out"
              className="w-9 h-9 rounded-full bg-[#edeef0] hover:bg-[#e1e2e4] flex items-center justify-center text-[#444748] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1100px] mx-auto px-5 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-[#e1e2e4] py-5">
        <div className="max-w-[1100px] mx-auto px-5 flex flex-wrap justify-between gap-2 text-xs text-[#747878]">
          <span>© 2026 Omniscience Support</span>
          <div className="flex gap-4"><span>Privacy</span><span>Terms</span><span>Support</span></div>
        </div>
      </footer>
    </div>
  )
}
