import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const timelineEvent = v.object({
  id: v.string(),
  time: v.string(),
  kind: v.string(),
  title: v.string(),
  summary: v.string()
});

const toolPair = v.object({
  id: v.string(),
  label: v.string(),
  summary: v.string()
});

export default defineSchema({
  dashboardMeta: defineTable({
    headline: v.string(),
    subheadline: v.string(),
    status: v.string(),
    totalSessions: v.number(),
    refreshLabel: v.string()
  }),
  sessions: defineTable({
    slug: v.string(),
    name: v.string(),
    source: v.string(),
    path: v.string(),
    updatedAt: v.string(),
    summary: v.string(),
    status: v.string(),
    events: v.number(),
    turns: v.number(),
    tools: v.number(),
    provenanceLabel: v.string(),
    provenanceConfidence: v.number(),
    activeEventKind: v.string(),
    activeEventTitle: v.string(),
    activeEventSummary: v.string(),
    activeEventFollowup: v.string(),
    linkedTools: v.number(),
    toolInformedShare: v.number(),
    modelOnlyShare: v.number(),
    rawEventJson: v.string(),
    timelineEvents: v.array(timelineEvent),
    toolPairs: v.array(toolPair)
  }).index("by_slug", ["slug"])
});
