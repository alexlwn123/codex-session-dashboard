import { query } from "./_generated/server";

export const getDashboard = query({
  args: {},
  handler: async (ctx) => {
    const meta = await ctx.db.query("dashboardMeta").first();
    const sessions = await ctx.db.query("sessions").collect();

    return {
      meta,
      sessions
    };
  }
});
