import { mutation } from "./_generated/server";
import { dashboardMeta, sessions } from "./seedData";

export const seedDashboard = mutation({
  args: {},
  handler: async (ctx) => {
    const existingMeta = await ctx.db.query("dashboardMeta").first();
    if (existingMeta) {
      return { seeded: false };
    }

    await ctx.db.insert("dashboardMeta", dashboardMeta);
    for (const session of sessions) {
      await ctx.db.insert("sessions", session);
    }

    return { seeded: true };
  }
});
