# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo shape

Frontend-only React app. The root contains the proposal PDF and two standalone HTML prototypes (`analytics.html`, `user.html`) — these are static design mockups, **not** wired to the React app. All real source lives under `frontend/`. There is no backend yet (Node/Express/Prisma/Postgres are planned per `README.md`).

All commands run from `frontend/`:

```bash
cd frontend
npm install
npm run dev      # Vite dev server on http://localhost:5173 (auto-opens browser)
npm run build    # production build → frontend/dist
npm run preview  # serve the built bundle
```

No lint, no test runner, no TypeScript configured. Don't add them unless asked.

## Architecture

Single-page React 18 app, React Router v6, Recharts for charts, plain CSS in one file.

- `src/main.jsx` mounts `App` inside `BrowserRouter` + `ToastProvider`.
- `src/App.jsx` declares the four routes: `/`, `/voter-detail`, `/form-20`, `/analytics`.
- `src/styles/index.css` holds **all** styles + design tokens (CSS variables) — ~2k lines, no CSS modules, no styled-components. New component styles go here.
- `src/context/ToastContext.jsx` exposes `useToast().show(message, type)` for global toast notifications. Used app-wide.

### Data layer is mock-only

Every chart, table, and seeded form pulls from `src/data/*.js`. There is **no fetch layer**. The README has a `Mock data → API endpoint mapping` table that future-you should consult when wiring the backend; replace the static imports with fetch calls in the page components, not in the chart components.

The `handleRecordSubmit` / `handleSubmit` / `handleFileAccepted` handlers in `routes/VoterDetailPage.jsx` and `routes/Form20Page.jsx` are the integration points — they currently push into local `useState`, and should `POST` to the backend when it exists.

### State is page-local on purpose (and a known limitation)

- Each page (Voter Detail, Form 20) keeps its own copy of voters/history seeded from `data/history.js`.
- Adding a voter on the Voter Detail page does **not** propagate to the demographic charts on the Analytics page — those read fixed aggregates from `data/voterDemographics.js`.
- Making them dynamic requires lifting voters into a shared Context (e.g. `VoterContext` + `HistoryContext`) and recomputing aggregates from it. Don't do this piecemeal — if you start, do it consistently across all three pages.

### Form 20 spreadsheet has live calculations

`components/upload/Form20.jsx` mirrors the ECI Detailed Result Sheet: 22 polling stations × 10 candidates, with auto-computed `Valid Votes = Σ candidates`, `Total = Valid + Rejected + NOTA`, plus a live totals row. Seed data in `data/form20Data.js`.

### Upload is simulated

`components/upload/Dropzone.jsx` animates a progress bar and creates a fake history entry — it does **not** parse files. Real `.xlsx` / `.csv` parsing is a TODO (the `xlsx` package is mentioned in the README plan).
