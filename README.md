# Policy Creator — Corporate Policy Governance

A web platform for **authoring, approving, versioning and publishing** company policies.
It models the full lifecycle **Draft → Approval → Publish → Viewer**, captures topics,
business rules and BPM application links on every policy, and produces print-ready
**PDF** documents in the NEWEAST layout.

> Internal product of **New East General Trading**. See [LICENSE](LICENSE).

Live apps:

| App | URL |
|-----|-----|
| Policy Creator | https://policycreator.neweast.cloud/ |
| Policy Viewer | https://policycreator.neweast.cloud/viewer |

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Quick start (local development)](#quick-start-local-development)
- [Configuration](#configuration)
- [Production deployment](#production-deployment)
- [Access control](#access-control)
- [Useful commands](#useful-commands)
- [Documentation](#documentation)
- [Contributing](#contributing)

---

## Features

**Policy authoring**

- Wizard: companies (multi-select), visibility (general vs department-specific), department,
  optional BPM process / sub-process link, topics, rich-text content, **business rules**,
  and **Apply to** (BPM Application Master, multi-select).
- Word template import into topics; reusable policy templates.
- Auto-saved drafts; print-ready document preview in the Review step.
- **Business System & IT** staff can create policies for any company, and can **edit any**
  in-flight policy (draft / returned / in approval).

**Approval workflow**

- Multi-stage electronic approval with signatures, comments, escalation and matrix changes.
- Per-department **Approval Setup**, including multi-company matrices.
- Business System & IT policies route to **Guru** as the sole approver.
- Microsoft Teams notifications for submit, approve, return and setup changes.

**Versions & publication**

- **New version** keeps name and scope; version number increments (`v1.0`, `v2.0`, …).
- Publishing a new version deactivates older published copies in the same family.
- Owner or IT can **deactivate** / **activate** a published policy (only one active version
  per family). Viewer shows published **and active** policies only.

**Documents & printing**

- Professional NEWEAST sheet: header, table of contents, document control, authorisation
  table, version history, topic tree (content → business rules → Apply to).
- Browser print / Save as PDF (HTML print path — no canvas slicing).
- Preview in a new tab uses the same print template.

**Policy Viewer**

- Read-only portal for employees (Intranet OTP login).
- Browse published policies by company and department; AI assistant over visible policies.
- Global viewers (HR / Audit / IT, configurable) see all published active policies.

**Platform**

- Microsoft Entra ID sign-in for Creator; Intranet OTP for Viewer; JWT app sessions.
- Integrations: **SAP HANA / BI** (companies, departments, users), **BPM PostgreSQL**
  (processes, activities, application master), Microsoft Teams, optional OpenAI chat.
- JSON file store for policies, templates and approval setups.

## Architecture

```
┌──────────────────────────┐  HTTPS   ┌───────────┐  /api/*     ┌─────────────────────────┐
│  Browser (React SPA)     │ ───────▶ │   nginx   │ ──────────▶ │  Express API (Node)     │
│  Vite build (static)     │ ◀─────── │ + TLS     │             │  PM2 :4025              │
│  Creator + /viewer       │          └───────────┘             └────────────┬────────────┘
└──────────────────────────┘                                                 │
                     ┌───────────────────────────┬───────────────┬───────────┴────────┐
                     ▼                           ▼               ▼                    ▼
               JSON files                  SAP HANA / BI    BPM PostgreSQL      Teams / OpenAI
          (policies, templates,            companies,         processes,           notify / chat
           approval setups)                users, depts       applications
```

- The SPA is a static build served by nginx from `/var/www/policycreator.neweast.cloud`.
- nginx proxies `/api/` to `policy-creator-api` on port **4025**.
- Viewer is the same SPA at `/viewer` (and intranet / MIS redirects).

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 4, Radix UI, TipTap, TanStack Query, Sonner |
| Backend | Node.js, Express, TypeScript |
| Storage | JSON files under `server/data/` |
| Auth | Microsoft Entra ID (Creator), Intranet OTP (Viewer), JWT |
| Integrations | SAP HANA (`@sap/hana-client`), BPM PostgreSQL (`pg`), SQL Server payroll, Teams |
| Documents | Print HTML → browser Save as PDF |
| Ops | nginx, PM2 (`policy-creator-api`), `deploy.sh` |

## Repository layout

```
.
├── src/                         React SPA (Creator + Viewer)
│   ├── App.tsx                  Policy Creator shell
│   ├── ViewersApp.tsx           Policy Viewer shell
│   ├── components/              Wizard, workflow, document, shared UI
│   ├── lib/                     API client, PDF/HTML, access helpers
│   └── pages/                   Dashboard, lists, templates, approval setup
├── server/
│   ├── src/                     Express API
│   │   ├── index.ts             HTTP routes
│   │   ├── workflow.ts          Submit / approve / publish
│   │   ├── bpm-catalog.ts       BPM processes, activities, applications
│   │   ├── policy-access.ts     Viewer / creator visibility
│   │   └── approval-setup-*.ts  Approval matrices
│   ├── data/                    Runtime JSON (policies.json is git-ignored)
│   └── .env.example             All supported environment variables
├── nginx/                       Viewer includes for intranet / MIS / policy host
├── deploy.sh                    Build + rsync + nginx reload + PM2 restart
├── public/                      Logo and static assets
└── package.json                 Web app scripts
```

## Quick start (local development)

### Prerequisites

- **Node.js ≥ 20** and npm ≥ 10
- SAP HANA / BI access for companies, departments and users
- *Optional:* BPM PostgreSQL (process link + Application Master)

### 1. Clone and install

```bash
git clone https://github.com/Neweast-General-Trading/policy_creator.git
cd policy_creator
npm run install:all
```

### 2. Configure the API

```bash
cp server/.env.example server/.env
```

Edit `server/.env` for local use (see [Configuration](#configuration)). At minimum set
HANA credentials and `APP_JWT_SECRET`.

On a fresh install, copy the example policy store if `server/data/policies.json` is missing:

```bash
cp server/data/policies.json.example server/data/policies.json
```

### 3. Run the API and the web UI

```bash
# terminal 1 — API on http://localhost:4025
npm run dev:api

# terminal 2 — web UI on http://localhost:5181
npm run dev:web
```

Open http://localhost:5181 for Creator and http://localhost:5181/viewer for Viewer.
Vite proxies `/api` to the Express process.

## Configuration

All backend settings are environment variables documented in
[`server/.env.example`](server/.env.example). The most important ones:

| Variable | Purpose |
|----------|---------|
| `PORT` | API listen port (default `4025`) |
| `APP_JWT_SECRET` / `JWT_SECRET` | Session signing (**required in production**) |
| `SERVER_NODE`, `SAP_HANA_USER`, `SAP_HANA_PASSWORD`, `SAP_HANA_SCHEMA` | BI companies, departments, users |
| `AZURE_*` / `MICROSOFT_*` | Creator Microsoft sign-in |
| `CLIENT_URL` | Public Creator URL (OAuth redirect, Teams links) |
| `BPM_DB_*` | BPM PostgreSQL (processes, activities, application master) |
| `POLICY_DELETE_ADMINS` | Extra emails allowed to delete any policy |
| `POLICY_GURU_EMAIL`, `POLICY_GURU_USER_ID` | Sole approver for Business System & IT |
| `GLOBAL_VIEW_DEPT_NAMES` | Viewer departments that see all published policies |
| `AUDIT_DEPT_CODE` | Audit routing |
| `TEAMS_API` | Teams notification endpoint |
| `OPENAI_API_KEY` | Optional Viewer AI assistant |

The web UI uses `VITE_API_URL` when the API is not on the same origin (empty in production;
nginx serves `/api`).

## Production deployment

On the production host:

```bash
bash deploy.sh
```

This:

1. Builds the API (`server/`) and the client (`dist/`).
2. Rsyncs the SPA to `/var/www/policycreator.neweast.cloud`.
3. Ensures nginx includes for intranet / MIS viewer redirects.
4. Reloads nginx and restarts PM2 process `policy-creator-api`.

**Production checklist**

- Strong `APP_JWT_SECRET`; never commit `server/.env`.
- HANA, BPM and Teams endpoints reachable from the API host.
- TLS terminated by nginx; API bound to localhost / internal only.
- Runtime store `server/data/policies.json` is git-ignored — back it up separately.

## Access control

| Who | Creator | Edit others' drafts | Approval Setup | Deactivate / Activate | Viewer |
|-----|---------|---------------------|----------------|------------------------|--------|
| Policy Creator menu (BI) | Own policies | — | — | Own published | — |
| Business System & IT | Any company / department | Yes (in-flight) | — | Own published | Scoped |
| IT (approval-setup admins) | If Creator menu | — | Yes | Any published | — |
| Policy owner | Own policies | — | — | Own published | — |
| Any BI employee | — | — | — | — | Published, scoped |
| HR / Audit / IT (global viewer) | — | — | — | — | All published active |

- **Submit / Publish** stay with the policy owner.
- Viewer never shows drafts, rejected, or inactive published copies.

## Useful commands

| Command | Description |
|---------|-------------|
| `npm run install:all` | Install web and API dependencies |
| `npm run dev:api` / `npm run dev:web` | Start the API / the web UI in watch mode |
| `npm run build` | Production build of the Creator SPA |
| `npm run build --prefix server` | Compile the API |
| `bash deploy.sh` | Build, rsync, reload nginx, restart PM2 |

## Documentation

- [API environment reference](server/.env.example)
- [Deploy script](deploy.sh)
- [Contributing](CONTRIBUTING.md)

## Contributing

1. Create a feature branch from `main`.
2. Run `npm run build --prefix server` and `npm run build` before opening a pull request.
3. Never commit secrets, `.env` files, or `server/data/policies.json`.
4. Keep user-facing text in English.

See [CONTRIBUTING.md](CONTRIBUTING.md).
