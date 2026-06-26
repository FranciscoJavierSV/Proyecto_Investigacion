MANUAL - Proyecto_Investigacion
MANUAL - Proyecto_Investigacion

Objetivo

Este proyecto compara el rendimiento entre dos formas de ofrecer datos a aplicaciones:
- REST (APIs tradicionales)
- GraphQL (consulta flexible de campos)

También recoge métricas por petición para poder analizar por qué una u otra opción responde mejor.


Conceptos mínimos

- Docker: permite ejecutar la aplicación y las herramientas de monitorización sin instalar nada más.
- Logs: ficheros en la carpeta "logs" donde la aplicación guarda, por petición, tiempos y tamaños.
- Artillery: herramienta incluida para simular carga (hacer muchas peticiones y medir tiempos).

Qué hace el proyecto al ejecutarlo

- Inicia la aplicación con rutas REST y GraphQL.
- Expone métricas en `/metrics` para que Prometheus y Grafana las muestren.
- Guarda, en `logs/metrics.jsonl`, una línea JSON por petición con datos útiles para el análisis.

Preparación (requisitos)

1) Tener Docker y Docker Compose instalados si vas a usar contenedores. Si no los tienes, solicita ayuda para instalarlos.
2) Si no usas Docker, necesitas Node 18+ y acceso a la base de datos Mongo.

Arrancar todo (forma recomendada)

1) Abre una terminal y sitúate en la carpeta del proyecto.

2) Inicia los servicios escribiendo las dos órdenes siguientes (una tras otra):

cd Proyecto_Investigacion/docker
docker-compose up --build -d

3) Espera unos 30 segundos para que todo se inicie.

Comprobar que está en funcionamiento

Escribe esta orden para ver los contenedores y su estado:

docker ps --format "{{.Names}}\t{{.Status}}"

Pruebas rápidas para comprobar la aplicación

REST: manda una petición pequeña y verás el código HTTP y el tiempo que tardó:

curl -s -o /dev/null -w "REST ok: HTTP %{http_code} en %{time_total}s" "http://localhost:4000/rest/?size=10"

GraphQL: realiza una consulta pequeña y verás el código HTTP y el tiempo:

curl -s -X POST http://localhost:4000/graphql -H 'Content-Type: application/json' -d '{"query":"query { obtenerDataset(input: { limit: 10, offset: 0 }) { clientes { data { _id } } } }"}' -w "GraphQL ok: HTTP %{http_code} en %{time_total}s"

Ver los registros generados

La aplicación escribe dos archivos en `Proyecto_Investigacion/logs`:
- `Historial_metricas.log`: formato legible para personas.
- `metrics.jsonl`: cada línea es un JSON con métricas por petición (ideal para análisis automatizado).

Para ver las últimas líneas del fichero JSONL escribe:

tail -n 20 Proyecto_Investigacion/logs/metrics.jsonl

Y para ver las métricas que Prometheus expone, escribe:

curl -s http://localhost:4000/metrics | head -n 20

Cómo ejecutar las pruebas de rendimiento

Opción A — Pruebas secuenciales (automáticas)

1) Haz ejecutable el script y ejecútalo:

chmod +x scripts/benchmark.sh
./scripts/benchmark.sh

El resultado se apila en `logs/benchmark_runs.log` y las métricas por petición en `logs/metrics.jsonl`.

Opción B — Pruebas de concurrencia (carga) con Artillery

Los escenarios están en la carpeta `scripts/`:
- scripts/concurrencia-rest.yml (REST)
- scripts/concurrencia-graph.yml (GraphQL corta)
- scripts/concurrencia-graph-minimal.yml (GraphQL campos mínimos)
- scripts/concurrencia-graph-full.yml (GraphQL campos completos)

Para ejecutar una prueba y generar un informe:

npx artillery run scripts/concurrencia-graph-minimal.yml -o logs/artillery_graph_minimal.json
npx artillery report logs/artillery_graph_minimal.json -o logs/artillery_graph_minimal_report.html

Repite con los otros escenarios para comparar.

Analizar resultados (qué mirar)

1) Desde los logs por petición (`logs/metrics.jsonl`) verás campos como:
- `api_type`: REST o GraphQL
- `operation` o `query`
- `limit` / `offset`
- `requestedFields` (qué pidió GraphQL)
- `db_fetch_ms` (tiempo que tardó la base de datos)
- `serialize_ms` (tiempo en convertir la respuesta a JSON)
- `payload_bytes` (tamaño de la respuesta en bytes)
- `total_ms` (tiempo total de la petición)

2) Artillery: genera métricas agregadas (latencias p50/p95/p99, RPS, errores). Los informes HTML en `logs/` son fáciles de abrir en un navegador.

3) Recomendación para generar la documentación:
- Ejecuta cada escenario (REST, GraphQL minimal, GraphQL full).
- Ejecuta `node scripts/aggregate_metrics.js` para generar `logs/metrics_summary.json` con percentiles por tamaño.
- Combina los resultados de Artillery y `metrics_summary.json` para escribir conclusiones (p.ej. reducción de `serialize_ms` y `payload_bytes` cuando GraphQL pide menos campos).

Consejos prácticos

- Evita pedir datos masivos sin paginación: usa `limit` y `offset`.
- Si usas una base de datos externa, actualiza `Proyecto_Investigacion/.env` con la URI correcta antes de arrancar.
- Usa Grafana para monitor en tiempo real y los logs JSONL para análisis detallado y generar gráficos para el informe.

Si algo falla

1) Reiniciar la pila:

cd Proyecto_Investigacion/docker
docker-compose down
docker-compose up --build -d

2) Ver logs de la aplicación en tiempo real:

docker logs -f proyecto_app

Resumen final

- Encontrarás informes de carga (Artillery) y reportes HTML en `logs/`.
- `logs/metrics.jsonl` contiene registros por petición con `db_fetch_ms`, `serialize_ms`, `payload_bytes` y `requestedFields`.
- `logs/metrics_summary.json` contiene percentiles por tamaño para facilitar la documentación.

Si necesita asistencia adicional (exportar a PDF, incluir capturas o una versión GUI), contacte para coordinarlo.
npx artillery report logs/artillery_rest.json -o logs/artillery_rest_report.html

# GraphQL (corta / minimal / full)
npx artillery run scripts/concurrencia-graph.yml -o logs/artillery_graph.json
npx artillery report logs/artillery_graph.json -o logs/artillery_graph_report.html

npx artillery run scripts/concurrencia-graph-minimal.yml -o logs/artillery_graph_minimal.json
npx artillery report logs/artillery_graph_minimal.json -o logs/artillery_graph_minimal_report.html

npx artillery run scripts/concurrencia-graph-full.yml -o logs/artillery_graph_full.json
npx artillery report logs/artillery_graph_full.json -o logs/artillery_graph_full_report.html
```

5. Agregar métricas internas por la app (percentiles):

```bash
node scripts/aggregate_metrics.js
# salida: logs/metrics_summary.json
```

6. Correlacionar resultados externos (Artillery) con métricas internas (`logs/metrics.jsonl`): filtra por `api_type` y `limit` con `jq` o `grep` y compara `total_ms`, `db_fetch_ms`, `serialize_ms`.

Ejemplo de extracción (size=50):

```bash
# GraphQL size=50
jq 'select(.api_type=="graphql" and (.input.limit==50 or .params.size==50 or .params.limit==50))' logs/metrics.jsonl > logs/metrics_graphql_size50.jsonl

# REST size=50
jq 'select(.api_type=="rest" and (.params.size==50 or .params.limit==50))' logs/metrics.jsonl > logs/metrics_rest_size50.jsonl
```

Buenas prácticas y recomendaciones

- No solicitar respuestas masivas: usar paginación por `limit` y `offset` o cursores.
- En GraphQL pedir solo los campos necesarios (mejora significativa del `serialize_ms` y `payload_bytes`).
- Para dumps grandes, exportar a fichero en disco o S3 en vez de construir una única respuesta en memoria.

Contacto

Editar este `MANUAL.md` según cambios futuros en la instrumentación o los scripts de benchmark.
