# Electioneering — Backend

Node + TypeScript + Express + Prisma + PostgreSQL.

## Setup

```bash
cd backend
cp .env.example .env          # adjust DATABASE_URL if needed
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run db:seed               # optional: load sample voter + Form 20 data
npm run dev                   # http://localhost:4000
```

## API

### Voters
- `GET    /api/voters?state=&assemblyNo=&search=&take=&skip=`
- `GET    /api/voters/:id`
- `POST   /api/voters`              — single voter
- `POST   /api/voters/bulk`         — `{ voters: [...] }`
- `PUT    /api/voters/:id`
- `DELETE /api/voters/:id`

### Elections / Form 20
- `GET    /api/elections`
- `GET    /api/elections/:id`            — full Form 20 view
- `POST   /api/elections`                — create election header
- `PUT    /api/elections/:id`
- `DELETE /api/elections/:id`
- `GET    /api/elections/:id/candidates`
- `POST   /api/elections/:id/candidates` — add candidate
- `PUT    /api/elections/:id/candidates/:cid`
- `DELETE /api/elections/:id/candidates/:cid`
- `PUT    /api/elections/:id/form20`     — replace polling-station rows + votes

### Uploads (xlsx / xls / csv)
- `POST /api/uploads/preview?kind=voter|form20`  — multipart `file`, returns parsed JSON; **does not write to DB**
- `POST /api/uploads/voters/commit`              — `{ fileName, source, rows }`
- `POST /api/uploads/form20/commit`              — `{ fileName, source, state, parlNo, parlName, assemblyNo, assemblyName, totalElectors, candidates: string[], rows: [...] }`
- `GET  /api/uploads/history`

## Flow for upload preview

1. `POST /api/uploads/preview` with the file → frontend shows preview table.
2. User edits / confirms.
3. Frontend calls `/voters/commit` or `/form20/commit` with cleaned rows.
