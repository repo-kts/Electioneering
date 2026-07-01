# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo shape

Full-stack monorepo with two independent apps:

- `frontend/` — React 18 SPA (Vite, React Router v6, TanStack Query, Recharts).
- `backend/` — Node + TypeScript + Express + Prisma + PostgreSQL. Ships both as a local server and as a single Vercel serverless function.

Root-level cruft to ignore (not wired to anything): `analytics.html` / `user.html` are static design mockups; `prisma/` and `package-lock.json` at the repo root are empty leftovers — the real Prisma project is `backend/prisma/`. The product proposal is `Proposal_Electioneering.pdf`.

There is **no lint, no test runner**. Don't add them unless asked.

## Commands

Frontend (from `frontend/`):

```bash
npm install
npm run dev      # Vite dev server on http://localhost:5173 (auto-opens browser)
npm run build    # production build → frontend/dist
npm run preview  # serve the built bundle
```

Frontend needs `frontend/.env` with `VITE_API_URL` pointing at the backend (e.g. `http://localhost:4000`). `lib/api.js` reads `import.meta.env.VITE_API_URL` as the base URL.

Backend (from `backend/`):

```bash
cp .env.example .env             # set DATABASE_URL, JWT_SECRET
npm install                      # postinstall runs `prisma generate`
npm run prisma:migrate           # apply migrations to a local Postgres
npm run db:seed                  # seed users + sample voter/Form 20 data
npm run dev                      # tsx watch → http://localhost:4000
npm run build && npm start       # tsc → node dist/index.js
npm run prisma:studio            # inspect the DB
```

Seeded logins (override via `SEED_ADMIN_PW` / `SEED_OPERATOR_PW`): `admin`/`admin123` (role `admin`), `operator`/`operator123` (role `data_operator`).

## The domain in one paragraph

This is a voter-analytics tool for a politician, not a generic dashboard. The pipeline: officers upload **voter rolls** and **Form 20** (the ECI Detailed Result Sheet — polling-station × candidate vote counts). The backend infers each voter's likely candidate preference by inheriting their polling station's Form 20 vote-share (`services/inference.ts`), writes it to `Voter.predictedLeaning` (JSONB), and then lets an admin **segment** voters by demographics + geography + turnout + predicted leaning and save those filters as **cohorts**. Booth-level correlation is the point.

## Backend architecture

- `src/app.ts` is the Express **app factory** (`createApp` / `getApp` singleton), imported by both `src/index.ts` (local listener) and `api/index.ts` (Vercel handler). Route mounting + the role gates live here — read it first.
- **Auth**: JWT bearer tokens. `middleware/auth.ts` exposes `requireAuth` and `requireAdmin`. Mount-level gating in `app.ts` is the source of truth for who can hit what:
  - Public: `/api/auth`, `/api/templates`.
  - Both roles: `/api/voters`, `/api/elections`, `/api/uploads`.
  - Admin only: `/api/analytics`, `/api/cohorts`.
- **Data model** (`prisma/schema.prisma`, Postgres): `Voter` is the primary entity. `Election → Candidate / PollingStation → VoteResult` model the Form 20 grid. `VoterTurnout` is per voter × election. `Cohort.criteria` is a serialized segment spec (JSONB). `Household` groups voters. `UploadHistory` is the audit trail.
- **Key services**:
  - `services/inference.ts` — recompute `predictedLeaning` from Form 20; also `linkVotersToPollingStations` matches voters to a PS by name when they were created before Form 20.
  - `services/segmentation.ts` — `segmentSchema` (Zod) is the canonical criteria shape; `buildVoterWhere` turns it into a Prisma where-clause. **Predicted-leaning filtering is done in JS post-query** (`passesLeaningFilter`), not in SQL — see the comment there if you touch it. `aggregate()` produces the demographic breakdowns.
  - `services/parseUpload.ts` parses xlsx/csv; `services/voterValidation.ts` validates rows.
- **Upload flow** is two-phase: `POST /api/uploads/preview?kind=voter|form20` parses and returns JSON **without writing**; the frontend shows a preview; then `/uploads/voters/commit` or `/uploads/form20/commit` persists. Templates are downloadable from `/api/templates`.

## Frontend architecture

- `src/main.jsx` nests the providers: `QueryClientProvider` → `BrowserRouter` → `AuthProvider` → `ToastProvider` → `App`. Order matters (auth + toast both rely on being inside the router/query client).
- `src/App.jsx` declares routes, each wrapped in `<ProtectedRoute roles={[...]}>`. Routes: `/login`, `/` (Home), `/voter-detail`, `/form-20`, `/analytics` (admin), `/segment` (admin). The `roles` here must stay in sync with the backend mount-level gates in `app.ts`.
- **Data layer is real**, not mock. `src/lib/api.js` is the single fetch wrapper — it attaches the bearer token, redirects to `/login` on 401, and exposes the `api.*` method object plus `downloadBlob` / `downloadUrls` for file downloads. Pages fetch through TanStack Query (`useQuery` / `useMutation`); mutations invalidate query keys to keep Home/Analytics stats live. When adding an endpoint, add a method to `api.js` rather than calling `fetch` in components.
- `src/context/AuthContext.jsx` — `useAuth()` gives `{ user, loading, login, logout, hasRole }`; token in `localStorage` under `auth_token`. `src/context/ToastContext.jsx` — `useToast().show(message, type)`.
- **Styles** are split across `src/styles/{tokens,base,primitives,pages,analytics}.css`, all pulled in by `src/styles/index.css` (the only file `main.jsx` imports). Design tokens (CSS variables) live in `tokens.css`. New styles go in the matching file; no CSS modules / styled-components.

### Dead code warning

`src/components/analytics/*Chart.jsx` (GenderChart, AgeGroupChart, SurnameChart, PartyBarChart, VoteShareDonut, TurnoutLineChart, …) and most of `src/data/*.js` are **orphaned legacy mock charts** — not imported anywhere. The live `routes/AnalyticsPage.jsx` builds its charts inline from the `/api/analytics/overview` query instead. Don't wire new work into the old components; don't trust `data/*.js` as a description of current behavior.

### Form 20 spreadsheet has live calculations

`components/upload/Form20.jsx` mirrors the ECI Detailed Result Sheet: polling stations × candidates, with auto-computed `Valid Votes = Σ candidates` and `Total = Valid + Rejected + NOTA`, plus a live totals row. It commits via `api.commitForm20` / `api.saveForm20`.

## Deploy

Backend deploys to Vercel as one serverless function (Root Directory = `backend`, `rhel-openssl-3.0.x` Prisma binary target is already set). Env vars: `DATABASE_URL` (Neon pooler URL), `JWT_SECRET`, `CORS_ORIGIN`. Run `prisma migrate deploy` against the remote DB once. Details in `backend/README.md`.
