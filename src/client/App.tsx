import { startTransition, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

type EventFilter = "all" | "assistant" | "commentary" | "tool_call" | "tool_output";

const FILTERS: { value: EventFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "assistant", label: "Assistant" },
  { value: "commentary", label: "Commentary" },
  { value: "tool_call", label: "Tool calls" },
  { value: "tool_output", label: "Tool outputs" }
];

export function App() {
  const dashboard = useQuery(api.dashboard.getDashboard);
  const seedDashboard = useMutation(api.seed.seedDashboard);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [sessionQuery, setSessionQuery] = useState("");
  const [filter, setFilter] = useState<EventFilter>("all");
  const deferredQuery = useDeferredValue(sessionQuery);

  useEffect(() => {
    if (dashboard === undefined) {
      return;
    }
    if (dashboard.meta === null && dashboard.sessions.length === 0) {
      void seedDashboard({});
    }
  }, [dashboard, seedDashboard]);

  useEffect(() => {
    if (!dashboard?.sessions.length) {
      return;
    }
    const selectedStillExists = dashboard.sessions.some((session) => session.slug === selectedSlug);
    if (!selectedSlug || !selectedStillExists) {
      setSelectedSlug(dashboard.sessions[0].slug);
    }
  }, [dashboard?.sessions, selectedSlug]);

  const filteredSessions = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    const query = deferredQuery.trim().toLowerCase();
    if (!query) {
      return dashboard.sessions;
    }

    return dashboard.sessions.filter((session) =>
      [session.name, session.path, session.summary, session.source]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [dashboard, deferredQuery]);

  const selectedSession = useMemo(() => {
    if (!dashboard?.sessions.length) {
      return null;
    }
    return dashboard.sessions.find((session) => session.slug === selectedSlug) ?? dashboard.sessions[0];
  }, [dashboard?.sessions, selectedSlug]);

  const visibleTimelineEvents = useMemo(() => {
    if (!selectedSession) {
      return [];
    }
    if (filter === "all") {
      return selectedSession.timelineEvents;
    }
    return selectedSession.timelineEvents.filter((event) => event.kind === filter);
  }, [filter, selectedSession]);

  if (dashboard === undefined) {
    return <LoadingState />;
  }

  if (dashboard.meta === null) {
    return <LoadingState label="Seeding Convex demo data" />;
  }

  if (selectedSession === null) {
    return <LoadingState label="No sessions available" />;
  }

  return (
    <div className="app-shell">
      <div className="background-orb orb-left" />
      <div className="background-orb orb-right" />

      <aside className="sidebar">
        <section className="sidebar-panel brand-panel">
          <span className="eyebrow">Vite + React + TypeScript + Convex</span>
          <h1>{dashboard.meta.headline}</h1>
          <p className="lede">{dashboard.meta.subheadline}</p>
          <label className="field-shell">
            <span className="sr-only">Search sessions</span>
            <input
              className="search-input"
              placeholder="Search sessions"
              value={sessionQuery}
              onChange={(event) => setSessionQuery(event.target.value)}
            />
          </label>
        </section>

        <section className="sidebar-panel utility-panel">
          <div className="sidebar-heading">
            <h2>Data Source</h2>
            <span className="mini-pill">{dashboard.meta.refreshLabel}</span>
          </div>
          <div className="seed-card">
            <p>Convex is serving seeded dashboard documents from a local deployment.</p>
            <code>VITE_CONVEX_URL</code>
          </div>
        </section>

        <section className="sidebar-panel sessions-panel">
          <div className="sidebar-heading">
            <h2>Sessions</h2>
            <span className="count-pill">{filteredSessions.length}</span>
          </div>
          <div className="session-list">
            {filteredSessions.map((session) => (
              <button
                key={session.slug}
                type="button"
                className={session.slug === selectedSession.slug ? "session-item active" : "session-item"}
                onClick={() =>
                  startTransition(() => {
                    setSelectedSlug(session.slug);
                  })
                }
              >
                <span className="session-title">{session.name}</span>
                <span className="session-meta">
                  {session.source} · {session.path}
                </span>
                <span className="session-summary">{session.summary}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Selected Session</p>
            <h2>{selectedSession.name}</h2>
            <p className="subtle">
              {selectedSession.path} · updated {selectedSession.updatedAt}
            </p>
          </div>
          <div className="status-pill">
            <span className="status-dot" />
            {dashboard.meta.status}
          </div>
        </header>

        <section className="overview-grid">
          <MetricCard label="Events" value={selectedSession.events} note="+42 since reload" />
          <MetricCard label="Turns" value={selectedSession.turns} note="2 open tool chains" flair />
          <MetricCard label="Tool Calls" value={selectedSession.tools} note="web, exec, paper, patch" />
          <MetricCard
            label="Provenance"
            value={selectedSession.provenanceLabel}
            note={`heuristic confidence ${selectedSession.provenanceConfidence.toFixed(2)}`}
          />
        </section>

        <section className="main-grid">
          <div className="left-column">
            <Panel
              title="Timeline Filters"
              aside={`${visibleTimelineEvents.length} visible`}
              contentClassName="filter-row"
            >
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={option.value === filter ? "filter-chip active" : "filter-chip"}
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </Panel>

            <Panel title="Timeline" aside={`${selectedSession.timelineEvents.length} events`}>
              <div className="timeline-list">
                {visibleTimelineEvents.map((event) => (
                  <article key={event.id} className={`timeline-item kind-${event.kind}`}>
                    <div className="timeline-row">
                      <span className="timeline-time">{event.time}</span>
                      <span className="kind-chip">{event.kind.replaceAll("_", " ")}</span>
                    </div>
                    <h3>{event.title}</h3>
                    <p>{event.summary}</p>
                  </article>
                ))}
              </div>
            </Panel>
          </div>

          <div className="right-column">
            <Panel title="Selected Event" aside={selectedSession.activeEventKind}>
              <div className="selected-event">
                <h3>{selectedSession.activeEventTitle}</h3>
                <p>{selectedSession.activeEventSummary}</p>
                <p className="subtle">{selectedSession.activeEventFollowup}</p>
                <div className="detail-grid">
                  <div className="detail-card">
                    <span>Provenance</span>
                    <strong>{selectedSession.provenanceLabel}</strong>
                  </div>
                  <div className="detail-card gold">
                    <span>Linked tools</span>
                    <strong>{selectedSession.linkedTools}</strong>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Tool Pairs" aside="latest">
              <div className="tool-pair-list">
                {selectedSession.toolPairs.map((pair) => (
                  <article key={pair.id} className="tool-pair-item">
                    <code>{pair.label}</code>
                    <p>{pair.summary}</p>
                  </article>
                ))}
              </div>
            </Panel>

            <Panel title="Provenance Pulse" aside="heuristic" dark>
              <div className="pulse-grid">
                <div className="pulse-card">
                  <span>Model only</span>
                  <strong>{selectedSession.modelOnlyShare}%</strong>
                </div>
                <div className="pulse-card">
                  <span>Tool informed</span>
                  <strong>{selectedSession.toolInformedShare}%</strong>
                </div>
              </div>
              <pre className="json-block">{selectedSession.rawEventJson}</pre>
            </Panel>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard(props: { label: string; value: number | string; note: string; flair?: boolean }) {
  if (!props.flair) {
    return (
      <article className="metric-card">
        <span>{props.label}</span>
        <strong>{props.value}</strong>
        <p>{props.note}</p>
      </article>
    );
  }

  return (
    <article className="metric-card flair-card">
      <span>{props.label}</span>
      <div className="flair-row">
        <div>
          <small>ACTIVE</small>
          <strong>{props.value}</strong>
        </div>
        <div className="flair-badge" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
      <p>{props.note}</p>
    </article>
  );
}

function Panel(props: {
  title: string;
  aside?: string;
  children: ReactNode;
  dark?: boolean;
  contentClassName?: string;
}) {
  return (
    <section className={props.dark ? "panel panel-dark" : "panel"}>
      <div className="panel-header">
        <h3>{props.title}</h3>
        {props.aside ? <span>{props.aside}</span> : null}
      </div>
      <div className={props.contentClassName}>{props.children}</div>
    </section>
  );
}

function LoadingState(props: { label?: string }) {
  return (
    <div className="loading-shell">
      <div className="loading-card">
        <span className="eyebrow">Convex dashboard</span>
        <h1>{props.label ?? "Loading dashboard"}</h1>
        <p>Waiting for the local Convex deployment and seeded session data.</p>
      </div>
    </div>
  );
}
