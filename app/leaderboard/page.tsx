import { Activity, Crown, ImageIcon, Medal, ShieldCheck, Timer, TrendingUp, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import { LeaderboardBoard } from "@/app/components/LeaderboardBoard";
import { type LeaderboardEntry, listLeaderboardEntries } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const entries = await listLeaderboardEntries();
  const topThree = entries.slice(0, 3);
  const merged = entries.filter((entry) => entry.pullRequest.state === "merged").length;
  const failed = entries.filter((entry) => entry.status === "fail").length;
  const averageScore = entries.length
    ? entries.reduce((total, entry) => total + entry.score, 0) / entries.length
    : 0;
  const topScore = entries[0]?.score ?? 0;
  const fastest = entries.length ? Math.min(...entries.map((entry) => entry.latencyP95Ms)) : 0;
  const totalCost = entries.reduce((total, entry) => total + entry.costUsd, 0);
  const leader = entries[0];
  const chronological = [...entries].sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt));
  const firstReport = chronological[0] ?? null;
  const latestReport = chronological[chronological.length - 1] ?? null;
  const projectBaseline = leader?.improvement.baselineScore ?? firstReport?.score ?? null;
  const projectDelta = projectBaseline === null ? null : topScore - projectBaseline;
  const eligible = entries.filter((entry) => entry.improvement.mergeEligible).length;
  const bestImprovement = entries.reduce<LeaderboardEntry | null>((best, entry) => {
    if (entry.improvement.delta === null) {
      return best;
    }
    if (!best || best.improvement.delta === null || entry.improvement.delta > best.improvement.delta) {
      return entry;
    }
    return best;
  }, null);
  const latestFive = chronological.slice(-5).reverse();

  return (
    <div className="leaderboard-page">
      <section className="leaderboard-hero">
        <div className="leaderboard-hero-copy">
          <span className="page-kicker">Gittensor subnet 74 · image miners · official eval</span>
          <h1>Image miners compete on live benchmark improvement.</h1>
          <p>Every report is ranked by score, PR outcome, baseline delta, latency, cost, and judge dimensions.</p>
        </div>
        <div className="leaderboard-visual" aria-hidden="true">
          <div className="visual-topline">
            <span>frontier miner</span>
            <strong>{leader ? `#${leader.rank}` : "#0"}</strong>
          </div>
          <div className="visual-avatar-row">
            {topThree.map((entry) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={entry.contributor.avatar_url || ""} alt="" key={entry.runId} />
            ))}
          </div>
          <div className="signal-rails">
            <span style={{ width: `${Math.max(8, Math.min(100, topScore))}%` }} />
            <span style={{ width: `${Math.max(8, Math.min(100, averageScore))}%` }} />
            <span style={{ width: `${entries.length ? 72 : 12}%` }} />
          </div>
          <div className="visual-ledger">
            <span>score {topScore.toFixed(2)}</span>
            <span>{entries.length} reports</span>
            <span>{eligible} eligible</span>
          </div>
        </div>
      </section>

      <section className="leaderboard-stats">
        <HeroStat icon={<Medal size={18} />} label="Top score" value={topScore.toFixed(2)} />
        <HeroStat icon={<TrendingUp size={18} />} label="Project delta" value={formatDelta(projectDelta)} />
        <HeroStat icon={<ShieldCheck size={18} />} label="Merge eligible" value={String(eligible)} />
        <HeroStat icon={<ImageIcon size={18} />} label="Avg score" value={averageScore.toFixed(1)} />
        <HeroStat icon={<Timer size={18} />} label="Fastest p95" value={`${fastest.toFixed(0)} ms`} />
        <HeroStat icon={<WalletCards size={18} />} label="Total cost" value={`$${totalCost.toFixed(4)}`} />
      </section>

      <section className="improvement-board" aria-label="Project improvement summary">
        <div className="improvement-board-copy">
          <span className="live-chip"><Activity size={13} /> Live benchmark feed</span>
          <h2>{formatDelta(projectDelta)} project improvement</h2>
          <p>
            Compared against {projectBaseline === null ? "the active baseline once it is available" : `baseline ${projectBaseline.toFixed(2)}`}.
            {" "}Latest report {latestReport ? `finished ${formatDate(latestReport.completedAt)}` : "has not been imported yet"}.
          </p>
        </div>
        <div className="improvement-metrics">
          <ProjectMetric
            label="Current frontier"
            value={leader ? leader.score.toFixed(2) : "0.00"}
            detail={leader ? `@${leader.contributor.login} · ${leader.improvement.label}` : "waiting for reports"}
          />
          <ProjectMetric
            label="Best PR uplift"
            value={bestImprovement ? formatDelta(bestImprovement.improvement.delta) : "N/A"}
            detail={bestImprovement ? `@${bestImprovement.contributor.login} · PR #${bestImprovement.pullRequest.number}` : "baseline unavailable"}
          />
          <ProjectMetric
            label="Merged proof"
            value={String(merged)}
            detail={`${failed} failed or closed`}
          />
          <ProjectMetric
            label="Latest score"
            value={latestReport ? latestReport.score.toFixed(2) : "0.00"}
            detail={latestReport ? latestReport.improvement.label : "no run yet"}
          />
        </div>
        {latestFive.length > 0 ? (
          <div className="improvement-timeline custom-scrollbar" aria-label="Latest benchmark reports">
            {latestFive.map((entry) => (
              <a href={`/reports/${entry.runId}`} key={entry.runId}>
                <span className={`timeline-dot ${deltaTone(entry.improvement.delta)}`} />
                <strong>{entry.score.toFixed(1)}</strong>
                <small>{formatDelta(entry.improvement.delta)}</small>
              </a>
            ))}
          </div>
        ) : null}
      </section>

      <section className="podium-grid">
        {topThree.map((entry, index) => (
          <a className={`podium-card rank-${index + 1}`} href={`/reports/${entry.runId}`} key={entry.runId}>
            <div className="podium-rank">{index === 0 ? <Crown size={20} /> : `#${index + 1}`}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={entry.contributor.avatar_url || ""} alt="" />
            <div>
              <h2>{entry.contributor.name || entry.contributor.login}</h2>
              <p>@{entry.contributor.login}</p>
            </div>
            <strong>{entry.score.toFixed(2)}</strong>
            <span>{entry.pullRequest.state} · PR #{entry.pullRequest.number}</span>
            <small>{formatDelta(entry.improvement.delta)} · {entry.improvement.label}</small>
          </a>
        ))}
      </section>

      <LeaderboardBoard entries={entries} />
    </div>
  );
}

function HeroStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="hero-stat">
      {icon}
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function ProjectMetric({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="project-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function formatDelta(value: number | null) {
  if (value === null) {
    return "N/A";
  }
  if (Math.abs(value) < 0.005) {
    return "+0.00";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "recently";
  }
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(date);
}

function deltaTone(value: number | null) {
  if (value === null || Math.abs(value) < 0.005) {
    return "neutral";
  }
  return value > 0 ? "positive" : "negative";
}
