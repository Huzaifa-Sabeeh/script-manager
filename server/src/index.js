import path from "path";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "./core/config.js";
import { User, Script } from "./models/index.js";
import { authRouter } from "./modules/auth/routes.js";
import { scriptsRouter } from "./modules/scripts/routes.js";
import { schedulesRouter } from "./modules/schedules/routes.js";
import { schedulerService } from "./modules/schedules/service.js";
import { systemRouter } from "./modules/system/routes.js";
import { isAllowedScriptPath } from "./modules/scripts/service.js";

const app = express();

await mongoose.connect(config.mongo.uri);

const seededUser = await User.findOne({ username: config.auth.adminUsername });
if (!seededUser) {
  const passwordHash = await bcrypt.hash(config.auth.adminPassword, 10);
  await User.create({ username: config.auth.adminUsername, passwordHash });
}

try {
  const initial = JSON.parse(config.scripts.initialScripts);
  for (const script of initial) {
    if (!script?.name || !script?.path || !isAllowedScriptPath(script.path)) continue;
    const exists = await Script.findOne({ path: script.path });
    if (!exists) {
      await Script.create({ name: script.name, path: script.path, description: script.description || "" });
    }
  }
} catch {
  // Ignore invalid INITIAL_SCRIPTS.
}

app.use(express.json({ limit: "1mb" }));
app.use(session({
  secret: config.auth.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: config.mongo.uri }),
  cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 1000 * 60 * 60 * 8 }
}));

app.use("/api/auth", authRouter);
app.use("/api/scripts", scriptsRouter);
app.use("/api/schedules", schedulesRouter);
app.use("/api/system", systemRouter);

app.use(express.static(config.app.publicDir));
app.get(/.*/, (_req, res) => res.sendFile(path.join(config.app.publicDir, "index.html")));

await schedulerService.sync();
app.listen(config.app.port, config.app.host, () => {
  console.log(`Script Manager listening on ${config.app.host}:${config.app.port}`);
});
