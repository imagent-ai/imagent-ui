import { promises as fs } from "fs";
import path from "path";

export type Artifact = {
  type: string;
  path: string;
  sha256: string;
  media_type: string | null;
};

export type CaseResult = {
  id: string;
  numeric_id: number;
  prompt: string;
  capability: string;
  status: "pass" | "fail" | "error";
  score: number;
  latency_ms: number;
  cost_usd: number;
  checks: Array<Record<string, unknown>>;
  artifacts: Artifact[];
  error?: string | null;
};

export type BenchmarkReport = {
  schema_version: "1.0";
  run_id: string;
  repository: string;
  commit_sha: string;
  pull_request?: PullRequestMetadata | null;
  contributor?: ContributorMetadata | null;
  benchmark_version: string;
  dataset_version: string;
  status: "pass" | "fail";
  overall_score: number;
  metrics: {
    overall_score: number;
    case_count: number;
    failed_case_count: number;
    latency_ms: {
      min: number;
      max: number;
      mean: number;
    };
    latency_p95_ms: number;
    cost_usd: number;
  };
  cases: CaseResult[];
  artifacts: Artifact[];
  logs: Artifact[];
  configuration: {
    agent_manifest: {
      id?: string;
      name?: string;
      version?: string;
      entrypoint?: string;
    };
    agent_config: Record<string, unknown>;
    execution: Record<string, unknown>;
  };
  policy: {
    passed: boolean;
    reasons: string[];
    thresholds: Record<string, unknown>;
  };
  started_at: string;
  completed_at: string;
  execution_time_ms: number;
};

export type ContributorMetadata = {
  login: string;
  name?: string | null;
  avatar_url?: string | null;
  html_url?: string | null;
};

export type PullRequestMetadata = {
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  html_url?: string | null;
  merged_at?: string | null;
  closed_at?: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  runId: string;
  agentName: string;
  repository: string;
  commitSha: string;
  score: number;
  status: BenchmarkReport["status"];
  latencyP95Ms: number;
  costUsd: number;
  benchmarkVersion: string;
  completedAt: string;
  contributor: Required<Pick<ContributorMetadata, "login">> & Omit<ContributorMetadata, "login">;
  pullRequest: PullRequestMetadata;
};

const reportsDir = path.join(process.cwd(), "data", "reports");

export async function listReports(): Promise<BenchmarkReport[]> {
  await fs.mkdir(reportsDir, { recursive: true });
  const names = await fs.readdir(reportsDir);
  const reports = await Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => readReport(path.join(reportsDir, name)))
  );
  return reports
    .filter((report): report is BenchmarkReport => report !== null)
    .sort((left, right) => {
      if (right.overall_score !== left.overall_score) {
        return right.overall_score - left.overall_score;
      }
      return Date.parse(right.completed_at) - Date.parse(left.completed_at);
    });
}

export async function getReport(runId: string): Promise<BenchmarkReport | null> {
  const reports = await listReports();
  return reports.find((report) => report.run_id === runId) ?? null;
}

export async function listLeaderboardEntries(): Promise<LeaderboardEntry[]> {
  const reports = await listReports();
  return reports.map((report, index) => toLeaderboardEntry(report, index + 1));
}

export function toLeaderboardEntry(report: BenchmarkReport, rank = 1): LeaderboardEntry {
  const agentName = report.configuration.agent_manifest.name || report.configuration.agent_manifest.id || "Image Agent";
  const contributor = normalizeContributor(report);
  const pullRequest = normalizePullRequest(report);
  return {
    rank,
    runId: report.run_id,
    agentName,
    repository: report.repository,
    commitSha: report.commit_sha,
    score: report.overall_score,
    status: report.status,
    latencyP95Ms: report.metrics.latency_p95_ms,
    costUsd: report.metrics.cost_usd,
    benchmarkVersion: report.benchmark_version,
    completedAt: report.completed_at,
    contributor,
    pullRequest
  };
}

async function readReport(filePath: string): Promise<BenchmarkReport | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as BenchmarkReport;
    if (parsed.schema_version !== "1.0" || !parsed.run_id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function normalizeContributor(report: BenchmarkReport): LeaderboardEntry["contributor"] {
  if (report.contributor?.login) {
    return {
      login: report.contributor.login,
      name: report.contributor.name ?? report.contributor.login,
      avatar_url: report.contributor.avatar_url ?? avatarFor(report.contributor.login),
      html_url: report.contributor.html_url ?? `https://github.com/${report.contributor.login}`
    };
  }

  const fallbackLogin = repositoryOwner(report.repository) || "local-miner";
  return {
    login: fallbackLogin,
    name: fallbackLogin,
    avatar_url: avatarFor(fallbackLogin),
    html_url: `https://github.com/${fallbackLogin}`
  };
}

function normalizePullRequest(report: BenchmarkReport): PullRequestMetadata {
  if (report.pull_request?.number) {
    return {
      number: report.pull_request.number,
      title: report.pull_request.title || `Benchmark run ${report.run_id}`,
      state: report.pull_request.state || (report.status === "pass" ? "merged" : "closed"),
      html_url: report.pull_request.html_url ?? null,
      merged_at: report.pull_request.merged_at ?? null,
      closed_at: report.pull_request.closed_at ?? null
    };
  }

  const fallbackNumber = stableNumber(report.run_id);
  return {
    number: fallbackNumber,
    title: `${report.benchmark_version} ${report.status === "pass" ? "accepted" : "rejected"}`,
    state: report.status === "pass" ? "merged" : "closed",
    html_url: repositoryUrl(report.repository, fallbackNumber),
    merged_at: report.status === "pass" ? report.completed_at : null,
    closed_at: report.status === "fail" ? report.completed_at : null
  };
}

function avatarFor(login: string) {
  const initials = login
    .split(/[-_\s]+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "IA";
  const colors = ["#04183b", "#0358bc", "#0478e8", "#0aa6d8", "#1dd9f5"];
  const fill = colors[stableNumber(login) % colors.length];
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">',
    `<rect width="96" height="96" rx="24" fill="${fill}"/>`,
    `<text x="48" y="56" text-anchor="middle" font-family="JetBrains Mono, Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="#fff">${escapeSvg(initials)}</text>`,
    "</svg>"
  ].join("");
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeSvg(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stableNumber(value: string) {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) % 9000;
  }
  return hash + 100;
}

function repositoryUrl(repository: string, prNumber: number) {
  if (!repositoryOwner(repository)) {
    return null;
  }
  return `https://github.com/${repository}/pull/${prNumber}`;
}

function repositoryOwner(repository: string) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    return null;
  }
  return repository.split("/")[0];
}
