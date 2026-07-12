import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { authApi, errorMessage, incidentApi, userApi } from '../api'
import type { IncidentResponse, Role, UserResponse } from '../api'
import { useAuth } from '../context/AuthContext'
import { fmtDateTime } from '../lib/format'

/** Stitch design: "User Management & RBAC" (docs/design/stitch/html/08-user-management.html). */

const ROLE_CHIP: Record<Role, string> = {
  ADMIN: 'bg-primary/10 border-primary/20 text-primary',
  ANALYST: 'bg-secondary/10 border-secondary/20 text-secondary',
  CUSTOMER: 'bg-surface-container-highest border-white/10 text-on-surface-variant',
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('ANALYST')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      // Direct API call — must NOT replace the admin's own session.
      await authApi.register({ name, email, password, role })
      onCreated()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-md" role="dialog" aria-modal="true" aria-label="Create user">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true"></div>
      <form onSubmit={submit} className="relative glass-panel rounded-lg w-full max-w-[28rem] p-lg space-y-md">
        <div className="flex items-center justify-between">
          <h3 className="text-headline-sm font-semibold flex items-center gap-sm">
            <span className="material-symbols-outlined" aria-hidden="true">person_add</span>
            Create User
          </h3>
          <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface cursor-pointer" aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {([
          { id: 'u-name', label: 'Full Name', value: name, set: setName, type: 'text', placeholder: 'Analyst Four' },
          { id: 'u-email', label: 'Email', value: email, set: setEmail, type: 'email', placeholder: 'analyst4@ims.com' },
          { id: 'u-pass', label: 'Password (min 8 chars)', value: password, set: setPassword, type: 'password', placeholder: '••••••••' },
        ] as const).map((f) => (
          <div key={f.id} className="flex flex-col gap-xs">
            <label htmlFor={f.id} className="text-label-md text-on-surface-variant uppercase tracking-widest">{f.label}</label>
            <input
              id={f.id} type={f.type} required value={f.value} placeholder={f.placeholder}
              onChange={(e) => f.set(e.target.value)}
              className="bg-background border border-outline-variant/50 p-sm rounded text-body-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        ))}
        <div className="flex flex-col gap-xs">
          <label htmlFor="u-role" className="text-label-md text-on-surface-variant uppercase tracking-widest">Role</label>
          <select
            id="u-role" value={role} onChange={(e) => setRole(e.target.value as Role)}
            className="bg-background border border-outline-variant/50 p-sm rounded text-body-sm focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="ANALYST">ANALYST — resolves incidents (joins round-robin)</option>
            <option value="CUSTOMER">CUSTOMER — raises tickets</option>
            <option value="ADMIN">ADMIN — full control</option>
          </select>
        </div>
        {error && <p role="alert" className="text-error text-body-sm">{error}</p>}
        <div className="flex justify-end gap-sm">
          <button type="button" onClick={onClose} className="px-lg py-sm border border-outline-variant rounded text-body-sm hover:border-outline transition-colors cursor-pointer">Cancel</button>
          <button
            type="submit" disabled={busy}
            className="px-lg py-sm bg-primary text-on-primary font-bold rounded text-body-sm hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function UsersPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<UserResponse[]>([])
  const [incidents, setIncidents] = useState<IncidentResponse[]>([])
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    userApi.all().then(setUsers).catch((e) => setError(errorMessage(e)))
    incidentApi.list({ size: 200 }).then((p) => setIncidents(p.content)).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const act = async (fn: () => Promise<unknown>) => {
    setError(null)
    try { await fn(); load() } catch (e) { setError(errorMessage(e)) }
  }

  const incidentCount = useCallback((u: UserResponse) => {
    if (u.role === 'CUSTOMER') return incidents.filter((i) => i.createdById === u.id).length
    return incidents.filter((i) => i.assignedToId === u.id).length
  }, [incidents])

  const visible = useMemo(() => users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    }
    return true
  }), [users, roleFilter, search])

  const active = users.filter((u) => u.status === 'ACTIVE').length
  const suspended = users.length - active
  const analystCount = users.filter((u) => u.role === 'ANALYST').length

  const exportCsv = () => {
    const head = ['Name', 'Email', 'Role', 'Status', 'Onboarded', 'Incidents']
    const rows = visible.map((u) => [u.name, u.email, u.role, u.status, u.createdAt, incidentCount(u)])
    const csv = [head, ...rows].map((r) => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'personnel.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="flex-1 overflow-y-auto p-lg">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md mb-xl">
        <div>
          <h2 className="text-headline-lg font-semibold text-on-surface tracking-tight">Identity & Access</h2>
          <p className="text-body-md text-on-surface-variant mt-1">Manage personnel clearance, roles, and operational status across the enterprise.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-white text-black px-6 py-2.5 rounded text-label-md font-bold flex items-center hover:bg-on-surface-variant transition-colors active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined mr-2" aria-hidden="true">person_add</span>
          Create User
        </button>
      </div>

      {/* Stats bento */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-lg mb-xl">
        <div className="glass-panel p-lg rounded-lg">
          <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mb-1">Total Personnel</p>
          <h3 className="text-[40px] font-bold leading-tight">{users.length}</h3>
          <div className="mt-4 flex items-center text-xs text-success">
            <span className="material-symbols-outlined text-sm mr-1" aria-hidden="true">group</span>
            <span>{analystCount} analysts in rotation</span>
          </div>
        </div>
        <div className="glass-panel p-lg rounded-lg">
          <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mb-1">Active Accounts</p>
          <h3 className="text-[40px] font-bold leading-tight">{active}</h3>
          <div className="mt-4 flex items-center text-xs text-on-surface-variant">
            <div className="w-1.5 h-1.5 rounded-full bg-info mr-2 animate-pulse" aria-hidden="true"></div>
            <span>Eligible for assignment</span>
          </div>
        </div>
        <div className={`glass-panel p-lg rounded-lg ${suspended > 0 ? 'border-l-4 border-l-error-container' : ''}`}>
          <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mb-1">Suspended</p>
          <h3 className="text-[40px] font-bold leading-tight">{suspended}</h3>
          <div className={`mt-4 flex items-center text-xs ${suspended > 0 ? 'text-error' : 'text-on-surface-variant'}`}>
            <span className="material-symbols-outlined text-sm mr-1" aria-hidden="true">security</span>
            <span>{suspended > 0 ? 'Awaiting review' : 'None suspended'}</span>
          </div>
        </div>
        <div className="glass-panel p-lg rounded-lg">
          <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mb-1">Active Ratio</p>
          <h3 className="text-[40px] font-bold leading-tight">{users.length ? Math.round((active / users.length) * 100) : 0}%</h3>
          <div className="mt-4 w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
            <div className="bg-primary h-full" style={{ width: `${users.length ? (active / users.length) * 100 : 0}%` }}></div>
          </div>
        </div>
      </div>

      {error && <p role="alert" className="text-error text-body-sm mb-md">{error}</p>}

      {/* Controls */}
      <div className="glass-panel rounded-t-lg p-md flex flex-col md:flex-row items-center justify-between gap-md">
        <div className="flex items-center space-x-1 bg-surface-container-lowest p-1 rounded border border-white/5">
          {(['', 'ADMIN', 'ANALYST', 'CUSTOMER'] as const).map((r) => (
            <button
              key={r || 'all'}
              onClick={() => setRoleFilter(r)}
              className={`px-4 py-1.5 text-label-md rounded transition-all cursor-pointer ${roleFilter === r ? 'bg-surface-container-highest text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {r === '' ? 'All' : r.charAt(0) + r.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-md">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm" aria-hidden="true">search</span>
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="bg-surface-container-lowest border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-body-sm w-56 focus:outline-none focus:border-primary transition-colors"
              placeholder="Search personnel…" aria-label="Search users"
            />
          </div>
          <button onClick={exportCsv} className="flex items-center text-on-surface-variant text-label-md hover:text-on-surface transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-sm mr-2" aria-hidden="true">download</span>
            Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-b-lg overflow-x-auto border-t-0">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-surface-container-low border-b border-white/5">
              {['Personnel', 'Role', 'Status', 'Onboarded', 'Incidents', 'Clearance Actions'].map((h, i) => (
                <th key={h} className={`px-lg py-4 text-label-md text-on-surface-variant uppercase tracking-widest font-semibold ${i === 5 ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visible.map((u) => {
              const isSelf = u.id === me?.id
              return (
                <tr key={u.id} className="transition-colors group hover:bg-white/[0.02]">
                  <td className="px-lg py-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center shrink-0 ${u.status === 'ACTIVE' ? 'ring-2 ring-success/50' : 'opacity-60'}`}>
                        <span className="font-bold text-xs">{initials(u.name)}</span>
                      </div>
                      <div>
                        <p className="text-body-sm font-bold text-on-surface">{u.name}{isSelf ? ' (you)' : ''}</p>
                        <p className="text-[10px] font-mono-label text-on-surface-variant opacity-60 font-bold">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-lg py-4">
                    {isSelf ? (
                      <span className={`px-2 py-1 border text-[10px] font-bold rounded uppercase tracking-wider ${ROLE_CHIP[u.role]}`}>{u.role}</span>
                    ) : (
                      <select
                        value={u.role}
                        onChange={(e) => act(() => userApi.setRole(u.id, e.target.value as Role))}
                        aria-label={`Role for ${u.name}`}
                        className={`px-2 py-1 border text-[10px] font-bold rounded uppercase tracking-wider bg-transparent cursor-pointer ${ROLE_CHIP[u.role]}`}
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="ANALYST">ANALYST</option>
                        <option value="CUSTOMER">CUSTOMER</option>
                      </select>
                    )}
                  </td>
                  <td className="px-lg py-4">
                    <div className="flex items-center">
                      <div className={`w-1.5 h-1.5 rounded-full mr-2 ${u.status === 'ACTIVE' ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-error'}`} aria-hidden="true"></div>
                      <span className="text-body-sm">{u.status === 'ACTIVE' ? 'Active' : 'Suspended'}</span>
                    </div>
                  </td>
                  <td className="px-lg py-4 font-mono-label text-mono-label text-on-surface-variant">{fmtDateTime(u.createdAt)}</td>
                  <td className="px-lg py-4 text-body-sm">{String(incidentCount(u)).padStart(2, '0')}</td>
                  <td className="px-lg py-4 text-right">
                    {!isSelf && (
                      <div className="flex items-center justify-end space-x-1">
                        {u.status === 'ACTIVE' ? (
                          <button
                            onClick={() => act(() => userApi.setStatus(u.id, 'INACTIVE'))}
                            className="p-2 rounded transition-colors text-on-surface-variant hover:text-error hover:bg-secondary/10 cursor-pointer"
                            title="Suspend account" aria-label={`Suspend ${u.name}`}
                          >
                            <span className="material-symbols-outlined text-sm">block</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => act(() => userApi.setStatus(u.id, 'ACTIVE'))}
                            className="p-2 bg-error/10 hover:bg-error/20 rounded transition-colors text-error cursor-pointer"
                            title="Re-enable account" aria-label={`Re-enable ${u.name}`}
                          >
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-lg text-on-surface-variant">
        <p className="text-label-md">Showing {visible.length} of {users.length} accounts</p>
      </div>

      {showCreate && (
        <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />
      )}
    </div>
  )
}
