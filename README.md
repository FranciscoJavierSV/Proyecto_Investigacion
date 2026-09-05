# BaseDR Docker integrado

Resumen rápido:

- Qué es: proyecto Docker que integra la ingesta (Kafka + consumer), las APIs (REST y GraphQL) y la pila de monitoreo (Prometheus + Grafana) para facilitar pruebas y demostraciones.
- Objetivo: levantar localmente todo el conjunto de servicios con un único comando para probar comparativas y métricas.
- Inicio rápido (desde la raíz del proyecto):

  ```bash
  cd <ruta_del_proyecto>
  docker compose --profile core --profile comparison --profile research --profile monitoring up --build -d
  ```

- Dashboards: 4 dashboards provisionados (ver MANUAL_USUARIO.md para descripciones y URLs).
- Manual detallado: seguir MANUAL_USUARIO.md y MANUAL_COMANDOS.md para procedimientos paso a paso, comandos y verificación de métricas.

## Dependencia externa

MongoDB es una dependencia configurable. Puede ser local o estar en otro servidor; cada servicio usa la URI definida en `.env`.

## Preparacion

```bash
cd <ruta_del_proyecto>
cp .env.example .env
# Editar solamente .env con los valores reales del túnel o credenciales locales (NO subir .env)
```

La URI debe ser alcanzable desde los contenedores. Para una Mongo instalada en el mismo equipo puede usarse `host.docker.internal` en lugar de `localhost`.

## Arranque completo

```bash
docker compose --profile core --profile comparison --profile research --profile monitoring up --build -d
```

Servicios publicados:

- API comparison: http://localhost:4000
- Research API GraphQL: http://localhost:4001/graphql
- Research API REST: http://localhost:4001/rest
- Consumer metrics: http://localhost:9464/metrics
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/admin)

Grafana carga automáticamente cuatro dashboards provisionados en `monitoring/dashboards/`. Los dashboards incluidos (accesibles en http://localhost:3000 cuando Grafana esté arriba) son:

- Insertion - REST (Carga masiva) — mide Ingestion/Consumer/Kafka/MongoDB. UID/URL de ejemplo: /d/consumer-metrics-dashboard/insertion-rest-carga-masiva
- Insertion Comparison - REST vs GraphQL (Mutations) — compara REST vs GraphQL. UID/URL de ejemplo: /d/rest-graphql-comparison/insertion-comparison-rest-vs-graphql-mutations
- Queries - GraphQL — UID/URL de ejemplo: /d/adlr9tc/queries-graphql
- Queries - REST — UID/URL de ejemplo: /d/rest-api-dashboard/queries-rest

Ajusta los slugs/UID si tu instancia de Grafana generó identificadores distintos.

## Generar datos

Con Kafka y consumer activos, ejecutar el seeder una sola vez cuando se necesite:

```bash
docker compose --profile seed run --rm seed
```

## Operacion

```bash
docker compose ps
docker compose logs -f consumer
docker compose logs -f research-api
docker compose down
```

No se crea MongoDB local ni se requiere una red Docker externa manual. Compose crea su red privada automáticamente.
