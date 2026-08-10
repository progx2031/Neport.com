const db = require("./db");
const { hashPassword } = require("./auth");

function clearAll() {
  const tables = ["users", "citizen_requests", "projects", "revenue", "permits", "assets", "notifications", "audit_log"];
  for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
}

function insertUsers() {
  const users = [
    { username: "admin", password: "admin123", name: "Grace Wanjiku", role: "Administrator", department: "Office of the County Secretary" },
    { username: "officer1", password: "officer123", name: "Peter Otieno", role: "Department Officer", department: "Public Works" },
    { username: "pm1", password: "pm123", name: "Susan Achieng", role: "Project Manager", department: "Infrastructure" },
    { username: "revenue1", password: "revenue123", name: "James Mwangi", role: "Revenue Officer", department: "Finance & Revenue" },
    { username: "permit1", password: "permit123", name: "Fatuma Hassan", role: "Permit Officer", department: "Licensing" },
    { username: "asset1", password: "asset123", name: "Daniel Kiptoo", role: "Asset Officer", department: "General Services" },
    { username: "viewer1", password: "viewer123", name: "Alice Nyambura", role: "Read Only", department: "Office of the Governor" },
  ];
  const stmt = db.prepare(`INSERT INTO users (username, password_hash, password_salt, name, role, department) VALUES (?, ?, ?, ?, ?, ?)`);
  for (const u of users) {
    const { hash, salt } = hashPassword(u.password);
    stmt.run(u.username, hash, salt, u.name, u.role, u.department);
  }
}

const CATEGORIES = [
  { category: "Roads", department: "Public Works", text: (loc) => `There has been a large pothole on ${loc} for three weeks, causing traffic and vehicle damage.` },
  { category: "Water", department: "Water & Sanitation", text: (loc) => `Residents near ${loc} have had no piped water supply for over a week.` },
  { category: "Electricity", department: "Energy & Infrastructure", text: (loc) => `The streetlight along ${loc} has not worked for a month, raising security concerns at night.` },
  { category: "Sanitation", department: "Environment & Sanitation", text: (loc) => `Uncollected garbage has been piling up near ${loc}, attracting pests and bad odour.` },
  { category: "Security", department: "County Security", text: (loc) => `There has been a rise in insecurity reports around ${loc} in the last two weeks.` },
  { category: "Environment", department: "Environment & Sanitation", text: (loc) => `Persistent flooding is reported on ${loc} whenever it rains, affecting nearby homes.` },
  { category: "Markets & Trade", department: "Trade & Markets", text: (loc) => `Vendors at ${loc} market are requesting repair of collapsed stalls and drainage.` },
];
const LOCATIONS = [
  "Kimathi Street", "Moi Avenue near the market", "Ngara estate", "Kawangware Road", "Buruburu Phase 3",
  "Kayole junction", "Dandora Phase 2", "Githurai 45", "Kibera Toi Market", "Rongai bypass",
  "Umoja Innercore", "Kariobangi South", "Pipeline estate", "Kasarani stadium road", "Ruaka town",
  "Embakasi Village", "Donholm roundabout", "Zimmerman Estate", "Utawala Junction", "South B shopping centre",
];
const OFFICERS = ["Peter Otieno", "Mary Njeri", "John Kamau", "Lucy Wambui", "Brian Ochieng", "Esther Chebet"];
const STATUS_FLOW = ["Received", "Under Review", "Assigned", "In Progress", "Resolved", "Closed"];

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function daysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

function insertCitizenRequests() {
  const { classifyComplaint } = require("./aiEngine");
  const stmt = db.prepare(`
    INSERT INTO citizen_requests
      (tracking_id, category, description, location, priority, status, department, officer, date_submitted, expected_resolution, internal_notes, resolution_notes, ai_summary, citizen_name)
    VALUES (@tracking_id, @category, @description, @location, @priority, @status, @department, @officer, @date_submitted, @expected_resolution, @internal_notes, @resolution_notes, @ai_summary, @citizen_name)
  `);
  const names = ["Wanjiru M.", "Otieno K.", "Abdi H.", "Chebet R.", "Kamau S.", "Nyaboke T.", "Mutiso J.", "Akinyi P."];
  for (let i = 1; i <= 20; i++) {
    const loc = pick(LOCATIONS);
    const c = pick(CATEGORIES);
    const description = c.text(loc);
    const ai = classifyComplaint(description);
    const status = i <= 5 ? "Resolved" : pick(STATUS_FLOW.slice(0, 5));
    const submitted = daysAgo(randInt(2, 60));
    stmt.run({
      tracking_id: `CF-${1000 + i}`,
      category: ai.category,
      description,
      location: loc,
      priority: ai.priority,
      status,
      department: ai.department,
      officer: status === "Received" ? null : pick(OFFICERS),
      date_submitted: submitted,
      expected_resolution: daysFromNow(randInt(3, 21)),
      internal_notes: status === "Received" ? null : "Field visit scheduled to confirm scope of works.",
      resolution_notes: status === "Resolved" || status === "Closed" ? "Issue addressed by the responsible department crew." : null,
      ai_summary: ai.summary,
      citizen_name: pick(names),
    });
  }
}

const PROJECT_TEMPLATES = [
  { name: "Kimathi-Ngara Road Rehabilitation", department: "Public Works", category: "Road" },
  { name: "Buruburu Primary School Extension", department: "Education", category: "School" },
  { name: "Kayole Sub-County Hospital Renovation", department: "Health", category: "Hospital" },
  { name: "Ruaka Water Trunk Line Extension", department: "Water & Sanitation", category: "Water" },
  { name: "County ICT Hub Phase 1", department: "ICT", category: "ICT" },
  { name: "Dandora Market Modernisation", department: "Trade & Markets", category: "Market" },
  { name: "Umoja Storm Drainage Project", department: "Public Works", category: "Road" },
  { name: "Kasarani Stadium Access Road", department: "Public Works", category: "Road" },
  { name: "Embakasi Health Centre Upgrade", department: "Health", category: "Hospital" },
  { name: "Zimmerman Estate Street Lighting", department: "Energy & Infrastructure", category: "ICT" },
];
const CONTRACTORS = ["Amka Builders Ltd", "Jenga Civil Works", "Northline Construction", "Delta Infra Co.", "Pamoja Engineering Ltd"];

function insertProjects() {
  const stmt = db.prepare(`
    INSERT INTO projects
      (project_id, name, department, location, contractor, approved_budget, amount_spent, start_date, expected_completion, completion_pct, status, project_manager, notes)
    VALUES (@project_id, @name, @department, @location, @contractor, @approved_budget, @amount_spent, @start_date, @expected_completion, @completion_pct, @status, @project_manager, @notes)
  `);
  PROJECT_TEMPLATES.forEach((tpl, idx) => {
    const budget = randInt(15, 250) * 100000;
    let completion, spentRatio, status, expectedCompletion;
    if (idx === 1) { completion = 42; spentRatio = 0.68; status = "Active"; expectedCompletion = daysFromNow(45); }
    else if (idx === 6) { completion = 20; spentRatio = 0.15; status = "Delayed"; expectedCompletion = daysAgo(10); }
    else if (idx < 3) { completion = 100; spentRatio = 0.97; status = "Completed"; expectedCompletion = daysAgo(20); }
    else { completion = randInt(15, 90); spentRatio = Math.max(0.05, Math.min(1, completion / 100 + randInt(-15, 15) / 100)); status = pick(["Active", "Active", "Delayed"]); expectedCompletion = daysFromNow(randInt(20, 200)); }

    stmt.run({
      project_id: `PW-${String(idx + 1).padStart(3, "0")}`,
      name: tpl.name,
      department: tpl.department,
      location: pick(LOCATIONS),
      contractor: pick(CONTRACTORS),
      approved_budget: budget,
      amount_spent: Math.round(budget * spentRatio),
      start_date: daysAgo(randInt(60, 400)),
      expected_completion: expectedCompletion,
      completion_pct: completion,
      status,
      project_manager: pick(["Susan Achieng", "Michael Wafula", "Rose Adhiambo", "Tom Muriithi"]),
      notes: "Progress recorded from the latest site supervision report.",
    });
  });
}

const REVENUE_STREAMS = ["Business Licences", "Construction Permits", "Market Fees", "Parking Fees", "Property Rates", "Advertising Fees"];

function insertRevenue() {
  const stmt = db.prepare(`
    INSERT INTO revenue (record_date, stream, department, location, expected_amount, actual_amount)
    VALUES (@record_date, @stream, @department, @location, @expected_amount, @actual_amount)
  `);
  let count = 0;
  for (let d = 0; d < 20; d++) {
    const stream = REVENUE_STREAMS[d % REVENUE_STREAMS.length];
    const baseline = { "Business Licences": 480000, "Construction Permits": 320000, "Market Fees": 150000, "Parking Fees": 90000, "Property Rates": 610000, "Advertising Fees": 60000 }[stream];
    let actual = Math.round(baseline * (0.9 + Math.random() * 0.2));
    // Inject a couple of clear anomalies for the demo
    if (stream === "Market Fees" && d === REVENUE_STREAMS.indexOf("Market Fees")) actual = Math.round(baseline * 0.56);
    if (stream === "Parking Fees" && d === REVENUE_STREAMS.indexOf("Parking Fees") + 6) actual = Math.round(baseline * 1.5);

    stmt.run({
      record_date: daysAgo(19 - d),
      stream,
      department: "Finance & Revenue",
      location: pick(["Nairobi CBD", "Westlands", "Kasarani", "Embakasi", "Kibra"]),
      expected_amount: baseline,
      actual_amount: actual,
    });
    count++;
  }
}

const PERMIT_TYPES = ["Business Permit", "Construction Permit", "Event Permit", "Advertising Permit", "Trade Licence"];
const ALL_DOCS = ["ID/Passport Copy", "KRA PIN Certificate", "Lease Agreement", "Passport Photo", "Architectural Drawings", "Structural Report", "Land Title", "Event Proposal", "Venue Confirmation", "Police Clearance", "Design Artwork", "Site Photos", "Business Registration"];
const PERMIT_STATUSES = ["Draft", "Submitted", "Document Review", "Assessment", "Approved", "Rejected"];

function insertPermits() {
  const { REQUIRED_DOCS } = require("./aiEngine");
  const stmt = db.prepare(`
    INSERT INTO permits (application_id, applicant_name, permit_type, documents, submission_date, status, officer, review_notes, decision, approval_date)
    VALUES (@application_id, @applicant_name, @permit_type, @documents, @submission_date, @status, @officer, @review_notes, @decision, @approval_date)
  `);
  const applicants = ["Jane Muthoni Enterprises", "Coastline Traders Ltd", "Highview Events Co.", "Sunrise Bakery", "Metro Advertising Ltd", "Baraka General Store", "Uptown Fashions", "Greenline Builders", "Fresh Mart Supermarket", "Skyline Media Ltd", "Amani Catering", "Prime Motors Garage", "Delight Salon", "Quickfix Electricals", "Urban Nest Realty"];
  for (let i = 1; i <= 15; i++) {
    const type = PERMIT_TYPES[i % PERMIT_TYPES.length];
    const required = REQUIRED_DOCS[type] || [];
    const status = PERMIT_STATUSES[i % PERMIT_STATUSES.length];
    const providedCount = status === "Draft" ? randInt(0, required.length - 1) : status === "Submitted" ? randInt(required.length - 2, required.length) : required.length;
    const documents = required.slice(0, Math.max(0, providedCount)).map((name) => ({ name, uploaded: true }));
    stmt.run({
      application_id: `PA-${2000 + i}`,
      applicant_name: applicants[i - 1],
      permit_type: type,
      documents: JSON.stringify(documents),
      submission_date: daysAgo(randInt(1, 45)),
      status,
      officer: status === "Draft" ? null : pick(["Fatuma Hassan", "Kevin Ouma", "Purity Wanjiru"]),
      review_notes: status === "Draft" ? null : "Initial review completed; awaiting further assessment.",
      decision: status === "Approved" ? "Approved" : status === "Rejected" ? "Rejected - incomplete documentation" : null,
      approval_date: status === "Approved" ? daysAgo(randInt(1, 10)) : null,
    });
  }
}

const ASSET_CATEGORIES = ["Vehicle", "Computer", "Printer", "Building", "Equipment", "Furniture"];
const CONDITIONS = ["Good", "Good", "Fair", "Poor"];
const ASSET_STATUSES = ["Active", "Active", "Active", "Maintenance", "Missing", "Retired"];

function insertAssets() {
  const stmt = db.prepare(`
    INSERT INTO assets (asset_id, name, category, department, location, purchase_date, purchase_value, condition, officer, maintenance_date, status)
    VALUES (@asset_id, @name, @category, @department, @location, @purchase_date, @purchase_value, @condition, @officer, @maintenance_date, @status)
  `);
  const namesByCategory = {
    Vehicle: ["Toyota Land Cruiser (Utility)", "Isuzu Truck (Waste Collection)", "Toyota Hilux (Field Ops)", "Nissan Van (Staff Transport)"],
    Computer: ["Dell OptiPlex Desktop", "HP EliteBook Laptop", "Lenovo ThinkCentre Desktop"],
    Printer: ["HP LaserJet Pro", "Canon ImageRunner", "Epson EcoTank"],
    Building: ["Sub-County Office Block", "Community Health Centre", "County Library Building"],
    Equipment: ["Water Pump Unit", "Generator (50kVA)", "Road Grader"],
    Furniture: ["Office Desk Set", "Conference Table", "Filing Cabinet Set"],
  };
  for (let i = 1; i <= 25; i++) {
    const category = ASSET_CATEGORIES[i % ASSET_CATEGORIES.length];
    const nameOptions = namesByCategory[category];
    const purchaseValue = { Vehicle: randInt(20, 80) * 100000, Computer: randInt(4, 15) * 10000, Printer: randInt(2, 8) * 10000, Building: randInt(50, 400) * 100000, Equipment: randInt(10, 60) * 10000, Furniture: randInt(1, 5) * 10000 }[category];
    const status = ASSET_STATUSES[i % ASSET_STATUSES.length];
    stmt.run({
      asset_id: `AS-${3000 + i}`,
      name: pick(nameOptions),
      category,
      department: pick(["Public Works", "Health", "ICT", "General Services", "Education"]),
      location: pick(LOCATIONS),
      purchase_date: daysAgo(randInt(100, 2000)),
      purchase_value: purchaseValue,
      condition: pick(CONDITIONS),
      officer: pick(OFFICERS),
      maintenance_date: daysAgo(randInt(10, 800)),
      status,
    });
  }
}

function insertNotifications() {
  const items = [
    { module: "citizenflow", type: "High-priority request", message: "3 new high-priority citizen requests received in the last 24 hours.", severity: "high" },
    { module: "projectwatch", type: "Project delayed", message: 'Project PW-007 "Umoja Storm Drainage Project" is marked Delayed.', severity: "high" },
    { module: "revenueguard", type: "Revenue anomaly", message: "Unusual pattern detected in Market Fees collections — requires human review.", severity: "high" },
    { module: "permitai", type: "Missing documents", message: "5 permit applications are awaiting missing documents.", severity: "medium" },
    { module: "assettrack", type: "Maintenance due", message: "4 assets have exceeded their recommended maintenance interval.", severity: "medium" },
    { module: "projectwatch", type: "Budget warning", message: 'Project PW-002 "Buruburu Primary School Extension" shows spending ahead of physical progress.', severity: "high" },
    { module: "citizenflow", type: "Status update", message: "12 citizen requests moved to In Progress this week.", severity: "info" },
  ];
  const stmt = db.prepare(`INSERT INTO notifications (module, type, message, severity) VALUES (@module, @type, @message, @severity)`);
  for (const n of items) stmt.run(n);
}

function insertAuditLog() {
  const items = [
    { actor: "admin", action: "Updated Project PW-001", details: "Changed status from Active to Completed." },
    { actor: "officer1", action: "Assigned Citizen Request CF-1042", details: "Assigned to Peter Otieno, Public Works." },
    { actor: "revenue1", action: "Reviewed Revenue Anomaly", details: "Flagged Market Fees collection for follow-up." },
    { actor: "permit1", action: "Requested Missing Documents", details: "PA-2005 - requested Land Title from applicant." },
    { actor: "asset1", action: "Scheduled Maintenance", details: "AS-3011 - scheduled for maintenance next week." },
    { actor: "admin", action: "Created User Account", details: "Created account for officer1 (Department Officer)." },
    { actor: "pm1", action: "Updated Project PW-006", details: "Updated completion percentage to 55%." },
  ];
  const stmt = db.prepare(`INSERT INTO audit_log (actor, action, details) VALUES (@actor, @action, @details)`);
  for (const a of items) stmt.run(a);
}

function seed() {
  clearAll();
  insertUsers();
  insertCitizenRequests();
  insertProjects();
  insertRevenue();
  insertPermits();
  insertAssets();
  insertNotifications();
  insertAuditLog();
  console.log("NePort demo database seeded successfully.");
}

seed();
