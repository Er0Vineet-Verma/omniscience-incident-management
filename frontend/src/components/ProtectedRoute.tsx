import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../api'

/**
 * Route guard. Unauthenticated users are sent to /login (remembering where
 * they came from); authenticated users lacking one of `roles` see /forbidden.
 */
export default function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { isAuthenticated, hasRole } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return <Navigate to="/forbidden" replace />
  }
  return <Outlet />
}
