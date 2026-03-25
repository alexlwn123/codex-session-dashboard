import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSessionFile } from "./session-loader.js";

async function writeTempSession(lines: string[]): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-session-dashboard-"));
  const file = path.join(dir, "session.jsonl");
  await fs.writeFile(file, `${lines.join("\n")}\n`, "utf8");
  return file;
}

describe("parseSessionFile", () => {
  it("normalizes a session with user messages, commentary, tools, and outputs", async () => {
    const file = await writeTempSession([
      JSON.stringify({
        timestamp: "2026-03-25T12:00:00Z",
        type: "session_meta",
        payload: {
          id: "session-1",
          timestamp: "2026-03-25T12:00:00Z",
          cwd: "/tmp/demo"
        }
      }),
      JSON.stringify({
        timestamp: "2026-03-25T12:00:01Z",
        type: "event_msg",
        payload: {
          type: "task_started",
          turn_id: "turn-1"
        }
      }),
      JSON.stringify({
        timestamp: "2026-03-25T12:00:02Z",
        type: "event_msg",
        payload: {
          type: "user_message",
          message: "Inspect this session"
        }
      }),
      JSON.stringify({
        timestamp: "2026-03-25T12:00:03Z",
        type: "event_msg",
        payload: {
          type: "agent_message",
          phase: "commentary",
          message: "Checking the session file now."
        }
      }),
      JSON.stringify({
        timestamp: "2026-03-25T12:00:04Z",
        type: "response_item",
        payload: {
          type: "function_call",
          name: "exec_command",
          arguments: "{\"cmd\":\"pwd\"}",
          call_id: "call-1"
        }
      }),
      JSON.stringify({
        timestamp: "2026-03-25T12:00:05Z",
        type: "response_item",
        payload: {
          type: "function_call_output",
          call_id: "call-1",
          output: "/tmp/demo"
        }
      }),
      JSON.stringify({
        timestamp: "2026-03-25T12:00:06Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: "I checked the command output and the working directory is /tmp/demo."
            }
          ]
        }
      }),
      JSON.stringify({
        timestamp: "2026-03-25T12:00:07Z",
        type: "event_msg",
        payload: {
          type: "task_complete",
          turn_id: "turn-1"
        }
      })
    ]);

    const result = await parseSessionFile(file, { indexById: new Map() });
    expect(result.session).not.toBeNull();

    const session = result.session!;
    expect(session.record.id).toBe("session-1");
    expect(session.turns).toHaveLength(1);
    expect(session.tools).toHaveLength(1);
    expect(session.tools[0].toolName).toBe("exec_command");
    expect(session.tools[0].outputText).toContain("/tmp/demo");

    const assistantEvent = session.events.find((event) => event.kind === "assistant_message");
    expect(assistantEvent?.provenance?.label).toBe("tool_informed");
    expect(assistantEvent?.provenance?.rationale).toContain("recent tool output");
  });

  it("skips malformed lines and preserves unknown event types", async () => {
    const file = await writeTempSession([
      JSON.stringify({
        timestamp: "2026-03-25T12:00:00Z",
        type: "session_meta",
        payload: {
          id: "session-2"
        }
      }),
      "{not valid json",
      JSON.stringify({
        timestamp: "2026-03-25T12:00:01Z",
        type: "event_msg",
        payload: {
          type: "mystery_event",
          value: 42
        }
      })
    ]);

    const result = await parseSessionFile(file, { indexById: new Map() });
    expect(result.session).not.toBeNull();
    expect(result.warnings).toHaveLength(1);
    expect(result.session!.events.some((event) => event.kind === "unknown")).toBe(true);
  });

  it("matches custom tool calls to outputs", async () => {
    const file = await writeTempSession([
      JSON.stringify({
        timestamp: "2026-03-25T12:00:00Z",
        type: "session_meta",
        payload: {
          id: "session-3"
        }
      }),
      JSON.stringify({
        timestamp: "2026-03-25T12:00:01Z",
        type: "response_item",
        payload: {
          type: "custom_tool_call",
          name: "apply_patch",
          status: "completed",
          input: "*** Begin Patch",
          call_id: "call-2"
        }
      }),
      JSON.stringify({
        timestamp: "2026-03-25T12:00:02Z",
        type: "response_item",
        payload: {
          type: "custom_tool_call_output",
          call_id: "call-2",
          output: "Success",
          status: "completed"
        }
      })
    ]);

    const result = await parseSessionFile(file, { indexById: new Map() });
    const tool = result.session?.tools[0];
    expect(tool?.toolType).toBe("custom_tool_call");
    expect(tool?.inputText).toContain("*** Begin Patch");
    expect(tool?.outputText).toBe("Success");
  });

  it("can parse one real active session log when available", async () => {
    const home = os.homedir();
    const activeRoot = path.join(home, ".codex", "sessions");
    let candidates: string[] = [];

    try {
      candidates = await findJsonl(activeRoot);
    } catch {
      candidates = [];
    }

    if (candidates.length === 0) {
      return;
    }

    const parsed = await parseFirstValidSession(candidates);
    expect(parsed).not.toBeNull();
    expect(parsed!.events.length).toBeGreaterThan(0);
  });

  it("can parse one archived session log when available", async () => {
    const home = os.homedir();
    const archiveRoot = path.join(home, ".codex", "archived_sessions");
    let candidates: string[] = [];

    try {
      candidates = await findJsonl(archiveRoot);
    } catch {
      candidates = [];
    }

    if (candidates.length === 0) {
      return;
    }

    const parsed = await parseFirstValidSession(candidates);
    expect(parsed).not.toBeNull();
    expect(parsed!.events.length).toBeGreaterThan(0);
  });
});

async function findJsonl(root: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.endsWith(".jsonl")) {
        results.push(fullPath);
      }
    }
  }

  await walk(root);
  return results.sort();
}

async function parseFirstValidSession(paths: string[]) {
  for (const candidate of paths) {
    const result = await parseSessionFile(candidate);
    if (result.session) {
      return result.session;
    }
  }
  return null;
}
