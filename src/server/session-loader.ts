import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import type {
  EventKind,
  NormalizedSession,
  ProvenanceAssessment,
  ProvenanceLabel,
  SessionAnalysis,
  SessionRecord,
  TimelineEvent,
  ToolInvocation,
  Turn
} from "../shared/types.js";

interface SessionIndexEntry {
  id: string;
  thread_name?: string;
  updated_at?: string;
}

interface DiscoveryContext {
  indexById: Map<string, SessionIndexEntry>;
}

interface ParseResult {
  session: NormalizedSession | null;
  warnings: string[];
}

const CODEX_HOME = process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
const DEFAULT_SCAN_DIRS = [
  path.join(CODEX_HOME, "sessions"),
  path.join(CODEX_HOME, "archived_sessions")
];
const DEFAULT_INDEX_FILE = path.join(CODEX_HOME, "session_index.jsonl");
const SCAN_EXTENSIONS = new Set([".jsonl", ".json", ".log", ".ndjson"]);

export class SessionStore {
  private readonly sessions = new Map<string, NormalizedSession>();
  private readonly warnings = new Map<string, string[]>();
  private readonly discovery: DiscoveryContext;

  private constructor(discovery: DiscoveryContext) {
    this.discovery = discovery;
  }

  static async create(): Promise<SessionStore> {
    const discovery = {
      indexById: await readSessionIndex(DEFAULT_INDEX_FILE)
    };

    const store = new SessionStore(discovery);
    await store.discoverDefaultSessions();
    return store;
  }

  async discoverDefaultSessions(): Promise<void> {
    const files = new Set<string>();
    for (const scanDir of DEFAULT_SCAN_DIRS) {
      for (const file of await collectCandidateFiles(scanDir)) {
        files.add(file);
      }
    }

    await this.loadFiles([...files]);
  }

  async loadPaths(pathsToLoad: string[]): Promise<SessionRecord[]> {
    const files = new Set<string>();
    for (const inputPath of pathsToLoad) {
      const expandedPath = expandHome(inputPath);
      const stat = await safeStat(expandedPath);
      if (!stat) {
        continue;
      }
      if (stat.isDirectory()) {
        for (const file of await collectCandidateFiles(expandedPath)) {
          files.add(file);
        }
      } else {
        files.add(expandedPath);
      }
    }

    return this.loadFiles([...files]);
  }

  listSessions(): SessionRecord[] {
    return [...this.sessions.values()]
      .map((session) => session.record)
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  }

  getSession(id: string): NormalizedSession | undefined {
    return this.sessions.get(id);
  }

  private async loadFiles(files: string[]): Promise<SessionRecord[]> {
    const loaded: SessionRecord[] = [];
    for (const file of files) {
      const result = await parseSessionFile(file, this.discovery);
      if (!result.session) {
        if (result.warnings.length > 0) {
          this.warnings.set(file, result.warnings);
        }
        continue;
      }

      const warnings = result.warnings;
      result.session.record.warnings.push(...warnings);
      this.sessions.set(result.session.record.id, result.session);
      this.warnings.set(file, warnings);
      loaded.push(result.session.record);
    }

    return loaded.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  }
}

export function getDefaultCodexPaths(): string[] {
  return [CODEX_HOME, ...DEFAULT_SCAN_DIRS, DEFAULT_INDEX_FILE];
}

export async function parseSessionFile(filePath: string, discovery?: DiscoveryContext): Promise<ParseResult> {
  const warnings: string[] = [];
  const events: TimelineEvent[] = [];
  const turnsById = new Map<string, Turn>();
  const toolsById = new Map<string, ToolInvocation>();
  const activeDiscovery = discovery ?? {
    indexById: await readSessionIndex(DEFAULT_INDEX_FILE)
  };

  let rawLineCount = 0;
  let sessionId = path.basename(filePath);
  let cwd: string | undefined;
  let startedAt: string | undefined;
  let updatedAt: string | undefined;
  let threadName: string | undefined;
  let currentTurnId: string | undefined;
  let sawRecognizedSession = false;

  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    rawLineCount += 1;
    if (!line.trim()) {
      continue;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(line);
    } catch {
      warnings.push(`Line ${rawLineCount}: invalid JSON skipped.`);
      continue;
    }

    const outerType = asString(parsed?.type);
    const payload = isObject(parsed?.payload) ? parsed.payload : {};
    const innerType = asString(payload.type);
    const timestamp = asString(parsed?.timestamp);

    if (!outerType) {
      warnings.push(`Line ${rawLineCount}: missing outer type.`);
      continue;
    }

    if (outerType === "session_meta") {
      sawRecognizedSession = true;
      sessionId = asString(payload.id) ?? sessionId;
      cwd = asString(payload.cwd) ?? cwd;
      startedAt = asString(payload.timestamp) ?? timestamp ?? startedAt;
      updatedAt = timestamp ?? updatedAt;
      threadName = activeDiscovery.indexById.get(sessionId)?.thread_name ?? threadName;
    }

    if (outerType === "turn_context") {
      sawRecognizedSession = true;
      currentTurnId = asString(payload.turn_id) ?? currentTurnId;
      ensureTurn(turnsById, currentTurnId, timestamp).eventIds.push(makeEventId(filePath, rawLineCount));
    }

    if (outerType === "event_msg" && innerType === "task_started") {
      sawRecognizedSession = true;
      currentTurnId = asString(payload.turn_id) ?? currentTurnId;
      const turn = ensureTurn(turnsById, currentTurnId, timestamp);
      turn.startTs = timestamp ?? turn.startTs;
    }

    const event = normalizeEvent({
      filePath,
      rawLine: rawLineCount,
      rawRecord: parsed,
      outerType,
      innerType,
      timestamp,
      payload,
      currentTurnId
    });
    if (!event) {
      continue;
    }

    sawRecognizedSession = sawRecognizedSession || outerType === "response_item" || outerType === "event_msg";
    updatedAt = timestamp ?? updatedAt;
    events.push(event);

    if (event.turnId) {
      const turn = ensureTurn(turnsById, event.turnId, event.ts);
      turn.eventIds.push(event.id);
      if (event.kind === "commentary") {
        turn.commentaryEventIds.push(event.id);
      } else if (event.kind === "assistant_message") {
        turn.assistantEventIds.push(event.id);
      } else if (event.kind === "token_usage") {
        turn.tokenEventIds.push(event.id);
      }
      if (event.kind === "user_message" && event.messageText) {
        turn.userMessage = event.messageText;
      }
      if (event.kind === "tool_call" && event.callId) {
        turn.toolCallIds.push(event.callId);
      }
      if (event.innerType === "task_complete" || event.innerType === "turn_aborted") {
        turn.endTs = event.ts ?? turn.endTs;
      }
    }

    updateToolState(toolsById, event);
  }

  if (!sawRecognizedSession || events.length === 0) {
    return { session: null, warnings };
  }

  if (!threadName && sessionId) {
      threadName = activeDiscovery.indexById.get(sessionId)?.thread_name;
  }
  if (!updatedAt) {
    updatedAt = startedAt;
  }

  const tools = [...toolsById.values()].sort((a, b) => (a.startTs ?? "").localeCompare(b.startTs ?? ""));
  applyProvenance(events, tools);

  const turns = [...turnsById.values()]
    .map((turn) => ({
      ...turn,
      toolCallIds: unique(turn.toolCallIds),
      eventIds: unique(turn.eventIds),
      commentaryEventIds: unique(turn.commentaryEventIds),
      assistantEventIds: unique(turn.assistantEventIds),
      tokenEventIds: unique(turn.tokenEventIds)
    }))
    .sort((a, b) => (a.startTs ?? "").localeCompare(b.startTs ?? ""));

  const record: SessionRecord = {
    id: sessionId,
    sourceFile: filePath,
    threadName,
    cwd,
    startedAt,
    updatedAt,
    rawLineCount,
    warnings
  };

  return {
    session: {
      record,
      events,
      turns,
      tools,
      analysis: buildAnalysis(events, turns, tools)
    },
    warnings
  };
}

function normalizeEvent(args: {
  filePath: string;
  rawLine: number;
  rawRecord: any;
  outerType: string;
  innerType?: string;
  timestamp?: string;
  payload: Record<string, unknown>;
  currentTurnId?: string;
}): TimelineEvent | null {
  const { filePath, rawLine, rawRecord, outerType, innerType, timestamp, payload, currentTurnId } = args;
  const id = makeEventId(filePath, rawLine);
  const turnId = asString(payload.turn_id) ?? currentTurnId;
  const phase = asString(payload.phase);
  const role = asString(payload.role);
  let kind: EventKind = "unknown";
  let summary = `${outerType}${innerType ? `:${innerType}` : ""}`;
  let callId: string | undefined;
  let messageText: string | undefined;

  if (outerType === "session_meta") {
    kind = "meta";
    summary = `Session metadata for ${asString(payload.id) ?? "unknown session"}`;
  } else if (outerType === "turn_context") {
    kind = "context";
    summary = `Turn context${turnId ? ` for ${turnId}` : ""}`;
  } else if (outerType === "event_msg") {
    switch (innerType) {
      case "user_message":
        kind = "user_message";
        messageText = asString(payload.message) ?? "";
        summary = trimSummary(messageText, "User message");
        break;
      case "agent_message":
        kind = phase === "commentary" ? "commentary" : "assistant_message";
        messageText = asString(payload.message) ?? "";
        summary = trimSummary(messageText, phase === "commentary" ? "Commentary update" : "Assistant message");
        break;
      case "task_started":
      case "task_complete":
      case "turn_aborted":
      case "thread_rolled_back":
        kind = "lifecycle";
        summary = formatLifecycleSummary(innerType, turnId);
        break;
      case "token_count":
        kind = "token_usage";
        summary = "Token usage update";
        break;
      default:
        kind = "unknown";
        summary = `Event ${innerType ?? "unknown"}`;
    }
  } else if (outerType === "response_item") {
    switch (innerType) {
      case "message": {
        const content = Array.isArray(payload.content) ? payload.content : [];
        messageText = content
          .map((item) => (isObject(item) ? asString(item.text) : undefined))
          .filter(Boolean)
          .join("\n");
        kind = phase === "commentary" ? "commentary" : role === "assistant" ? "assistant_message" : "meta";
        summary = trimSummary(messageText, role ? `${role} message` : "Message");
        break;
      }
      case "reasoning":
        kind = "reasoning";
        summary = "Reasoning record";
        break;
      case "function_call":
      case "custom_tool_call":
        kind = "tool_call";
        callId = asString(payload.call_id);
        summary = `Tool call ${asString(payload.name) ?? callId ?? "unknown"}`;
        break;
      case "function_call_output":
      case "custom_tool_call_output":
        kind = "tool_output";
        callId = asString(payload.call_id);
        summary = `Tool output ${callId ?? "unknown"}`;
        break;
      default:
        kind = "unknown";
        summary = `Response item ${innerType ?? "unknown"}`;
    }
  }

  return {
    id,
    ts: timestamp,
    outerType,
    innerType,
    turnId,
    phase,
    role,
    kind,
    summary,
    raw: rawRecord,
    rawLine,
    sourceFile: filePath,
    callId,
    messageText
  };
}

function updateToolState(toolsById: Map<string, ToolInvocation>, event: TimelineEvent): void {
  if (!event.callId) {
    return;
  }

  if (event.kind === "tool_call") {
    const payload = isObject((event.raw as any)?.payload) ? (event.raw as any).payload : {};
    const tool = toolsById.get(event.callId) ?? {
      callId: event.callId,
      toolName: asString(payload.name) ?? "unknown",
      toolType: payload.type === "custom_tool_call" ? "custom_tool_call" : "function_call",
      sourceEventIds: []
    };
    tool.startTs = event.ts ?? tool.startTs;
    tool.turnId = event.turnId ?? tool.turnId;
    tool.argumentsText = asString(payload.arguments) ?? tool.argumentsText;
    tool.inputText = asString(payload.input) ?? tool.inputText;
    tool.status = asString(payload.status) ?? tool.status;
    tool.sourceEventIds.push(event.id);
    toolsById.set(event.callId, tool);
  } else if (event.kind === "tool_output") {
    const payload = isObject((event.raw as any)?.payload) ? (event.raw as any).payload : {};
    const tool = toolsById.get(event.callId) ?? {
      callId: event.callId,
      toolName: "unknown",
      toolType: payload.type === "custom_tool_call_output" ? "custom_tool_call" : "function_call",
      sourceEventIds: []
    };
    tool.endTs = event.ts ?? tool.endTs;
    tool.turnId = event.turnId ?? tool.turnId;
    tool.outputText = asString(payload.output) ?? tool.outputText;
    tool.status = asString(payload.status) ?? tool.status ?? "completed";
    tool.sourceEventIds.push(event.id);
    toolsById.set(event.callId, tool);
  }
}

function applyProvenance(events: TimelineEvent[], tools: ToolInvocation[]): void {
  const toolsById = new Map(tools.map((tool) => [tool.callId, tool]));
  const recentOutputsByTurn = new Map<string, string[]>();

  for (const event of events) {
    const turnKey = event.turnId ?? "__session__";
    if (event.kind === "tool_output" && event.callId) {
      const current = recentOutputsByTurn.get(turnKey) ?? [];
      current.push(event.callId);
      recentOutputsByTurn.set(turnKey, current.slice(-8));
    }

    if (event.kind === "assistant_message" || event.kind === "commentary") {
      event.provenance = inferProvenance(event, recentOutputsByTurn.get(turnKey) ?? [], toolsById);
    }

    if (event.kind === "user_message") {
      recentOutputsByTurn.set(turnKey, []);
    }
  }
}

function inferProvenance(
  event: TimelineEvent,
  recentCallIds: string[],
  toolsById: Map<string, ToolInvocation>
): ProvenanceAssessment {
  if (recentCallIds.length === 0) {
    return {
      label: "model_only",
      confidence: 0.8,
      rationale: "No recent tool outputs in this turn before the message.",
      linkedToolCallIds: []
    };
  }

  const toolNames = recentCallIds
    .map((callId) => toolsById.get(callId)?.toolName)
    .filter(Boolean) as string[];
  const uniqueNames = unique(toolNames);
  const message = event.messageText?.toLowerCase() ?? "";
  const citesCommandOutput = /\bconfirmed\b|\bchecked\b|\bfound\b|\bline\b|\boutput\b|\bdiff\b|\blog\b|\bverified\b/.test(message);

  let label: ProvenanceLabel = "tool_informed";
  let confidence = 0.7;
  if (!citesCommandOutput && message.length > 280) {
    label = "mixed";
    confidence = 0.55;
  } else if (!citesCommandOutput && recentCallIds.length === 1) {
    label = "unknown";
    confidence = 0.45;
  }

  return {
    label,
    confidence,
    rationale: `${recentCallIds.length} recent tool output${recentCallIds.length === 1 ? "" : "s"} before this message${uniqueNames.length ? ` (${uniqueNames.join(", ")})` : ""}.`,
    linkedToolCallIds: recentCallIds
  };
}

function buildAnalysis(events: TimelineEvent[], turns: Turn[], tools: ToolInvocation[]): SessionAnalysis {
  const eventCounts: Record<string, number> = {};
  const kindCounts: Record<EventKind, number> = {
    lifecycle: 0,
    user_message: 0,
    assistant_message: 0,
    commentary: 0,
    tool_call: 0,
    tool_output: 0,
    reasoning: 0,
    token_usage: 0,
    context: 0,
    meta: 0,
    unknown: 0
  };
  const toolUsageCounts: Record<string, number> = {};
  const provenanceCounts: Record<ProvenanceLabel, number> = {
    model_only: 0,
    tool_informed: 0,
    mixed: 0,
    unknown: 0
  };

  for (const event of events) {
    const key = `${event.outerType}:${event.innerType ?? "none"}`;
    eventCounts[key] = (eventCounts[key] ?? 0) + 1;
    kindCounts[event.kind] += 1;
    if (event.provenance) {
      provenanceCounts[event.provenance.label] += 1;
    }
  }

  for (const tool of tools) {
    toolUsageCounts[tool.toolName] = (toolUsageCounts[tool.toolName] ?? 0) + 1;
  }

  return {
    eventCounts,
    kindCounts,
    toolUsageCounts,
    provenanceCounts,
    totalTurns: turns.length
  };
}

function ensureTurn(turnsById: Map<string, Turn>, turnId: string | undefined, ts?: string): Turn {
  const id = turnId ?? `unknown-turn-${turnsById.size + 1}`;
  const existing = turnsById.get(id);
  if (existing) {
    existing.startTs = existing.startTs ?? ts;
    return existing;
  }

  const created: Turn = {
    id,
    startTs: ts,
    commentaryEventIds: [],
    assistantEventIds: [],
    toolCallIds: [],
    tokenEventIds: [],
    eventIds: []
  };
  turnsById.set(id, created);
  return created;
}

async function collectCandidateFiles(root: string): Promise<string[]> {
  const stat = await safeStat(root);
  if (!stat) {
    return [];
  }
  if (stat.isFile()) {
    return SCAN_EXTENSIONS.has(path.extname(root).toLowerCase()) ? [root] : [];
  }

  const results: string[] = [];
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (SCAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

async function safeStat(targetPath: string): Promise<fs.Stats | null> {
  try {
    return await fs.promises.stat(targetPath);
  } catch {
    return null;
  }
}

async function readSessionIndex(filePath: string): Promise<Map<string, SessionIndexEntry>> {
  const index = new Map<string, SessionIndexEntry>();
  const stat = await safeStat(filePath);
  if (!stat?.isFile()) {
    return index;
  }

  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }
    try {
      const parsed = JSON.parse(line) as SessionIndexEntry;
      if (parsed.id) {
        index.set(parsed.id, parsed);
      }
    } catch {
      // Ignore malformed index lines.
    }
  }

  return index;
}

function expandHome(inputPath: string): string {
  if (inputPath === "~") {
    return os.homedir();
  }
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

function formatLifecycleSummary(innerType: string, turnId?: string): string {
  switch (innerType) {
    case "task_started":
      return `Turn started${turnId ? ` (${turnId})` : ""}`;
    case "task_complete":
      return `Turn completed${turnId ? ` (${turnId})` : ""}`;
    case "turn_aborted":
      return `Turn aborted${turnId ? ` (${turnId})` : ""}`;
    case "thread_rolled_back":
      return "Thread rolled back";
    default:
      return `Lifecycle event ${innerType}`;
  }
}

function trimSummary(text: string | undefined, fallback: string): string {
  const cleaned = text?.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return fallback;
  }
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function makeEventId(filePath: string, line: number): string {
  return `${filePath}:${line}`;
}
