const { useState, useEffect, useMemo, useCallback, createContext, useContext } = React;

/* ============================== UTILITIES ============================== */

function fmtKsh(n) {
  const v = Number(n) || 0;
  return "KSh " + v.toLocaleString("en-KE", { maximumFractionDigits: 0 });
}
function fmtDate(s) {
  if (!s) return "—";
  return s;
}
function slugify(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, "-");
}
function genId(prefix) {
  const tail = Date.now().toString(36).slice(-4).toUpperCase() + Math.floor(Math.random() * 90 + 10);
  return `${prefix}-${tail}`;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseHash() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [pathPart, queryPart] = raw.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  const query = new URLSearchParams(queryPart || "");
  return { segments, query, path: "/" + segments.join("/") };
}
function navigate(path) {
  window.location.hash = path;
}

function useHashRoute() {
  const [route, setRoute] = useState(parseHash());
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

/* ============================== AUTH CONTEXT ============================== */

const AuthContext = createContext(null);
function useAuth() { return useContext(AuthContext); }

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = NePortAPI.getToken();
    if (!token) { setLoading(false); return; }
    NePortAPI.get("/api/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => NePortAPI.setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const r = await NePortAPI.post("/api/auth/login", { username, password });
    NePortAPI.setToken(r.token);
    setUser(r.user);
    return r.user;
  };
  const logout = () => {
    NePortAPI.setToken(null);
    setUser(null);
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ============================== MODULE CONFIG ============================== */

const REQUIRED_DOCS = {
  "Business Permit": ["ID/Passport Copy", "KRA PIN Certificate", "Lease Agreement", "Passport Photo"],
  "Construction Permit": ["Architectural Drawings", "Structural Report", "Land Title", "ID/Passport Copy"],
  "Event Permit": ["Event Proposal", "Venue Confirmation", "Police Clearance", "ID/Passport Copy"],
  "Advertising Permit": ["Design Artwork", "Site Photos", "ID/Passport Copy"],
  "Trade Licence": ["ID/Passport Copy", "KRA PIN Certificate", "Business Registration"],
};

const MODULES = {
  citizenflow: {
    key: "citizenflow",
    api: "/api/citizen-requests",
    idField: "tracking_id",
    idPrefix: "CF",
    label: "CitizenFlow",
    title: "Citizen Complaints & Service Requests",
    description: "Citizens report issues; officers triage, assign and resolve them.",
    statusFlow: ["Received", "Under Review", "Assigned", "In Progress", "Resolved", "Closed"],
    fields: [
      { name: "citizen_name", label: "Citizen Name", type: "text", required: true, table: true },
      { name: "description", label: "Description", type: "textarea", required: true },
      { name: "location", label: "Location", type: "text", required: true, table: true },
      { name: "category", label: "Category (AI-suggested)", type: "text", table: true },
      { name: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High"], table: true, format: "priority" },
      { name: "status", label: "Status", type: "select", options: ["Received", "Under Review", "Assigned", "In Progress", "Resolved", "Closed"], table: true, format: "status" },
      { name: "department", label: "Assigned Department", type: "text", table: true },
      { name: "officer", label: "Assigned Officer", type: "text" },
      { name: "date_submitted", label: "Date Submitted", type: "date", table: true },
      { name: "expected_resolution", label: "Expected Resolution", type: "date" },
      { name: "internal_notes", label: "Internal Notes", type: "textarea" },
      { name: "resolution_notes", label: "Resolution Notes", type: "textarea" },
    ],
  },
  projectwatch: {
    key: "projectwatch",
    api: "/api/projects",
    idField: "project_id",
    idPrefix: "PW",
    label: "ProjectWatch",
    title: "Government Project Monitoring",
    description: "Track budgets, progress and delivery risk for public projects.",
    fields: [
      { name: "name", label: "Project Name", type: "text", required: true, table: true },
      { name: "department", label: "Department", type: "text", required: true, table: true },
      { name: "location", label: "Location", type: "text", table: true },
      { name: "contractor", label: "Contractor", type: "text" },
      { name: "approved_budget", label: "Approved Budget (KSh)", type: "number", format: "money", table: true },
      { name: "amount_spent", label: "Amount Spent (KSh)", type: "number", format: "money", table: true },
      { name: "start_date", label: "Start Date", type: "date" },
      { name: "expected_completion", label: "Expected Completion", type: "date", table: true },
      { name: "completion_pct", label: "Completion %", type: "number", table: true },
      { name: "status", label: "Status", type: "select", options: ["Active", "Delayed", "Completed"], table: true, format: "status" },
      { name: "project_manager", label: "Project Manager", type: "text" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  revenueguard: {
    key: "revenueguard",
    api: "/api/revenue",
    idField: null,
    idPrefix: null,
    label: "RevenueGuard",
    title: "Government Revenue Monitoring",
    description: "Track collections across revenue streams and flag unusual patterns.",
    fields: [
      { name: "record_date", label: "Date", type: "date", required: true, table: true },
      { name: "stream", label: "Revenue Stream", type: "select", options: ["Business Licences", "Construction Permits", "Market Fees", "Parking Fees", "Property Rates", "Advertising Fees"], required: true, table: true },
      { name: "department", label: "Department", type: "text", table: true },
      { name: "location", label: "Location", type: "text", table: true },
      { name: "expected_amount", label: "Expected Amount (KSh)", type: "number", format: "money", table: true },
      { name: "actual_amount", label: "Actual Amount (KSh)", type: "number", format: "money", table: true },
    ],
  },
  permitai: {
    key: "permitai",
    api: "/api/permits",
    idField: "application_id",
    idPrefix: "PA",
    label: "PermitAI",
    title: "Permit & Application Management",
    description: "Manage permit applications from submission through decision.",
    fields: [
      { name: "applicant_name", label: "Applicant Name", type: "text", required: true, table: true },
      { name: "permit_type", label: "Permit Type", type: "select", options: Object.keys(REQUIRED_DOCS), required: true, table: true },
      { name: "documents", label: "Documents Submitted", type: "docs" },
      { name: "submission_date", label: "Submission Date", type: "date", table: true },
      { name: "status", label: "Status", type: "select", options: ["Draft", "Submitted", "Document Review", "Assessment", "Approved", "Rejected"], table: true, format: "status" },
      { name: "officer", label: "Assigned Officer", type: "text" },
      { name: "review_notes", label: "Review Notes", type: "textarea" },
      { name: "decision", label: "Decision", type: "text" },
      { name: "approval_date", label: "Approval Date", type: "date" },
    ],
  },
  assettrack: {
    key: "assettrack",
    api: "/api/assets",
    idField: "asset_id",
    idPrefix: "AS",
    label: "AssetTrack",
    title: "Government Asset Management",
    description: "Track vehicles, equipment, buildings and other public assets.",
    fields: [
      { name: "name", label: "Asset Name", type: "text", required: true, table: true },
      { name: "category", label: "Category", type: "select", options: ["Vehicle", "Computer", "Printer", "Building", "Equipment", "Furniture", "Other"], table: true },
      { name: "department", label: "Department", type: "text", table: true },
      { name: "location", label: "Location", type: "text", table: true },
      { name: "purchase_date", label: "Purchase Date", type: "date" },
      { name: "purchase_value", label: "Purchase Value (KSh)", type: "number", format: "money", table: true },
      { name: "condition", label: "Condition", type: "select", options: ["Good", "Fair", "Poor"], table: true },
      { name: "officer", label: "Assigned Officer", type: "text" },
      { name: "maintenance_date", label: "Last Maintenance Date", type: "date" },
      { name: "status", label: "Status", type: "select", options: ["Active", "Maintenance", "Missing", "Retired"], table: true, format: "status" },
    ],
  },
};

/* ============================== SMALL UI PIECES ============================== */

function Pill({ value, kind }) {
  if (!value) return <span className="text-muted">—</span>;
  const cls = kind === "priority" ? `pill priority-${slugify(value)}` : `pill status-${slugify(value)}`;
  return <span className={cls}>{value}</span>;
}

function RiskBadge({ level }) {
  if (!level) return null;
  return <span className={`risk-badge ${level}`}>{level} Risk</span>;
}

function FieldValue({ field, value }) {
  if (field.format === "money") return <span>{fmtKsh(value)}</span>;
  if (field.format === "priority") return <Pill value={value} kind="priority" />;
  if (field.format === "status") return <Pill value={value} kind="status" />;
  return <span>{value === null || value === undefined || value === "" ? "—" : String(value)}</span>;
}

function Loading({ label }) {
  return <p className="text-muted">Loading {label || "data"}...</p>;
}

function ErrorBox({ message }) {
  if (!message) return null;
  return <div className="error-box">{message}</div>;
}

/* ---------- AI Insight box (per-module rendering) ---------- */
function AIInsightBox({ moduleKey, insight, extra }) {
  const [showWhy, setShowWhy] = useState(false);
  if (!insight) return null;

  let headline = null;
  if (moduleKey === "projectwatch") {
    headline = (
      <div>
        <RiskBadge level={insight.riskLevel} /> — spent {insight.spentPct}% of budget vs {insight.completionPct}% physical completion.
        <div style={{ marginTop: 4 }}>Suggested action: {insight.suggestedAction}</div>
      </div>
    );
  } else if (moduleKey === "revenueguard") {
    headline = insight.hasAnomaly ? (
      <div><strong>Unusual pattern detected</strong> — {insight.deviationPct > 0 ? "+" : ""}{insight.deviationPct}% vs recent average ({fmtKsh(insight.baselineAverage)}). Requires human review.</div>
    ) : (
      <div>No unusual pattern detected for this stream at this time.</div>
    );
  } else if (moduleKey === "permitai") {
    headline = insight.isComplete ? (
      <div>All required documents submitted. Next step: {insight.nextStep}</div>
    ) : (
      <div><strong>Missing documents:</strong> {insight.missing.join(", ")}. Next step: {insight.nextStep}</div>
    );
  } else if (moduleKey === "assettrack") {
    headline = (
      <div>
        <RiskBadge level={insight.riskLevel} /> — {insight.daysSinceMaintenance === null ? "no maintenance date on record" : `${insight.daysSinceMaintenance} day(s) since last maintenance`} (recommended interval: {insight.recommendedIntervalDays} days).
        <div style={{ marginTop: 4 }}>Suggested next maintenance date: {insight.suggestedMaintenanceDate}</div>
      </div>
    );
  } else if (moduleKey === "citizenflow") {
    headline = <div>{extra || "AI classification suggested a category, priority and department for this request."}</div>;
  }

  return (
    <div className="ai-box">
      <div className="ai-title">AI Insight</div>
      {headline}
      {insight.reasons && (
        <div style={{ marginTop: 6 }}>
          <button className="ai-why" onClick={() => setShowWhy((s) => !s)}>
            {showWhy ? "Hide reasoning" : "Why am I seeing this?"}
          </button>
          {showWhy && (
            <ul className="ai-why-reasons">
              {insight.reasons.map((r, i) => <li key={i}>{r}</li>)}
              {insight.note && <li><em>{insight.note}</em></li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Generic field editor for forms ---------- */
function FieldEditor({ field, value, onChange, permitType }) {
  if (field.type === "textarea") {
    return <textarea rows={3} value={value || ""} onChange={(e) => onChange(e.target.value)} required={field.required} />;
  }
  if (field.type === "select") {
    return (
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} required={field.required}>
        <option value="">-- select --</option>
        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field.type === "number") {
    return <input type="number" value={value === undefined || value === null ? "" : value} onChange={(e) => onChange(e.target.value)} required={field.required} />;
  }
  if (field.type === "date") {
    return <input type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} required={field.required} />;
  }
  if (field.type === "docs") {
    const required = REQUIRED_DOCS[permitType] || [];
    let current = [];
    try { current = JSON.parse(value || "[]").map((d) => (typeof d === "string" ? d : d.name)); } catch { current = []; }
    if (!permitType) return <p className="hint">Select a permit type first to see required documents.</p>;
    return (
      <div>
        {required.map((docName) => {
          const checked = current.includes(docName);
          return (
            <label key={docName} style={{ display: "block", fontSize: 12, fontWeight: "normal" }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  const next = e.target.checked ? [...current, docName] : current.filter((d) => d !== docName);
                  onChange(JSON.stringify(next.map((n) => ({ name: n, uploaded: true }))));
                }}
              /> {docName}
            </label>
          );
        })}
      </div>
    );
  }
  return <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} required={field.required} />;
}

/* ============================== LAYOUT ============================== */

function DemoBanner() {
  return (
    <div className="demo-banner">
      DEMO MODE — NePort is a demonstration platform using fictional data. It is not connected to any real government system.
    </div>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    NePortAPI.get("/api/notifications").then((rows) => { setItems(rows); setLoaded(true); }).catch(() => {});
  }, []);

  const unread = items.filter((n) => !n.is_read).length;

  const markRead = async (id) => {
    try {
      await NePortAPI.put(`/api/notifications/${id}`, { is_read: 1 });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
    } catch {}
  };

  return (
    <div style={{ position: "relative" }}>
      <button className="logout-btn" onClick={() => setOpen((o) => !o)}>
        Alerts ({unread})
      </button>
      {open && (
        <div className="notif-panel">
          <div className="panel-header" style={{ background: "var(--navy)", color: "#fff" }}>
            Notifications
            <button className="ai-why" style={{ color: "#fff" }} onClick={() => setOpen(false)}>close</button>
          </div>
          {!loaded && <div className="notif-item">Loading...</div>}
          {loaded && items.length === 0 && <div className="notif-item">No notifications.</div>}
          {items.map((n) => (
            <div key={n.id} className={`notif-item ${n.severity}`}>
              <strong>{n.type}</strong> ({n.module})
              <div>{n.message}</div>
              <small>
                {n.created_at} {!n.is_read && <button className="ai-why" onClick={() => markRead(n.id)}>mark read</button>}
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Header() {
  const { user, logout } = useAuth();
  const [q, setQ] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  const submitSearch = (e) => {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const navItems = [
    { path: "/dashboard", label: "Home" },
    { path: "/citizenflow", label: "CitizenFlow" },
    { path: "/projectwatch", label: "ProjectWatch" },
    { path: "/revenueguard", label: "RevenueGuard" },
    { path: "/permitai", label: "PermitAI" },
    { path: "/assettrack", label: "AssetTrack" },
    { path: "/assistant", label: "AI Assistant" },
    { path: "/reports", label: "Reports" },
    { path: "/admin", label: "Administration" },
    { path: "/help", label: "Help" },
  ];
  const current = parseHash().path;

  return (
    <React.Fragment>
      <DemoBanner />
      <header className="site-header">
        <a className="brand" href="#/dashboard">
          <div className="logo-box">NP</div>
          <div className="brand-text">
            <div className="brand-title">NePort</div>
            <div className="brand-sub">Government Administration Portal</div>
          </div>
        </a>
        {user && (
          <form className="search-box" onSubmit={submitSearch}>
            <input placeholder="Search NePort..." value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="submit">Search</button>
          </form>
        )}
        <div className="header-right">
          {user ? (
            <React.Fragment>
              <span className="user-chip">{user.name} — {user.role}</span>
              <NotificationBell />
              <button className="logout-btn" onClick={logout}>Log Out</button>
            </React.Fragment>
          ) : (
            <a href="#/login" style={{ color: "#fff" }}>Officer Login</a>
          )}
        </div>
      </header>
      {user && (
        <React.Fragment>
          <button className="nav-toggle" onClick={() => setNavOpen((o) => !o)}>Menu ▾</button>
          <nav className={`site-nav ${navOpen ? "open" : ""}`}>
            {navItems.map((item) => (
              <a key={item.path} href={`#${item.path}`} className={`nav-item ${current.startsWith(item.path) ? "active" : ""}`} onClick={() => setNavOpen(false)}>
                {item.label}
              </a>
            ))}
            <a className="nav-item" href="#/audit">Audit Log</a>
          </nav>
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div>NePort — Government Administration &amp; Intelligence Portal (Demonstration Build)</div>
      <div>Last updated: {new Date().toLocaleDateString()} | Fictional data only | Not affiliated with any actual county or national government system</div>
      <div style={{ marginTop: 4 }}>
        <a href="#/help">Help</a> &nbsp;|&nbsp; <a href="#/audit">Audit Log</a> &nbsp;|&nbsp; <a href="#/reports">Reports</a>
      </div>
    </footer>
  );
}

function Breadcrumbs({ trail }) {
  return (
    <div className="breadcrumbs">
      <a href="#/dashboard">Home</a>
      {trail.map((t, i) => (
        <span key={i}> &raquo; {t.href ? <a href={`#${t.href}`}>{t.label}</a> : t.label}</span>
      ))}
    </div>
  );
}

/* ============================== HOME (public) ============================== */

function HomePage() {
  const { user } = useAuth();
  return (
    <div className="page-wrap">
      <div className="panel">
        <div className="panel-body" style={{ textAlign: "center", padding: "26px 14px" }}>
          <h1 style={{ color: "var(--navy)", marginBottom: 4 }}>NePort</h1>
          <p style={{ fontWeight: "bold", color: "var(--gov-blue)" }}>Government Administration &amp; Intelligence Portal</p>
          <p style={{ maxWidth: 560, margin: "10px auto" }}>
            A unified platform for managing public services, projects, revenue, permits and government assets.
          </p>
          <a className="btn" href={user ? "#/dashboard" : "#/login"} style={{ fontSize: 14, padding: "8px 18px" }}>ENTER GOVERNMENT PORTAL</a>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">The Five NePort Modules</div>
        <div className="panel-body module-grid">
          {Object.values(MODULES).map((m) => (
            <a key={m.key} className="module-tile" href={`#/${m.key}`}>
              <h3>{m.label}</h3>
              <p>{m.description}</p>
            </a>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">Powered by Vertical AI</div>
        <div className="panel-body">
          <p>
            NePort applies artificial intelligence to specific government workflows, helping officers identify
            patterns, prioritize work and make better-informed decisions. AI results are always labelled and
            explainable — NePort assists government workers rather than replacing their decisions.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================== LOGIN ============================== */

function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState([]);

  useEffect(() => {
    NePortAPI.get("/api/auth/demo-accounts").then(setDemoAccounts).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-wrap">
      <div className="login-wrap">
        <div className="panel">
          <div className="panel-header">Officer Login</div>
          <div className="panel-body">
            <ErrorBox message={error} />
            <form onSubmit={submit}>
              <div className="form-row">
                <label>Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="form-row">
                <label>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <button className="btn" disabled={busy} type="submit">{busy ? "Signing in..." : "Sign In"}</button>
            </form>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">DEMO ACCOUNTS</div>
          <div className="panel-body">
            <p className="hint">This is a demonstration platform. Use any account below (click to autofill).</p>
            {demoAccounts.map((a) => (
              <div key={a.username} className="demo-account-row">
                <span>{a.role} — <code>{a.username}</code> / <code>{a.password}</code></span>
                <button className="btn secondary small" onClick={() => { setUsername(a.username); setPassword(a.password); }}>Use</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== DASHBOARD ============================== */

function StatCard({ value, label, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [flagged, setFlagged] = useState({ citizen: [], projects: [], permits: [], assets: [], revenue: [] });

  useEffect(() => {
    NePortAPI.get("/api/dashboard/stats").then(setStats).catch((e) => setError(e.message));
    Promise.all([
      NePortAPI.get("/api/citizen-requests?priority=High"),
      NePortAPI.get("/api/projects"),
      NePortAPI.get("/api/permits"),
      NePortAPI.get("/api/assets"),
      NePortAPI.get("/api/revenue"),
    ]).then(([citizen, projects, permits, assets, revenue]) => {
      setFlagged({
        citizen: citizen.filter((r) => !["Resolved", "Closed"].includes(r.status)).slice(0, 5),
        projects: projects.filter((p) => p.aiInsight && p.aiInsight.riskLevel !== "Low").slice(0, 5),
        permits: permits.filter((p) => p.aiInsight && !p.aiInsight.isComplete).slice(0, 5),
        assets: assets.filter((a) => a.aiInsight && a.aiInsight.riskLevel !== "Low").slice(0, 5),
        revenue: revenue.filter((r) => r.aiInsight && r.aiInsight.hasAnomaly).slice(0, 5),
      });
    }).catch(() => {});
  }, []);

  return (
    <div className="page-wrap">
      <Breadcrumbs trail={[{ label: "Government Overview" }]} />
      <h2 style={{ color: "var(--navy)" }}>Government Overview</h2>
      <ErrorBox message={error} />
      {!stats ? <Loading label="dashboard" /> : (
        <React.Fragment>
          <div className="stat-grid">
            <StatCard value={stats.citizenRequests.total.toLocaleString()} label="Citizen Requests" sub={`${stats.citizenRequests.open} open`} />
            <StatCard value={stats.projects.active} label="Active Projects" sub={`${stats.projects.atRisk} at risk of the ${stats.projects.total} total`} />
            <StatCard value={fmtKsh(stats.revenue.total)} label="Revenue Collected (period)" />
            <StatCard value={stats.permits.pending} label="Pending Permits" sub={`of ${stats.permits.total} total`} />
            <StatCard value={stats.assets.total.toLocaleString()} label="Government Assets" sub={`${stats.assets.needingAttention} need attention`} />
            <StatCard value={stats.projects.completed} label="Completed Projects" />
            <StatCard value={stats.projects.delayed} label="Delayed Projects" />
            <StatCard value={fmtKsh(stats.projects.totalBudget - stats.projects.totalSpent)} label="Remaining Project Budget" />
          </div>

          <div className="panel">
            <div className="panel-header">Items Requiring Attention (AI-Flagged)</div>
            <div className="panel-body">
              <FlaggedSection title="High-Priority Citizen Requests" rows={flagged.citizen} render={(r) => (
                <tr key={r.id}><td><a href={`#/citizenflow/${r.id}`}>{r.tracking_id}</a></td><td>{r.description}</td><td><Pill value={r.priority} kind="priority" /></td><td><Pill value={r.status} kind="status" /></td></tr>
              )} headers={["ID", "Description", "Priority", "Status"]} />

              <FlaggedSection title="At-Risk Projects" rows={flagged.projects} render={(p) => (
                <tr key={p.id}><td><a href={`#/projectwatch/${p.id}`}>{p.project_id}</a></td><td>{p.name}</td><td><RiskBadge level={p.aiInsight.riskLevel} /></td></tr>
              )} headers={["ID", "Name", "AI Risk"]} />

              <FlaggedSection title="Revenue Anomalies" rows={flagged.revenue} render={(r) => (
                <tr key={r.id}><td><a href={`#/revenueguard/${r.id}`}>{r.stream}</a></td><td>{r.record_date}</td><td>{fmtKsh(r.actual_amount)}</td><td>{r.aiInsight.deviationPct}%</td></tr>
              )} headers={["Stream", "Date", "Actual", "Deviation"]} />

              <FlaggedSection title="Permits Waiting on Documents" rows={flagged.permits} render={(p) => (
                <tr key={p.id}><td><a href={`#/permitai/${p.id}`}>{p.application_id}</a></td><td>{p.applicant_name}</td><td>{p.aiInsight.missing.join(", ")}</td></tr>
              )} headers={["ID", "Applicant", "Missing Docs"]} />

              <FlaggedSection title="Assets Requiring Maintenance" rows={flagged.assets} render={(a) => (
                <tr key={a.id}><td><a href={`#/assettrack/${a.id}`}>{a.asset_id}</a></td><td>{a.name}</td><td><RiskBadge level={a.aiInsight.riskLevel} /></td></tr>
              )} headers={["ID", "Name", "AI Risk"]} />
            </div>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

function FlaggedSection({ title, rows, render, headers }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h4 style={{ color: "var(--navy)", marginBottom: 4 }}>{title} ({rows.length})</h4>
      {rows.length === 0 ? <p className="hint">None currently flagged.</p> : (
        <table className="gov-table">
          <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(render)}</tbody>
        </table>
      )}
    </div>
  );
}

/* ============================== GENERIC MODULE LIST ============================== */

function ModuleListPage({ moduleKey }) {
  const cfg = MODULES[moduleKey];
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const statusField = cfg.fields.find((f) => f.name === "status");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (statusFilter) params.set("status", statusFilter);
    NePortAPI.get(`${cfg.api}?${params.toString()}`).then(setRows).catch((e) => setError(e.message));
  }, [cfg.api, q, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const tableFields = cfg.fields.filter((f) => f.table);

  return (
    <div className="page-wrap">
      <Breadcrumbs trail={[{ label: cfg.label }]} />
      <h2 style={{ color: "var(--navy)" }}>{cfg.title}</h2>
      <p className="text-muted">{cfg.description}</p>
      <ErrorBox message={error} />

      <div className="toolbar">
        <input placeholder={`Search ${cfg.label}...`} value={q} onChange={(e) => setQ(e.target.value)} />
        {statusField && (
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {statusField.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        <button className="btn secondary" onClick={load}>Apply Filters</button>
        <button className="btn" onClick={() => setShowCreate(true)}>+ New {cfg.label} Record</button>
        <a className="btn secondary" href={`#/reports`}>Export / Report</a>
      </div>

      {!rows ? <Loading label={cfg.label} /> : (
        <div className="panel">
          <div className="panel-header">{cfg.label} Records ({rows.length})</div>
          <div className="panel-body" style={{ overflowX: "auto" }}>
            <table className="gov-table">
              <thead>
                <tr>
                  {cfg.idField && <th>ID</th>}
                  {tableFields.map((f) => <th key={f.name}>{f.label}</th>)}
                  {(moduleKey === "projectwatch" || moduleKey === "assettrack") && <th>AI Risk</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/${moduleKey}/${r.id}`)}>
                    {cfg.idField && <td><a href={`#/${moduleKey}/${r.id}`} onClick={(e) => e.stopPropagation()}>{r[cfg.idField]}</a></td>}
                    {tableFields.map((f) => <td key={f.name}><FieldValue field={f} value={r[f.name]} /></td>)}
                    {(moduleKey === "projectwatch" || moduleKey === "assettrack") && <td>{r.aiInsight && <RiskBadge level={r.aiInsight.riskLevel} />}</td>}
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={10} className="text-muted">No records match your filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateModal moduleKey={moduleKey} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
      )}
    </div>
  );
}

/* ============================== CREATE MODAL ============================== */

function CreateModal({ moduleKey, onClose, onCreated }) {
  const cfg = MODULES[moduleKey];
  const [values, setValues] = useState(() => {
    const initial = {};
    cfg.fields.forEach((f) => { initial[f.name] = ""; });
    if (cfg.fields.find((f) => f.name === "status")) initial.status = cfg.fields.find((f) => f.name === "status").options[0];
    const dateField = cfg.fields.find((f) => f.name.includes("date") || f.name.includes("submitted"));
    return initial;
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiPreview, setAiPreview] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);

  const setVal = (name, v) => setValues((prev) => ({ ...prev, [name]: v }));

  const runAIClassification = async () => {
    if (!values.description || values.description.trim().length < 5) {
      setError("Enter a longer description before running AI classification.");
      return;
    }
    setAiBusy(true); setError("");
    try {
      const result = await NePortAPI.post("/api/ai/classify-complaint", { description: values.description });
      setAiPreview(result);
      setValues((prev) => ({ ...prev, category: result.category, priority: result.priority, department: result.department }));
    } catch (e) {
      setError(e.message);
    } finally {
      setAiBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const payload = { ...values };
      if (cfg.idField) payload[cfg.idField] = genId(cfg.idPrefix);
      if (moduleKey === "citizenflow") {
        payload.date_submitted = payload.date_submitted || todayISO();
        payload.ai_summary = aiPreview ? aiPreview.summary : values.description.slice(0, 90);
        if (!payload.priority) payload.priority = "Medium";
        if (!payload.status) payload.status = "Received";
      }
      const created = await NePortAPI.post(cfg.api, payload);
      onCreated(created);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <div className="modal-header">
          <strong>New {cfg.label} Record</strong>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <ErrorBox message={error} />
          <form onSubmit={submit}>
            <div className="form-grid">
              {cfg.fields.map((f) => (
                <div className="form-row" key={f.name} style={f.type === "textarea" || f.type === "docs" ? { gridColumn: "1 / -1" } : undefined}>
                  <label>{f.label}{f.required && " *"}</label>
                  <FieldEditor field={f} value={values[f.name]} onChange={(v) => setVal(f.name, v)} permitType={values.permit_type} />
                </div>
              ))}
            </div>

            {moduleKey === "citizenflow" && (
              <div className="ai-box">
                <div className="ai-title">AI Classification Assistant</div>
                <p className="hint">Run AI classification to auto-suggest category, priority and department from the description above.</p>
                <button type="button" className="btn secondary small" onClick={runAIClassification} disabled={aiBusy}>
                  {aiBusy ? "Analyzing..." : "Run AI Classification"}
                </button>
                {aiPreview && (
                  <div style={{ marginTop: 8 }}>
                    <div><strong>Category:</strong> {aiPreview.category} &nbsp; <strong>Priority:</strong> {aiPreview.priority} &nbsp; <strong>Department:</strong> {aiPreview.department}</div>
                    <div><strong>Summary:</strong> {aiPreview.summary}</div>
                    {aiPreview.similar && aiPreview.similar.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <strong>Possible duplicate/similar complaints:</strong>
                        <ul className="ai-why-reasons">
                          {aiPreview.similar.map((s) => <li key={s.tracking_id}>{s.tracking_id} ({s.similarity}% similar) — {s.description}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button className="btn" type="submit" disabled={busy}>{busy ? "Saving..." : "Save Record"}</button>
              <button className="btn secondary" type="button" onClick={onClose}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ============================== DETAIL / EDIT PAGE ============================== */

function ModuleDetailPage({ moduleKey, id }) {
  const cfg = MODULES[moduleKey];
  const [record, setRecord] = useState(null);
  const [values, setValues] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const canWrite = user && user.role !== "Read Only";

  const load = useCallback(() => {
    NePortAPI.get(`${cfg.api}/${id}`).then((r) => { setRecord(r); setValues(r); }).catch((e) => setError(e.message));
  }, [cfg.api, id]);

  useEffect(() => { load(); }, [load]);

  const setVal = (name, v) => setValues((prev) => ({ ...prev, [name]: v }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError(""); setSuccess("");
    try {
      const payload = {};
      cfg.fields.forEach((f) => { payload[f.name] = values[f.name]; });
      const updated = await NePortAPI.put(`${cfg.api}/${id}`, payload);
      setRecord(updated); setValues(updated);
      setSuccess("Record updated successfully.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Are you sure you want to delete this ${cfg.label} record? This action cannot be undone.`)) return;
    try {
      await NePortAPI.del(`${cfg.api}/${id}`);
      navigate(`/${moduleKey}`);
    } catch (e) {
      setError(e.message);
    }
  };

  if (error && !record) return <div className="page-wrap"><ErrorBox message={error} /></div>;
  if (!record) return <div className="page-wrap"><Loading label="record" /></div>;

  return (
    <div className="page-wrap">
      <Breadcrumbs trail={[{ label: cfg.label, href: `/${moduleKey}` }, { label: record[cfg.idField] || `#${record.id}` }]} />
      <h2 style={{ color: "var(--navy)" }}>{cfg.label} — {record[cfg.idField] || `Record #${record.id}`}</h2>
      <ErrorBox message={error} />
      {success && <div className="success-box">{success}</div>}

      {record.aiInsight && (
        <AIInsightBox
          moduleKey={moduleKey}
          insight={record.aiInsight}
          extra={moduleKey === "citizenflow" && record.ai_summary ? `AI Summary: ${record.ai_summary}` : undefined}
        />
      )}
      {moduleKey === "citizenflow" && record.aiInsight && record.aiInsight.similar && record.aiInsight.similar.length > 0 && (
        <div className="ai-box">
          <div className="ai-title">Possible Duplicate / Similar Complaints</div>
          <ul className="ai-why-reasons">
            {record.aiInsight.similar.map((s) => (
              <li key={s.tracking_id}><a href={`#/citizenflow/${s.tracking_id}`}>{s.tracking_id}</a> ({s.similarity}% similar) — {s.description}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel" style={{ marginTop: 10 }}>
        <div className="panel-header">Record Details {!canWrite && "(Read Only)"}</div>
        <div className="panel-body">
          <form onSubmit={save}>
            <div className="form-grid">
              {cfg.fields.map((f) => (
                <div className="form-row" key={f.name} style={f.type === "textarea" || f.type === "docs" ? { gridColumn: "1 / -1" } : undefined}>
                  <label>{f.label}</label>
                  {canWrite ? (
                    <FieldEditor field={f} value={values[f.name]} onChange={(v) => setVal(f.name, v)} permitType={values.permit_type} />
                  ) : (
                    <div style={{ padding: "5px 0" }}><FieldValue field={f} value={record[f.name]} /></div>
                  )}
                </div>
              ))}
            </div>
            {canWrite && (
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <button className="btn" type="submit" disabled={busy}>{busy ? "Saving..." : "Save Changes"}</button>
                <button className="btn danger" type="button" onClick={remove}>Delete Record</button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

/* ============================== AI ASSISTANT ============================== */

const ASSISTANT_EXAMPLES = {
  citizenflow: ["Show me unresolved high-priority complaints"],
  projectwatch: ["Which projects are at risk?"],
  revenueguard: ["Which revenue streams have unusual changes?"],
  permitai: ["Which applications are waiting for documents?"],
  assettrack: ["Which assets require maintenance?"],
};

function AIAssistantPage() {
  const [moduleKey, setModuleKey] = useState("citizenflow");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ask = async (q) => {
    const question_ = q !== undefined ? q : question;
    setBusy(true); setError(""); setResult(null);
    try {
      const r = await NePortAPI.post("/api/ai/assistant", { module: moduleKey, question: question_ });
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-wrap">
      <Breadcrumbs trail={[{ label: "AI Assistant" }]} />
      <h2 style={{ color: "var(--navy)" }}>NePort AI Assistant</h2>
      <p className="text-muted">Ask a question relevant to the selected module. The assistant is context-aware and rule-based for this demo.</p>

      <div className="panel">
        <div className="panel-body">
          <div className="form-row">
            <label>Module Context</label>
            <select value={moduleKey} onChange={(e) => { setModuleKey(e.target.value); setResult(null); }}>
              {Object.values(MODULES).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div className="tag-row">
            {(ASSISTANT_EXAMPLES[moduleKey] || []).map((ex) => (
              <button key={ex} className="btn secondary small" onClick={() => { setQuestion(ex); ask(ex); }}>{ex}</button>
            ))}
          </div>
          <div className="form-row" style={{ marginTop: 8 }}>
            <label>Your Question</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input style={{ flex: 1 }} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a question about this module..." />
              <button className="btn" onClick={() => ask()} disabled={busy}>{busy ? "Thinking..." : "Ask"}</button>
            </div>
          </div>
          <ErrorBox message={error} />
        </div>
      </div>

      {result && (
        <div className="panel">
          <div className="panel-header">AI Assistant Response</div>
          <div className="panel-body">
            <div className="ai-box"><div className="ai-title">AI Insight</div>{result.answer}</div>
            {result.results && result.results.length > 0 && (
              <table className="gov-table" style={{ marginTop: 10 }}>
                <thead><tr><th>Record</th><th>Details</th></tr></thead>
                <tbody>
                  {result.results.map((r, i) => (
                    <tr key={i}>
                      <td>{r.tracking_id || r.project_id || r.application_id || r.asset_id || r.stream || `#${r.id}`}</td>
                      <td>{r.description || r.name || r.applicant_name || r.stream || JSON.stringify(r).slice(0, 80)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== REPORTS ============================== */

const REPORTS = [
  { key: "citizen", label: "Citizen Service Report" },
  { key: "projects", label: "Project Status Report" },
  { key: "revenue", label: "Revenue Report" },
  { key: "permits", label: "Permit Processing Report" },
  { key: "assets", label: "Asset Report" },
];

function ReportsPage() {
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");

  const exportReport = async (key) => {
    setBusyKey(key); setError("");
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (department) params.set("department", department);
      const token = NePortAPI.getToken();
      const res = await fetch(`/api/reports/${key}/export?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Could not generate report.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${key}_report.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="page-wrap">
      <Breadcrumbs trail={[{ label: "Reports" }]} />
      <h2 style={{ color: "var(--navy)" }}>Reports</h2>
      <p className="text-muted">Filter and export government reports as CSV. Print via your browser's print function once exported/opened.</p>
      <ErrorBox message={error} />

      <div className="panel">
        <div className="panel-header">Report Filters</div>
        <div className="panel-body toolbar">
          <div className="form-row">
            <label>Status (optional)</label>
            <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="e.g. Active, Resolved" />
          </div>
          <div className="form-row">
            <label>Department (optional)</label>
            <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Public Works" />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">Available Reports</div>
        <div className="panel-body">
          <table className="gov-table">
            <thead><tr><th>Report</th><th>Action</th></tr></thead>
            <tbody>
              {REPORTS.map((r) => (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td>
                    <button className="btn small" onClick={() => exportReport(r.key)} disabled={busyKey === r.key}>
                      {busyKey === r.key ? "Exporting..." : "Export CSV"}
                    </button>
                    &nbsp;
                    <button className="btn secondary small" onClick={() => window.print()}>Print</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============================== SEARCH RESULTS ============================== */

function SearchResultsPage({ q }) {
  const [results, setResults] = useState(null);
  useEffect(() => {
    if (!q) return;
    NePortAPI.get(`/api/search?q=${encodeURIComponent(q)}`).then(setResults).catch(() => {});
  }, [q]);

  const sections = [
    { key: "citizen_requests", label: "CitizenFlow", idField: "tracking_id", path: "citizenflow", text: (r) => r.description },
    { key: "projects", label: "ProjectWatch", idField: "project_id", path: "projectwatch", text: (r) => r.name },
    { key: "revenue", label: "RevenueGuard", idField: "id", path: "revenueguard", text: (r) => `${r.stream} — ${r.record_date}` },
    { key: "permits", label: "PermitAI", idField: "application_id", path: "permitai", text: (r) => `${r.applicant_name} (${r.permit_type})` },
    { key: "assets", label: "AssetTrack", idField: "asset_id", path: "assettrack", text: (r) => r.name },
  ];

  return (
    <div className="page-wrap">
      <Breadcrumbs trail={[{ label: `Search Results for "${q}"` }]} />
      <h2 style={{ color: "var(--navy)" }}>Search Results: "{q}"</h2>
      {!results ? <Loading label="search results" /> : (
        sections.map((s) => (
          <div className="panel" key={s.key}>
            <div className="panel-header">{s.label} ({results[s.key].length})</div>
            <div className="panel-body">
              {results[s.key].length === 0 ? <p className="hint">No matches.</p> : (
                <table className="gov-table">
                  <thead><tr><th>ID</th><th>Details</th></tr></thead>
                  <tbody>
                    {results[s.key].map((r) => (
                      <tr key={r.id}>
                        <td><a href={`#/${s.path}/${r.id}`}>{r[s.idField] || `#${r.id}`}</a></td>
                        <td>{s.text(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ============================== AUDIT LOG ============================== */

function AuditLogPage() {
  const [rows, setRows] = useState(null);
  useEffect(() => { NePortAPI.get("/api/audit-log").then(setRows).catch(() => {}); }, []);
  return (
    <div className="page-wrap">
      <Breadcrumbs trail={[{ label: "Audit Log" }]} />
      <h2 style={{ color: "var(--navy)" }}>System Audit Log</h2>
      <p className="text-muted">A record of actions performed within NePort, for accountability and transparency.</p>
      {!rows ? <Loading label="audit log" /> : (
        <div className="panel">
          <div className="panel-body" style={{ overflowX: "auto" }}>
            <table className="gov-table">
              <thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}><td>{r.ts}</td><td>{r.actor}</td><td>{r.action}</td><td>{r.details}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== ADMINISTRATION ============================== */

function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { NePortAPI.get("/api/users").then(setUsers).catch((e) => setError(e.message)); }, []);

  return (
    <div className="page-wrap">
      <Breadcrumbs trail={[{ label: "Administration" }]} />
      <h2 style={{ color: "var(--navy)" }}>Administration — Users &amp; Roles</h2>
      {user.role !== "Administrator" ? (
        <div className="error-box">Only Administrator accounts can view full user management. You are viewing limited information.</div>
      ) : null}
      <ErrorBox message={error} />
      {!users ? <Loading label="users" /> : (
        <div className="panel">
          <div className="panel-header">Registered Users ({users.length})</div>
          <div className="panel-body">
            <table className="gov-table">
              <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Department</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}><td>{u.username}</td><td>{u.name}</td><td>{u.role}</td><td>{u.department}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="panel">
        <div className="panel-header">Role Permissions Reference</div>
        <div className="panel-body">
          <table className="gov-table">
            <thead><tr><th>Role</th><th>Access</th></tr></thead>
            <tbody>
              <tr><td>Administrator</td><td>Full access to all modules and administration</td></tr>
              <tr><td>Department Officer</td><td>Access to assigned department data (CitizenFlow focus)</td></tr>
              <tr><td>Project Manager</td><td>ProjectWatch access</td></tr>
              <tr><td>Revenue Officer</td><td>RevenueGuard access</td></tr>
              <tr><td>Permit Officer</td><td>PermitAI access</td></tr>
              <tr><td>Asset Officer</td><td>AssetTrack access</td></tr>
              <tr><td>Read Only</td><td>Can view dashboards and reports but cannot modify records</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HelpPage() {
  return (
    <div className="page-wrap">
      <Breadcrumbs trail={[{ label: "Help" }]} />
      <h2 style={{ color: "var(--navy)" }}>Help &amp; About NePort</h2>
      <div className="panel">
        <div className="panel-body">
          <p><strong>NePort</strong> is a Vertical AI + Micro-SaaS demonstration platform for government departments, covering citizen services (CitizenFlow), project monitoring (ProjectWatch), revenue monitoring (RevenueGuard), permit management (PermitAI) and asset management (AssetTrack).</p>
          <p>All AI results in NePort are advisory. They are clearly labelled "AI Insight" and include a "Why am I seeing this?" explanation. AI assists government workers — it does not make final decisions.</p>
          <p>This is a demonstration build using fictional data. See the README included with this project for full documentation.</p>
        </div>
      </div>
    </div>
  );
}

/* ============================== APP SHELL / ROUTER ============================== */

function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();
  const route = parseHash();
  if (loading) return <div className="page-wrap"><Loading label="NePort" /></div>;
  if (!user) {
    navigate("/login");
    return <div className="page-wrap"><Loading label="login" /></div>;
  }
  return children;
}

function App() {
  const route = useHashRoute();
  const { user, loading } = useAuth();
  const [seg0, seg1] = route.segments;

  useEffect(() => { window.scrollTo(0, 0); }, [route.path]);

  let page;
  if (!seg0 || seg0 === "") {
    page = <HomePage />;
  } else if (seg0 === "login") {
    page = <LoginPage />;
  } else if (loading) {
    page = <div className="page-wrap"><Loading label="NePort" /></div>;
  } else if (!user) {
    // Defer to hash change
    navigate("/login");
    page = <div className="page-wrap"><Loading label="login" /></div>;
  } else if (seg0 === "dashboard") {
    page = <DashboardPage />;
  } else if (MODULES[seg0]) {
    page = seg1 ? <ModuleDetailPage moduleKey={seg0} id={seg1} /> : <ModuleListPage moduleKey={seg0} />;
  } else if (seg0 === "assistant") {
    page = <AIAssistantPage />;
  } else if (seg0 === "reports") {
    page = <ReportsPage />;
  } else if (seg0 === "search") {
    page = <SearchResultsPage q={route.query.get("q") || ""} />;
  } else if (seg0 === "audit") {
    page = <AuditLogPage />;
  } else if (seg0 === "admin") {
    page = <AdminPage />;
  } else if (seg0 === "help") {
    page = <HelpPage />;
  } else {
    page = <div className="page-wrap"><div className="error-box">Page not found.</div></div>;
  }

  return (
    <React.Fragment>
      <Header />
      {page}
      <Footer />
    </React.Fragment>
  );
}

function Root() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<Root />);
