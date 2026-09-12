#!/usr/bin/env node

// Consulta parametrizada hacia REST o GraphQL (research-api)
const { performance } = require('perf_hooks');

// Procesa los argumentos de la linea de comandos y define valores por defecto
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    target: null,
    endpoint: 'all',
    size: 10,
    offset: 0,
    fields: 'full',
    host: process.env.RESEARCH_HOST || 'localhost',
    port: process.env.RESEARCH_PORT || '4001',
    raw: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--raw') {
      options.raw = true;
    } else if (arg === '--target' || arg === '-t') {
      options.target = args[++i]?.toLowerCase();
    } else if (arg === '--endpoint' || arg === '-e') {
      options.endpoint = args[++i]?.toLowerCase();
    } else if (arg === '--size' || arg === '-s' || arg === '--limit' || arg === '-l') {
      options.size = parseInt(args[++i], 10) || 0;
    } else if (arg === '--offset' || arg === '-o') {
      options.offset = parseInt(args[++i], 10) || 0;
    } else if (arg === '--fields' || arg === '-f') {
      options.fields = args[++i]?.toLowerCase();
    } else if (arg === '--port' || arg === '-p') {
      options.port = args[++i];
    } else if (arg === '--host') {
      options.host = args[++i];
    } else if (!options.target && (arg.toLowerCase() === 'rest' || arg.toLowerCase() === 'graphql')) {
      options.target = arg.toLowerCase();
    }
  }

  if (!options.target) {
    options.target = 'rest';
  }

  return options;
}

// Muestra las opciones y ejemplos de uso en la consola
function printHelp() {
  console.log(`
Uso: ./run.sh query [rest|graphql] [opciones]
     node scripts/query.js [rest|graphql] [opciones]

Parametros:
  rest | graphql          Arquitectura destino (default: rest)
  -s, --size, -l, --limit Cantidad de registros por consulta (default: 10)
  -o, --offset            Desplazamiento para paginacion (default: 0)
  -e, --endpoint          [REST] Coleccion: all, clientes, productos, facturas, datosfacturas, variaciones (default: all)
  -f, --fields            [GraphQL] Campos: full, minimal, clientes, productos, facturas, datosfacturas, variaciones (default: full)
  --raw                   Imprime el JSON completo sin resumir
  -p, --port              Puerto de research-api (default: 4001)
  -h, --help              Muestra esta ayuda

Ejemplos:
  ./run.sh query rest -s 25 -o 0
  ./run.sh query rest -e clientes -s 50 -o 10
  ./run.sh query rest -e productos -s 5 --raw
  ./run.sh query graphql -s 20 -o 0
  ./run.sh query graphql -s 50 -f minimal
  ./run.sh query graphql -s 10 -f clientes
`);
}

// Construye la consulta GraphQL segun la proyeccion de campos solicitada
function buildGraphQLQuery(fields) {
  if (fields === 'minimal') {
    return `
      query DatasetMinimal($input: DatasetInput) {
        obtenerDataset(input: $input) {
          tiempoMs
          clientes { data { id nombre } }
          productos { data { id descripcion precio } }
        }
      }
    `;
  }
  if (fields === 'clientes') {
    return `
      query DatasetClientes($input: DatasetInput) {
        obtenerDataset(input: $input) {
          tiempoMs
          clientes { data { id nombre apepat apemat correo rfc activo } }
        }
      }
    `;
  }
  if (fields === 'productos') {
    return `
      query DatasetProductos($input: DatasetInput) {
        obtenerDataset(input: $input) {
          tiempoMs
          productos { data { id descripcion precio activo } }
        }
      }
    `;
  }
  if (fields === 'facturas') {
    return `
      query DatasetFacturas($input: DatasetInput) {
        obtenerDataset(input: $input) {
          tiempoMs
          facturas { data { id serie folio total subtotal iva fecha activo } }
        }
      }
    `;
  }
  if (fields === 'datosfacturas') {
    return `
      query DatasetDatosFacturas($input: DatasetInput) {
        obtenerDataset(input: $input) {
          tiempoMs
          datosfacturas { data { id iva_total precio_total descuento } }
        }
      }
    `;
  }
  if (fields === 'variaciones') {
    return `
      query DatasetVariaciones($input: DatasetInput) {
        obtenerDataset(input: $input) {
          tiempoMs
          variaciones { data { id descripcion activo } }
        }
      }
    `;
  }

  return `
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

// Ejecuta la peticion hacia el servicio correspondiente y resume los resultados obtenidos
async function runQuery() {
  const opts = parseArgs();

  if (opts.help) {
    printHelp();
    return;
  }

  const baseUrl = `http://${opts.host}:${opts.port}`;

  console.log(`=== Consulta parametrizada ===`);
  console.log(`Arquitectura: ${opts.target.toUpperCase()}`);
  console.log(`Size: ${opts.size}`);
  console.log(`Offset: ${opts.offset}`);
  if (opts.target === 'rest') {
    console.log(`Endpoint: /rest/${opts.endpoint === 'all' ? '' : opts.endpoint}`);
  } else {
    console.log(`Campos GQL: ${opts.fields}`);
  }
  console.log(`URL: ${baseUrl}`);
  console.log(`------------------------------`);

  const tStart = performance.now();

  try {
    let response;
    let url;
    let requestOptions;

    if (opts.target === 'rest') {
      const path = opts.endpoint === 'all' ? '/rest/' : `/rest/${opts.endpoint}`;
      const params = new URLSearchParams({
        size: String(opts.size),
        offset: String(opts.offset),
      });
      url = `${baseUrl}${path}?${params.toString()}`;
      requestOptions = { method: 'GET' };
    } else {
      url = `${baseUrl}/graphql`;
      const query = buildGraphQLQuery(opts.fields);
      const body = {
        query,
        variables: {
          input: {
            limit: opts.size,
            offset: opts.offset,
          },
        },
      };
      requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      };
    }

    response = await fetch(url, requestOptions);
    const textData = await response.text();
    const tEnd = performance.now();
    const clientLatencyMs = (tEnd - tStart).toFixed(2);
    const payloadBytes = Buffer.byteLength(textData, 'utf8');

    let json;
    try {
      json = JSON.parse(textData);
    } catch {
      json = null;
    }

    console.log(`HTTP Status: ${response.status} ${response.statusText}`);
    console.log(`Latencia cliente: ${clientLatencyMs} ms`);
    console.log(`Payload size: ${(payloadBytes / 1024).toFixed(2)} KB (${payloadBytes} bytes)`);

    if (json) {
      if (opts.target === 'rest') {
        if (json.responseTimeMs !== undefined) {
          console.log(`Tiempo DB/servidor: ${json.responseTimeMs.toFixed(2)} ms`);
        }
        console.log(`Resumen de registros:`);
        if (opts.endpoint === 'all') {
          console.log(`  clientes: ${json.clientes?.length || 0}`);
          console.log(`  datosfacturas: ${json.datosfacturas?.length || 0}`);
          console.log(`  facturas: ${json.facturas?.length || 0}`);
          console.log(`  productos: ${json.productos?.length || 0}`);
          console.log(`  variaciones: ${json.variaciones?.length || 0}`);
        } else {
          const key = Object.keys(json).find(k => Array.isArray(json[k]));
          console.log(`  ${opts.endpoint}: ${key ? json[key].length : 0}`);
        }
      } else {
        const dataset = json.data?.obtenerDataset;
        if (dataset?.tiempoMs !== undefined) {
          console.log(`Tiempo DB/servidor: ${dataset.tiempoMs.toFixed(2)} ms`);
        }
        if (dataset) {
          console.log(`Resumen de registros:`);
          if (dataset.clientes) console.log(`  clientes: ${dataset.clientes.data?.length || 0}`);
          if (dataset.facturas) console.log(`  facturas: ${dataset.facturas.data?.length || 0}`);
          if (dataset.datosfacturas) console.log(`  datosfacturas: ${dataset.datosfacturas.data?.length || 0}`);
          if (dataset.productos) console.log(`  productos: ${dataset.productos.data?.length || 0}`);
          if (dataset.variaciones) console.log(`  variaciones: ${dataset.variaciones.data?.length || 0}`);
        }
        if (json.errors) {
          console.error(`Errores GraphQL:`, json.errors);
        }
      }

      if (opts.raw) {
        console.log(`\nRespuesta JSON:\n`);
        console.log(JSON.stringify(json, null, 2));
      }
    } else {
      console.log(`\nRespuesta:\n${textData.slice(0, 500)}`);
    }
  } catch (err) {
    console.error(`Error ejecutando consulta: ${err.message}`);
    console.error(`Verifica que research-api este activo en http://${opts.host}:${opts.port}`);
    process.exit(1);
  }
}

runQuery();
