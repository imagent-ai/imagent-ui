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
  dimensions?: Record<string, unknown> | null;
  judge?: Record<string, unknown> | null;
  error?: string | null;
};

export type RankingMetadata = {
  baseline_score?: number | null;
  baseline_commit?: string | null;
  candidate_score?: number | null;
  delta?: number | null;
  label?: string | null;
  merge_eligible?: boolean | null;
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
  ranking?: RankingMetadata | null;
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
  dimensions: Array<{
    name: string;
    score: number;
  }>;
  improvement: {
    baselineScore: number | null;
    baselineCommit: string | null;
    candidateScore: number;
    delta: number | null;
    label: string;
    mergeEligible: boolean;
    source: "ranking" | "history" | "none";
  };
  judgeModel: string | null;
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
  const historicalBaselines = buildHistoricalBaselines(reports);
  return reports.map((report, index) => toLeaderboardEntry(report, index + 1, historicalBaselines.get(report.run_id) ?? null));
}

export function toLeaderboardEntry(report: BenchmarkReport, rank = 1, historicalBaselineScore: number | null = null): LeaderboardEntry {
  const agentName = report.configuration.agent_manifest.name || report.configuration.agent_manifest.id || "Image Agent";
  const contributor = normalizeContributor(report);
  const pullRequest = normalizePullRequest(report);
  const improvement = normalizeImprovement(report, historicalBaselineScore);
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
    dimensions: normalizeDimensions(report),
    improvement,
    judgeModel: normalizeJudgeModel(report),
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

function buildHistoricalBaselines(reports: BenchmarkReport[]) {
  const baselines = new Map<string, number | null>();
  const chronological = [...reports].sort((left, right) => Date.parse(left.completed_at) - Date.parse(right.completed_at));
  let bestScore: number | null = null;

  for (const report of chronological) {
    baselines.set(report.run_id, bestScore);
    if (Number.isFinite(report.overall_score)) {
      bestScore = bestScore === null ? report.overall_score : Math.max(bestScore, report.overall_score);
    }
  }

  return baselines;
}

function normalizeImprovement(report: BenchmarkReport, historicalBaselineScore: number | null): LeaderboardEntry["improvement"] {
  const ranking = report.ranking ?? null;
  const candidateScore = finiteNumber(ranking?.candidate_score) ?? report.overall_score;
  const baselineScore = finiteNumber(ranking?.baseline_score) ?? historicalBaselineScore;
  const delta = finiteNumber(ranking?.delta) ?? (baselineScore === null ? null : candidateScore - baselineScore);
  const label = normalizeImprovementLabel(ranking?.label, delta, baselineScore);
  const mergeEligible = typeof ranking?.merge_eligible === "boolean"
    ? ranking.merge_eligible
    : Boolean(report.status === "pass" && delta !== null && delta > 0);

  return {
    baselineScore,
    baselineCommit: ranking?.baseline_commit ?? null,
    candidateScore,
    delta,
    label,
    mergeEligible,
    source: ranking ? "ranking" : baselineScore === null ? "none" : "history"
  };
}

function normalizeImprovementLabel(label: unknown, delta: number | null, baselineScore: number | null) {
  if (typeof label === "string" && label.trim()) {
    return label.trim();
  }
  if (baselineScore === null || delta === null) {
    return "baseline-unavailable";
  }
  if (delta < 0) {
    return "score-regression";
  }
  if (delta >= 10) {
    return "improvement-major";
  }
  if (delta >= 5) {
    return "improvement-strong";
  }
  if (delta > 0) {
    return "improvement-minor";
  }
  return "unchanged";
}

function normalizeDimensions(report: BenchmarkReport): LeaderboardEntry["dimensions"] {
  const totals = new Map<string, { count: number; total: number }>();

  for (const item of report.cases) {
    if (!item.dimensions || Array.isArray(item.dimensions)) {
      continue;
    }
    Object.entries(item.dimensions).forEach(([name, value]) => {
      const score = finiteNumber(value);
      if (score === null) {
        return;
      }
      const existing = totals.get(name) ?? { count: 0, total: 0 };
      existing.count += 1;
      existing.total += score;
      totals.set(name, existing);
    });
  }

  return Array.from(totals.entries())
    .map(([name, value]) => ({
      name,
      score: value.count > 0 ? value.total / value.count : 0
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeJudgeModel(report: BenchmarkReport) {
  for (const item of report.cases) {
    const model = stringFromRecord(item.judge, "model") ?? stringFromRecord(item.judge, "provider");
    if (model) {
      return model;
    }
  }

  const imageJudge = report.configuration.agent_config?.evaluation;
  if (isRecord(imageJudge)) {
    const nested = imageJudge.image_judge;
    if (isRecord(nested)) {
      return stringFromRecord(nested, "model") ?? stringFromRecord(nested, "provider");
    }
  }

  return null;
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringFromRecord(value: unknown, key: string) {
  if (!isRecord(value)) {
    return null;
  }
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
