# NePort — Government Administration & Intelligence Portal

NePort is a working MVP demonstration of a **Vertical AI + Micro-SaaS platform for
government departments**. It looks and feels like a government/intranet portal from
around 2004, but runs on a modern Node.js + React stack and is fully functional:
real login, a real SQLite database, real CRUD operations, and a rule-based AI layer
that classifies, scores risk, and flags anomalies across five focused modules.

> **DEMO MODE:** All data in NePort is fictional. It is not connected to any real
> government system, and no real citizen personal information is used.

---

## 1. What is Vertical AI?

"Vertical AI" means AI built for a specific industry's workflows, instead of a
general-purpose chatbot bolted onto an app. NePort's industry is **public
administration**. Its AI layer doesn't chat about anything — it does five narrow,
well-defined jobs: classify citizen complaints, flag project budget/progress risk,
flag revenue anomalies, check permit document completeness, and predict asset
maintenance needs. Every AI output is labelled **"AI Insight"**, uses hedged language
("AI suggests", "potential risk", "requires human review"), and includes a
**"Why am I seeing this?"** explanation. The AI assists officers — it never makes a
final decision or auto-executes an action.

## 2. What is Micro-SaaS?

Instead of one monolithic system, NePort is a **platform of five small, independently
useful modules** that share a login, a design system, and a central AI assistant:

| Module | What it does |
|---|---|
| **CitizenFlow** | Citizen complaint / service-request tracking |
| **ProjectWatch** | Government project monitoring (budget vs. progress) |
| **RevenueGuard** | Revenue stream monitoring and anomaly detection |
| **PermitAI** | Permit/licence application workflow |
| **AssetTrack** | Public asset register and maintenance prediction |

Each module is a self-contained CRUD app with its own AI logic; together they form
the beginnings of a government operating platform.

---

## 3. Architecture

```
neport/
├── server/               Node.js + Express REST API
│   ├── index.js          App entrypoint, routes, dashboard stats, reports, search
│   ├── db.js             SQLite schema (better-sqlite3)
│   ├── auth.js           Password hashing (scrypt) + signed session tokens (HMAC)
│   ├── aiEngine.js        Rule-based "Vertical AI" logic for all 5 modules + assistant
│   ├── crud.js            Generic REST CRUD router factory (list/get/create/update/delete)
│   ├── seed.js             Generates realistic fictional demo data
│   └── routes/             (reserved for future module-specific route splits)
├── public/                Frontend (React 18 via CDN — no build step required)
│   ├── index.html
│   ├── styles.css          The 2004-government-portal design system
│   ├── api-client.js       Small fetch wrapper (adds auth token, parses errors)
│   └── app.js               All React components, routing, and module configuration
├── data/                    SQLite database file lives here (created on first run)
├── package.json
└── .env.example
```

**Frontend stack:** React 18 (loaded via CDN as UMD builds) + Babel Standalone for
in-browser JSX transpilation. This was a deliberate MVP choice: it gives you real
React components and hooks with **zero build tooling** — just `npm start` and open a
browser. It is easy to later migrate to a Vite/CRA build if you want production
bundling, code-splitting, and minification.

**Backend stack:** Express + SQLite (via `better-sqlite3`, synchronous and fast for
an MVP). The schema is plain relational tables, so migrating to PostgreSQL later is
mostly a matter of swapping the `db.js` driver and adjusting a few SQL differences
(e.g. autoincrement syntax) — the rest of the codebase talks to `db` through simple
`prepare/run/get/all` calls, not raw SQLite-specific features.

**Auth:** Demo-appropriate but not toy-insecure: passwords are hashed with Node's
built-in `scrypt` (no plaintext, no extra dependency), and sessions use a signed,
expiring HMAC token (JWT-like, no extra dependency). Roles are enforced server-side
via middleware (`requireAuth`, `requireWrite`, `requireRole`), not just hidden in the
UI.

---

## 4. Installation

**Requirements:** Node.js 18+ (tested with Node 22), npm.

```bash
cd neport
npm install
npm run seed     # creates data/neport.db and fills it with fictional demo data
npm start        # starts the server on http://localhost:4000
```

Then open **http://localhost:4000** in a browser.

> `better-sqlite3` compiles a small native module during `npm install`. On most
> systems this "just works" via prebuilt binaries. If it fails, install your OS's
> C++ build tools (e.g. `build-essential` on Debian/Ubuntu, Xcode Command Line Tools
> on macOS) and re-run `npm install`.

### Environment variables

Copy `.env.example` to `.env` if you want to override defaults (the app runs fine
without a `.env` file):

```
PORT=4000
NEPORT_SESSION_SECRET=neport-demo-secret-change-me
NEPORT_DB_PATH=./data/neport.db
```

### Resetting demo data

Run `npm run seed` again at any time — it wipes and regenerates all tables with
fresh fictional data.

---

## 5. Demo credentials

All demo accounts use the pattern `password: <role>123`. They're also listed with a
"quick fill" button directly on the NePort login screen (fetched from
`GET /api/auth/demo-accounts`).

| Username | Password | Role | Department |
|---|---|---|---|
| `admin` | `admin123` | Administrator | Office of the County Secretary |
| `officer1` | `officer123` | Department Officer | Public Works |
| `pm1` | `pm123` | Project Manager | Infrastructure |
| `revenue1` | `revenue123` | Revenue Officer | Finance & Revenue |
| `permit1` | `permit123` | Permit Officer | Licensing |
| `asset1` | `asset123` | Asset Officer | General Services |
| `viewer1` | `viewer123` | Read Only | Office of the Governor |

`Read Only` accounts can view every dashboard/report but the API rejects any
create/update/delete they attempt (`requireWrite` middleware), and the UI hides the
edit/delete controls for them.

---

## 6. Using the app (a full walkthrough)

1. **Log in** at `/#/login` with any demo account.
2. **Dashboard** (`/#/dashboard`) shows government-wide stats and an AI-flagged
   "Items Requiring Attention" panel pulled live from all five modules.
3. **CitizenFlow → + New Record**: type a complaint description (e.g. *"There has
   been a huge pothole outside the market for three weeks"*) and click
   **Run AI Classification** to see category/priority/department/summary and any
   similar/duplicate complaints, before saving.
4. **ProjectWatch**: open any project to see its **AI Insight** risk box
   (spend % vs. completion %, suggested action, "Why am I seeing this?").
5. **RevenueGuard**: open a revenue record to see anomaly detection against a
   rolling average for that stream.
6. **PermitAI**: create or open an application to see missing-document detection
   against the required document list for that permit type.
7. **AssetTrack**: open an asset to see a maintenance-priority prediction based on
   age, condition, and category-specific maintenance intervals.
8. **AI Assistant** (`/#/assistant`): pick a module and ask a suggested question
   (e.g. *"Which projects are at risk?"*).
9. **Reports** (`/#/reports`): filter by status/department and **Export CSV** for
   any of the five reports.
10. **Global search** (header search box): search across all five modules at once.
11. **Audit Log** (`/#/audit`): every create/update/delete/login/report-export is
    recorded here with actor, action, and details.
12. **Administration** (`/#/admin`): view all users and the role-permission matrix.

---

## 7. API reference

All endpoints except `/api/auth/login` and `/api/auth/demo-accounts` require
`Authorization: Bearer <token>` (returned from login).

### Auth
- `POST /api/auth/login` `{ username, password }` → `{ token, user }`
- `GET /api/auth/me` → current user
- `GET /api/auth/demo-accounts` → list of demo accounts (for the login screen)

### CRUD (same shape for all five modules)
- `GET /api/citizen-requests` `?q=&status=&priority=&category=&department=&from=&to=`
- `GET /api/citizen-requests/:id`
- `POST /api/citizen-requests`
- `PUT /api/citizen-requests/:id`
- `DELETE /api/citizen-requests/:id`

...and equivalently for `/api/projects`, `/api/revenue`, `/api/permits`,
`/api/assets`, `/api/notifications`, `/api/users`. List/detail responses are
**enriched with `aiInsight`** computed on read (never stale, always reflects current
data).

### AI
- `POST /api/ai/classify-complaint` `{ description }` → category/priority/department/summary/similar
- `POST /api/ai/assistant` `{ module, question }` → context-aware answer + matching records

### Search, dashboard, reports, audit
- `GET /api/search?q=...`
- `GET /api/dashboard/stats`
- `GET /api/reports/:key/export?status=&department=` (`key` ∈ `citizen|projects|revenue|permits|assets`) → CSV file
- `GET /api/audit-log`

---

## 8. Database setup

The MVP uses **SQLite** via `better-sqlite3` for zero-config local development — no
separate database server to install. The schema (`server/db.js`) is created
automatically on first run via `CREATE TABLE IF NOT EXISTS`.

**To migrate to PostgreSQL later:**
1. Replace `better-sqlite3` with `pg` (or an ORM like Prisma/Knex).
2. Convert the `CREATE TABLE` statements in `db.js` (mainly `INTEGER PRIMARY KEY
   AUTOINCREMENT` → `SERIAL PRIMARY KEY`, and SQLite's `datetime('now')` → Postgres
   `NOW()`).
3. `crud.js` and every route already use parameterized `prepare/run/get/all`-style
   calls with named parameters — the equivalent `pg` queries are a mechanical
   rewrite, not a redesign.

---

## 9. How the AI layer works (and how to connect a real provider)

`server/aiEngine.js` is a **deterministic, rule-based mock AI**. It uses keyword
matching (complaint classification), budget-vs-progress math (project risk),
rolling-average deviation (revenue anomalies), a required-documents lookup table
(permit checks), and age/condition heuristics (asset maintenance) — all reproducible
with no external API calls, so the MVP works immediately with no API keys.

Every function returns a consistent shape: a conclusion (category, risk level,
anomaly flag, etc.) **plus a `reasons` array**, which powers the "Why am I seeing
this?" UI everywhere in the app.

**To connect a real AI provider (e.g. the Anthropic API) later:**
1. Add `ANTHROPIC_API_KEY` to `.env` (a placeholder is already in `.env.example`).
2. Implement `buildRealAIProvider()` at the bottom of `aiEngine.js` — a stub and
   example call shape are already sketched there.
3. Swap the body of e.g. `classifyComplaint()` to call the real provider with a
   structured prompt and parse a JSON response into the **same return shape**
   (`{ category, department, priority, summary, reasons }`). Because the frontend
   only depends on that shape — never on *how* it was produced — no UI changes are
   needed.
4. Keep the rule-based version as a fallback when no API key is configured, so the
   demo mode continues to work offline.

---

## 10. Security design notes (MVP-appropriate, not production-hardened)

- Passwords hashed with `scrypt` (Node core, no plaintext storage).
- Sessions are signed, expiring tokens (HMAC-SHA256), verified server-side.
- Role-based permissions enforced in middleware, not just hidden in the UI.
- `Read Only` role is rejected server-side on all write endpoints.
- No secrets are hardcoded; `NEPORT_SESSION_SECRET` and any future API keys are
  read from environment variables.
- All mutations write an **audit log entry** (actor, action, details, timestamp).
- Destructive actions (delete) require an in-UI confirmation dialog.
- Basic form validation both client-side (`required` fields) and server-side
  (rejects empty payloads, unknown records return 404, etc.).

This is an MVP. Before any real deployment you would add: HTTPS, rate limiting,
CSRF protection if adding cookie-based auth, stronger password policies, real
document upload/storage (with virus scanning) for PermitAI, and a production-grade
database with backups.

---

## 11. Future roadmap

- **Phase 1 — NePort MVP** *(this build)*: five modules, rule-based AI, RBAC, CSV
  reports, audit log, demo data.
- **Phase 2 — Real AI integration**: connect a real LLM provider (see §9) for
  classification, summarization, and a genuinely conversational assistant.
- **Phase 3 — Advanced analytics**: trend dashboards, forecasting, department
  scorecards, exportable PDF reports.
- **Phase 4 — Government department integrations**: single sign-on with government
  identity providers, integration with existing finance/HR systems, document
  management integration for PermitAI.
- **Phase 5 — Multi-county deployment**: multi-tenancy, per-county data isolation
  and branding, cross-county benchmarking.
- **Phase 6 — National-scale platform**: national data warehouse, standardized
  APIs for third-party government systems, high-availability infrastructure.

---

## 12. What to extend first

If you're picking this up to build further, the highest-leverage next steps are:

1. **Real file uploads for PermitAI** — currently documents are just checkbox
   metadata; wire up actual file storage (S3-compatible or local disk) with the
   document-check AI reading real filenames/metadata.
2. **Department-scoped data access** — right now roles gate *write* access; add
   row-level filtering so a Department Officer only *sees* their department's
   CitizenFlow records.
3. **Charts** — RevenueGuard and the dashboard would benefit from an actual chart
   library (Chart.js/Recharts) instead of tables; the CDN-script architecture makes
   this a small addition.
4. **Real AI provider** — see §9; this is the single change with the most "wow"
   impact once you have an API key.
5. **Pagination** — list endpoints currently return full tables, fine for MVP demo
   volumes (20-25 records) but should paginate before real data volumes.


## Phone-only MVP setup

This version is prepared for browser-based cloud development/hosting, so you do not need a computer to run the MVP.

### Fastest route from a phone

1. Open a browser-based Node.js workspace that supports ZIP project uploads.
2. Upload this project ZIP.
3. In its shell/console run:

```bash
npm install
npm start
```

4. Open the workspace's web preview/public URL on your phone.
5. The first launch automatically creates the fictional demo database and accounts.

The server listens on `0.0.0.0` and respects the hosting platform's `PORT`.

Demo login: `admin` / `admin123`

> This is a demo MVP. All government records are fictional and it is not connected to any government system.
