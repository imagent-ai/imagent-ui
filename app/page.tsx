import { ArrowRight, BarChart3, BrainCircuit, GitPullRequestArrow, ImageIcon, RadioTower, Search, Trophy, Workflow } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { IMAGENT_GENERATION_MODEL_NAME } from "@/lib/models";
import { listLeaderboardEntries } from "@/lib/reports";

export const metadata: Metadata = {
  title: "Imagent | Image Generation Agents",
  description: "Open platform for image-generation agents that plan, reason, generate, benchmark, and compete through Gittensor-powered rounds.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Imagent | Image Generation Agents",
    description: "Open platform for image-generation agents that plan, reason, generate, benchmark, and compete through Gittensor-powered rounds.",
    url: "/"
  }
};

export const dynamic = "force-dynamic";

const capabilities = [
  {
    icon: Workflow,
    title: "Plan before generation",
    copy: "Convert underspecified requests into an explicit generation trajectory before the image model runs."
  },
  {
    icon: BrainCircuit,
    title: "Reason over context",
    copy: "Resolve arithmetic, structure, style constraints, memory, and hidden requirements that a one-shot prompt can miss."
  },
  {
    icon: Search,
    title: "Ground missing details",
    copy: "Treat the user prompt as partial context and build the missing generation context before rendering."
  }
];

export default async function HomePage() {
  const entries = await listLeaderboardEntries();
  const leader = entries[0] ?? null;
  const eligible = entries.filter((entry) => entry.improvement.mergeEligible).length;
  const merged = entries.filter((entry) => entry.pullRequest.state === "merged").length;

  return (
    <div className="product-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="page-kicker">Built through Gittensor · image agents · fixed model</span>
          <h1>Image generation should be an agent problem.</h1>
          <p>
            Imagent is an open platform for researching image-generation agents that plan, reason,
            gather context, generate, critique, and compete on measurable benchmark improvement.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" href="/generation">
              Try generation <ArrowRight size={16} />
            </Link>
            <Link className="secondary-action" href="/leaderboard">
              View leaderboard <BarChart3 size={16} />
            </Link>
            <Link className="secondary-action" href="/whitepaper">
              Read whitepaper <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="home-system-card" aria-label="Imagent system overview">
          <div className="system-card-top">
            <span>runtime trajectory</span>
            <strong>{leader ? `#${leader.rank}` : "open"}</strong>
          </div>
          <div className="system-orbit">
            <span>plan</span>
            <span>reason</span>
            <span>ground</span>
            <span>generate</span>
            <span>score</span>
          </div>
          <div className="system-model">
            <ImageIcon size={18} />
            <div>
              <strong>{IMAGENT_GENERATION_MODEL_NAME}</strong>
              <small>fixed OpenRouter image model</small>
            </div>
          </div>
          <div className="system-ledger">
            <span>{entries.length} reports</span>
            <span>{eligible} eligible</span>
            <span>{merged} merged</span>
          </div>
        </div>
      </section>

      <section className="product-stats" aria-label="Imagent benchmark status">
        <ProductStat label="Top score" value={leader ? leader.score.toFixed(2) : "0.00"} detail={leader ? `@${leader.contributor.login}` : "waiting for reports"} />
        <ProductStat label="Project delta" value={leader ? formatDelta(leader.improvement.delta) : "N/A"} detail="score over baseline" />
        <ProductStat label="Fixed model" value="Gemini 3.1" detail="Flash Image via OpenRouter" />
        <ProductStat label="Gittensor" value="SN74" detail="open contributor loop" />
      </section>

      <section className="product-section split" id="why">
        <div>
          <span className="section-eyebrow">Why Imagent</span>
          <h2>One-shot prompting leaves too much context outside the model.</h2>
          <p>
            Real image requests are often implicit, multi-step, or dependent on missing information.
            Imagent turns generation into a runtime process: identify the gap, construct the context,
            call the image model, evaluate the result, and improve the agent.
          </p>
        </div>
        <div className="capability-grid">
          {capabilities.map((item) => {
            const Icon = item.icon;
            return (
              <article className="capability-card" key={item.title}>
                <Icon size={20} />
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="product-section">
        <div className="section-heading">
          <span className="section-eyebrow">How It Works</span>
          <h2>A public agent competition around one fixed image model.</h2>
        </div>
        <div className="workflow-row">
          <WorkflowStep index="01" title="Contributors submit agent code" copy="PRs compete by changing the agent strategy, not the underlying image model." />
          <WorkflowStep index="02" title="Benchmarks score improvement" copy="Reports measure prompt alignment, quality, text accuracy, composition, and baseline delta." />
          <WorkflowStep index="03" title="Winners become public reference code" copy="The best threshold-passing agent is promoted, archived, and visible for future contributors." />
        </div>
      </section>

      <section className="product-section gittensor-panel">
        <div>
          <span className="section-eyebrow">Powered by Gittensor</span>
          <h2>Open-source image-agent research with market-style feedback.</h2>
          <p>
            Imagent makes the Gittensor relationship visible: contributors submit agent improvements,
            benchmark rounds rank the work, and winning implementations become public artifacts.
          </p>
        </div>
        <div className="gittensor-mark">
          <RadioTower size={30} />
          <strong>SN74</strong>
          <span>benchmark · contributor PRs · merged proof</span>
        </div>
      </section>

      <section className="product-cta">
        <Trophy size={24} />
        <h2>Build the next winning image-generation agent.</h2>
        <p>Start with the playground, inspect the leaderboard, then read the whitepaper for architecture and roadmap.</p>
        <div className="hero-actions">
          <Link className="primary-action" href="/generation">Generate now <ArrowRight size={16} /></Link>
          <Link className="secondary-action" href="/whitepaper">Read the whitepaper <GitPullRequestArrow size={16} /></Link>
        </div>
      </section>
    </div>
  );
}

function ProductStat({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="product-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function WorkflowStep({ copy, index, title }: { copy: string; index: string; title: string }) {
  return (
    <article className="workflow-step">
      <span>{index}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
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
