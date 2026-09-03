# PCB Inspector — Web Client

Next.js client for **PCB Inspector**: upload PCB images, run inference against the shared FastAPI backend, and review detected defects as bounding boxes overlaid on the image.

Pages: `/` (home), `/inspect` (upload + results), `/history` (per-user history + review), `/model` (Model Card), `/login`, `/register`.

## Stack

- [Next.js](https://nextjs.org) (App Router, `src/app/`) with React 19 and TypeScript
- [Tailwind CSS](https://tailwindcss.com) v4 (CSS-first configuration via `@tailwindcss/postcss`)
- Auth: `better-auth` (email/password); DB: Drizzle + SQLite locally (`./sqlite.db`), Turso in production
- No additional UI or state-management libraries

## Prerequisites

The FastAPI backend must be reachable (default `http://localhost:8000`, override `NEXT_PUBLIC_API_URL`). Start it from the repository root:

```bash
pip install -r requirements.txt
cd backend
uvicorn main:app --reload
```

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Copy needed vars to `.env.local` (never committed):

- `NEXT_PUBLIC_API_URL` — backend URL
- `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` — production DB (omit for local SQLite file)
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` — auth

Without a backend, append `?demo=1` (e.g. `/inspect?demo=1`) for offline demo mode with canned results.

## How it works

- `/inspect` (`src/app/inspect/page.tsx`): queue, client-side compression (>2 MB → JPEG 0.85, dimensions kept), sensitivity presets (0.30/0.45/0.60 calibrated via E16 sweep), two-model compare (IoU ≥ 0.5), `ZoomableViewer` + sortable `DetectionTable`, export JSON/CSV/PDF report.
- API layer (`src/lib/api.ts`), class colors/meta (`src/lib/colors.ts`, single source), demo recordings (`public/demo/canned.json`).
- History API (`src/app/api/history/`) is session-protected; thumbnails + dims + threshold stored per inspection.

## Checks

```bash
npm run lint
npm run build
npm test        # vitest
```

## Deploy

Vercel with Root Directory = `web/`; set the env vars above in project settings. Backend + DB deploy notes: root `README.md` (Deployment).
