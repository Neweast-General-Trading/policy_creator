# Policy Creator

NEWEAST internal platform for creating, approving, versioning, and publishing company policies — with a separate read-only **Policy Viewer** portal for employees.

## What it does

| Area | Description |
|------|-------------|
| **Policy Creator** | HR / authorized staff create policies, manage templates, and configure approval matrices |
| **Approval workflow** | Multi-stage electronic approval with signatures, escalation, and matrix changes |
| **Policy Viewer** | Employees browse **published** policies by company and department (Intranet login) |
| **Approval Setup** | IT configures per-department approval chains — including **multi-company** matrices |

---

## Main workflow

### Create & publish a policy

1. **Create** — choose *New policy* or *New version* from an existing published policy
2. Select **companies** (single or multi-select), **visibility** (general vs department-specific), and **department**
3. Add **topics** and rich-text **content** (TipTap editor)
4. **Save draft** → **Submit for approval**
5. Approvers sign at each stage (Teams notifications)
6. Owner **Publish** when fully approved → policy appears in the **Viewer**

### Policy versions

- **New version** keeps the same name and scope; only content changes
- Version number increments automatically (`v1`, `v2`, …)
- When a new version is **published**, older published versions in the same family become **Inactive** (hidden from Viewer)

### Deactivate (block) a policy

- **Owner** or **IT Admin** can deactivate a **Published + Active** policy
- Deactivated policies stay in Creator but are hidden from Viewer

---

## Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite 7, TypeScript, Tailwind CSS 4 |
| **UI** | Radix UI, TipTap (rich text), TanStack Query, Sonner toasts |
| **Backend** | Node.js, Express, TypeScript |
| **Storage** | JSON files (`server/data/`) — policies, templates, approval setups |
| **Auth** | Microsoft OAuth (Creator) · Intranet OTP link (Viewer) · JWT |
| **Integrations** | SAP HANA / BI (companies, departments, users), Microsoft Teams notifications |
| **Deploy** | nginx + PM2 (`policy-creator-api`) |

---

## Production URLs

| App | URL |
|-----|-----|
| **Policy Creator** | https://policycreator.neweast.cloud/ |
| **Policy Viewer** | https://policycreator.neweast.cloud/viewer |

- **API** (internal): port **4025** — PM2 process `policy-creator-api`
- Public access is via nginx (HTTPS 443), not the raw port

---

## Project structure

```
policy_creator/
├── src/                    # React app (Creator + Viewer entry)
│   ├── App.tsx             # Policy Creator shell
│   ├── ViewersApp.tsx      # Policy Viewer shell
│   ├── components/         # UI, wizard, workflow, viewer
│   └── pages/              # Dashboard, templates, approval setup, …
├── server/
│   ├── src/                # Express API
│   │   ├── index.ts        # Routes
│   │   ├── workflow.ts     # Submit / approve / publish
│   │   ├── policy-access.ts
│   │   └── approval-setup-*.ts
│   └── data/               # JSON persistence (not all committed)
├── nginx/                  # Viewer redirects for intranet / MIS
├── deploy.sh               # Build + rsync + PM2 restart
└── public/                 # Static assets (logo, …)
```

---

## Run locally

### Prerequisites

- Node.js 20+
- Copy `server/.env.example` → `server/.env` and fill values (HANA, JWT, Microsoft OAuth)
- BI / HANA access for companies and departments

### Commands

```bash
# API
cd server && npm install && npm run dev

# Creator UI (terminal 2) — http://localhost:5181
cd .. && npm install && npm run dev

# Viewer UI uses the same dev server at /viewer
```

### Build

```bash
cd server && npm run build
cd .. && npm run build          # Creator
npm run build:viewer            # Viewer bundle (optional separate output)
```

---

## Deploy

On the production server:

```bash
bash deploy.sh
```

This builds API + client, rsyncs to `/var/www/policycreator.neweast.cloud`, reloads nginx, and restarts `policy-creator-api` via PM2.

---

## Environment (`server/.env`)

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default `4025`) |
| `SAP_HANA_*` | BI database connection |
| `JWT_SECRET` | App session tokens |
| `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID` | Creator login (Azure AD) |
| `POLICY_DELETE_ADMINS` | Comma-separated emails with global delete access |
| `GLOBAL_VIEW_DEPT_NAMES` | Departments that see all policies in Viewer (default HR, Audit, IT) |
| `AUDIT_DEPT_CODE` | Audit department code for approval routing |

See `server/.env.example` for a starter template. **Never commit** `server/.env`.

---

## Data files (`server/data/`)

| File | Contents |
|------|----------|
| `policies.json` | All policies (runtime — use `policies.json.example` on fresh install) |
| `templates.json` | Reusable policy templates |
| `approval-setups.json` | Approval matrices per source department / companies |

---

## Access control (summary)

| Role | Creator | Viewer | Approval Setup | Deactivate policy |
|------|---------|--------|----------------|-------------------|
| **Policy Creator menu (BI)** | ✅ | — | — | — |
| **IT department** | If has Creator menu | — | ✅ | ✅ (any published) |
| **Policy owner** | ✅ own policies | — | — | ✅ own published |
| **Any BI employee** | — | ✅ scoped policies | — | — |
| **HR / Audit / IT (global viewer)** | — | ✅ all published | — | — |

---

## Key features

- **Multi-company policies** — one policy applies to several companies
- **Visibility scope** — *General* (all departments) or *Department-specific*
- **Multi-company approval setup** — one matrix for IT (or any dept) across companies
- **Version lineage** — `policyFamilyId`, sequential versions, auto-inactivate on publish
- **BPM link** (optional) — tie policy to business process / sub-processes
- **PDF export** — download or preview policy document
- **Teams notifications** — approval requests and setup change alerts

---

## Repository

**https://github.com/Neweast-General-Trading/policy_creator**

---

## NEWEAST · Internal use
