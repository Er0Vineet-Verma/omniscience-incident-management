import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Customer portal routes: customers only; staff are sent to the ops console. */
export function CustomerOnly() {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'CUSTOMER') return <Navigate to="/" replace />
  return <Outlet />
}

/** Ops console routes: customers are redirected to their portal. */
export function OpsOnly() {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role === 'CUSTOMER') return <Navigate to="/portal" replace />
  return <Outlet />
}
