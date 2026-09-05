# BaseDR Docker integrado

Unifica la ingesta Kafka, las dos APIs y el monitoreo en un solo proyecto Docker. Los proyectos originales no forman parte de esta carpeta y no se modifican.

## Dependencia externa

MongoDB es una dependencia configurable. Puede ser local o estar en otro servidor; cada servicio usa la URI definida en `.env`.

## Preparacion

```bash
cd /home/deriker/ProyectoSS/BaseDR_Docker
cp .env.example .env
# Editar solamente .env con los valores reales del tunel
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

Grafana carga automáticamente los tres dashboards de `monitoring/dashboards/`.

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
