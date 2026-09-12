#!/usr/bin/env node

// Comparativa de Over-fetching vs Under-fetching: REST vs GraphQL
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Procesa los argumentos para configurar el tamano de consulta y muestras
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    size: 100,
    samples: 10,
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
    } else if (arg === '--size' || arg === '-s') {
      options.size = parseInt(args[++i], 10) || 100;
    } else if (arg === '--samples' || arg === '-n') {
      options.samples = parseInt(args[++i], 10) || 10;
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
Uso: ./run.sh overfetching [opciones]
     node scripts/overfetching_test.js [opciones]

Parametros:
  -s, --size          Cantidad de registros por consulta (default: 100)
  -n, --samples       Numero de peticiones para promediar resultados (default: 10)
  -e, --endpoint      Entidad a comparar: clientes o productos (default: clientes)
  -p, --port          Puerto de research-api (default: 4001)
  --host              Host de research-api (default: localhost)
  -o, --output        Directorio de salida para los reportes (default: ./data)
  -h, --help          Muestra esta ayuda

Ejemplos:
  ./run.sh overfetching
  ./run.sh overfetching -s 500 -n 15
  ./run.sh overfetching -e productos -s 200
`);
}

// Genera las variantes de consulta GraphQL completa y con proyeccion reducida
function getGraphQLQueries(endpoint, size) {
  if (endpoint === 'productos') {
    const full = JSON.stringify({
      query: `
        query ProductosFull($input: DatasetInput) {
          obtenerDataset(input: $input) {
            tiempoMs
            productos { data { id descripcion precio activo } }
          }
        }
      `,
      variables: { input: { limit: size, offset: 0 } }
    });

    const minimal = JSON.stringify({
      query: `
        query ProductosMinimal($input: DatasetInput) {
          obtenerDataset(input: $input) {
            tiempoMs
            productos { data { id precio } }
          }
        }
      `,
      variables: { input: { limit: size, offset: 0 } }
    });

    return { full, minimal };
  }

  // Por defecto: clientes
  const full = JSON.stringify({
    query: `
      query ClientesFull($input: DatasetInput) {
        obtenerDataset(input: $input) {
          tiempoMs
          clientes { data { id nombre apepat apemat correo rfc tipoDePersona tipo activo fechaRegistro } }
        }
      }
    `,
    variables: { input: { limit: size, offset: 0 } }
  });

  const minimal = JSON.stringify({
    query: `
      query ClientesMinimal($input: DatasetInput) {
        obtenerDataset(input: $input) {
          tiempoMs
          clientes { data { id nombre } }
        }
      }
    `,
    variables: { input: { limit: size, offset: 0 } }
  });

  return { full, minimal };
}

// Realiza la peticion REST y mide la latencia y el tamano de la respuesta
async function executeRest(baseUrl, endpoint, size) {
  const url = `${baseUrl}/rest/${endpoint}?size=${size}&offset=0`;
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
    return { success: false, latency: t1 - t0, bytes: 0, error: err.message };
  }
}

// Realiza la peticion GraphQL y mide la latencia y el tamano de la respuesta
async function executeGraphQL(baseUrl, body) {
  const url = `${baseUrl}/graphql`;
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
    return { success: false, latency: t1 - t0, bytes: 0, error: err.message };
  }
}

// Evalua el impacto del over-fetching comparando el volumen de datos transferido
async function runOverfetchingTest() {
  const opts = parseArgs();
  if (opts.help) {
    printHelp();
    return;
  }

  const baseUrl = `http://${opts.host}:${opts.port}`;
  const { full: gqlFullBody, minimal: gqlMinBody } = getGraphQLQueries(opts.endpoint, opts.size);

  console.log(`=== Prueba de Over-fetching vs Under-fetching ===`);
  console.log(`Entidad evaluada  : ${opts.endpoint}`);
  console.log(`Registros / query : ${opts.size}`);
  console.log(`Muestras          : ${opts.samples}`);
  console.log(`Servidor objetivo : ${baseUrl}`);
  console.log(`-------------------------------------------------`);

  const restLatencies = [], restPayloads = [];
  const gqlFullLatencies = [], gqlFullPayloads = [];
  const gqlMinLatencies = [], gqlMinPayloads = [];

  for (let i = 0; i < opts.samples; i++) {
    const [rRes, gfRes, gmRes] = await Promise.all([
      executeRest(baseUrl, opts.endpoint, opts.size),
      executeGraphQL(baseUrl, gqlFullBody),
      executeGraphQL(baseUrl, gqlMinBody),
    ]);

    if (rRes.success) {
      restLatencies.push(rRes.latency);
      restPayloads.push(rRes.bytes);
    }
    if (gfRes.success) {
      gqlFullLatencies.push(gfRes.latency);
      gqlFullPayloads.push(gfRes.bytes);
    }
    if (gmRes.success) {
      gqlMinLatencies.push(gmRes.latency);
      gqlMinPayloads.push(gmRes.bytes);
    }
  }

  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const restAvgBytes = avg(restPayloads);
  const restAvgMs = avg(restLatencies);

  const gqlFullAvgBytes = avg(gqlFullPayloads);
  const gqlFullAvgMs = avg(gqlFullLatencies);

  const gqlMinAvgBytes = avg(gqlMinPayloads);
  const gqlMinAvgMs = avg(gqlMinLatencies);

  const bytesSavedVsRest = restAvgBytes - gqlMinAvgBytes;
  const pctSavedVsRest = restAvgBytes > 0 ? (bytesSavedVsRest / restAvgBytes) * 100 : 0;

  const bytesSavedVsGqlFull = gqlFullAvgBytes - gqlMinAvgBytes;
  const pctSavedVsGqlFull = gqlFullAvgBytes > 0 ? (bytesSavedVsGqlFull / gqlFullAvgBytes) * 100 : 0;

  console.log(`Resultados de consumo de red:`);
  console.log(`-----------------------------------------------------------------------------------------`);
  console.log(
    'Arquitectura / Escenario'.padEnd(28) +
    'Payload (Bytes)'.padEnd(18) +
    'Payload (KB)'.padEnd(15) +
    'Latencia Avg (ms)'.padEnd(20) +
    'Reduccion Ancho Banda'
  );
  console.log('-'.repeat(89));

  console.log(
    'REST (Todos los campos)'.padEnd(28) +
    restAvgBytes.toFixed(0).padEnd(18) +
    (restAvgBytes / 1024).toFixed(2).padEnd(15) +
    restAvgMs.toFixed(2).padEnd(20) +
    'Referencia (Base)'
  );

  console.log(
    'GraphQL (Todos los campos)'.padEnd(28) +
    gqlFullAvgBytes.toFixed(0).padEnd(18) +
    (gqlFullAvgBytes / 1024).toFixed(2).padEnd(15) +
    gqlFullAvgMs.toFixed(2).padEnd(20) +
    (restAvgBytes > 0 ? `${(((gqlFullAvgBytes - restAvgBytes) / restAvgBytes) * 100).toFixed(1)}%` : '-')
  );

  console.log(
    'GraphQL (Solo campos clave)'.padEnd(28) +
    gqlMinAvgBytes.toFixed(0).padEnd(18) +
    (gqlMinAvgBytes / 1024).toFixed(2).padEnd(15) +
    gqlMinAvgMs.toFixed(2).padEnd(20) +
    `-${pctSavedVsRest.toFixed(1)}% vs REST`
  );
  console.log('-'.repeat(89));

  console.log(`\nAnalisis de Over-fetching:`);
  console.log(`- GraphQL Minimal redujo un ${pctSavedVsRest.toFixed(1)}% el tamano del payload transferido respecto a REST.`);
  console.log(`- Bytes ahorrados por consulta (${opts.size} registros): ${(bytesSavedVsRest / 1024).toFixed(2)} KB.`);
  if (opts.size > 0) {
    const bytesPerDocSaved = bytesSavedVsRest / opts.size;
    console.log(`- Ahorro estimado para 1,000,000 registros: ${((bytesPerDocSaved * 1000000) / (1024 * 1024)).toFixed(2)} MB en red.`);
  }

  // Guardar datos
  if (!fs.existsSync(opts.outputDir)) {
    fs.mkdirSync(opts.outputDir, { recursive: true });
  }

  const results = {
    endpoint: opts.endpoint,
    size: opts.size,
    samples: opts.samples,
    scenarios: {
      rest_full: { bytes: restAvgBytes, kb: restAvgBytes / 1024, latency_ms: restAvgMs },
      graphql_full: { bytes: gqlFullAvgBytes, kb: gqlFullAvgBytes / 1024, latency_ms: gqlFullAvgMs },
      graphql_minimal: { bytes: gqlMinAvgBytes, kb: gqlMinAvgBytes / 1024, latency_ms: gqlMinAvgMs },
    },
    savings_vs_rest: {
      bytes: bytesSavedVsRest,
      percentage: pctSavedVsRest,
    },
    savings_vs_graphql_full: {
      bytes: bytesSavedVsGqlFull,
      percentage: pctSavedVsGqlFull,
    }
  };

  const jsonFile = path.join(opts.outputDir, 'overfetching_results.json');
  fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));

  const csvFile = path.join(opts.outputDir, 'overfetching_results.csv');
  const csvContent = [
    'scenario,bytes,kb,latency_ms,savings_pct_vs_rest',
    `rest_full,${restAvgBytes.toFixed(0)},${(restAvgBytes / 1024).toFixed(2)},${restAvgMs.toFixed(2)},0.0`,
    `graphql_full,${gqlFullAvgBytes.toFixed(0)},${(gqlFullAvgBytes / 1024).toFixed(2)},${gqlFullAvgMs.toFixed(2)},${(((gqlFullAvgBytes - restAvgBytes) / restAvgBytes) * 100).toFixed(1)}`,
    `graphql_minimal,${gqlMinAvgBytes.toFixed(0)},${(gqlMinAvgBytes / 1024).toFixed(2)},${gqlMinAvgMs.toFixed(2)},-${pctSavedVsRest.toFixed(1)}`
  ].join('\n') + '\n';

  fs.writeFileSync(csvFile, csvContent);

  console.log(`\nArchivos de resultados guardados:`);
  console.log(`- JSON: ${jsonFile}`);
  console.log(`- CSV : ${csvFile}\n`);
}

runOverfetchingTest();
