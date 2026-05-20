import { Router } from "express";
import { config } from "../../core/config.js";

export const systemRouter = Router();

systemRouter.get("/runtime-meta", (_req, res) => {
  res.json({
    scriptsAllowedRoot: config.scripts.allowedRoot,
    hostHome: config.runtime.hostHome,
    scriptRoot: config.runtime.roots.scripts,
    backupRoot: config.runtime.roots.backups,
    logsRoot: config.runtime.roots.logs,
    dockerSocketEnabled: config.runtime.dockerSocketEnabled
  });
});
