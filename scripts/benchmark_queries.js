#!/usr/bin/env node

// Benchmark comparativo de consultas: REST vs GraphQL hacia research-api
const { performance } = require('perf_hooks');

// Interpreta los argumentos de la linea de comandos para configurar el benchmark
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    requests: 20,
    size: 50,
    offset: 0,
    concurrency: 1,
    endpoint: 'all',
    fields: 'full',
    mode: 'alternate',
    host: process.env.RESEARCH_HOST || 'localhost',
    port: process.env.RESEARCH_PORT || '4001',
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--requests' || arg === '-n') {
      options.requests = parseInt(args[++i], 10) || 20;
    } else if (arg === '--size' || arg === '-s' || arg === '--limit' || arg === '-l') {
      options.size = parseInt(args[++i], 10) || 50;
    } else if (arg === '--offset' || arg === '-o') {
      options.offset = parseInt(args[++i], 10) || 0;
    } else if (arg === '--concurrency' || arg === '-c') {
      options.concurrency = parseInt(args[++i], 10) || 1;
    } else if (arg === '--endpoint' || arg === '-e') {
      options.endpoint = args[++i]?.toLowerCase();
    } else if (arg === '--fields' || arg === '-f') {
      options.fields = args[++i]?.toLowerCase();
    } else if (arg === '--mode' || arg === '-m') {
      options.mode = args[++i]?.toLowerCase();
    } else if (arg === '--port' || arg === '-p') {
      options.port = args[++i];
    } else if (arg === '--host') {
      options.host = args[++i];
    } else if (!isNaN(parseInt(arg, 10)) && i === 0) {
      options.requests = parseInt(arg, 10);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Uso: ./run.sh benchmark-queries [opciones]
     node scripts/benchmark_queries.js [opciones]

Parametros:
  -n, --requests      Numero de consultas por arquitectura (default: 20)
  -s, --size          Cantidad de registros por consulta (default: 50)
  -o, --offset        Offset de inicio para la consulta (default: 0)
  -c, --concurrency   Concurrencia (default: 1, secuencial)
  -e, --endpoint      [REST] Coleccion: all, clientes, productos, etc. (default: all)
  -f, --fields        [GraphQL] Campos: full, minimal, clientes, etc. (default: full)
  -m, --mode          alternate (intercalado) o batch (default: alternate)
  -p, --port          Puerto de research-api (default: 4001)
  -h, --help          Muestra esta ayuda

Ejemplos:
  ./run.sh benchmark-queries 30
  ./run.sh benchmark-queries -n 50 -s 100
  ./run.sh benchmark-queries -n 25 -s 50 -e clientes -f minimal
  ./run.sh benchmark-queries -n 100 -s 20 -c 5
`);
}

// Prepara el cuerpo JSON con la consulta y variables para GraphQL
function buildGraphQLBody(size, offset, fields) {
  let query;
  if (fields === 'minimal') {
    query = `
      query DatasetMinimal($input: DatasetInput) {
        obtenerDataset(input: $input) {
          tiempoMs
          clientes { data { id nombre } }
          productos { data { id descripcion precio } }
        }
      }
    `;
  } else if (fields === 'clientes') {
    query = `
      query DatasetClientes($input: DatasetInput) {
        obtenerDataset(input: $input) {
          tiempoMs
          clientes { data { id nombre correo rfc activo } }
        }
      }
    `;
  } else {
    query = `
      query DatasetFull($input: DatasetInput) {
        obtenerDataset(input: $input) {
          tiempoMs
          
          clientes { 
            data { 
              _id id nombre apepat apemat correo rfc tipoDePersona tipo 
              _type activo fechaRegistro telefonos listaPrecios 
              direccionEnvio direccionFacturacion saldoAFavor 
              historialListaPrecios _idSucursal _idEmpresa _idUsuario 
              _idAccesoUsuario rutaFoto nombreFoto 
            } 
          }
          
          facturas { 
            data { 
              _id id _idCliente fecha activo subtotal descuento iva total 
              observaciones _idSucursal _idEmpresa _idUsuario 
              _idAccesoUsuario formaDePago moneda tipoDeComprobante 
              usoDelCFDI metodoDePago _idArchivoFiscal serie folio uuid 
              version ieps retencionIeps tieneRetencionIeps tipoDeCambio _type 
            } 
          }
          
          datosfacturas { 
            data { 
              _id id _idFactura claveProdServ claveUnidad total_retenciones 
              iva_total descuento iva_unitario precio_total precio_unitario 
              producto detalle cantidad_producto por_iva_unitario ret_iva 
              ret_isr cantidad_dcto trasladoIeps porcentajeTrasladoIeps 
              tieneTrasladoIeps retencionIeps porcentajeRetencionIeps 
              tieneRetencionIeps _idEmpresa _type 
            } 
          }
          
          productos { 
            data { 
              _id id fechaRegistro activo nombre descripcion tieneVariaciones 
              incluyeIva registroLote controlLote ingresoRapido proveedores 
              historialProveedores _idCSat_ClaveUnidad _idCSat_ClaveProdServ 
              porcentajeIva porcentajeIvaCosto costoIncluyeIva incluirDescuento 
              _idSucursal _idEmpresa _idUsuario _idAccesoUsuario _idMoneda 
              _idMonedaCosto precio costo _type 
            } 
          }
          
          variaciones { 
            data { 
              _id id fechaRegistro activo tieneColores default nombre 
              descripcion upc colores imagenes precios especificaciones 
              equivalencias _idProducto _idSucursal _idEmpresa _idUsuario 
              _idAccesoUsuario _type 
            } 
          }
          
        }
      }
    `;
  }

  return JSON.stringify({
    query,
    variables: {
      input: {
        limit: size,
        offset: offset,
      },
    },
  });
}

// Obtiene el percentil deseado a partir de un arreglo ordenado de valores
function calculatePercentile(sortedArray, p) {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
}

// Consolida las metricas de rendimiento, latencia y tamano de respuesta
function summarizeStats(latencies, payloadSizes, totalWallTimeMs, errorsCount) {
  const count = latencies.length;
  if (count === 0) {
    return {
      total: errorsCount,
      success: 0,
      errors: errorsCount,
      avg: 0,
      min: 0,
      max: 0,
      p50: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      avgPayloadKb: 0,
      throughput: 0,
    };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avg = sum / count;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p50 = calculatePercentile(sorted, 50);
  const p90 = calculatePercentile(sorted, 90);
  const p95 = calculatePercentile(sorted, 95);
  const p99 = calculatePercentile(sorted, 99);

  const payloadSum = payloadSizes.reduce((acc, v) => acc + v, 0);
  const avgPayloadKb = (payloadSum / count / 1024);
  const throughput = (count / (totalWallTimeMs / 1000));

  return {
    total: count + errorsCount,
    success: count,
    errors: errorsCount,
    avg,
    min,
    max,
    p50,
    p90,
    p95,
    p99,
    avgPayloadKb,
    throughput,
  };
}

// Ejecuta una consulta REST individual midiendo duracion y tamano
async function executeSingleRest(baseUrl, endpoint, size, offset) {
  const path = endpoint === 'all' ? '/rest/' : `/rest/${endpoint}`;
  const url = `${baseUrl}${path}?size=${size}&offset=${offset}`;
  const t0 = performance.now();
  try {
    const res = await fetch(url, { method: 'GET' });
    const text = await res.text();
    const t1 = performance.now();
    if (!res.ok) {
      return { success: false, latency: t1 - t0, bytes: 0, error: `HTTP ${res.status}` };
    }
    return { success: true, latency: t1 - t0, bytes: Buffer.byteLength(text, 'utf8') };
  } catch (err) {
    const t1 = performance.now();
    return { success: false, latency: t1 - t0, bytes: 0, error: err.message };
  }
}

// Ejecuta una consulta GraphQL individual midiendo duracion y tamano
async function executeSingleGraphQL(baseUrl, body) {
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

    if (!res.ok) {
      return { success: false, latency: t1 - t0, bytes: 0, error: `HTTP ${res.status}` };
    }
    return { success: true, latency: t1 - t0, bytes: Buffer.byteLength(text, 'utf8') };
  } catch (err) {
    const t1 = performance.now();
    return { success: false, latency: t1 - t0, bytes: 0, error: err.message };
  }
}

// Controla la ejecucion de tareas respetando el limite de concurrencia
async function runWorkerPool(tasks, concurrency) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const currentIndex = index++;
      const task = tasks[currentIndex];
      const res = await task();
      results[currentIndex] = res;
    }
  }

  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

// Calcula el porcentaje de diferencia entre dos mediciones
function formatDiff(valRest, valGql, higherIsBetter = false) {
  if (!valRest || !valGql) return '-';
  const pct = ((valGql - valRest) / valRest) * 100;
  const sign = pct >= 0 ? '+' : '';
  const formatted = `${sign}${pct.toFixed(1)}%`;
  if (Math.abs(pct) < 0.1) return '0.0%';

  if (higherIsBetter) {
    return pct > 0 ? `${formatted} (GQL superior)` : `${formatted} (REST superior)`;
  } else {
    return pct > 0 ? `${formatted} (REST mas rapido)` : `${formatted} (GQL mas rapido)`;
  }
}

// Orquesta la ejecucion completa del benchmark y presenta el reporte comparativo
async function runBenchmark() {
  const opts = parseArgs();
  if (opts.help) {
    printHelp();
    return;
  }

  const baseUrl = `http://${opts.host}:${opts.port}`;

  console.log(`=== Benchmark de consultas: REST vs GraphQL ===`);
  console.log(`Peticiones por API: ${opts.requests}`);
  console.log(`Size por consulta : ${opts.size}`);
  console.log(`Offset base       : ${opts.offset}`);
  console.log(`Concurrencia      : ${opts.concurrency}`);
  console.log(`Modo              : ${opts.mode}`);
  console.log(`Target            : ${baseUrl}`);
  console.log(`------------------------------------------------`);

  const gqlBody = buildGraphQLBody(opts.size, opts.offset, opts.fields);

  const restLatencies = [];
  const restPayloads = [];
  let restErrors = 0;

  const gqlLatencies = [];
  const gqlPayloads = [];
  let gqlErrors = 0;

  const wallStart = performance.now();
  let restTotalMs = null;
  let gqlTotalMs = null;

  if (opts.mode === 'alternate') {
    const pairedTasks = [];
    for (let i = 0; i < opts.requests; i++) {
      pairedTasks.push(async () => {
        const [rRes, gRes] = await Promise.all([
          executeSingleRest(baseUrl, opts.endpoint, opts.size, opts.offset),
          executeSingleGraphQL(baseUrl, gqlBody),
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
      });
    }
    await runWorkerPool(pairedTasks, opts.concurrency);
  } else {
    // MODO BATCH: REST
    const rStart = performance.now();
    const restTasks = Array.from({ length: opts.requests }, () => () => executeSingleRest(baseUrl, opts.endpoint, opts.size, opts.offset));
    const rResults = await runWorkerPool(restTasks, opts.concurrency);
    const rEnd = performance.now();
    restTotalMs = rEnd - rStart;

    for (const r of rResults) {
      if (r.success) {
        restLatencies.push(r.latency);
        restPayloads.push(r.bytes);
      } else {
        restErrors++;
      }
    }

    // MODO BATCH: GraphQL
    const gStart = performance.now();
    const gqlTasks = Array.from({ length: opts.requests }, () => () => executeSingleGraphQL(baseUrl, gqlBody));
    const gResults = await runWorkerPool(gqlTasks, opts.concurrency);
    const gEnd = performance.now();
    gqlTotalMs = gEnd - gStart;

    for (const g of gResults) {
      if (g.success) {
        gqlLatencies.push(g.latency);
        gqlPayloads.push(g.bytes);
      } else {
        gqlErrors++;
      }
    }
  }

  const wallEnd = performance.now();
  const totalWallMs = wallEnd - wallStart;

  // En modo alternate, los tiempos individuales no se miden por separado; se usa el total de pared.
  const rStats = summarizeStats(restLatencies, restPayloads, restTotalMs ?? totalWallMs, restErrors);
  const gStats = summarizeStats(gqlLatencies, gqlPayloads, gqlTotalMs ?? totalWallMs, gqlErrors);

  console.log(`\nResultados comparativos:`);
  console.log(`--------------------------------------------------------------------------------`);

  const rows = [
    ['Peticiones Totales', `${rStats.total}`, `${gStats.total}`, '-'],
    ['Peticiones Exitosas', `${rStats.success} (${((rStats.success / rStats.total) * 100 || 0).toFixed(1)}%)`, `${gStats.success} (${((gStats.success / gStats.total) * 100 || 0).toFixed(1)}%)`, '-'],
    ['Errores', `${rStats.errors}`, `${gStats.errors}`, '-'],
    ['Latencia Promedio', `${rStats.avg.toFixed(2)} ms`, `${gStats.avg.toFixed(2)} ms`, formatDiff(rStats.avg, gStats.avg)],
    ['Mediana (p50)', `${rStats.p50.toFixed(2)} ms`, `${gStats.p50.toFixed(2)} ms`, formatDiff(rStats.p50, gStats.p50)],
    ['Percentil 90 (p90)', `${rStats.p90.toFixed(2)} ms`, `${gStats.p90.toFixed(2)} ms`, formatDiff(rStats.p90, gStats.p90)],
    ['Percentil 95 (p95)', `${rStats.p95.toFixed(2)} ms`, `${gStats.p95.toFixed(2)} ms`, formatDiff(rStats.p95, gStats.p95)],
    ['Percentil 99 (p99)', `${rStats.p99.toFixed(2)} ms`, `${gStats.p99.toFixed(2)} ms`, formatDiff(rStats.p99, gStats.p99)],
    ['Latencia Mínima', `${rStats.min.toFixed(2)} ms`, `${gStats.min.toFixed(2)} ms`, formatDiff(rStats.min, gStats.min)],
    ['Latencia Máxima', `${rStats.max.toFixed(2)} ms`, `${gStats.max.toFixed(2)} ms`, formatDiff(rStats.max, gStats.max)],
    ['Payload Promedio', `${rStats.avgPayloadKb.toFixed(2)} KB`, `${gStats.avgPayloadKb.toFixed(2)} KB`, formatDiff(rStats.avgPayloadKb, gStats.avgPayloadKb)],
    ['Throughput', `${rStats.throughput.toFixed(2)} req/s`, `${gStats.throughput.toFixed(2)} req/s`, formatDiff(rStats.throughput, gStats.throughput, true)],
  ];

  console.log(
    'Metrica'.padEnd(24) +
    'REST'.padEnd(20) +
    'GraphQL'.padEnd(20) +
    'Diferencia'
  );
  console.log('-'.repeat(80));
  for (const [metric, restVal, gqlVal, diff] of rows) {
    console.log(
      metric.padEnd(24) +
      restVal.padEnd(20) +
      gqlVal.padEnd(20) +
      diff
    );
  }
  console.log('-'.repeat(80));

  console.log(`Tiempo total: ${(totalWallMs / 1000).toFixed(2)} s`);
  console.log(`Metricas disponibles en Prometheus (http://localhost:9090) y Grafana (http://localhost:3000)\n`);
}

runBenchmark();
