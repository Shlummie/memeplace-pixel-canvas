# Memeplace Monorepo

Memeplace is a pnpm monorepo containing a Next.js web client and a Fastify API server. Users burn SPL tokens on Solana Devnet to paint pixels onto a shared 1000x1000 canvas. Redis stores tile buffers, Postgres stores placement history, and WebSockets broadcast live diffs.

## Packages

- `apps/web` – Next.js 14 App Router client with Solana wallet connect, canvas UI, burn-to-paint flow, and WebSocket client.
- `apps/server` – Fastify TypeScript server exposing REST API and WebSocket endpoints, integrating Redis and Postgres.
- `packages/shared` – Shared types and commit hashing utilities.

## Prerequisites

- Node.js 18+
- pnpm (Corepack recommended)
- Docker (for Postgres/Redis)

## Quickstart

1. Install dependencies: `pnpm install`.
2. Launch Postgres + Redis: `pnpm infra:up`.
3. Run migrations (e.g. `pnpm --filter server migrate` or `pnpm migrate`).
4. Populate `apps/web/.env.local` and `apps/server/.env` with RPC, mint, and costs.
5. Start both apps: `pnpm dev:all`.
6. Visit `http://localhost:3000` to place pixels.
7. Tail services with `pnpm infra:logs` and inspect Postgres rows as pixels land.

The web app runs on `http://localhost:3000`, server on `http://localhost:3001`.

## Environment Variables

Copy the example env files and adjust values. Both web and server default to Solana devnet.

- `apps/web/.env.example`
- `apps/server/.env.example`

Key variables:

- `MEME_MINT`: SPL token mint used for burns.
- `PIXEL_COST`: lamports cost per pixel.
- `PIXEL_COST` only changes between seasons; use `/v1/config` to fetch the active season label and cost.
- `RPC_URL`: Solana RPC endpoint (Devnet).

## Devnet Mint Setup

Run this script to prepare devnet and mint a zero-decimal token:

```bash
solana config set --url https://api.devnet.solana.com
solana airdrop 2
spl-token create-token --decimals 0
spl-token create-account <MINT>
spl-token mint <MINT> 1000000
```

After minting, copy the `<MINT>` address printed by the CLI into `apps/web/.env.local` as `NEXT_PUBLIC_MEME_MINT` and into `apps/server/.env` as `MEME_MINT` so both services reference the same token.

When the mint uses zero decimals, credits resolve as `credits = burned_raw / PIXEL_COST`.

## Database & Cache

Start services:

```bash
docker-compose up -d
```

Run migrations:

```bash
pnpm run migrate
```

## Scripts

- `pnpm run dev:web` – Start web client.
- `pnpm run dev:server` – Start Fastify server.
- `pnpm run dev:all` – Start web and server in parallel.
- `pnpm run infra:up` – Boot Postgres/Redis via Docker Compose.
- `pnpm run infra:logs` – Follow Docker Compose logs.
- `pnpm run lint` – Lint workspace.
- `pnpm run typecheck` – Type-check all packages.
- `pnpm run test` – Run unit tests.
- `pnpm run migrate` – Run database migrations via server script.

## Testing

- Shared hashing utility tests: `pnpm --filter @memeplace/shared test`.
- Server decoder tests: `pnpm --filter server test`.
- Web client tests: `pnpm --filter web test`.

## Architecture Overview

### Web Client

- Solana wallet integration using `@solana/wallet-adapter`.
- Zustand store manages tiles, zoom, pan, and active color.
- Canvas renders 100x100 tiles (each tile 100x100 pixels) via `<canvas>`.
- WebSocket client listens for live diffs to update tiles.
- Burn-to-paint flow: user submits token burn + memo, commit sent to `/v1/submit`.

### Server

- Fastify with REST `/v1/submit`, `/v1/tile/:id` and WebSocket `/ws`.
- Validates Solana burn transaction: checks memo, signature, SPL burn instruction.
- Applies pixel batches to Redis tile buffers and records placements in Postgres.
- Uses shared commit hashing to ensure deterministic commits.

## Future Improvements

- Detailed burn verification with on-chain memo parsing.
- Real-time diff broadcasting and reconciliation.
- Advanced canvas tools (selection, history).
- Comprehensive integration tests.

## Production Deployment

### Build Images

1. Ensure `.env` files exist for web (`apps/web/.env.production`, copy from `env.production.sample`) and server (`apps/server/.env`, copy from `env.production.sample`) with production RPC URL, mememint, and database credentials.
2. Build containers:
   - `docker compose -f compose.prod.yml build`

### Single VM Setup

1. Provision a VM with Docker and docker-compose plugin installed.
2. Copy the repository (or required files) to `/opt/memeplace` on the VM.
3. Configure environment files and persistent volumes (`postgres-data`).
4. Start services:
   - `docker compose -f compose.prod.yml up -d`
5. Run migrations inside the server container:
   - `docker compose -f compose.prod.yml exec server pnpm --filter server migrate`
6. Verify health:
   - `curl http://<vm-ip>/` should render the web UI.
   - `curl http://<vm-ip>/v1/config` should return JSON.

### Reverse Proxy & Logs

- Nginx in `compose.prod.yml` proxies `/` to the web container and `/ws`, `/v1` to the server, preserving upgrade headers for WebSockets.
- Health checks ping web root and `/v1/config` to ensure liveness before routing traffic.
- Configure log rotation on the VM (e.g. `/etc/logrotate.d/nginx` and Docker default logging) to cap growth:
  ```
  /var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    missingok
    copytruncate
  }
  ```
- Backups: the `backups` service runs hourly `pg_dump` and Redis snapshot uploads to `s3://$S3_BUCKET/...`. Provide AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `S3_BUCKET`) via environment variables or secrets.

### SSL Termination

- For HTTPS, attach certbot or a managed certificate in front of the VM, or extend the Nginx config with TLS directives and mount certificates into the container.

### Monitoring & Alerts

- `compose.prod.yml` includes Prometheus and the blackbox exporter. Prometheus scrapes the blackbox module every 30s to confirm web (`/`) and API (`/v1/config`) endpoints are reachable.
- Default alert rule `ServiceDown` fires after 2 minutes of probe failures. Hook this into your alerting channel by running Alertmanager or integrating the Prometheus webhook with your paging tool.
- To customize targets or thresholds, edit `infra/prometheus/prometheus.yml` and `infra/prometheus/alerts.yml`, then reload Prometheus (`POST /-/reload`).
- Blackbox Prometheus target monitors `/v1/config` which also implicitly covers `/v1/tile/:id` availability; tile fetches are rate-limited per IP to prevent scraping abuse.
- WebSocket endpoint `/ws` streams tile diffs without auth; consider running behind Cloudflare/NGINX IP filtering or adding API tokens if exposed beyond trusted clients.


