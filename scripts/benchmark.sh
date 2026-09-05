#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:4000"
REST_CLIENTE_URL="$BASE_URL/rest/insert/cliente"
GRAPHQL_URL="$BASE_URL/graphql"
REPEAT=${1:-20}

printf "Benchmark REST vs GraphQL inserts (%s requests each)\n" "$REPEAT"

time_rest=0
count_rest=0
for i in $(seq 1 "$REPEAT"); do
  start=$(date +%s%3N)
  curl -sS -X POST -H 'Content-Type: application/json' -d '{"nombre":"Cliente'$i'","email":"cliente'$i'@example.com","ciudad":"Ciudad'$i'"}' "$REST_CLIENTE_URL" >/dev/null
  end=$(date +%s%3N)
  delta=$((end - start))
  time_rest=$((time_rest + delta))
  count_rest=$((count_rest + 1))
done

export LC_ALL=C
printf "REST inserts: %s requests completed\n" "$count_rest"
printf "REST total time: %sms\n" "$time_rest"
rest_avg=$(awk "BEGIN { printf \"%.2f\", $time_rest / $count_rest }")
printf "REST avg latency: %sms\n" "$rest_avg"

time_graphql=0
count_graphql=0
for i in $(seq 1 "$REPEAT"); do
  start=$(date +%s%3N)
  curl -sS -X POST -H 'Content-Type: application/json' -d '{"query":"mutation { insertCliente(nombre:\"GraphQL '$i'\", email:\"graphql'$i'@example.com\", ciudad:\"Ciudad '$i'\"){success message insertedId}}"}' "$GRAPHQL_URL" >/dev/null
  end=$(date +%s%3N)
  delta=$((end - start))
  time_graphql=$((time_graphql + delta))
  count_graphql=$((count_graphql + 1))
done

printf "GraphQL inserts: %s requests completed\n" "$count_graphql"
printf "GraphQL total time: %sms\n" "$time_graphql"
graphql_avg=$(awk "BEGIN { printf \"%.2f\", $time_graphql / $count_graphql }")
printf "GraphQL avg latency: %sms\n" "$graphql_avg"

printf "\nFetching current /metrics snapshot...\n"
curl -sS "$BASE_URL/metrics" | tail -n 40
