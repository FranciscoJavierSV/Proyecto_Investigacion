Manual de Usuario — BaseDR_Docker

Objetivo
Este manual muestra, de forma directa y práctica, cómo preparar el proyecto para una presentación usando los scripts incluidos. Está redactado para un usuario con conocimientos básicos de terminal.

Nota: reemplaza <ruta_del_proyecto> por la ubicación real donde hayas descargado o clonado este proyecto en tu equipo.

Resumen rapido
- Levantar la pila: ./run.sh all (usa docker compose con perfiles).
- Ver metricas: /metrics en las APIs.
- Dashboards: Grafana en http://localhost:3000.
- Agregados/evidencia: ./run.sh aggregate genera un resumen en services/research-api/logs/metrics_summary.json.

Pasos mínimos (ordenados)
1. Abrir terminal y situarse en la carpeta del proyecto:
   cd <ruta_del_proyecto>

2. Comprobar que existe .env (no incluir credenciales en la presentación):
   ls -la .env

3. Levantar servicios (recomendado: usar el helper incluido):
   COMPOSE_PROFILES=core,monitoring,comparison,research,tools ./run.sh all

4. Verificar servicios:
   docker ps
   - Grafana: http://localhost:3000
   - Prometheus: http://localhost:9090
   - API metrics: curl -sS http://localhost:4001/metrics | head -n 20

Sección: Evidencia generada (qué archivos/volúmenes se crean cuando se ejecutan los procesos)
Nota: esta lista indica los artefactos que el proyecto genera durante ejecución y dónde encontrarlos; no son pasos a ejecutar.

1) Resumen agregado (archivo generado por el helper):
   - services/research-api/logs/metrics_summary.json
   - Contenido: agregados de latencias, counts, y métricas que resultan de los benchmarks/seed/lecturas cuando se ejecuta ./run.sh aggregate.

2) Series históricas de métricas (TSDB de Prometheus):
   - Volumen Docker: prometheus_data (montado en el contenedor Prometheus como /prometheus)
   - Contenido: series temporales (historial de scrapes) que permiten calcular p95/p99 y otros percentiles.

3) Dashboards provisionados y metadatos de Grafana:
   - Archivos provisionados en el repositorio: <ruta_del_proyecto>/monitoring/dashboards/
   - Volumen Docker de Grafana (persistencia): grafana_data (contiene la sqlite y datos de Grafana)

4) Reglas de Prometheus (recording & alerts):
   - <ruta_del_proyecto>/monitoring/rules/recording_and_alerts.yml
   - Al ejecutar Prometheus, estas reglas se cargan y generan series grabadas (recording rules) en la TSDB.

5) Logs y series de métricas en bruto (servicios):
   - <ruta_del_proyecto>/services/research-api/logs/  (métricas en formato jsonl, logs de requests, metrics.jsonl)
   - Contenido ejemplo: metrics.jsonl, requests.log, metrics_summary.json (cuando se genera)

6) Resultados de benchmarks / carga (si se ejecutan los scripts de benchmark):
   - Ubicaciones típicas: <ruta_del_proyecto>/logs/artillery_*.json o <ruta_del_proyecto>/tools/logs/ (según script usado)
   - Contenido: JSON de Artillery o archivos de salida de benchmark con latencias, throughput y resultados por petición.

7) Datos de MongoDB (si Mongo se ejecuta como servicio en el compose):
   - Volumen Docker: mongo_data (si está definido en docker-compose)
   - Contenido: la base de datos real donde quedan insertados los registros generados por seed/insert.
   - Si la conexión usa un Mongo externo, la persistencia depende de esa instancia externa (no se crea volumen local).

8) Docker compose y configuración usados en la ejecución:
   - docker-compose.yml: <ruta_del_proyecto>/docker-compose.yml
   - monitoring/prometheus.yml: <ruta_del_proyecto>/monitoring/prometheus.yml

9) Dashboards JSON de exportacion (si se exportan desde Grafana o se copian):
   - <ruta_del_proyecto>/monitoring/dashboards/ (JSON provisionados en el repo)
   - Estos archivos representan la configuración de los paneles que verá el profesor.

Fin de la seccion Evidencia generada.

Comprobaciones básicas (comandos cortos)
- Ver targets de Prometheus:
  curl -sS http://localhost:9090/api/v1/targets

- Confirmar métrica db_fetch_duration_ms está expuesta por la API:
  curl -sS http://localhost:4001/metrics | grep db_fetch_duration_ms -n

- Ver el resumen agregado (si existe):
  less services/research-api/logs/metrics_summary.json

Detener servicios (al terminar la presentación)
- ./run.sh down
- Para limpiar volúmenes (elimina datos persistidos): ./run.sh clean

Fin del Manual de Usuario.
