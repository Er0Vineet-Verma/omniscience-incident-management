# Omniscience — AI-Powered Incident Management & Log Analysis Platform

![Java](https://img.shields.io/badge/Java-21-orange) ![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4.1-brightgreen) ![React](https://img.shields.io/badge/React-19-61dafb) ![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6) ![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8) ![Build](https://img.shields.io/badge/build-passing-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

A **full-stack incident management platform** for IT operations teams: track incidents end-to-end, enforce SLAs with automatic escalation, upload and analyze application logs, and get rule-based root-cause suggestions backed by a reusable knowledge base — plus a **self-service customer portal** so end users can raise, follow, and rate their own support requests.

Two role-aware interfaces on one codebase:
- **Operations console** (Admin/Analyst) — a dark "Mission Control" for triage, assignment, SLA/escalation, log analysis, dashboards, reports, KB, governance, and audit.
- **Customer portal** (Customer) — a calm, light "Omniscience Support" experience for creating requests, tracking their lifecycle, chatting with analysts, attaching files, reopening/closing, and leaving a satisfaction rating.

## Problem Statement

IT support teams drown in unstructured incident reports and gigabytes of application logs. Incidents get lost in email threads, SLA deadlines slip silently, and the same root causes are re-diagnosed from scratch every few weeks because nobody captured what fixed them last time. Managers lack a live view of open workload, breach risk, and analyst performance — and customers have no window into their own tickets.

This system centralizes the entire incident lifecycle — creation, assignment, SLA tracking, escalation, resolution — pairs it with a log-analysis engine that parses uploaded logs and matches error patterns against a curated knowledge base to suggest probable root causes, and exposes a customer-facing portal with strict data isolation. Every change is audited, and dashboards/reports give management real-time and historical visibility.

## Architecture

```
 ┌───────────────────────────┐        ┌───────────────────────────────┐        ┌──────────────┐
 │  React 19 + Vite + TS SPA │        │      Spring Boot Backend      │  JPA   │    MySQL     │
 │                           │  HTTPS │  REST API · JWT · Scheduler   │ ─────► │  (H2 in dev) │
 │  Ops console (dark)       │ ─────► │                               │        └──────────────┘
 │  Customer portal (light)  │  JWT   │  auth │ incidents │ logs      │
 │  Tailwind v4 · RBAC routes│        │  sla  │ escalation│ rca       │        ┌──────────────┐
 └───────────────────────────┘        │  kb   │ dashboard │ reports   │ ─────► │  Ollama AI   │
                                       │  users│ audit     │ assignment│ future │  RCA engine  │
                                       │  csat │ attach    │ governance│        └──────────────┘
                                       └───────────────────────────────┘
```

## Features

### Core platform
- **Incident management** — full lifecycle (OPEN → IN_PROGRESS → PENDING → RESOLVED → CLOSED) with unique incident numbers, priorities P1–P4, filtering, search, and pagination
- **RBAC + JWT security** — stateless bearer-token auth with three roles (ADMIN, ANALYST, CUSTOMER) enforced via Spring method security
- **Round-robin assignment** — new incidents are automatically distributed across active analysts
- **SLA engine** — per-priority resolution deadlines (P1=4h, P2=8h, P3=24h, P4=72h), admin-configurable at runtime
- **Escalation L1–L3** — a background monitor flags SLA breaches (L1 → Team Lead), then escalates to Manager (L2) and Critical Alert (L3) as incidents stay unresolved
- **Log upload & parsing** — upload raw log files, parse timestamps/levels/messages, attach them to incidents, search and filter them
- **Rule-based RCA** — pattern-matching engine scans error/warning logs, identifies likely root causes, and suggests corrective actions
- **Knowledge base** — reusable KB articles (issue, root cause, resolution, keywords) matched automatically during RCA, with an `INTERNAL / CUSTOMER / BOTH` audience field
- **Dashboard, reports & audit** — live KPIs and distribution/trend charts; monthly, analyst-performance, and SLA-compliance reports; every mutation recorded (who, what, old → new, when)

### Customer self-service portal
- **Raise & track requests** — create tickets and watch them move through a live status timeline
- **Conversation + attachments** — reply to analysts inline and attach files (validated type/size) to requests or comments
- **Reopen / confirm & close** — customers control resolution: reopen a resolved request or confirm closure
- **CSAT** — rate support after closure; ratings are tied to the assigned analyst and roll up into a per-analyst summary
- **Help Center** — self-serve articles fed from the knowledge base (customer-facing audience only)
- **Strict data isolation** — customers only ever see their own requests; global dashboards/reports/KB catalog are locked to Admin/Analyst

## Security hardening

- **JWT secret is environment-only** with fail-fast startup (no insecure default ever ships)
- **Rate limiting** on auth and general endpoints (429 + `Retry-After`)
- **Account lockout** after repeated failed logins
- **BCrypt strength 12** password hashing
- **Security headers** — CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-Frame-Options
- **Upload MIME allowlist** + size caps on attachments
- **Method-level RBAC** + customer visibility enforcement on every incident/KB/dashboard path
- **Full audit trail** of state changes

## Tech Stack

| Layer            | Technology                                                        |
|------------------|-------------------------------------------------------------------|
| Frontend         | React 19, Vite 8, TypeScript 6, Tailwind CSS v4, React Router v7, Axios |
| Language (API)   | Java 21                                                            |
| Framework        | Spring Boot 3.4.1 (Web, Data JPA, Security, Validation, Actuator)  |
| Auth             | JWT (jjwt 0.12.x), BCrypt password hashing                        |
| Database (dev)   | H2 (file-based, MySQL mode)                                       |
| Database (prod)  | MySQL 8.4                                                         |
| API docs         | springdoc-openapi (Swagger UI)                                    |
| Build            | Maven (backend), npm/Vite (frontend)                             |
| Container        | Docker multi-stage build, Docker Compose                          |
| CI               | GitHub Actions                                                    |
| AI RCA (planned) | Ollama (local LLM)                                               |

## Quickstart

### Backend (H2, zero setup)

```bash
cd backend
cp .env.example .env      # set JWT_SECRET (Base64, ≥ 256-bit) — required, no default
mvn spring-boot:run
```

- API base: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- H2 console: `http://localhost:8080/h2-console` (JDBC URL `jdbc:h2:file:./data/imsdb`, user `sa`, empty password)

Demo data (users, SLA rules, incidents, logs, KB articles) is seeded automatically on first start.

### Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173 (proxies /api → :8080)
```

Pick **Customer** or **Operations** on the login screen; you're routed to the right interface by role.

### Production (Docker Compose: MySQL + backend)

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

See [docker/README.md](docker/README.md) for environment variables (`JWT_SECRET`, DB credentials) and details.

## Seeded Credentials

| Role     | Email             | Password     | Lands on            |
|----------|-------------------|--------------|---------------------|
| ADMIN    | admin@ims.com     | Admin@123    | Operations console  |
| ANALYST  | analyst1@ims.com  | Analyst@123  | Operations console  |
| CUSTOMER | customer@ims.com  | Customer@123 | Customer portal     |

## Documentation

- [docs/API.md](docs/API.md) — every REST endpoint with roles, request/response examples, and the auth flow
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — module map, request flows, data model, security model, profiles
- [docs/PROGRESS.md](docs/PROGRESS.md) — detailed build progress log
- [database/README.md](database/README.md) — schema, FK policy, manual SQL setup

## Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Backend: incidents, auth, SLA, escalation, logs, RCA, KB, dashboard, reports, audit | ✅ Done |
| 2 | React operations console (dashboard, incident workspace, log viewer, KB, governance, audit) | ✅ Done |
| 3 | Security hardening (JWT env-only, rate limiting, lockout, headers, MIME validation) | ✅ Done |
| 4 | Customer self-service portal (requests, timeline, chat + attachments, reopen/close, CSAT, Help Center) | ✅ Done |
| 5 | Email notifications (assignment, breach, escalation) | 🔜 Planned |
| 6 | PDF report export | 🔜 Planned |
| 7 | Ollama AI-powered RCA + RAG knowledge base (semantic retrieval) | 🔜 Planned |

## License

MIT
