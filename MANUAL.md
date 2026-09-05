# Manual de ejecucion

## Arquitectura

- `data-ingestion`: Kafka, consumer y seeders.
- `api-comparison`: inserciones REST y GraphQL para comparar rendimiento.
- `research-api`: consultas REST/GraphQL y metricas detalladas.
- `monitoring`: Prometheus, Grafana y tres dashboards.

Todos los servicios comparten la red privada creada automáticamente por Docker Compose. La base MongoDB es externa y se alcanza por `host.docker.internal` mediante el túnel.

## Validar antes de usar Mongo

```bash
cd /home/deriker/ProyectoSS/BaseDR_Docker
docker compose config --quiet
docker compose build
```

Estas órdenes validan Compose y construyen imágenes sin ejecutar consultas a MongoDB.

## Iniciar por partes

```bash
# Kafka y consumer
docker compose --profile core up --build -d

# APIs
docker compose --profile comparison --profile research up --build -d

# Prometheus y Grafana
docker compose --profile monitoring up -d

# Seeder manual
docker compose --profile seed run --rm seed
```

Para iniciar todo en una orden:

```bash
docker compose --profile core --profile comparison --profile research --profile monitoring up --build -d
```

## Dashboards

Grafana importa automáticamente:

- `DashboardGraphQL.json`
- `DashboardGraphQL2.json`
- `DashboardRESTAPI.json`

El datasource se define en `monitoring/provisioning/datasources/prometheus.yml` y apunta a `http://prometheus:9090`.

## Detener

```bash
docker compose down
```

Los volúmenes de Kafka, Prometheus y Grafana se conservan. No usar `down -v` salvo que se quiera borrar ese estado.
