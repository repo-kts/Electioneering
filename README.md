# Electioneering — Frontend

Vite + React frontend for the Election Data Collection & Real-Time Analytics platform.

## Stack

- **React 18** with React Router v6
- **Vite** dev server / bundler
- **Recharts** for the analytics charts (bar, donut, line, demographics)
- **Plus Jakarta Sans** via Google Fonts
- Plain CSS with design tokens (CSS variables) — no CSS-in-JS or framework

## Getting started

```bash
npm install
npm run dev
```

The dev server runs at <http://localhost:5173>.

## Scripts

| Command           | What it does                          |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Start the Vite dev server with HMR    |
| `npm run build`   | Production build into `dist/`         |
| `npm run preview` | Preview the production build locally  |

## Pages

| Route             | Page              | Contents                                                                 |
| ----------------- | ----------------- | ------------------------------------------------------------------------ |
| `/`               | Home              | Tile-based landing — Voter Detail and Form 20 tiles                      |
| `/voter-detail`   | Voter Detail      | Tabs: Add Voter (spreadsheet) · Upload File · History                    |
| `/form-20`        | Form 20           | Tabs: Form 20 (detailed result sheet) · Upload File · History            |
| `/analytics`      | Analytics         | KPIs, charts, voter demographics, constituency map, top results          |

## Folder layout

```
src/
├── main.jsx                    # entry — mounts App in BrowserRouter + ToastProvider
├── App.jsx                     # routes
├── styles/
│   └── index.css               # design tokens + all component styles
├── routes/
│   ├── HomePage.jsx            # tile landing page
│   ├── VoterDetailPage.jsx     # Add Voter / Upload / History tabs
│   ├── Form20Page.jsx          # Form 20 / Upload / History tabs
│   └── AnalyticsPage.jsx       # KPIs, charts, demographics, map, results
├── components/
│   ├── layout/
│   │   └── Header.jsx
│   ├── ui/
│   │   └── Icon.jsx            # inline SVG icon set
│   ├── upload/
│   │   ├── Dropzone.jsx        # drag-drop + simulated upload progress
│   │   ├── RecordForm.jsx      # voter spreadsheet (multi-row entry)
│   │   ├── Form20.jsx          # Form 20 spreadsheet (auto-calc totals)
│   │   ├── ValidationCard.jsx
│   │   ├── SessionCard.jsx
│   │   └── HistoryTable.jsx
│   └── analytics/
│       ├── FilterBar.jsx
│       ├── KpiGrid.jsx
│       ├── Sparkline.jsx
│       ├── PartyBarChart.jsx
│       ├── VoteShareDonut.jsx
│       ├── TurnoutLineChart.jsx
│       ├── ConstituencyMap.jsx
│       ├── ResultsTable.jsx
│       ├── SurnameChart.jsx    # voter demographics
│       ├── GenderChart.jsx     # voter demographics
│       └── AgeGroupChart.jsx   # voter demographics
├── context/
│   └── ToastContext.jsx        # global toast notifications
└── data/                       # mock data — replace with API calls when backend lands
    ├── parties.js
    ├── constituencies.js
    ├── history.js
    ├── results.js
    ├── voterForm.js            # states, gender, EPIC pattern, dummy voters
    ├── voterDemographics.js    # surname/gender/age aggregations
    └── form20Data.js           # Form 20 candidates + 22 polling stations
```

## Current Status

### What's working

- **Home page** with tiles for Voter Detail and Form 20 sections
- **Voter Detail page** with three tabs:
  - Add Voter — Excel-style spreadsheet, 8 dummy Indian voters pre-filled, add/delete rows, validation
  - Upload File — drag-drop with simulated progress
  - History — searchable, filterable history table
- **Form 20 page** mirroring the official ECI Detailed Result Sheet:
  - Polling-station-wise vote counts for 10 candidates
  - Auto-calculated totals (Valid Votes = sum of candidates; Total = Valid + Rejected + NOTA)
  - Live totals row at the bottom
  - 22 polling stations pre-filled from real Form 20 sample data
- **Analytics page** with:
  - KPI cards with sparklines (live ticker for Total Votes)
  - Party-wise vote totals (bar chart)
  - Vote share (donut chart)
  - **Voter Demographics**: surname, gender, age group charts
  - Hourly turnout (line chart with 2022 comparison + forecast)
  - Constituency outlook map (96 cells, hover tooltips)
  - Top constituencies results table
- **Shared toast notifications** across all pages
- **Responsive layout** down to mobile

### Known limitations

- **Charts are static.** All chart data is hardcoded in `src/data/`. Adding a voter to the
  spreadsheet does **not** update the demographic charts (surname/gender/age) on the
  Analytics page. To make them dynamic, voter records need to be lifted into a shared
  store (React Context) and the charts must read aggregated counts from it.
- **History is page-local.** Each page (Voter Detail, Form 20) keeps its own history copy
  seeded from `data/history.js`. A shared HistoryContext would unify them.
- **No persistence.** Refreshing the page resets everything to mock state — no backend
  yet, so nothing is saved.
- **Upload is simulated.** The drag-drop animates a progress bar but doesn't actually
  parse the file; it just creates a fake history entry.

### What still needs to be done

| Area                   | Task                                                                       |
| ---------------------- | -------------------------------------------------------------------------- |
| Backend                | Node.js + Express + Prisma + PostgreSQL per the proposal                   |
| Auth                   | JWT login flow, role-based middleware (Officer L1 / L2 / L3)               |
| File storage           | AWS S3 (with local-disk fallback for dev)                                  |
| API integration        | Replace `src/data/*` mock imports with `fetch` calls to backend endpoints  |
| Excel parsing          | Wire `Dropzone` to actually parse uploaded `.xlsx` / `.csv` (xlsx package) |
| Shared state           | React Context for voters + history so charts update live                   |
| Deployment             | AWS EC2 host, Nginx reverse proxy, env-based config                        |
| Tests                  | Unit + integration tests (none yet)                                        |

## Mock data → API endpoint mapping

When the backend lands, swap each import for a fetch — the components don't care where
the data comes from.

| Data file                                 | Replace with                                         |
| ----------------------------------------- | ---------------------------------------------------- |
| `parties.js`                              | `GET /api/parties`                                   |
| `constituencies.js`                       | `GET /api/constituencies/leaders`                    |
| `history.js` (uploads)                    | `GET /api/uploads?limit=20`                          |
| `history.js` (session)                    | `GET /api/auth/me`                                   |
| `history.js` (validation checks)          | `GET /api/uploads/:id/validation`                    |
| `results.js` (party totals)               | `GET /api/analytics/party-totals?date=…&region=…`    |
| `results.js` (vote share)                 | `GET /api/analytics/vote-share`                      |
| `results.js` (turnout)                    | `GET /api/analytics/turnout?compareTo=2022`          |
| `results.js` (top results)                | `GET /api/analytics/top-results?sortBy=margin`       |
| `voterForm.js` (DUMMY_VOTERS)             | `GET /api/voters?limit=N`                            |
| `voterDemographics.js` (surname / gender) | `GET /api/analytics/voters/by-surname` etc.          |
| `form20Data.js` (initial rows)            | `GET /api/form20/:assemblyId`                        |

The submit handlers in [VoterDetailPage.jsx](src/routes/VoterDetailPage.jsx) and
[Form20Page.jsx](src/routes/Form20Page.jsx) (`handleRecordSubmit`, `handleSubmit`,
`handleFileAccepted`) are the spots that should `POST` to the backend instead of pushing
into local state.
