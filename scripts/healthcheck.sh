#!/usr/bin/env bash
set -euo pipefail
curl -fsS http://localhost:4000/api/v1/health
curl -fsS http://localhost:4001/health
