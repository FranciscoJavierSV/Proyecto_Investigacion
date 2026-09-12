#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"
COMPOSE=(docker compose)

require_env() {
  if [[ ! -f .env ]]; then
    echo "Falta .env. Ejecuta: ./run.sh setup"
    exit 1
  fi
}

case "${1:-help}" in
  setup)
    if [[ -e .env ]]; then
      echo ".env ya existe; no se modifico."
    else
      cp .env.example .env
      echo ".env creado desde .env.example. Completa sus valores antes de continuar."
    fi
    ;;
  check)
    docker --version
    docker compose version
    docker info >/dev/null
    docker compose config --quiet
    echo "Docker y Compose estan listos."
    ;;
  build)
    docker compose config --quiet
    "${COMPOSE[@]}" --profile core --profile seed --profile comparison --profile research --profile monitoring --profile tools build
    ;;
  core)
    require_env
    "${COMPOSE[@]}" --profile core up --build -d
    ;;
  apis)
    require_env
    "${COMPOSE[@]}" --profile comparison --profile research up --build -d
    ;;
  monitoring)
    "${COMPOSE[@]}" --profile monitoring up -d
    ;;
  all)
    require_env
    "${COMPOSE[@]}" --profile core --profile comparison --profile research --profile monitoring up --build -d
    ;;
  seed)
    require_env
    "${COMPOSE[@]}" --profile seed run --rm seed
    ;;
  test)
    curl -fsS http://localhost:9464/ >/dev/null
    curl -fsS http://localhost:9464/metrics >/dev/null
    curl -fsS http://localhost:4000/health >/dev/null
    curl -fsS http://localhost:4000/metrics >/dev/null
    curl -fsS http://localhost:4001/metrics >/dev/null
    curl -fsS "http://localhost:4001/rest/?size=1" >/dev/null
    curl -fsS http://localhost:9090/-/ready >/dev/null
    curl -fsS http://localhost:3000/api/health >/dev/null
    echo "Servicios principales responden correctamente."
    ;;
  aggregate)
    "${COMPOSE[@]}" --profile tools run --rm tools node scripts/aggregate_metrics.js
    ;;
  artillery)
    "${COMPOSE[@]}" --profile tools run --rm tools npx artillery run scripts/concurrencia-rest.yml
    "${COMPOSE[@]}" --profile tools run --rm tools npx artillery run scripts/concurrencia-graph-minimal.yml
    "${COMPOSE[@]}" --profile tools run --rm tools npx artillery run scripts/concurrencia-graph-full.yml
    ;;
  benchmark)
    bash scripts/benchmark.sh 20
    ;;
  query)
    shift
    node scripts/query.js "$@"
    ;;
  benchmark-queries|benchmark-query)
    shift
    node scripts/benchmark_queries.js "$@"
    ;;
  scalability)
    shift
    node scripts/scalability_test.js "$@"
    ;;
  overfetching)
    shift
    node scripts/overfetching_test.js "$@"
    ;;
  stress)
    bash scripts/stress_test.sh
    ;;
  status)
    "${COMPOSE[@]}" ps
    ;;
  logs)
    "${COMPOSE[@]}" logs --tail=100 kafka consumer api-comparison research-api
    ;;
  ports)
    ss -ltnp | grep -E ':(3000|4000|4001|9090|9092|9464)' || true
    ;;
  down)
    "${COMPOSE[@]}" down
    ;;
  clean)
    "${COMPOSE[@]}" down -v
    ;;
  help|*)
    cat <<'EOF'
Uso: ./run.sh <accion>

setup       Crea .env solo si no existe
check       Comprueba Docker y Compose
build       Valida y construye imagenes
core        Inicia Kafka y consumer
apis        Inicia las dos APIs
monitoring  Inicia Prometheus y Grafana
all         Inicia todo excepto el seeder
seed        Genera e inserta datos
test        Comprueba los endpoints principales
query       Ejecuta consulta parametrizada
benchmark   Ejecuta benchmark REST vs GraphQL
benchmark-queries  Ejecuta benchmark de consultas REST vs GraphQL
scalability  Curva de escalabilidad por tamano de lote
overfetching Comparativa de over-fetching vs under-fetching
aggregate   Calcula el resumen de metricas
artillery   Ejecuta pruebas REST y GraphQL
stress      Ejecuta prueba concurrente
status      Muestra el estado
logs        Muestra logs recientes
ports       Muestra puertos ocupados
down        Detiene servicios
clean       Detiene y elimina volumenes
EOF
  exit 0
    ;;
esac
