import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import { CustomerOnly, OpsOnly } from './components/RoleGate'
import CustomerShell from './components/customer/CustomerShell'
import DashboardPage from './pages/DashboardPage'
import IncidentDetailPage from './pages/IncidentDetailPage'
import IncidentsPage from './pages/IncidentsPage'
import InfraPage from './pages/InfraPage'
import LoginPage from './pages/LoginPage'
import LogsPage from './pages/LogsPage'
import ReportsPage from './pages/ReportsPage'
import UsersPage from './pages/UsersPage'
import KnowledgeBasePage from './pages/KnowledgeBasePage'
import GovernancePage from './pages/GovernancePage'
import AuditCenterPage from './pages/AuditCenterPage'
import PlaceholderPage from './pages/PlaceholderPage'
import CustomerHomePage from './pages/customer/CustomerHomePage'
import MyRequestsPage from './pages/customer/MyRequestsPage'
import RequestDetailPage from './pages/customer/RequestDetailPage'
import HelpCenterPage from './pages/customer/HelpCenterPage'

/**
 * Route map. Two worlds: the customer portal (CUSTOMER only) and the analyst/admin
 * ops console. RoleGate redirects each role to its own home so neither sees the other.
 */
export default function App() {
  return (
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
  )
}
