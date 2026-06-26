#!/usr/bin/env bash
set -euo pipefail

# Simple benchmark runner (host). Requirements: curl, jq. Artillery optional (npx artillery).
# Run from host: ./scripts/benchmark.sh

ROOT_DIR="/home/javi/Proyecto_Investigacion"
DOCKER_DIR="$ROOT_DIR/docker"
METRICS_FILE="$ROOT_DIR/logs/metrics.jsonl"
OUT_LOG="$ROOT_DIR/logs/benchmark_runs.log"

mkdir -p "$ROOT_DIR/logs"
echo "Benchmark run started: $(date -Iseconds)" >> "$OUT_LOG"

echo "Starting docker stack..."
cd "$DOCKER_DIR"
docker-compose up --build -d

echo "Waiting for app to be ready (checking logs)..."
ready=false
for i in {1..30}; do
  if docker logs proyecto_app 2>&1 | grep -q "Servidor corriendo"; then
    ready=true
    break
  fi
  sleep 2
done
if [ "$ready" = false ]; then
  echo "Warning: app did not show ready log. Proceeding anyway." | tee -a "$OUT_LOG"
fi

SIZES=(10 100 1000 5000 10000)
ITER=3

for size in "${SIZES[@]}"; do
  echo "--- size=$size ---" | tee -a "$OUT_LOG"
  for i in $(seq 1 $ITER); do
    ts=$(date -Iseconds)
    rest_out=$(curl -s -w "%{http_code} %{time_total}" -o /dev/null "http://localhost:4000/rest/?size=${size}") || rest_out="ERR"
    echo "$ts REST size=$size iter=$i $rest_out" | tee -a "$OUT_LOG"

    gql_payload=$(cat <<EOF
{"query":"query { obtenerDataset(input: { limit: ${size} }) { clientes { data { _id } } } }"}
EOF
)
    gql_out=$(curl -s -X POST http://localhost:4000/graphql -H 'Content-Type: application/json' -d "$gql_payload" -w " %{http_code} %{time_total}" -o /dev/null) || gql_out="ERR"
    echo "$ts GRAPHQL limit=$size iter=$i $gql_out" | tee -a "$OUT_LOG"
    sleep 1
  done
done

echo "Optional: running Artillery concurrency tests if npx available..." | tee -a "$OUT_LOG"
cd "$ROOT_DIR"
if command -v npx >/dev/null 2>&1; then
  echo "Running concurrency REST (concurrencia-rest.yml)" | tee -a "$OUT_LOG"
  npx artillery run scripts/concurrencia-rest.yml | tee -a "$OUT_LOG"
  echo "Running concurrency GraphQL (concurrencia-graph.yml)" | tee -a "$OUT_LOG"
  npx artillery run scripts/concurrencia-graph.yml | tee -a "$OUT_LOG"
else
  echo "npx not found on host. To run Artillery inside the container, execute:" | tee -a "$OUT_LOG"
  echo "  docker exec -it proyecto_app npx artillery run /usr/src/app/scripts/concurrencia-rest.yml" | tee -a "$OUT_LOG"
  echo "  docker exec -it proyecto_app npx artillery run /usr/src/app/scripts/concurrencia-graph.yml" | tee -a "$OUT_LOG"
fi

echo "Benchmark finished: $(date -Iseconds)" | tee -a "$OUT_LOG"
echo "Logs: $OUT_LOG" | tee -a "$OUT_LOG"

exit 0
