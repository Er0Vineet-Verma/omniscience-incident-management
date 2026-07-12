import { api } from './client'
import type {
  AnalystReport, AuditResponse, AuditStats, AuthResponse, ChartSlice, CommentResponse, DashboardSummary,
  EscalationResponse, IncidentCreateRequest, IncidentListParams, IncidentResponse,
  IncidentStatus, IncidentUpdateRequest, InfraMetrics, KbRequest, KbResponse, LogListParams,
  LogResponse, LogStats, LogUploadResult, MonthlyIncidentReport, Page,
  PublicStats, RcaResult, Role, SlaBuckets, SlaComplianceReport, SlaRuleResponse, TrendPoint,
  UserResponse, UserStatus,
  MySummary, AttachmentResponse, CsatRequest, CsatResponse, CsatSummaryRow,
} from './types'

export * from './types'
export { api, errorMessage, TOKEN_KEY, USER_KEY } from './client'

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }).then(r => r.data),
  register: (data: { name: string; email: string; password: string; role?: Role }) =>
    api.post<AuthResponse>('/auth/register', data).then(r => r.data),
}

export const incidentApi = {
  list: (params: IncidentListParams = {}) =>
    api.get<Page<IncidentResponse>>('/incidents', { params }).then(r => r.data),
  search: (q: string) =>
    api.get<IncidentResponse[]>('/incidents/search', { params: { q } }).then(r => r.data),
  get: (id: number) =>
    api.get<IncidentResponse>(`/incidents/${id}`).then(r => r.data),
  getByNumber: (incidentNumber: string) =>
    api.get<IncidentResponse>(`/incidents/number/${incidentNumber}`).then(r => r.data),
  create: (data: IncidentCreateRequest) =>
    api.post<IncidentResponse>('/incidents', data).then(r => r.data),
  update: (id: number, data: IncidentUpdateRequest) =>
    api.put<IncidentResponse>(`/incidents/${id}`, data).then(r => r.data),
  setStatus: (id: number, status: IncidentStatus, notes?: string) =>
    api.patch<IncidentResponse>(`/incidents/${id}/status`, { status, notes }).then(r => r.data),
  assign: (id: number, analystId: number) =>
    api.patch<IncidentResponse>(`/incidents/${id}/assign`, { analystId }).then(r => r.data),
  close: (id: number, notes?: string) =>
    api.patch<IncidentResponse>(`/incidents/${id}/close`, { notes }).then(r => r.data),
  remove: (id: number) => api.delete<void>(`/incidents/${id}`).then(() => undefined),
  comments: (id: number) =>
    api.get<CommentResponse[]>(`/incidents/${id}/comments`).then(r => r.data),
  addComment: (id: number, body: string) =>
    api.post<CommentResponse>(`/incidents/${id}/comments`, { body }).then(r => r.data),
  // Customer portal
  mySummary: () => api.get<MySummary>('/incidents/my-summary').then(r => r.data),
  reopen: (id: number) => api.patch<IncidentResponse>(`/incidents/${id}/reopen`).then(r => r.data),
  confirmClose: (id: number) => api.patch<IncidentResponse>(`/incidents/${id}/confirm-close`).then(r => r.data),
}

export const attachmentApi = {
  list: (incidentId: number) =>
    api.get<AttachmentResponse[]>(`/incidents/${incidentId}/attachments`).then(r => r.data),
  upload: (incidentId: number, file: File, commentId?: number) => {
    const form = new FormData()
    form.append('file', file)
    return api
      .post<AttachmentResponse>(`/incidents/${incidentId}/attachments`, form, {
        params: commentId != null ? { commentId } : undefined,
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data)
  },
  download: (incidentId: number, attachmentId: number) =>
    api.get<Blob>(`/incidents/${incidentId}/attachments/${attachmentId}/download`, { responseType: 'blob' })
      .then(r => r.data),
}

export const csatApi = {
  get: (incidentId: number) =>
    api.get<CsatResponse>(`/csat/incident/${incidentId}`)
      .then(r => (r.status === 204 ? null : r.data)),
  submit: (incidentId: number, data: CsatRequest) =>
    api.post<CsatResponse>(`/csat/incident/${incidentId}`, data).then(r => r.data),
  summary: () => api.get<CsatSummaryRow[]>('/csat/summary').then(r => r.data),
}

export const logApi = {
  upload: (file: File, incidentId?: number) => {
    const form = new FormData()
    form.append('file', file)
    return api
      .post<LogUploadResult>('/logs/upload', form, {
        params: incidentId != null ? { incidentId } : undefined,
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data)
  },
  list: (params: LogListParams = {}) =>
    api.get<Page<LogResponse>>('/logs', { params }).then(r => r.data),
  byIncident: (incidentId: number) =>
    api.get<LogResponse[]>(`/logs/incident/${incidentId}`).then(r => r.data),
  stats: () => api.get<LogStats>('/logs/stats').then(r => r.data),
}

export const rcaApi = {
  forIncident: (incidentId: number) =>
    api.get<RcaResult>(`/rca/incident/${incidentId}`).then(r => r.data),
  analyze: (logs: string[]) =>
    api.post<RcaResult>('/rca/analyze', { logs }).then(r => r.data),
}

export const slaApi = {
  rules: () => api.get<SlaRuleResponse[]>('/sla/rules').then(r => r.data),
  updateRule: (id: number, resolutionTimeHours: number) =>
    api.put<SlaRuleResponse>(`/sla/rules/${id}`, { resolutionTimeHours }).then(r => r.data),
}

export const escalationApi = {
  list: () => api.get<EscalationResponse[]>('/escalations').then(r => r.data),
  byIncident: (incidentId: number) =>
    api.get<EscalationResponse[]>(`/escalations/incident/${incidentId}`).then(r => r.data),
}

export const dashboardApi = {
  summary: () => api.get<DashboardSummary>('/dashboard/summary').then(r => r.data),
  priorityDistribution: () =>
    api.get<ChartSlice[]>('/dashboard/priority-distribution').then(r => r.data),
  statusDistribution: () =>
    api.get<ChartSlice[]>('/dashboard/status-distribution').then(r => r.data),
  trends: (days = 14) =>
    api.get<TrendPoint[]>('/dashboard/trends', { params: { days } }).then(r => r.data),
  slaBuckets: () => api.get<SlaBuckets>('/dashboard/sla-buckets').then(r => r.data),
  /** 7x24 created-incident counts, Monday-first rows. */
  heatmap: (days = 28) => api.get<number[][]>('/dashboard/heatmap', { params: { days } }).then(r => r.data),
}

export const reportApi = {
  monthly: (year?: number, month?: number) =>
    api.get<MonthlyIncidentReport>('/reports/monthly', { params: { year, month } }).then(r => r.data),
  analysts: () => api.get<AnalystReport[]>('/reports/analysts').then(r => r.data),
  slaCompliance: () => api.get<SlaComplianceReport>('/reports/sla-compliance').then(r => r.data),
}

export const kbApi = {
  list: () => api.get<KbResponse[]>('/kb').then(r => r.data),
  /** Customer Help Center feed — only CUSTOMER + BOTH articles. */
  help: () => api.get<KbResponse[]>('/kb/help').then(r => r.data),
  get: (id: number) => api.get<KbResponse>(`/kb/${id}`).then(r => r.data),
  match: (text: string) => api.get<KbResponse[]>('/kb/match', { params: { text } }).then(r => r.data),
  create: (data: KbRequest) => api.post<KbResponse>('/kb', data).then(r => r.data),
  update: (id: number, data: KbRequest) => api.put<KbResponse>(`/kb/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete<void>(`/kb/${id}`).then(() => undefined),
}

export const userApi = {
  all: () => api.get<UserResponse[]>('/users').then(r => r.data),
  analysts: () => api.get<UserResponse[]>('/users/analysts').then(r => r.data),
  me: () => api.get<UserResponse>('/users/me').then(r => r.data),
  setStatus: (id: number, status: UserStatus) =>
    api.patch<UserResponse>(`/users/${id}/status`, { status }).then(r => r.data),
  setRole: (id: number, role: Role) =>
    api.patch<UserResponse>(`/users/${id}/role`, { role }).then(r => r.data),
}

export const infraApi = {
  metrics: () => api.get<InfraMetrics>('/infra/metrics').then(r => r.data),
}

export const publicApi = {
  stats: () => api.get<PublicStats>('/public/stats').then(r => r.data),
}

export const auditApi = {
  list: (page = 0, size = 20) =>
    api.get<Page<AuditResponse>>('/audit', { params: { page, size } }).then(r => r.data),
  stats: () => api.get<AuditStats>('/audit/stats').then(r => r.data),
  byIncident: (incidentId: number) =>
    api.get<AuditResponse[]>(`/audit/incident/${incidentId}`).then(r => r.data),
}
