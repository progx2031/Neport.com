const express = require("express");
const db = require("./db");
const { requireAuth, requireWrite } = require("./auth");

function logAudit(actor, action, details) {
  db.prepare(`INSERT INTO audit_log (actor, action, details) VALUES (?, ?, ?)`).run(actor, action, details || "");
}

/**
 * Creates a REST router for a table.
 * options:
 *   table: table name
 *   idField: unique human-readable id column (e.g. tracking_id) - optional
 *   searchFields: columns included in `?q=` search
 *   filterFields: columns allowed as exact-match query filters (e.g. ?status=Active)
 *   enrich: (row) => extra fields to merge in (e.g. AI insight), applied on read
 *   label: human label used in audit log messages
 */
function makeCrudRouter({ table, idField, searchFields = [], filterFields = [], enrich, label }) {
  const router = express.Router();

  router.get("/", requireAuth, (req, res) => {
    let rows = db.prepare(`SELECT * FROM ${table}`).all();

    for (const field of filterFields) {
      if (req.query[field]) {
        rows = rows.filter((r) => String(r[field] || "").toLowerCase() === String(req.query[field]).toLowerCase());
      }
    }
    if (req.query.q) {
      const q = String(req.query.q).toLowerCase();
      rows = rows.filter((r) => searchFields.some((f) => String(r[f] || "").toLowerCase().includes(q)));
    }
    if (req.query.from) rows = rows.filter((r) => (r.date_submitted || r.record_date || r.submission_date || r.start_date || r.purchase_date || "") >= req.query.from);
    if (req.query.to) rows = rows.filter((r) => (r.date_submitted || r.record_date || r.submission_date || r.start_date || r.purchase_date || "") <= req.query.to);

    if (enrich) rows = rows.map((r) => ({ ...r, aiInsight: enrich(r, rows) }));
    res.json(rows);
  });

  router.get("/:id", requireAuth, (req, res) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: `${label} not found.` });
    const all = db.prepare(`SELECT * FROM ${table}`).all();
    res.json(enrich ? { ...row, aiInsight: enrich(row, all) } : row);
  });

  router.post("/", requireAuth, requireWrite, (req, res) => {
    const body = { ...req.body };
    delete body.id;
    const columns = Object.keys(body);
    if (columns.length === 0) return res.status(400).json({ error: "No fields provided." });
    const placeholders = columns.map((c) => `@${c}`).join(", ");
    try {
      const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`);
      const info = stmt.run(body);
      const created = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
      logAudit(req.user.username, `Created ${label}`, idField ? `${label} ${created[idField]}` : `${label} #${created.id}`);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put("/:id", requireAuth, requireWrite, (req, res) => {
    const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: `${label} not found.` });
    const body = { ...req.body };
    delete body.id;
    const columns = Object.keys(body);
    if (columns.length === 0) return res.status(400).json({ error: "No fields provided." });
    const setClause = columns.map((c) => `${c} = @${c}`).join(", ");
    try {
      db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = @__id`).run({ ...body, __id: req.params.id });
      const updated = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
      logAudit(req.user.username, `Updated ${label}`, idField ? `${label} ${updated[idField]}` : `${label} #${updated.id}`);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete("/:id", requireAuth, requireWrite, (req, res) => {
    const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: `${label} not found.` });
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    logAudit(req.user.username, `Deleted ${label}`, idField ? `${label} ${existing[idField]}` : `${label} #${existing.id}`);
    res.json({ success: true });
  });

  return router;
}

module.exports = { makeCrudRouter, logAudit };
