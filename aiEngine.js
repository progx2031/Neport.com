/**
 * NePort AI Engine
 * --------------------------------------------------------------------
 * This is a DETERMINISTIC, RULE-BASED mock AI layer. It exists so the
 * MVP works end-to-end with zero external API keys and 100% reproducible
 * demo behaviour.
 *
 * Every function below returns an object that always includes:
 *   - a human-readable AI conclusion/label
 *   - a `reasons` array (used by the "Why am I seeing this?" UI)
 *
 * TO CONNECT A REAL AI PROVIDER LATER:
 *   Implement `buildRealAIProvider()` at the bottom of this file to call
 *   the Anthropic API (see README "Connecting a real AI provider"), then
 *   swap the exported function bodies to call the provider instead of
 *   the rule-based logic. Keep the same return shape so the frontend
 *   does not need to change.
 * --------------------------------------------------------------------
 */

const ROAD_WORDS = ["pothole", "road", "tarmac", "highway", "street", "drainage", "culvert"];
const WATER_WORDS = ["water", "leak", "pipe", "sewage", "sewer", "borehole", "tap"];
const ELECTRICITY_WORDS = ["electricity", "power", "streetlight", "light", "transformer", "blackout"];
const SANITATION_WORDS = ["garbage", "trash", "waste", "dumping", "litter", "refuse"];
const SECURITY_WORDS = ["crime", "theft", "insecurity", "assault", "robbery", "security"];
const ENVIRONMENT_WORDS = ["noise", "pollution", "smoke", "dust", "tree", "flood"];
const MARKET_WORDS = ["market", "stall", "vendor", "hawker"];

const URGENT_WORDS = ["urgent", "danger", "dangerous", "children", "school", "hospital", "collapse", "fire", "injur", "weeks", "months", "emergency"];

function scoreCategory(text) {
  const t = text.toLowerCase();
  const table = [
    { category: "Roads", department: "Public Works", words: ROAD_WORDS },
    { category: "Water", department: "Water & Sanitation", words: WATER_WORDS },
    { category: "Electricity", department: "Energy & Infrastructure", words: ELECTRICITY_WORDS },
    { category: "Sanitation", department: "Environment & Sanitation", words: SANITATION_WORDS },
    { category: "Security", department: "County Security", words: SECURITY_WORDS },
    { category: "Environment", department: "Environment & Sanitation", words: ENVIRONMENT_WORDS },
    { category: "Markets & Trade", department: "Trade & Markets", words: MARKET_WORDS },
  ];
  let best = { category: "General", department: "Office of the County Secretary", matches: [] };
  let bestScore = 0;
  for (const row of table) {
    const matches = row.words.filter((w) => t.includes(w));
    if (matches.length > bestScore) {
      bestScore = matches.length;
      best = { category: row.category, department: row.department, matches };
    }
  }
  return best;
}

function scorePriority(text) {
  const t = text.toLowerCase();
  const hits = URGENT_WORDS.filter((w) => t.includes(w));
  if (hits.length >= 2) return { priority: "High", hits };
  if (hits.length === 1) return { priority: "Medium", hits };
  return { priority: "Low", hits: [] };
}

function summarize(text) {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= 90) return clean;
  return clean.slice(0, 87).trimEnd() + "...";
}

/** MODULE 1 — CitizenFlow: classify a new complaint */
function classifyComplaint(description) {
  const { category, department, matches } = scoreCategory(description);
  const { priority, hits } = scorePriority(description);
  const reasons = [];
  if (matches.length) {
    reasons.push(`The words "${matches.join('", "')}" matched the ${category} category.`);
  } else {
    reasons.push("No strong keyword match was found, so this was routed to the general office for triage.");
  }
  if (hits.length) {
    reasons.push(`The words "${hits.join('", "')}" suggest higher urgency.`);
  } else {
    reasons.push("No urgency keywords were detected, so a default priority was applied.");
  }
  return {
    category,
    department,
    priority,
    summary: summarize(description),
    reasons,
  };
}

/** MODULE 1 — CitizenFlow: find similar/duplicate complaints via word-overlap similarity */
function findSimilarComplaints(description, existingRequests) {
  const words = new Set(
    description.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 3)
  );
  const scored = existingRequests.map((r) => {
    const rWords = new Set(
      (r.description || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 3)
    );
    const overlap = [...words].filter((w) => rWords.has(w));
    const union = new Set([...words, ...rWords]);
    const similarity = union.size ? overlap.length / union.size : 0;
    return { request: r, similarity, overlap };
  });
  return scored
    .filter((s) => s.similarity >= 0.25 && s.overlap.length >= 2)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
    .map((s) => ({
      tracking_id: s.request.tracking_id,
      description: s.request.description,
      similarity: Math.round(s.similarity * 100),
    }));
}

/** MODULE 2 — ProjectWatch: risk analysis */
function analyzeProjectRisk(project) {
  const budget = Number(project.approved_budget) || 0;
  const spent = Number(project.amount_spent) || 0;
  const completion = Number(project.completion_pct) || 0;
  const spentPct = budget > 0 ? (spent / budget) * 100 : 0;
  const gap = spentPct - completion; // positive = spending ahead of progress

  const today = new Date();
  const expected = project.expected_completion ? new Date(project.expected_completion) : null;
  const daysToDeadline = expected ? Math.ceil((expected - today) / (1000 * 60 * 60 * 24)) : null;
  const nearDeadlineBehind = daysToDeadline !== null && daysToDeadline <= 60 && completion < 85;

  const reasons = [];
  let riskLevel = "Low";

  if (gap >= 25) {
    riskLevel = "High";
    reasons.push(
      `Spending (${spentPct.toFixed(0)}% of budget) is significantly ahead of physical progress (${completion.toFixed(0)}% complete).`
    );
  } else if (gap >= 12) {
    riskLevel = "Medium";
    reasons.push(
      `Spending (${spentPct.toFixed(0)}% of budget) is somewhat ahead of physical progress (${completion.toFixed(0)}% complete).`
    );
  } else {
    reasons.push(`Spending (${spentPct.toFixed(0)}%) is broadly in line with physical progress (${completion.toFixed(0)}%).`);
  }

  if (nearDeadlineBehind) {
    riskLevel = riskLevel === "Low" ? "Medium" : "High";
    reasons.push(`Only ${daysToDeadline} day(s) remain to the expected completion date, but the project is ${completion.toFixed(0)}% complete.`);
  }
  if (daysToDeadline !== null && daysToDeadline < 0 && project.status !== "Completed") {
    riskLevel = "High";
    reasons.push(`The expected completion date has passed (${Math.abs(daysToDeadline)} day(s) ago) and the project is not marked Completed.`);
  }

  const suggestedAction =
    riskLevel === "High"
      ? "Review expenditure records and project milestones with the contractor and department head."
      : riskLevel === "Medium"
      ? "Schedule a progress check-in and confirm upcoming milestones are on track."
      : "No action required at this time.";

  return {
    riskLevel,
    spentPct: Math.round(spentPct),
    completionPct: Math.round(completion),
    budgetWarning: gap >= 12,
    suggestedAction,
    reasons,
    note: "This is an analytical warning based on budget-vs-progress patterns, not an accusation of fraud or mismanagement.",
  };
}

/** MODULE 3 — RevenueGuard: anomaly detection against a rolling average */
function detectRevenueAnomaly(stream, records) {
  const sameStream = records.filter((r) => r.stream === stream).sort((a, b) => (a.record_date < b.record_date ? 1 : -1));
  if (sameStream.length < 4) {
    return { hasAnomaly: false, reasons: ["Not enough historical records for this stream to establish a baseline."] };
  }
  const latest = sameStream[0];
  const history = sameStream.slice(1, 15);
  const avg = history.reduce((sum, r) => sum + Number(r.actual_amount || 0), 0) / history.length;
  if (avg === 0) return { hasAnomaly: false, reasons: ["Baseline average is zero; cannot compute a meaningful deviation."] };

  const deviationPct = ((Number(latest.actual_amount) - avg) / avg) * 100;
  const hasAnomaly = Math.abs(deviationPct) >= 30;

  const reasons = [
    `Latest collection for "${stream}" (KSh ${Number(latest.actual_amount).toLocaleString()}) compared against a ${history.length}-record average of KSh ${Math.round(avg).toLocaleString()}.`,
  ];
  if (hasAnomaly) {
    reasons.push(
      deviationPct < 0
        ? `Revenue is approximately ${Math.abs(deviationPct).toFixed(0)}% below the recent average.`
        : `Revenue is approximately ${deviationPct.toFixed(0)}% above the recent average.`
    );
  }

  return {
    hasAnomaly,
    deviationPct: Math.round(deviationPct),
    baselineAverage: Math.round(avg),
    latestAmount: Number(latest.actual_amount),
    reasons,
    note: "Unusual pattern detected — requires human review. This is not an accusation against any employee or citizen.",
  };
}

/** MODULE 4 — PermitAI: document / completeness check */
const REQUIRED_DOCS = {
  "Business Permit": ["ID/Passport Copy", "KRA PIN Certificate", "Lease Agreement", "Passport Photo"],
  "Construction Permit": ["Architectural Drawings", "Structural Report", "Land Title", "ID/Passport Copy"],
  "Event Permit": ["Event Proposal", "Venue Confirmation", "Police Clearance", "ID/Passport Copy"],
  "Advertising Permit": ["Design Artwork", "Site Photos", "ID/Passport Copy"],
  "Trade Licence": ["ID/Passport Copy", "KRA PIN Certificate", "Business Registration"],
};

function checkPermitDocuments(permit) {
  const required = REQUIRED_DOCS[permit.permit_type] || ["ID/Passport Copy"];
  let submitted = [];
  try {
    submitted = JSON.parse(permit.documents || "[]");
  } catch {
    submitted = [];
  }
  const submittedNames = submitted.map((d) => (typeof d === "string" ? d : d.name));
  const missing = required.filter((doc) => !submittedNames.includes(doc));
  const reasons = [];
  if (missing.length) {
    reasons.push(`${missing.length} of ${required.length} required document(s) for a ${permit.permit_type} are missing: ${missing.join(", ")}.`);
  } else {
    reasons.push(`All ${required.length} required document(s) for a ${permit.permit_type} have been submitted.`);
  }
  let nextStep = "Proceed to assessment.";
  if (missing.length) nextStep = "Request the missing documents from the applicant before review.";
  else if (permit.status === "Draft") nextStep = "Move application to Submitted.";

  return {
    requiredCount: required.length,
    missing,
    isComplete: missing.length === 0,
    nextStep,
    reasons,
  };
}

/** MODULE 5 — AssetTrack: maintenance prediction */
const MAINTENANCE_INTERVAL_DAYS = {
  Vehicle: 180,
  Computer: 365,
  Printer: 270,
  Building: 730,
  Equipment: 365,
  Furniture: 1095,
  Other: 365,
};

function predictMaintenance(asset) {
  const interval = MAINTENANCE_INTERVAL_DAYS[asset.category] || 365;
  const lastDate = asset.maintenance_date ? new Date(asset.maintenance_date) : (asset.purchase_date ? new Date(asset.purchase_date) : null);
  const today = new Date();
  let daysSince = null;
  if (lastDate) daysSince = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

  let riskLevel = "Low";
  const reasons = [];
  if (daysSince === null) {
    reasons.push("No purchase or maintenance date on record; unable to calculate interval precisely.");
  } else if (daysSince > interval) {
    riskLevel = daysSince > interval * 1.5 ? "High" : "Medium";
    reasons.push(`${daysSince} day(s) have passed since last maintenance, exceeding the recommended ${interval}-day interval for ${asset.category || "this"} assets.`);
  } else {
    reasons.push(`${daysSince} day(s) since last maintenance, within the recommended ${interval}-day interval.`);
  }
  if (asset.condition === "Poor" || asset.condition === "Fair") {
    riskLevel = riskLevel === "Low" ? "Medium" : "High";
    reasons.push(`Recorded condition is "${asset.condition}".`);
  }
  if (asset.status === "Missing") {
    riskLevel = "High";
    reasons.push("Asset is currently marked as Missing.");
  }

  const suggestedDate = new Date(today);
  suggestedDate.setDate(suggestedDate.getDate() + (riskLevel === "High" ? 7 : riskLevel === "Medium" ? 30 : 90));

  return {
    riskLevel,
    daysSinceMaintenance: daysSince,
    recommendedIntervalDays: interval,
    suggestedMaintenanceDate: suggestedDate.toISOString().slice(0, 10),
    reasons,
  };
}

/** Central AI Assistant: very small rule-based intent router, aware of module context */
function assistantQuery(moduleName, question, dataset) {
  const q = (question || "").toLowerCase();

  if (moduleName === "citizenflow") {
    const openStatuses = ["Received", "Under Review", "Assigned", "In Progress"];
    if (q.includes("high") || q.includes("priority") || q.includes("unresolved") || q.includes("open")) {
      const results = dataset.filter((r) => r.priority === "High" && openStatuses.includes(r.status));
      return { answer: `Found ${results.length} unresolved high-priority request(s).`, results: results.slice(0, 15) };
    }
    return { answer: `CitizenFlow has ${dataset.length} total request(s) on record. Try asking about "high priority" or "unresolved" requests.`, results: [] };
  }

  if (moduleName === "projectwatch") {
    if (q.includes("risk") || q.includes("delay")) {
      const flagged = dataset
        .map((p) => ({ project: p, risk: analyzeProjectRisk(p) }))
        .filter((x) => x.risk.riskLevel !== "Low");
      return {
        answer: `${flagged.length} project(s) currently show elevated risk.`,
        results: flagged.map((x) => ({ ...x.project, aiRisk: x.risk })).slice(0, 15),
      };
    }
    return { answer: `ProjectWatch is tracking ${dataset.length} project(s). Try asking "which projects are at risk?"`, results: [] };
  }

  if (moduleName === "revenueguard") {
    if (q.includes("unusual") || q.includes("anomal") || q.includes("change")) {
      const streams = [...new Set(dataset.map((r) => r.stream))];
      const flagged = streams
        .map((s) => ({ stream: s, anomaly: detectRevenueAnomaly(s, dataset) }))
        .filter((x) => x.anomaly.hasAnomaly);
      return { answer: `${flagged.length} revenue stream(s) show an unusual pattern.`, results: flagged };
    }
    return { answer: `RevenueGuard has ${dataset.length} revenue record(s). Try asking "which revenue streams have unusual changes?"`, results: [] };
  }

  if (moduleName === "permitai") {
    if (q.includes("document") || q.includes("waiting") || q.includes("missing")) {
      const flagged = dataset
        .map((p) => ({ permit: p, check: checkPermitDocuments(p) }))
        .filter((x) => !x.check.isComplete);
      return { answer: `${flagged.length} application(s) are waiting on documents.`, results: flagged.map((x) => ({ ...x.permit, aiCheck: x.check })).slice(0, 15) };
    }
    return { answer: `PermitAI has ${dataset.length} application(s) on record. Try asking "which applications are waiting for documents?"`, results: [] };
  }

  if (moduleName === "assettrack") {
    if (q.includes("maintenance") || q.includes("risk")) {
      const flagged = dataset
        .map((a) => ({ asset: a, predict: predictMaintenance(a) }))
        .filter((x) => x.predict.riskLevel !== "Low");
      return { answer: `${flagged.length} asset(s) require maintenance attention.`, results: flagged.map((x) => ({ ...x.asset, aiPredict: x.predict })).slice(0, 15) };
    }
    return { answer: `AssetTrack has ${dataset.length} asset(s) on record. Try asking "which assets require maintenance?"`, results: [] };
  }

  return { answer: "Select a module and ask a question relevant to it, e.g. \"show me unresolved high-priority complaints\".", results: [] };
}

/**
 * Placeholder for a real AI provider integration (Phase 2 of the roadmap).
 * Example using the Anthropic API — intentionally not wired in for the MVP.
 */
function buildRealAIProvider() {
  // const apiKey = process.env.ANTHROPIC_API_KEY;
  // if (!apiKey) return null;
  // return {
  //   async classifyComplaint(description) {
  //     // call https://api.anthropic.com/v1/messages with a structured prompt
  //     // and parse a JSON response into { category, department, priority, summary, reasons }
  //   },
  // };
  return null;
}

module.exports = {
  classifyComplaint,
  findSimilarComplaints,
  analyzeProjectRisk,
  detectRevenueAnomaly,
  checkPermitDocuments,
  predictMaintenance,
  assistantQuery,
  buildRealAIProvider,
  REQUIRED_DOCS,
};
