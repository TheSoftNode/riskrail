#!/usr/bin/env bash
set -euo pipefail
corepack enable
corepack prepare pnpm@10.17.1 --activate
pnpm install
cp -n .env.example .env || true
pnpm infra:up
pnpm db:generate
printf '
RiskRail bootstrap complete. Run: pnpm db:migrate && pnpm dev
'
