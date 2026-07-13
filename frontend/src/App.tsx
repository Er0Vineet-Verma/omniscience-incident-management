import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import { CustomerOnly, OpsOnly } from './components/RoleGate'
import CustomerShell from './components/customer/CustomerShell'
import LoginPage from './pages/LoginPage'

// Route-level code splitting: each page ships as its own chunk and loads on
// demand, keeping the initial bundle to the shell + login screen.
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const IncidentDetailPage = lazy(() => import('./pages/IncidentDetailPage'))
const IncidentsPage = lazy(() => import('./pages/IncidentsPage'))
const InfraPage = lazy(() => import('./pages/InfraPage'))
const LogsPage = lazy(() => import('./pages/LogsPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const KnowledgeBasePage = lazy(() => import('./pages/KnowledgeBasePage'))
const GovernancePage = lazy(() => import('./pages/GovernancePage'))
const AuditCenterPage = lazy(() => import('./pages/AuditCenterPage'))
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage'))
const CustomerHomePage = lazy(() => import('./pages/customer/CustomerHomePage'))
const MyRequestsPage = lazy(() => import('./pages/customer/MyRequestsPage'))
const RequestDetailPage = lazy(() => import('./pages/customer/RequestDetailPage'))
const HelpCenterPage = lazy(() => import('./pages/customer/HelpCenterPage'))

/** Theme-neutral loading state shown while a route chunk downloads. */
function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]" role="status" aria-label="Loading page">
      <span className="w-6 h-6 rounded-full border-2 border-current border-t-transparent animate-spin opacity-40" />
    </div>
  )
}

/**
 * Route map. Two worlds: the customer portal (CUSTOMER only) and the analyst/admin
 * ops console. RoleGate redirects each role to its own home so neither sees the other.
 */
export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Customer portal — light "Omniscience Support" */}
        <Route element={<CustomerOnly />}>
          <Route element={<CustomerShell />}>
            <Route path="/portal" element={<CustomerHomePage />} />
            <Route path="/portal/requests" element={<MyRequestsPage />} />
            <Route path="/portal/requests/:id" element={<RequestDetailPage />} />
            <Route path="/portal/help" element={<HelpCenterPage />} />
          </Route>
        </Route>

        {/* Ops console — analysts + admins (customers redirected to /portal) */}
        <Route element={<OpsOnly />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/forbidden" element={<PlaceholderPage title="403 — Access denied" />} />
            <Route path="/incidents" element={<IncidentsPage />} />
            <Route path="/incidents/:id" element={<IncidentDetailPage />} />
            <Route path="/kb" element={<KnowledgeBasePage />} />

            {/* Analyst + Admin */}
            <Route element={<ProtectedRoute roles={['ANALYST', 'ADMIN']} />}>
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/infra" element={<InfraPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/escalations" element={<PlaceholderPage title="Escalations" />} />
            </Route>

            {/* Admin only */}
            <Route element={<ProtectedRoute roles={['ADMIN']} />}>
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/governance" element={<GovernancePage />} />
              <Route path="/admin/audit" element={<AuditCenterPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
