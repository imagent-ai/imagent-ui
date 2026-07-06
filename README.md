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

## Deployment

For the public deployment on `https://tryimagent.com`, the repository includes
[`deploy/Caddyfile`](./deploy/Caddyfile). After updating DNS so both
`tryimagent.com` and `www.tryimagent.com` point at the server, validate and
reload Caddy from the server host:

```bash
cd ~/Documents/imagent-ai/imagent-ui
sudo caddy validate --config "$PWD/deploy/Caddyfile"
sudo caddy reload --config "$PWD/deploy/Caddyfile"
```

To avoid path mistakes and keep the service config in sync, prefer the bundled
deploy helper on the server host:

```bash
cd ~/Documents/imagent-ai/imagent-ui
npm run deploy:caddy
```

That command copies [`deploy/Caddyfile`](./deploy/Caddyfile) to
`/etc/caddy/Caddyfile`, validates it, reloads the `caddy` service, probes the
backend on `127.0.0.1:3002`, probes public HTTP/HTTPS for `tryimagent.com`, and
prints the recent TLS / ACME log lines.

If HTTPS still fails right after DNS changes, inspect the certificate issuance
logs and trigger a fresh retry:

```bash
sudo journalctl -u caddy -n 200 --no-pager
sudo systemctl reload caddy
```

The most common causes are:

- DNS not pointing both hostnames at the server yet;
- ports `80` and `443` not reachable from the public Internet;
- Caddy not being reloaded after the DNS cutover.
