const path = require("path");
// Minimal .env loader (avoids requiring the `dotenv` package as a dependency)
try {
  const fs = require("fs");
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = (m[2] || "").trim();
    }
  }
} catch { /* .env is optional */ }

const express = require("express");
const cors = require("cors");
const db = require("./db");
const ai = require("./aiEngine");
const { hashPassword, verifyPassword, issueToken, requireAuth, requireWrite } = require("./auth");
const { makeCrudRouter, logAudit } = require("./crud");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;

// -----------------------------------------------------------------------
// AUTH
// -----------------------------------------------------------------------
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Username and password are required." });
  const user = db.prepare(`SELECT * FROM users WHERE username = ? AND active = 1`).get(username);
  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }
  const token = issueToken({ id: user.id, username: user.username, name: user.name, role: user.role, department: user.department });
  logAudit(user.username, "Logged in", `Role: ${user.role}`);
  res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role, department: user.department } });
});

app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));

app.get("/api/auth/demo-accounts", (_req, res) => {
  const rows = db.prepare(`SELECT username, name, role, department FROM users`).all();
  res.json(rows.map((r) => ({ ...r, password: DEMO_PASSWORDS[r.username] })));
});
const DEMO_PASSWORDS = {
  admin: "admin123", officer1: "officer123", pm1: "pm123", revenue1: "revenue123",
  permit1: "permit123", asset1: "asset123", viewer1: "viewer123",
};

// -----------------------------------------------------------------------
// MODULE CRUD ROUTERS (with AI enrichment applied on read)
// -----------------------------------------------------------------------
app.use("/api/citizen-requests", makeCrudRouter({
  table: "citizen_requests",
  idField: "tracking_id",
  label: "Citizen Request",
  searchFields: ["tracking_id", "description", "location", "category", "department", "citizen_name"],
  filterFields: ["status", "priority", "category", "department"],
  enrich: (row, all) => ({
    similar: ai.findSimilarComplaints(row.description, all.filter((r) => r.id !== row.id)),
  }),
}));

app.use("/api/projects", makeCrudRouter({
  table: "projects",
  idField: "project_id",
  label: "Project",
  searchFields: ["project_id", "name", "department", "location", "contractor", "project_manager"],
  filterFields: ["status", "department"],
  enrich: (row) => ai.analyzeProjectRisk(row),
}));

app.use("/api/revenue", makeCrudRouter({
  table: "revenue",
  label: "Revenue Record",
  searchFields: ["stream", "department", "location"],
  filterFields: ["stream", "department"],
  enrich: (row, all) => ai.detectRevenueAnomaly(row.stream, all),
}));

app.use("/api/permits", makeCrudRouter({
  table: "permits",
  idField: "application_id",
  label: "Permit Application",
  searchFields: ["application_id", "applicant_name", "permit_type"],
  filterFields: ["status", "permit_type"],
  enrich: (row) => ai.checkPermitDocuments(row),
}));

app.use("/api/assets", makeCrudRouter({
  table: "assets",
  idField: "asset_id",
  label: "Asset",
  searchFields: ["asset_id", "name", "category", "department", "location"],
  filterFields: ["status", "category", "department"],
  enrich: (row) => ai.predictMaintenance(row),
}));

app.use("/api/notifications", makeCrudRouter({
  table: "notifications",
  label: "Notification",
  searchFields: ["type", "message", "module"],
  filterFields: ["module", "severity"],
}));

app.use("/api/users", makeCrudRouter({
  table: "users",
  idField: "username",
  label: "User",
  searchFields: ["username", "name", "role", "department"],
  filterFields: ["role"],
}));

app.get("/api/audit-log", requireAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM audit_log ORDER BY id DESC LIMIT 200`).all());
});

// -----------------------------------------------------------------------
// AI: complaint classification preview + central assistant
// -----------------------------------------------------------------------
app.post("/api/ai/classify-complaint", requireAuth, (req, res) => {
  const { description } = req.body || {};
  if (!description || description.trim().length < 5) {
    return res.status(400).json({ error: "Please provide a longer description for AI classification." });
  }
  const result = ai.classifyComplaint(description);
  const existing = db.prepare(`SELECT * FROM citizen_requests`).all();
  result.similar = ai.findSimilarComplaints(description, existing);
  res.json(result);
});

app.post("/api/ai/assistant", requireAuth, (req, res) => {
  const { module, question } = req.body || {};
  const tableMap = {
    citizenflow: "citizen_requests",
    projectwatch: "projects",
    revenueguard: "revenue",
    permitai: "permits",
    assettrack: "assets",
  };
  const table = tableMap[module];
  const dataset = table ? db.prepare(`SELECT * FROM ${table}`).all() : [];
  const result = ai.assistantQuery(module, question, dataset);
  res.json(result);
});

// -----------------------------------------------------------------------
// GLOBAL SEARCH
// -----------------------------------------------------------------------
app.get("/api/search", requireAuth, (req, res) => {
  const q = String(req.query.q || "").toLowerCase().trim();
  if (!q) return res.json({ citizen_requests: [], projects: [], revenue: [], permits: [], assets: [] });

  const citizen = db.prepare(`SELECT * FROM citizen_requests`).all()
    .filter((r) => [r.tracking_id, r.description, r.location, r.category, r.citizen_name].some((f) => String(f || "").toLowerCase().includes(q)));
  const projects = db.prepare(`SELECT * FROM projects`).all()
    .filter((r) => [r.project_id, r.name, r.department, r.location, r.contractor].some((f) => String(f || "").toLowerCase().includes(q)));
  const revenue = db.prepare(`SELECT * FROM revenue`).all()
    .filter((r) => [r.stream, r.department, r.location].some((f) => String(f || "").toLowerCase().includes(q)));
  const permits = db.prepare(`SELECT * FROM permits`).all()
    .filter((r) => [r.application_id, r.applicant_name, r.permit_type].some((f) => String(f || "").toLowerCase().includes(q)));
  const assets = db.prepare(`SELECT * FROM assets`).all()
    .filter((r) => [r.asset_id, r.name, r.category, r.location].some((f) => String(f || "").toLowerCase().includes(q)));

  res.json({
    citizen_requests: citizen.slice(0, 20),
    projects: projects.slice(0, 20),
    revenue: revenue.slice(0, 20),
    permits: permits.slice(0, 20),
    assets: assets.slice(0, 20),
  });
});

// -----------------------------------------------------------------------
// DASHBOARD STATS
// -----------------------------------------------------------------------
app.get("/api/dashboard/stats", requireAuth, (req, res) => {
  const citizenTotal = db.prepare(`SELECT COUNT(*) c FROM citizen_requests`).get().c;
  const citizenOpen = db.prepare(`SELECT COUNT(*) c FROM citizen_requests WHERE status NOT IN ('Resolved','Closed')`).get().c;

  const projects = db.prepare(`SELECT * FROM projects`).all();
  const projectsAtRisk = projects.filter((p) => ai.analyzeProjectRisk(p).riskLevel !== "Low").length;

  const revenueTotal = db.prepare(`SELECT SUM(actual_amount) s FROM revenue`).get().s || 0;

  const permitsPending = db.prepare(`SELECT COUNT(*) c FROM permits WHERE status NOT IN ('Approved','Rejected')`).get().c;

  const assetsTotal = db.prepare(`SELECT COUNT(*) c FROM assets`).get().c;
  const assets = db.prepare(`SELECT * FROM assets`).all();
  const assetsNeedingAttention = assets.filter((a) => ai.predictMaintenance(a).riskLevel !== "Low").length;

  res.json({
    citizenRequests: { total: citizenTotal, open: citizenOpen },
    projects: {
      total: projects.length,
      active: projects.filter((p) => p.status === "Active").length,
      completed: projects.filter((p) => p.status === "Completed").length,
      delayed: projects.filter((p) => p.status === "Delayed").length,
      atRisk: projectsAtRisk,
      totalBudget: projects.reduce((s, p) => s + Number(p.approved_budget || 0), 0),
      totalSpent: projects.reduce((s, p) => s + Number(p.amount_spent || 0), 0),
    },
    revenue: { total: revenueTotal },
    permits: { pending: permitsPending, total: db.prepare(`SELECT COUNT(*) c FROM permits`).get().c },
    assets: { total: assetsTotal, needingAttention: assetsNeedingAttention },
  });
});

// -----------------------------------------------------------------------
// REPORTS: CSV export
// -----------------------------------------------------------------------
const REPORT_TABLES = {
  citizen: { table: "citizen_requests", filename: "citizen_service_report" },
  projects: { table: "projects", filename: "project_status_report" },
  revenue: { table: "revenue", filename: "revenue_report" },
  permits: { table: "permits", filename: "permit_processing_report" },
  assets: { table: "assets", filename: "asset_report" },
};

function toCSV(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

app.get("/api/reports/:key/export", requireAuth, (req, res) => {
  const cfg = REPORT_TABLES[req.params.key];
  if (!cfg) return res.status(404).json({ error: "Unknown report." });
  let rows = db.prepare(`SELECT * FROM ${cfg.table}`).all();
  if (req.query.status) rows = rows.filter((r) => r.status === req.query.status);
  if (req.query.department) rows = rows.filter((r) => r.department === req.query.department);
  const csv = toCSV(rows);
  logAudit(req.user.username, `Exported report`, `${cfg.filename}.csv (${rows.length} rows)`);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${cfg.filename}_${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

// -----------------------------------------------------------------------
// FIRST-RUN DEMO SEED (cloud/phone friendly)
// -----------------------------------------------------------------------
// On a fresh deployment the database is empty. Seed fictional demo data
// automatically so the MVP works immediately without a terminal command.
try {
  const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (userCount === 0) {
    require("child_process").execFileSync(process.execPath, [path.join(__dirname, "seed.js")], { stdio: "inherit" });
  }
} catch (err) {
  console.error("Automatic demo seed failed:", err.message);
}

// -----------------------------------------------------------------------
// STATIC FRONTEND
// -----------------------------------------------------------------------
app.use(express.static(path.join(__dirname, "..", "public")));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`NePort server running: http://localhost:${PORT}`);
  console.log(`DEMO MODE — fictional data only, not connected to any real government system.`);
});
