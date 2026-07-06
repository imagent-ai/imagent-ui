# imagent-ui

Web console for imported `imagent-bench` reports.

## Gittensor Relationship

Imagent is being built through Gittensor. This website makes that relationship
clear without requiring visitors to know Discord context or subnet shorthand:
the generation playground, benchmark leaderboard, and imported reports all
represent the open image-agent competition that Gittensor helps power.

The public site at `https://tryimagent.com` explains that contributors submit
agent improvements through GitHub PRs, benchmark rounds score those
submissions, and winning agents become public reference code in the Imagent
repository.

## Development

```bash
npm install
npm run dev
```

Import a benchmark report:

```bash
npm run import-report -- ../imagent-bench/benchmark-output/benchmark-report.json
```

The UI reads JSON reports from `data/reports`. It does not execute official
benchmark runs; official results are produced by `imagent-bench`.
