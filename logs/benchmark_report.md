# Informe de benchmark

Fecha: 2026-06-24T18:01:48.437Z

## Resumen comparativo

Archivo CSV: logs/artillery_comparison.csv

|API|Requests|200s|Failures|Success %|Mean ms|p50 ms|p95 ms|p99 ms|Downloaded bytes|
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
|GraphQL|3000|3000|0|100.00|131.7|115.6|237.5|361.5|13320000|
|REST|3000|2571|429|85.70|511.5|242.3|1587.9|3984.7|593614002|

## Métricas instrumentadas (resumen)

El archivo `logs/metrics_summary.json` contiene percentiles de `total_ms`, `db_fetch_ms`, `serialize_ms` y `ttfb_ms` por endpoint/size.

Extracto:

{
  "unknown::unknown": {
    "count": 28766,
    "total_ms": {
      "p50": 92.66499999999999,
      "p95": 537.2634999999988,
      "p99": 2748.515299999998
    },
    "db_fetch_ms": {
      "p50": 92.655,
      "p95": 537.2609999999987,
      "p99": 2748.5052999999984
    },
    "serialize_ms": {
      "p50": 2.76,
      "p95": 11.020499999999993,
      "p99": 28.485699999999852
    },
    "ttfb_ms": {
      "p50": null,
      "p95": null,
      "p99": null
    }
  }
}


## Observaciones rápidas

- GraphQL (10 rps × 5 min) mostró menor latencia media y menos p95/p99 comparado con REST en esta máquina de prueba.
- REST experimentó `ERR_SOCKET_TIMEOUT` y mayor variabilidad en p95/p99; parte de las solicitudes fallaron (ver CSV).
- Las razones pueden incluir diferencias en tamaño de payload, serialización y número de operaciones internas. Revisar `logs/metrics_summary.json` para ver `serialize_ms` y `db_fetch_ms`.

---
Generado automáticamente.
