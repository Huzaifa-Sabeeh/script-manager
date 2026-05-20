import cron from "node-cron";
import { Schedule } from "../../models/index.js";
import { createRunRecord, runScript } from "../scripts/service.js";

class SchedulerService {
  constructor() {
    this.jobs = new Map();
  }

  async sync() {
    for (const [, job] of this.jobs) job.stop();
    this.jobs.clear();

    const schedules = await Schedule.find({ enabled: true }).populate("scriptId");
    for (const schedule of schedules) {
      if (!schedule.scriptId || !cron.validate(schedule.cronExpr)) continue;
      const job = cron.schedule(schedule.cronExpr, async () => {
        const result = await runScript(schedule.scriptId.path);
        await createRunRecord(schedule.scriptId._id, result);
      });
      this.jobs.set(String(schedule._id), job);
    }
  }
}

export const schedulerService = new SchedulerService();
