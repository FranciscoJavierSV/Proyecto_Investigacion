#!/usr/bin/env node

// Prueba de escalabilidad y degradacion por tamano de lote (REST vs GraphQL)
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Procesa los argumentos para configurar la lista de tamanos de lote y muestras
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    steps: [10, 50, 100, 500, 1000, 2500, 5000, 10000],
    samples: 5,
    endpoint: 'clientes',
    host: process.env.RESEARCH_HOST || 'localhost',
    port: process.env.RESEARCH_PORT || '4001',
    outputDir: path.resolve(__dirname, '..', 'data'),
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--steps') {
      const raw = args[++i];
      if (raw) {
        options.steps = raw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
      }
    } else if (arg === '--samples' || arg === '-n') {
      options.samples = parseInt(args[++i], 10) || 5;
    } else if (arg === '--endpoint' || arg === '-e') {
      options.endpoint = args[++i]?.toLowerCase();
    } else if (arg === '--port' || arg === '-p') {
      options.port = args[++i];
    } else if (arg === '--host') {
      options.host = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      options.outputDir = path.resolve(args[++i]);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Uso: ./run.sh scalability [opciones]
     node scripts/scalability_test.js [opciones]

Parametros:
  --steps             Lista separada por comas de tamanos de lote (default: 10,50,100,500,1000,2500,5000,10000)
  -n, --samples       Numero de peticiones por cada paso (default: 5)
  -e, --endpoint      Coleccion en REST: clientes, productos, facturas, all (default: clientes)
  -p, --port          Puerto de research-api (default: 4001)
  --host              Host de research-api (default: localhost)
  -o, --output        Directorio de salida para los reportes (default: ./data)
  -h, --help          Muestra esta ayuda

Ejemplos:
  ./run.sh scalability
  ./run.sh scalability --steps 10,100,1000,5000 -n 3
  ./run.sh scalability --endpoint all --steps 50,200,500
`);
}

// Calcula percentiles a partir de un conjunto ordenado de latencias
function calculatePercentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

// Prepara la consulta GraphQL adecuada segun la coleccion y el tamano de lote
function buildGraphQLBody(collection, size) {
  let query;
  if (collection === 'clientes') {
    query = `
      query DatasetClientes($input: DatasetInput) {
        obtenerDataset(input: $input) {
          tiempoMs
          clientes { data { id nombre apepat apemat correo rfc activo } }
        }
      }
    `;
  } else if (collection === 'productos') {
    query = `
      query DatasetProductos($input: DatasetInput) {
        obtenerDataset(input: $input) {
          tiempoMs
          productos { data { id descripcion precio activo } }
        }
      }
    `;
  } else {
    query = `
      query DatasetFull($input: DatasetInput) {
        obtenerDataset(input: $input) {
          tiempoMs
          clientes { data { id nombre correo rfc activo } }
          facturas { data { id serie folio total } }
          datosfacturas { data { id precio_total iva_total descuento } }
          productos { data { id descripcion precio } }
          variaciones { data { id descripcion } }
        }
      }
    `;
  }

  return JSON.stringify({
    query,
    variables: { input: { limit: size, offset: 0 } }
  });
}

// Ejecuta la consulta REST para el tamano de lote indicado y mide la respuesta
async function requestRest(baseUrl, endpoint, size) {
  const pathPart = endpoint === 'all' ? '/rest/' : `/rest/${endpoint}`;
  const url = `${baseUrl}${pathPart}?size=${size}&offset=0`;
  const t0 = performance.now();
  try {
    const res = await fetch(url, { method: 'GET' });
    const text = await res.text();
    const t1 = performance.now();
    return {
      success: res.ok,
      latency: t1 - t0,
      bytes: Buffer.byteLength(text, 'utf8'),
      status: res.status,
    };
  } catch (err) {
    const t1 = performance.now();
    return {
      success: false,
      latency: t1 - t0,
      bytes: 0,
      error: err.message,
    };
  }
}

// Ejecuta la consulta GraphQL para el tamano de lote indicado y mide la respuesta
async function requestGraphQL(baseUrl, collection, size) {
  const url = `${baseUrl}/graphql`;
  const body = buildGraphQLBody(collection, size);
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const text = await res.text();
    const t1 = performance.now();
    return {
      success: res.ok,
      latency: t1 - t0,
      bytes: Buffer.byteLength(text, 'utf8'),
      status: res.status,
    };
  } catch (err) {
    const t1 = performance.now();
    return {
      success: false,
      latency: t1 - t0,
      bytes: 0,
      error: err.message,
    };
  }
}

// Ejecuta las pruebas progresivas por tamano de lote y genera los reportes JSON y CSV
async function runScalabilityTest() {
  const opts = parseArgs();
  if (opts.help) {
    printHelp();
    return;
  }

  const baseUrl = `http://${opts.host}:${opts.port}`;

  console.log(`=== Curva de escalabilidad: REST vs GraphQL ===`);
  console.log(`Coleccion objetivo : ${opts.endpoint}`);
  console.log(`Pasos (batch sizes): ${opts.steps.join(', ')}`);
  console.log(`Muestras por paso  : ${opts.samples}`);
  console.log(`Servidor objetivo  : ${baseUrl}`);
  console.log(`------------------------------------------------`);

  const results = [];

  for (const step of opts.steps) {
    process.stdout.write(`Evaluando batch size = ${step.toString().padEnd(6)} ... `);

    const restLatencies = [];
    const restPayloads = [];
    let restErrors = 0;

    const gqlLatencies = [];
    const gqlPayloads = [];
    let gqlErrors = 0;

    for (let i = 0; i < opts.samples; i++) {
      const [rRes, gRes] = await Promise.all([
        requestRest(baseUrl, opts.endpoint, step),
        requestGraphQL(baseUrl, opts.endpoint, step),
      ]);

      if (rRes.success) {
        restLatencies.push(rRes.latency);
        restPayloads.push(rRes.bytes);
      } else {
        restErrors++;
      }

      if (gRes.success) {
        gqlLatencies.push(gRes.latency);
        gqlPayloads.push(gRes.bytes);
      } else {
        gqlErrors++;
      }
    }

    const calcStats = (latencies, payloads, errors) => {
      const count = latencies.length;
      if (count === 0) {
        return { avg: 0, p50: 0, p95: 0, avgKb: 0, errors };
      }
      const sum = latencies.reduce((a, b) => a + b, 0);
      const avg = sum / count;
      const p50 = calculatePercentile(latencies, 50);
      const p95 = calculatePercentile(latencies, 95);
      const avgKb = (payloads.reduce((a, b) => a + b, 0) / count) / 1024;
      return { avg, p50, p95, avgKb, errors };
    };

    const rStats = calcStats(restLatencies, restPayloads, restErrors);
    const gStats = calcStats(gqlLatencies, gqlPayloads, gqlErrors);

    results.push({
      batchSize: step,
      rest: rStats,
      graphql: gStats,
    });

    console.log(`REST avg: ${rStats.avg.toFixed(1)}ms | GQL avg: ${gStats.avg.toFixed(1)}ms`);
  }

  console.log(`\nResumen de la curva de escalabilidad:`);
  console.log(`-----------------------------------------------------------------------------------------`);
  console.log(
    'Batch Size'.padEnd(12) +
    'REST Avg (ms)'.padEnd(15) +
    'REST p95 (ms)'.padEnd(15) +
    'REST (KB)'.padEnd(12) +
    'GQL Avg (ms)'.padEnd(15) +
    'GQL p95 (ms)'.padEnd(15) +
    'GQL (KB)'
  );
  console.log('-'.repeat(89));

  for (const row of results) {
    console.log(
      String(row.batchSize).padEnd(12) +
      row.rest.avg.toFixed(2).padEnd(15) +
      row.rest.p95.toFixed(2).padEnd(15) +
      row.rest.avgKb.toFixed(2).padEnd(12) +
      row.graphql.avg.toFixed(2).padEnd(15) +
      row.graphql.p95.toFixed(2).padEnd(15) +
      row.graphql.avgKb.toFixed(2)
    );
  }
  console.log('-'.repeat(89));

  // Guardar datos en disco
  if (!fs.existsSync(opts.outputDir)) {
    fs.mkdirSync(opts.outputDir, { recursive: true });
  }

  const jsonFile = path.join(opts.outputDir, 'scalability_results.json');
  fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));

  const csvFile = path.join(opts.outputDir, 'scalability_results.csv');
  const csvHeader = 'batch_size,rest_avg_ms,rest_p50_ms,rest_p95_ms,rest_payload_kb,rest_errors,gql_avg_ms,gql_p50_ms,gql_p95_ms,gql_payload_kb,gql_errors\n';
  const csvRows = results.map(r => [
    r.batchSize,
    r.rest.avg.toFixed(2),
    r.rest.p50.toFixed(2),
    r.rest.p95.toFixed(2),
    r.rest.avgKb.toFixed(2),
    r.rest.errors,
    r.graphql.avg.toFixed(2),
    r.graphql.p50.toFixed(2),
    r.graphql.p95.toFixed(2),
    r.graphql.avgKb.toFixed(2),
    r.graphql.errors,
  ].join(',')).join('\n');

  fs.writeFileSync(csvFile, csvHeader + csvRows + '\n');

  console.log(`\nArchivos de resultados guardados:`);
  console.log(`- JSON: ${jsonFile}`);
  console.log(`- CSV : ${csvFile}\n`);
}

runScalabilityTest();
