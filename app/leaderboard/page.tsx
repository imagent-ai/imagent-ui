import { Crown, GitMerge, GitPullRequestClosed, ImageIcon, Medal, Timer, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import { LeaderboardBoard } from "@/app/components/LeaderboardBoard";
import { listLeaderboardEntries } from "@/lib/reports";

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

  return (
    <div className="leaderboard-page">
      <section className="leaderboard-hero">
        <div className="leaderboard-hero-copy">
          <span className="page-kicker">Gittensor subnet 74 · image miners · official eval</span>
          <h1>Image miners compete on merged proof.</h1>
          <p>Every imported report is ranked by benchmark score, PR outcome, latency, and generation cost.</p>
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
            <span>{merged} merged</span>
          </div>
        </div>
      </section>

      <section className="leaderboard-stats">
        <HeroStat icon={<Medal size={18} />} label="Top score" value={topScore.toFixed(2)} />
        <HeroStat icon={<ImageIcon size={18} />} label="Avg score" value={averageScore.toFixed(1)} />
        <HeroStat icon={<Timer size={18} />} label="Fastest p95" value={`${fastest.toFixed(0)} ms`} />
        <HeroStat icon={<WalletCards size={18} />} label="Total cost" value={`$${totalCost.toFixed(4)}`} />
        <HeroStat icon={<GitMerge size={18} />} label="Merged PRs" value={String(merged)} />
        <HeroStat icon={<GitPullRequestClosed size={18} />} label="Failed/closed" value={String(failed)} />
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
            <small>{entry.benchmarkVersion}</small>
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
