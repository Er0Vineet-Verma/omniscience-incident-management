// Typed models mirroring the backend DTOs (see docs/API.md).

export type Role = 'ADMIN' | 'ANALYST' | 'CUSTOMER'
export type UserStatus = 'ACTIVE' | 'INACTIVE'
export type Priority = 'P1' | 'P2' | 'P3' | 'P4'
export type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING' | 'RESOLVED' | 'CLOSED'
export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
export type AuditAction =
  | 'CREATED' | 'UPDATED' | 'STATUS_CHANGED' | 'PRIORITY_CHANGED' | 'ASSIGNED'
  | 'ESCALATED' | 'RESOLVED' | 'CLOSED' | 'DELETED' | 'LOG_UPLOADED'

/** Spring Data page envelope. */
export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
}

export interface AuthResponse {
  token: string
  tokenType: string
  id: number
  name: string
  email: string
  role: Role
}

export interface UserResponse {
  id: number
  name: string
  email: string
  role: Role
  status: UserStatus
  createdAt: string
}

export interface IncidentResponse {
  id: number
  incidentNumber: string
  title: string
  description: string | null
  priority: Priority
  status: IncidentStatus
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  closedAt: string | null
  slaDeadline: string
  slaBreached: boolean
  escalationLevel: number
  resolutionNotes: string | null
  rootCause: string | null
  assignedToId: number | null
  assignedToName: string | null
  createdById: number
  createdByName: string
}

export interface IncidentCreateRequest {
  title: string
  description?: string
  priority: Priority
}

export interface IncidentUpdateRequest {
  title?: string
  description?: string
  priority?: Priority
  status?: IncidentStatus
  resolutionNotes?: string
  rootCause?: string
}

export interface IncidentListParams {
  priority?: Priority
  status?: IncidentStatus
  assignedToId?: number
  q?: string
  page?: number
  size?: number
  sort?: string
}

export interface SlaRuleResponse {
  id: number
  priority: Priority
  resolutionTimeHours: number
}

export interface EscalationResponse {
  id: number
  incidentId: number
  incidentNumber: string
  level: number
  escalatedTo: 'TEAM_LEAD' | 'MANAGER' | 'CRITICAL_ALERT'
  reason: string
  escalatedAt: string
}

export interface LogResponse {
  id: number
  incidentId: number | null
  timestamp: string
  logLevel: LogLevel
  message: string
  source: string
  uploadedBy: string
  createdAt: string
}

export interface LogUploadResult {
  source: string
  totalLines: number
  parsed: number
  errors: number
  warnings: number
  infos: number
  incidentId: number | null
}

export interface LogListParams {
  level?: LogLevel
  incidentId?: number
  q?: string
  from?: string
  to?: string
  page?: number
  size?: number
}

/** Counts per log level plus TOTAL. */
export type LogStats = Record<LogLevel | 'TOTAL', number>

export interface RcaFinding {
  rule: string
  matchCount: number
  likelyRootCause: string
  suggestedActions: string[]
}

export interface KbMatch {
  kbNumber: string
  title: string
  resolution: string
}

export interface RcaResult {
  incidentId: number | null
  analyzedLogCount: number
  errorCount: number
  warnCount: number
  findings: RcaFinding[]
  kbMatches: KbMatch[]
}

export interface DashboardSummary {
  openIncidents: number
  inProgress: number
  closedToday: number
  slaBreaches: number
  p1Open: number
  totalIncidents: number
  totalLogs: number
  errorLogs: number
}

export interface ChartSlice {
  label: string
  value: number
}

export interface TrendPoint {
  date: string
  created: number
  resolved: number
}

export interface MonthlyIncidentReport {
  year: number
  month: number
  totalCreated: number
  totalResolved: number
  totalClosed: number
  byPriority: Record<string, number>
  byStatus: Record<string, number>
  slaCompliancePercent: number
}

export interface AnalystReport {
  analystId: number
  analystName: string
  email: string
  assignedTotal: number
  openNow: number
  resolvedTotal: number
  avgResolutionHours: number
  slaCompliancePercent: number
  p1OpenCount: number
}

/** Server-side SLA health buckets over all active incidents. */
export interface SlaBuckets {
  healthy: number
  risk: number
  fail: number
}

export interface SlaPriorityRow {
  priority: Priority
  total: number
  withinSla: number
  compliancePercent: number
}

export interface SlaComplianceReport {
  totalResolved: number
  resolvedWithinSla: number
  breached: number
  compliancePercent: number
  byPriority: SlaPriorityRow[]
}

export type Audience = 'INTERNAL' | 'CUSTOMER' | 'BOTH'

export interface KbResponse {
  id: number
  kbNumber: string
  title: string
  issueDescription: string | null
  rootCause: string | null
  resolution: string
  keywords: string
  audience: Audience
  createdBy: string
  createdAt: string
  timesUsed: number
}

export interface KbRequest {
  title: string
  issueDescription?: string
  rootCause?: string
  resolution: string
  keywords?: string
  audience?: Audience
}

/** Customer-scoped request counts (GET /api/incidents/my-summary). */
export interface MySummary {
  open: number
  inProgress: number
  pending: number
  resolved: number
  closed: number
  total: number
}

export interface AttachmentResponse {
  id: number
  incidentId: number
  commentId: number | null
  filename: string
  contentType: string
  sizeBytes: number
  uploadedBy: string
  createdAt: string
}

export interface CsatRequest {
  rating: number
  comment?: string
}

export interface CsatResponse {
  id: number
  incidentId: number
  analystId: number | null
  analystName: string | null
  rating: number
  comment: string | null
  submittedBy: string
  createdAt: string
}

export interface CsatSummaryRow {
  analystId: number
  analystName: string
  ratingCount: number
  averageRating: number
}

export interface InfraMetrics {
  uptimeSeconds: number
  cpuLoadPercent: number
  heapUsedMb: number
  heapMaxMb: number
  threadCount: number
  availableProcessors: number
  diskFreeGb: number
  diskTotalGb: number
  dbStatus: string
  dbLatencyMs: number
  dbProfile: string
  osName: string
  javaVersion: string
  slaSchedulerEnabled: boolean
  slaLastSweepAt: string | null
  slaLastSweepOverdue: number
}

export interface PublicStats {
  openIncidents: number
  p1Open: number
  totalIncidents: number
  slaCompliancePercent: number
  analystsOnDuty: number
}

export interface CommentResponse {
  id: number
  incidentId: number
  authorName: string
  authorEmail: string
  body: string
  createdAt: string
}

export interface AuditResponse {
  id: number
  entityType: string
  entityId: number
  action: AuditAction
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  performedBy: string
  timestamp: string
}

export interface AuditStats {
  totalEvents: number
  eventsToday: number
  escalations: number
  resolved: number
  deletions: number
  distinctActors: number
}
