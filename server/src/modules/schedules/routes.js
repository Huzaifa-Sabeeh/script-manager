import cron from "node-cron";
import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { Schedule, Script } from "../../models/index.js";
import { schedulerService } from "./service.js";

export const schedulesRouter = Router();

schedulesRouter.use(requireAuth);

schedulesRouter.get("/", async (_req, res) => {
  const schedules = await Schedule.find().populate("scriptId").sort({ createdAt: -1 });
  res.json(schedules);
});

schedulesRouter.post("/", async (req, res) => {
  const { scriptId, cronExpr, enabled } = req.body;
  if (!cron.validate(cronExpr)) return res.status(400).json({ error: "Invalid cron expression" });
  const script = await Script.findById(scriptId);
  if (!script) return res.status(400).json({ error: "Invalid scriptId" });

  const schedule = await Schedule.create({ scriptId, cronExpr, enabled: enabled !== false });
  await schedulerService.sync();
  res.json(schedule);
});

schedulesRouter.put("/:id", async (req, res) => {
  const { cronExpr, enabled } = req.body;
  const update = {};
  if (cronExpr !== undefined) {
    if (!cron.validate(cronExpr)) return res.status(400).json({ error: "Invalid cron expression" });
    update.cronExpr = cronExpr;
  }
  if (enabled !== undefined) update.enabled = Boolean(enabled);

  const schedule = await Schedule.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!schedule) return res.status(404).json({ error: "Not found" });

  await schedulerService.sync();
  res.json(schedule);
});

schedulesRouter.delete("/:id", async (req, res) => {
  await Schedule.findByIdAndDelete(req.params.id);
  await schedulerService.sync();
  res.json({ ok: true });
});
