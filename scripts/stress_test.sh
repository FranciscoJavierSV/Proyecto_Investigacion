#!/bin/bash

API_URL="http://localhost:4000"

echo "=== Lanzando 1000 inserciones REST (clientes) ==="
for i in $(seq 1 1000); do
  curl -s -X POST "$API_URL/rest/insert/cliente" \
    -H "Content-Type: application/json" \
    -d "{\"nombre\":\"Cliente$i\",\"email\":\"cliente$i@example.com\",\"ciudad\":\"CDMX\"}" >/dev/null &
done

echo "=== Lanzando 1000 inserciones GraphQL (clientes) ==="
for i in $(seq 1 1000); do
  curl -s -X POST "$API_URL/graphql" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"mutation { insertCliente(nombre:\\\"ClienteG$i\\\", email:\\\"clienteG$i@example.com\\\", ciudad:\\\"GDL\\\") { success message insertedId } }\"}" >/dev/null &
done

wait
echo "Prueba completada. Revisa Prometheus y Grafana."