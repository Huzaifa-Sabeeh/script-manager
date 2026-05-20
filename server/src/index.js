import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";
import { spawn } from "child_process";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import cron from "node-cron";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 19000;
const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ALLOWED_ROOT = process.env.ALLOWED_ROOT || "/home/ubuntu";
const INITIAL_SCRIPTS = process.env.INITIAL_SCRIPTS || "[]";
const RUNS_MAX_PER_SCRIPT = Number(process.env.RUNS_MAX_PER_SCRIPT || 200);
const RUN_RETENTION_DAYS = Number(process.env.RUN_RETENTION_DAYS || 90);

if (!MONGODB_URI) throw new Error("MONGODB_URI is required");

await mongoose.connect(MONGODB_URI);

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true }
});
const scriptSchema = new mongoose.Schema({
  name: { type: String, required: true },
  path: { type: String, required: true, unique: true },
  description: { type: String, default: "" }
}, { timestamps: true });
const scheduleSchema = new mongoose.Schema({
  scriptId: { type: mongoose.Schema.Types.ObjectId, ref: "Script", required: true },
  cronExpr: { type: String, required: true },
  enabled: { type: Boolean, default: true }
}, { timestamps: true });
const runSchema = new mongoose.Schema({
  scriptId: { type: mongoose.Schema.Types.ObjectId, ref: "Script", required: true },
  status: { type: String, enum: ["success", "failed"], required: true },
  output: { type: String, required: true },
  startedAt: { type: Date, required: true },
  finishedAt: { type: Date, required: true }
}, { timestamps: true });
if (RUN_RETENTION_DAYS > 0) {
  runSchema.index({ createdAt: 1 }, { expireAfterSeconds: RUN_RETENTION_DAYS * 24 * 60 * 60 });
}

const User = mongoose.model("User", userSchema);
const Script = mongoose.model("Script", scriptSchema);
const Schedule = mongoose.model("Schedule", scheduleSchema);
const Run = mongoose.model("Run", runSchema);

const seededUser = await User.findOne({ username: ADMIN_USERNAME });
if (!seededUser) {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await User.create({ username: ADMIN_USERNAME, passwordHash });
}

try {
  const initial = JSON.parse(INITIAL_SCRIPTS);
  for (const s of initial) {
    if (!s?.name || !s?.path || !isAllowedScriptPath(s.path)) continue;
    const exists = await Script.findOne({ path: s.path });
    if (!exists) await Script.create({ name: s.name, path: s.path, description: s.description || "" });
  }
} catch {
  // Ignore invalid INITIAL_SCRIPTS.
}

app.use(express.json({ limit: "1mb" }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGODB_URI }),
  cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 1000 * 60 * 60 * 8 }
}));

const jobs = new Map();

function isAllowedScriptPath(p) {
  const normalized = path.resolve(p);
  return normalized.startsWith(path.resolve(ALLOWED_ROOT));
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function runScript(scriptPath) {
  return new Promise((resolve) => {
    const startedAt = new Date();
    const child = spawn("bash", [scriptPath], { cwd: path.dirname(scriptPath), env: process.env });
    let output = "";
    child.stdout.on("data", (d) => { output += d.toString(); });
    child.stderr.on("data", (d) => { output += d.toString(); });
    child.on("close", (code) => {
      resolve({
        status: code === 0 ? "success" : "failed",
        output,
        startedAt,
        finishedAt: new Date()
      });
    });
  });
}

async function createRunRecord(scriptId, result) {
  await Run.create({
    scriptId,
    status: result.status,
    output: result.output,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt
  });

  if (RUNS_MAX_PER_SCRIPT > 0) {
    const total = await Run.countDocuments({ scriptId });
    const excess = total - RUNS_MAX_PER_SCRIPT;
    if (excess > 0) {
      const oldest = await Run.find({ scriptId }).sort({ createdAt: 1 }).limit(excess).select("_id");
      if (oldest.length > 0) {
        await Run.deleteMany({ _id: { $in: oldest.map((r) => r._id) } });
      }
    }
  }
}

async function syncSchedules() {
  for (const [, job] of jobs) job.stop();
  jobs.clear();
  const schedules = await Schedule.find({ enabled: true }).populate("scriptId");
  for (const s of schedules) {
    if (!s.scriptId || !cron.validate(s.cronExpr)) continue;
    const job = cron.schedule(s.cronExpr, async () => {
      const result = await runScript(s.scriptId.path);
      await createRunRecord(s.scriptId._id, result);
    });
    jobs.set(String(s._id), job);
  }
}

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  req.session.userId = String(user._id);
  res.json({ ok: true });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", (req, res) => {
  res.json({ authenticated: Boolean(req.session.userId) });
});

app.get("/api/scripts", requireAuth, async (_req, res) => {
  const scripts = await Script.find().sort({ name: 1 });
  res.json(scripts);
});

app.post("/api/scripts", requireAuth, async (req, res) => {
  const { name, path: scriptPath, description, content, makeExecutable } = req.body;
  if (!name || !scriptPath) return res.status(400).json({ error: "name and path are required" });
  const resolvedPath = path.resolve(scriptPath);
  if (!isAllowedScriptPath(resolvedPath)) return res.status(400).json({ error: "path outside allowed root" });

  const duplicate = await Script.findOne({ path: resolvedPath });
  if (duplicate) return res.status(400).json({ error: "script path already added" });

  const contentString = typeof content === "string" ? content : "";
  let exists = true;
  try {
    await fs.access(resolvedPath);
  } catch {
    exists = false;
  }

  if (!exists) {
    if (!contentString.trim()) {
      return res.status(400).json({ error: "script path not found. Provide code to create file." });
    }
    const parentDir = path.dirname(resolvedPath);
    try {
      const st = await fs.stat(parentDir);
      if (!st.isDirectory()) return res.status(400).json({ error: "parent path is not a directory" });
    } catch {
      return res.status(400).json({ error: "parent directory not found" });
    }
    await fs.writeFile(resolvedPath, contentString, "utf8");
    if (makeExecutable !== false) {
      await fs.chmod(resolvedPath, 0o755);
    }
  }

  const script = await Script.create({ name, path: resolvedPath, description: description || "" });
  res.json(script);
});

app.post("/api/scripts/validate-path", requireAuth, async (req, res) => {
  const scriptPath = String(req.body?.path || "").trim();
  if (!scriptPath) return res.status(400).json({ error: "path is required" });

  const resolvedPath = path.resolve(scriptPath);
  const allowed = isAllowedScriptPath(resolvedPath);
  const duplicate = await Script.findOne({ path: resolvedPath });

  let exists = false;
  let isFile = false;
  let executable = false;
  try {
    const stat = await fs.stat(resolvedPath);
    exists = true;
    isFile = stat.isFile();
    await fs.access(resolvedPath, fsConstants.X_OK);
    executable = true;
  } catch {
    // Keep flags false when checks fail.
  }

  const suggestedName = path.basename(resolvedPath).replace(/\.sh$/i, "").replace(/[-_]+/g, " ").trim();

  res.json({
    path: resolvedPath,
    allowed,
    exists,
    isFile,
    executable,
    duplicate: Boolean(duplicate),
    suggestedName
  });
});

app.get("/api/scripts/:id/content", requireAuth, async (req, res) => {
  const script = await Script.findById(req.params.id);
  if (!script) return res.status(404).json({ error: "Not found" });
  const content = await fs.readFile(script.path, "utf8");
  res.json({ content });
});

app.put("/api/scripts/:id/content", requireAuth, async (req, res) => {
  const script = await Script.findById(req.params.id);
  if (!script) return res.status(404).json({ error: "Not found" });
  const { content } = req.body;
  if (typeof content !== "string") return res.status(400).json({ error: "content required" });
  const backupPath = `${script.path}.bak.${Date.now()}`;
  const existing = await fs.readFile(script.path, "utf8");
  await fs.writeFile(backupPath, existing, "utf8");
  await fs.writeFile(script.path, content, "utf8");
  res.json({ ok: true, backupPath });
});

app.post("/api/scripts/:id/run", requireAuth, async (req, res) => {
  const script = await Script.findById(req.params.id);
  if (!script) return res.status(404).json({ error: "Not found" });
  const result = await runScript(script.path);
  await createRunRecord(script._id, result);
  const run = {
    scriptId: script._id,
    status: result.status,
    output: result.output,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt
  };
  res.json(run);
});

app.get("/api/scripts/:id/runs", requireAuth, async (req, res) => {
  const runs = await Run.find({ scriptId: req.params.id }).sort({ createdAt: -1 }).limit(20);
  res.json(runs);
});

app.delete("/api/scripts/:id", requireAuth, async (req, res) => {
  const script = await Script.findById(req.params.id);
  if (!script) return res.status(404).json({ error: "Not found" });

  await Schedule.deleteMany({ scriptId: script._id });
  await Run.deleteMany({ scriptId: script._id });
  await Script.deleteOne({ _id: script._id });
  await syncSchedules();
  res.json({ ok: true });
});

app.get("/api/schedules", requireAuth, async (_req, res) => {
  const schedules = await Schedule.find().populate("scriptId").sort({ createdAt: -1 });
  res.json(schedules);
});

app.post("/api/schedules", requireAuth, async (req, res) => {
  const { scriptId, cronExpr, enabled } = req.body;
  if (!cron.validate(cronExpr)) return res.status(400).json({ error: "Invalid cron expression" });
  const exists = await Script.findById(scriptId);
  if (!exists) return res.status(400).json({ error: "Invalid scriptId" });
  const s = await Schedule.create({ scriptId, cronExpr, enabled: enabled !== false });
  await syncSchedules();
  res.json(s);
});

app.put("/api/schedules/:id", requireAuth, async (req, res) => {
  const { cronExpr, enabled } = req.body;
  const update = {};
  if (cronExpr !== undefined) {
    if (!cron.validate(cronExpr)) return res.status(400).json({ error: "Invalid cron expression" });
    update.cronExpr = cronExpr;
  }
  if (enabled !== undefined) update.enabled = Boolean(enabled);
  const s = await Schedule.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!s) return res.status(404).json({ error: "Not found" });
  await syncSchedules();
  res.json(s);
});

app.delete("/api/schedules/:id", requireAuth, async (req, res) => {
  await Schedule.findByIdAndDelete(req.params.id);
  await syncSchedules();
  res.json({ ok: true });
});

app.use(express.static(path.resolve("public")));
app.get("*", (_req, res) => res.sendFile(path.resolve("public/index.html")));

await syncSchedules();
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Script Manager listening on ${PORT}`);
});
