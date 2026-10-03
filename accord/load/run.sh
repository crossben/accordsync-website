#!/usr/bin/env bash
# One load-test run: fresh database, server with rate limits off, k6 for 60 s.
#   load/run.sh 100            → load/results/vus-100.json and a one-line summary
#   WORKERS=4 load/run.sh 200  → same, with 4 server processes
set -euo pipefail
cd "$(dirname "$0")/.."
V=${1:?usage: load/run.sh <devices>}
docker compose down -v >/dev/null 2>&1 || true
ACCORD_RATE_LIMIT=off ACCORD_WORKERS="${WORKERS:-1}" docker compose up -d --build --wait >/dev/null
curl -sf localhost:8080/health >/dev/null
docker run --rm --network host -v "$PWD/load:/load" grafana/k6:1.3.0 run -q \
  -e VUS="$V" -e DURATION="${DURATION:-60s}" --summary-export "/load/results/vus-$V.json" \
  /load/k6/sync.js >/dev/null 2>&1 || true
python3 - "$V" <<'PY'
import json, sys
v = sys.argv[1]
d = json.load(open(f"load/results/vus-{v}.json"))["metrics"]
p, q = d["accord_push_ms"], d["accord_pull_ms"]
print(f"{v} devices: ops/s {d['accord_ops_pushed']['rate']:.0f}  push p50 {p['med']:.0f} p95 {p['p(95)']:.0f} p99 {p['p(99)']:.0f} ms  "
      f"pull p50 {q['med']:.0f} p95 {q['p(95)']:.0f} ms  failed {d['http_req_failed']['value']*100:.2f}%  checks {d['checks']['value']*100:.2f}%")
PY
