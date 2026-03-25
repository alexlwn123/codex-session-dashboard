export const dashboardMeta = {
  headline: "Codex Session Dashboard",
  subheadline:
    "Convex-backed session observatory for timeline density, provenance shifts, and tool-heavy workflows.",
  status: "Tool-informed trace detected",
  totalSessions: 4,
  refreshLabel: "Today · Mar 25, 2026"
};

export const sessions = [
  {
    slug: "paper-mockup-pass",
    name: "paper-mockup-pass",
    source: "Mar 25, 2026",
    path: "/Users/alex/Projects/codex-session-dashboard",
    updatedAt: "09:15 AM",
    summary: "Desktop shell, mobile companion, and reactive session cards.",
    status: "mixed",
    events: 284,
    turns: 19,
    tools: 57,
    provenanceLabel: "mixed",
    provenanceConfidence: 0.73,
    activeEventKind: "commentary",
    activeEventTitle: "Dashboard structure confirmed",
    activeEventSummary: "Rail, stats, filters, event trace, and details were grounded in the codebase before drawing.",
    activeEventFollowup: "Next: mobile companion and density tuning.",
    linkedTools: 3,
    toolInformedShare: 64,
    modelOnlyShare: 21,
    rawEventJson: `{
  "kind": "commentary",
  "label": "tool informed",
  "toolRefs": ["paper", "exec"],
  "summary": "Canvas inspection complete"
}`,
    timelineEvents: [
      {
        id: "evt-1",
        time: "09:15:11",
        kind: "tool_output",
        title: "Created desktop and mobile artboards",
        summary: "Convex-powered mockup build now has desktop and mobile surfaces."
      },
      {
        id: "evt-2",
        time: "09:14:32",
        kind: "assistant",
        title: "Planned shell, metrics, and companion layout",
        summary: "Focused the implementation on the dashboard workflow instead of static marketing cards."
      },
      {
        id: "evt-3",
        time: "09:14:06",
        kind: "tool_call",
        title: "Fetched Paper artboard inventory",
        summary: "Read active artboards and selected layer context before drawing."
      },
      {
        id: "evt-4",
        time: "09:14:02",
        kind: "commentary",
        title: "Grounded design in repo structure",
        summary: "Read the app shell and styles before turning the mockup into product UI."
      }
    ],
    toolPairs: [
      {
        id: "pair-1",
        label: "create_artboard → output",
        summary: "Created desktop and mobile canvas frames."
      },
      {
        id: "pair-2",
        label: "exec_command → output",
        summary: "Read the app structure and styling context."
      },
      {
        id: "pair-3",
        label: "write_html → output",
        summary: "Built shells, cards, rails, and event rows."
      }
    ]
  },
  {
    slug: "provenance-filter-audit",
    name: "provenance-filter-audit",
    source: "Mar 24, 2026",
    path: "~/.codex/archived_sessions",
    updatedAt: "06:42 PM",
    summary: "Legend tuning and event filter pass for uncertain traces.",
    status: "tool informed",
    events: 193,
    turns: 14,
    tools: 29,
    provenanceLabel: "tool informed",
    provenanceConfidence: 0.81,
    activeEventKind: "assistant",
    activeEventTitle: "Legend copy tuned",
    activeEventSummary: "Clarified the difference between model-only, tool-informed, mixed, and unknown traces.",
    activeEventFollowup: "Next: normalize badge color semantics.",
    linkedTools: 2,
    toolInformedShare: 71,
    modelOnlyShare: 17,
    rawEventJson: `{
  "kind": "assistant",
  "label": "mixed",
  "summary": "Legend copy tuned"
}`,
    timelineEvents: [
      {
        id: "evt-a1",
        time: "06:42:11",
        kind: "assistant",
        title: "Refined provenance language",
        summary: "Collapsed the legend to faster, clearer definitions."
      },
      {
        id: "evt-a2",
        time: "06:40:28",
        kind: "tool_call",
        title: "Read session traces",
        summary: "Cross-checked ambiguous events against surrounding tool outputs."
      }
    ],
    toolPairs: [
      {
        id: "pair-a1",
        label: "read_traces → output",
        summary: "Compared event order and supporting tool context."
      }
    ]
  },
  {
    slug: "session-loader-tests",
    name: "session-loader-tests",
    source: "Mar 23, 2026",
    path: "src/server/session-loader.test.ts",
    updatedAt: "03:20 PM",
    summary: "Parser coverage and smoke fixtures for archived logs.",
    status: "model only",
    events: 118,
    turns: 11,
    tools: 9,
    provenanceLabel: "model only",
    provenanceConfidence: 0.62,
    activeEventKind: "reasoning",
    activeEventTitle: "Test matrix expanded",
    activeEventSummary: "Added parser expectations for malformed tool output and empty turn boundaries.",
    activeEventFollowup: "Next: add fixture minimization.",
    linkedTools: 1,
    toolInformedShare: 38,
    modelOnlyShare: 44,
    rawEventJson: `{
  "kind": "reasoning",
  "summary": "Test matrix expanded"
}`,
    timelineEvents: [
      {
        id: "evt-b1",
        time: "03:18:17",
        kind: "reasoning",
        title: "Expanded parser edge coverage",
        summary: "Covered missing call IDs and split output cases."
      }
    ],
    toolPairs: [
      {
        id: "pair-b1",
        label: "vitest → output",
        summary: "Confirmed session loader expectations."
      }
    ]
  },
  {
    slug: "dashboard-density-tune",
    name: "dashboard-density-tune",
    source: "Mar 21, 2026",
    path: "dist/client/assets",
    updatedAt: "11:05 AM",
    summary: "Spacing, rhythm, and stat-card hierarchy adjustments.",
    status: "mixed",
    events: 151,
    turns: 12,
    tools: 18,
    provenanceLabel: "mixed",
    provenanceConfidence: 0.68,
    activeEventKind: "commentary",
    activeEventTitle: "Density pass completed",
    activeEventSummary: "Reduced panel bulk and strengthened the selected session state.",
    activeEventFollowup: "Next: mobile collapse behavior.",
    linkedTools: 2,
    toolInformedShare: 57,
    modelOnlyShare: 26,
    rawEventJson: `{
  "kind": "commentary",
  "summary": "Density pass completed"
}`,
    timelineEvents: [
      {
        id: "evt-c1",
        time: "11:04:10",
        kind: "commentary",
        title: "Reduced visual weight",
        summary: "Compressed vertical spacing without flattening the hierarchy."
      }
    ],
    toolPairs: [
      {
        id: "pair-c1",
        label: "write_html → output",
        summary: "Adjusted panel density and stat emphasis."
      }
    ]
  }
];
