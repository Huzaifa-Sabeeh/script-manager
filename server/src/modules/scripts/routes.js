import fs from "fs/promises";
import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { Run, Script } from "../../models/index.js";
import { createRunRecord, createScript, deleteScript, runScript, updateScriptContent, validateScriptPath } from "./service.js";
import { schedulerService } from "../schedules/service.js";

export const scriptsRouter = Router();

scriptsRouter.use(requireAuth);

scriptsRouter.get("/", async (_req, res) => {
  const scripts = await Script.find().sort({ name: 1 });
  res.json(scripts);
});

scriptsRouter.post("/", async (req, res) => {
  try {
    const script = await createScript({
      name: req.body?.name,
      scriptPath: req.body?.path,
      description: req.body?.description,
      content: req.body?.content,
      makeExecutable: req.body?.makeExecutable
    });
    res.json(script);
  } catch (error) {
    res.status(error.message === "Not found" ? 404 : 400).json({ error: error.message });
  }
});

scriptsRouter.post("/validate-path", async (req, res) => {
  const scriptPath = String(req.body?.path || "").trim();
  if (!scriptPath) return res.status(400).json({ error: "path is required" });
  res.json(await validateScriptPath(scriptPath));
});

scriptsRouter.get("/:id/content", async (req, res) => {
  const script = await Script.findById(req.params.id);
  if (!script) return res.status(404).json({ error: "Not found" });
  const content = await fs.readFile(script.path, "utf8");
  res.json({ content });
});

scriptsRouter.put("/:id/content", async (req, res) => {
  try {
    const result = await updateScriptContent(req.params.id, req.body?.content);
    res.json({ ok: true, backupPath: result.backupPath });
  } catch (error) {
    res.status(error.message === "Not found" ? 404 : 400).json({ error: error.message });
  }
});

scriptsRouter.post("/:id/run", async (req, res) => {
  const script = await Script.findById(req.params.id);
  if (!script) return res.status(404).json({ error: "Not found" });
  const result = await runScript(script.path);
  await createRunRecord(script._id, result);
  res.json({
    scriptId: script._id,
    status: result.status,
    output: result.output,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt
  });
});

scriptsRouter.get("/:id/runs", async (req, res) => {
  const runs = await Run.find({ scriptId: req.params.id }).sort({ createdAt: -1 }).limit(20);
  res.json(runs);
});

scriptsRouter.delete("/:id", async (req, res) => {
  try {
    await deleteScript(req.params.id);
    await schedulerService.sync();
    res.json({ ok: true });
  } catch (error) {
    res.status(error.message === "Not found" ? 404 : 400).json({ error: error.message });
  }
});
