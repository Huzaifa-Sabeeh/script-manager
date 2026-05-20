import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";
import { spawn } from "child_process";
import { config } from "../../core/config.js";
import { Run, Schedule, Script } from "../../models/index.js";

export function isAllowedScriptPath(targetPath) {
  const normalized = path.resolve(targetPath);
  return normalized.startsWith(config.scripts.allowedRoot);
}

export async function validateScriptPath(scriptPath) {
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

  return {
    path: resolvedPath,
    allowed,
    exists,
    isFile,
    executable,
    duplicate: Boolean(duplicate),
    suggestedName: path.basename(resolvedPath).replace(/\.sh$/i, "").replace(/[-_]+/g, " ").trim()
  };
}

export function runScript(scriptPath) {
  return new Promise((resolve) => {
    const startedAt = new Date();
    const child = spawn("bash", [scriptPath], { cwd: path.dirname(scriptPath), env: process.env });
    let output = "";
    child.stdout.on("data", (data) => { output += data.toString(); });
    child.stderr.on("data", (data) => { output += data.toString(); });
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

export async function createRunRecord(scriptId, result) {
  await Run.create({
    scriptId,
    status: result.status,
    output: result.output,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt
  });

  if (config.scripts.runsMaxPerScript <= 0) return;

  const total = await Run.countDocuments({ scriptId });
  const excess = total - config.scripts.runsMaxPerScript;
  if (excess <= 0) return;

  const oldest = await Run.find({ scriptId }).sort({ createdAt: 1 }).limit(excess).select("_id");
  if (oldest.length > 0) {
    await Run.deleteMany({ _id: { $in: oldest.map((run) => run._id) } });
  }
}

export async function createScript({ name, scriptPath, description, content, makeExecutable }) {
  if (!name || !scriptPath) throw new Error("name and path are required");

  const resolvedPath = path.resolve(scriptPath);
  if (!isAllowedScriptPath(resolvedPath)) throw new Error("path outside allowed root");

  const duplicate = await Script.findOne({ path: resolvedPath });
  if (duplicate) throw new Error("script path already added");

  const contentString = typeof content === "string" ? content : "";
  let exists = true;
  try {
    await fs.access(resolvedPath);
  } catch {
    exists = false;
  }

  if (!exists) {
    if (!contentString.trim()) throw new Error("script path not found. Provide code to create file.");

    const parentDir = path.dirname(resolvedPath);
    try {
      const stat = await fs.stat(parentDir);
      if (!stat.isDirectory()) throw new Error("parent path is not a directory");
    } catch (error) {
      if (error.message === "parent path is not a directory") throw error;
      throw new Error("parent directory not found");
    }

    await fs.writeFile(resolvedPath, contentString, "utf8");
    if (makeExecutable !== false) {
      await fs.chmod(resolvedPath, 0o755);
    }
  }

  return Script.create({ name, path: resolvedPath, description: description || "" });
}

export async function updateScriptContent(scriptId, content) {
  const script = await Script.findById(scriptId);
  if (!script) throw new Error("Not found");
  if (typeof content !== "string") throw new Error("content required");

  await fs.mkdir(config.runtime.roots.backups, { recursive: true });
  const backupPath = path.join(config.runtime.roots.backups, `${path.basename(script.path)}.${Date.now()}.bak`);
  const existing = await fs.readFile(script.path, "utf8");
  await fs.writeFile(backupPath, existing, "utf8");
  await fs.writeFile(script.path, content, "utf8");
  return { backupPath };
}

export async function deleteScript(scriptId) {
  const script = await Script.findById(scriptId);
  if (!script) throw new Error("Not found");
  await Schedule.deleteMany({ scriptId: script._id });
  await Run.deleteMany({ scriptId: script._id });
  await Script.deleteOne({ _id: script._id });
}
