import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SessionStore, getDefaultCodexPaths } from "./session-loader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distClientDir = path.resolve(__dirname, "../client");
const port = Number(process.env.PORT ?? 4318);

const store = await SessionStore.create();
const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, defaultPaths: getDefaultCodexPaths() });
});

app.get("/api/sessions", (_req, res) => {
  res.json({ sessions: store.listSessions() });
});

app.post("/api/load", async (req, res) => {
  const input = Array.isArray(req.body?.paths) ? req.body.paths.filter((item: unknown) => typeof item === "string") : [];
  const sessions = await store.loadPaths(input);
  res.json({ sessions });
});

app.get("/api/session/:id", (req, res) => {
  const session = store.getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ session });
});

app.use(express.static(distClientDir));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }
  res.sendFile(path.join(distClientDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Codex Session Dashboard listening on http://localhost:${port}`);
});
