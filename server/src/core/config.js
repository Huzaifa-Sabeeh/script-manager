import path from "path";
import dotenv from "dotenv";

dotenv.config();

function readString(name, fallback = "") {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function readNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`${name} must be a number`);
  }
  return parsed;
}

function readBoolean(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function requireString(name, fallback = "") {
  const value = readString(name, fallback);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function buildMongoUri(mongoMode) {
  if (mongoMode === "local") {
    const username = requireString("LOCAL_MONGO_USERNAME", "script_manager");
    const password = requireString("LOCAL_MONGO_PASSWORD", "script_manager_password");
    const host = requireString("LOCAL_MONGO_HOST", "mongodb");
    const port = readNumber("LOCAL_MONGO_PORT", 27017);
    const database = requireString("LOCAL_MONGO_DATABASE", "script_manager_db");
    return `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}?authSource=admin`;
  }

  return requireString("MONGODB_URI");
}

const hostHome = readString("HOST_HOME", "/home/ubuntu");
const scriptsAllowedRoot = path.resolve(readString("SCRIPT_ALLOWED_ROOT", readString("ALLOWED_ROOT", hostHome)));
const appRoot = path.resolve(readString("APP_ROOT", "/opt/script-manager"));

export const config = {
  app: {
    host: readString("APP_HOST", "0.0.0.0"),
    port: readNumber("PORT", 19000),
    publicDir: path.resolve("public")
  },
  auth: {
    sessionSecret: requireString("SESSION_SECRET", "change-me"),
    adminUsername: readString("ADMIN_USERNAME", "admin"),
    adminPassword: readString("ADMIN_PASSWORD", "admin123")
  },
  runtime: {
    hostHome,
    appUid: readNumber("APP_UID", 1001),
    appGid: readNumber("APP_GID", 1001),
    dockerSocketEnabled: readBoolean("DOCKER_SOCKET_ENABLED", true),
    roots: {
      app: appRoot,
      scripts: path.resolve(readString("SCRIPTS_ROOT", path.join(appRoot, "scripts"))),
      logs: path.resolve(readString("LOGS_ROOT", path.join(appRoot, "logs"))),
      backups: path.resolve(readString("BACKUPS_ROOT", path.join(appRoot, "backups"))),
      credentials: path.resolve(readString("CREDENTIALS_ROOT", path.join(appRoot, "credentials")))
    }
  },
  mongo: {
    mode: readString("MONGO_MODE", "external"),
    uri: buildMongoUri(readString("MONGO_MODE", "external"))
  },
  scripts: {
    allowedRoot: scriptsAllowedRoot,
    initialScripts: readString("INITIAL_SCRIPTS", "[]"),
    runsMaxPerScript: readNumber("RUNS_MAX_PER_SCRIPT", 200),
    runRetentionDays: readNumber("RUN_RETENTION_DAYS", 90)
  }
};
