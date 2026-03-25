export type ProvenanceLabel = "model_only" | "tool_informed" | "mixed" | "unknown";

export type EventKind =
  | "lifecycle"
  | "user_message"
  | "assistant_message"
  | "commentary"
  | "tool_call"
  | "tool_output"
  | "reasoning"
  | "token_usage"
  | "context"
  | "meta"
  | "unknown";

export interface SessionRecord {
  id: string;
  sourceFile: string;
  threadName?: string;
  cwd?: string;
  startedAt?: string;
  updatedAt?: string;
  rawLineCount: number;
  warnings: string[];
}

export interface ProvenanceAssessment {
  label: ProvenanceLabel;
  confidence: number;
  rationale: string;
  linkedToolCallIds: string[];
}

export interface TimelineEvent {
  id: string;
  ts?: string;
  outerType: string;
  innerType?: string;
  turnId?: string;
  phase?: string;
  role?: string;
  kind: EventKind;
  summary: string;
  raw: unknown;
  rawLine: number;
  sourceFile: string;
  callId?: string;
  messageText?: string;
  provenance?: ProvenanceAssessment;
}

export interface ToolInvocation {
  callId: string;
  toolName: string;
  toolType: "function_call" | "custom_tool_call";
  argumentsText?: string;
  inputText?: string;
  outputText?: string;
  status?: string;
  startTs?: string;
  endTs?: string;
  turnId?: string;
  sourceEventIds: string[];
}

export interface Turn {
  id: string;
  startTs?: string;
  endTs?: string;
  userMessage?: string;
  commentaryEventIds: string[];
  assistantEventIds: string[];
  toolCallIds: string[];
  tokenEventIds: string[];
  eventIds: string[];
}

export interface SessionAnalysis {
  eventCounts: Record<string, number>;
  kindCounts: Record<EventKind, number>;
  toolUsageCounts: Record<string, number>;
  provenanceCounts: Record<ProvenanceLabel, number>;
  totalTurns: number;
}

export interface NormalizedSession {
  record: SessionRecord;
  events: TimelineEvent[];
  turns: Turn[];
  tools: ToolInvocation[];
  analysis: SessionAnalysis;
}

export interface LoadPathsRequest {
  paths: string[];
}

export interface SessionsResponse {
  sessions: SessionRecord[];
}

export interface SessionDetailResponse {
  session: NormalizedSession;
}
