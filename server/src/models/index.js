import mongoose from "mongoose";
import { config } from "../core/config.js";

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

if (config.scripts.runRetentionDays > 0) {
  runSchema.index({ createdAt: 1 }, { expireAfterSeconds: config.scripts.runRetentionDays * 24 * 60 * 60 });
}

export const User = mongoose.model("User", userSchema);
export const Script = mongoose.model("Script", scriptSchema);
export const Schedule = mongoose.model("Schedule", scheduleSchema);
export const Run = mongoose.model("Run", runSchema);
