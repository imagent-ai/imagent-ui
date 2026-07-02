"use client";

import { ArrowUpRight, CheckCircle2, GitMerge, GitPullRequestClosed, Search, Timer, WalletCards, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { LeaderboardEntry } from "@/lib/reports";

type Filter = "all" | "merged" | "closed" | "failed";

const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "merged", label: "Merged" },
  { id: "closed", label: "Closed" },
  { id: "failed", label: "Failed" }
];

export function LeaderboardBoard({ entries }: { entries: LeaderboardEntry[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "merged" && entry.pullRequest.state === "merged") ||
        (filter === "closed" && entry.pullRequest.state === "closed") ||
        (filter === "failed" && entry.status === "fail");

      if (!matchesFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        entry.contributor.login,
        entry.contributor.name,
        entry.repository,
        entry.agentName,
        entry.pullRequest.title,
        String(entry.pullRequest.number),
        entry.benchmarkVersion,
        entry.runId
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [entries, filter, query]);

  return (
    <section className="subnet-table">
      <div className="table-toolbar">
        <div>
          <h2>All benchmarked miners</h2>
          <p>{visibleEntries.length} of {entries.length} reports</p>
        </div>
        <div className="leaderboard-controls">
          <label className="leaderboard-search">
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search miner, repo, PR"
            />
          </label>
          <div className="filter-chips" aria-label="Leaderboard filters">
            {filters.map((item) => (
              <button
                className={filter === item.id ? "active" : ""}
                type="button"
                key={item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="leaderboard-table-wrap">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Miner</th>
              <th>Pull Request</th>
              <th>Score</th>
              <th>Result</th>
              <th>Latency</th>
              <th>Cost</th>
              <th>Report</th>
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry) => (
              <tr key={entry.runId}>
                <td><span className="rank-pill">#{entry.rank}</span></td>
                <td>
                  <div className="miner-cell">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={entry.contributor.avatar_url || ""} alt="" />
                    <div>
                      <strong>{entry.contributor.name || entry.contributor.login}</strong>
                      <span>@{entry.contributor.login}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="pr-cell">
                    <strong>#{entry.pullRequest.number}</strong>
                    <small>{entry.pullRequest.title}</small>
                    <span className={`pr-state ${entry.pullRequest.state}`}>
                      {entry.pullRequest.state === "merged" ? <GitMerge size={13} /> : <GitPullRequestClosed size={13} />}
                      {entry.pullRequest.state}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="score-cell">
                    <strong>{entry.score.toFixed(2)}</strong>
                    <span><i style={{ width: `${Math.max(3, Math.min(100, entry.score))}%` }} /></span>
                  </div>
                </td>
                <td>
                  <span className={`result-badge ${entry.status}`}>
                    {entry.status === "pass" ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                    {entry.status}
                  </span>
                  <small className="benchmark-version">{entry.benchmarkVersion}</small>
                </td>
                <td><span className="metric-inline"><Timer size={13} /> {entry.latencyP95Ms.toFixed(0)} ms</span></td>
                <td><span className="metric-inline"><WalletCards size={13} /> ${entry.costUsd.toFixed(5)}</span></td>
                <td>
                  <a className="report-link" href={`/reports/${entry.runId}`}>
                    View <ArrowUpRight size={14} />
                  </a>
                </td>
              </tr>
            ))}
            {visibleEntries.length === 0 ? (
              <tr>
                <td className="empty-table-cell" colSpan={8}>No benchmark reports match this view.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
