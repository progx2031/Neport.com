const crypto = require("crypto");

const SECRET = process.env.NEPORT_SESSION_SECRET || "neport-demo-secret-change-me";
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// ---- Password hashing (scrypt, built into Node core, no plaintext storage) ----
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(expectedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ---- Simple signed session tokens (HMAC-SHA256), stateless, JWT-like ----
function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64urlDecode(input) {
  input = input.replace(/-/g, "+").replace(/_/g, "/");
  while (input.length % 4) input += "=";
  return Buffer.from(input, "base64").toString("utf8");
}

function issueToken(payload) {
  const body = { ...payload, exp: Date.now() + TOKEN_TTL_MS };
  const encoded = base64url(JSON.stringify(body));
  const sig = crypto.createHmac("sha256", SECRET).update(encoded).digest("hex");
  return `${encoded}.${sig}`;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [encoded, sig] = token.split(".");
  const expectedSig = crypto.createHmac("sha256", SECRET).update(encoded).digest("hex");
  const a = Buffer.from(sig || "", "hex");
  const b = Buffer.from(expectedSig, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(base64urlDecode(encoded));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Not authenticated. Please log in." });
  }
  req.user = payload;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated." });
    if (req.user.role === "Administrator") return next(); // admins bypass module checks
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    next();
  };
}

// Read-only role (and any role) can GET; only certain roles can mutate.
function requireWrite(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated." });
  if (req.user.role === "Read Only") {
    return res.status(403).json({ error: "Your account (Read Only) cannot modify records." });
  }
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  issueToken,
  verifyToken,
  requireAuth,
  requireRole,
  requireWrite,
};
