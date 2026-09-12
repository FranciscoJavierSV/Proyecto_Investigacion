#!/usr/bin/env bash
set -euo pipefail
node "$(dirname "$0")/benchmark_queries.js" "$@"
