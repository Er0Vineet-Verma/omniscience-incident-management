# Frontend — React + TypeScript + Material UI (Vite)

UI shell for the Incident Management System. The **infrastructure layer is complete**;
page designs are produced in the dedicated UI phase (ui-ux-pro-max / Stitch).

## Run

```bash
npm install
npm run dev      # http://localhost:5173 — proxies /api to the backend on :8080
npm run build    # type-check + production bundle to dist/
```

Start the backend first: `cd ../backend && mvn spring-boot:run`.
Seeded logins: `admin@ims.com / Admin@123`, `analyst1@ims.com / Analyst@123`, `customer@ims.com / Customer@123`.

## Structure

```
src/
├── api/
│   ├── types.ts      # TS models mirroring every backend DTO (see ../docs/API.md)
│   ├── client.ts     # axios instance: JWT header injection, 401 auto-logout, errorMessage()
│   └── index.ts      # typed endpoint groups: authApi, incidentApi, logApi, rcaApi,
│                     #   slaApi, escalationApi, dashboardApi, reportApi, kbApi, userApi, auditApi
├── context/
│   └── AuthContext.tsx   # useAuth(): user, login, register, logout, hasRole(...)
├── components/
│   └── ProtectedRoute.tsx # route guard with optional role restriction
├── pages/                # placeholders — replaced during the UI phase
└── App.tsx               # final route map + role guards (paths are stable)
```

## Conventions for UI work

- **Never call axios directly** — import from `src/api` (e.g. `incidentApi.list({ status: 'OPEN' })`).
  Everything is typed; check `src/api/types.ts` for shapes.
- Auth state: `const { user, hasRole, logout } = useAuth()`.
- Role gating in JSX: `hasRole('ADMIN', 'ANALYST')`.
- Paged endpoints return the Spring `Page<T>` envelope (`content`, `totalElements`, …).
- Charts: `recharts` is installed; dashboard endpoints return ready-to-plot
  `ChartSlice[]` / `TrendPoint[]`.
- Routes & required roles are already wired in `App.tsx` — design pages drop into
  the existing `<Route>` slots.
