# imagent-ui

Web console for imported `imagent-bench` reports.

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
