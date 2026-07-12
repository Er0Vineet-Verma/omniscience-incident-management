import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi, TOKEN_KEY, USER_KEY } from '../api'
import type { AuthResponse, Role } from '../api'

export interface AuthUser {
  id: number
  name: string
  email: string
  role: Role
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  /** True when the user has any of the given roles. */
  hasRole: (...roles: Role[]) => boolean
  login: (email: string, password: string) => Promise<AuthUser>
  register: (name: string, email: string, password: string, role?: Role) => Promise<AuthUser>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw && localStorage.getItem(TOKEN_KEY) ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function storeSession(auth: AuthResponse): AuthUser {
  const user: AuthUser = { id: auth.id, name: auth.name, email: auth.email, role: auth.role }
  localStorage.setItem(TOKEN_KEY, auth.token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser)

  const login = useCallback(async (email: string, password: string) => {
    const u = storeSession(await authApi.login(email, password))
    setUser(u)
    return u
  }, [])

  const register = useCallback(async (name: string, email: string, password: string, role?: Role) => {
    const u = storeSession(await authApi.register({ name, email, password, role }))
    setUser(u)
    return u
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      hasRole: (...roles) => user !== null && roles.includes(user.role),
      login,
      register,
      logout,
    }),
    [user, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
