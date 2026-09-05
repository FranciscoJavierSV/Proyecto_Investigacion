// CONSUMER: Lee mensajes de Kafka e inserta en MongoDB por lotes
// Expone endpoints HTTP para acceder a métricas y estadísticas

const { Kafka } = require('kafkajs');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const http = require('http');
const client = require('prom-client');

// CONFIGURACION: Variables de entorno
const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPIC = process.env.KAFKA_TOPIC || 'data';
const GROUP_ID = process.env.KAFKA_GROUP_ID || 'data-collector';
const METRICS_PORT = process.env.METRICS_PORT || 9464;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || process.env.CLIENTDB || 'baseDR';
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const BATCH_SIZE = parseInt(process.env.CONSUMER_BATCH_SIZE || '5000', 10);

// VALIDACION: Verificar MONGO_URI
if (!MONGO_URI || MONGO_URI.trim() === '') {
  console.error('ERROR: MONGO_URI es requerido en .env');
  process.exit(1);
}

// ALMACENAMIENTO: Crear directorios
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const STATS_DIR = path.join(DATA_DIR, 'estadísticas');
if (!fs.existsSync(STATS_DIR)) {
  fs.mkdirSync(STATS_DIR, { recursive: true });
}

// ARCHIVOS: Rutas de almacenamiento
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const STATS_HISTÓRICO = path.join(DATA_DIR, 'stats_histórico.jsonl');

// UTILIDADES: Obtener número de ejecución
function getExecutionNumber() {
  let maxNum = 0;
  if (fs.existsSync(STATS_DIR)) {
    const files = fs.readdirSync(STATS_DIR);
    files.forEach(f => {
      const match = f.match(/execution_(\d+)\.json/);
      if (match) {
        maxNum = Math.max(maxNum, parseInt(match[1], 10));
      }
    });
  }
  return maxNum + 1;
}

let EXECUTION_ID = getExecutionNumber();

// METRICAS: Inicializar contadores
let received = 0;
let inserted = 0;
let errors = 0;
const batchInsertLatencies = [];
let startTime;

// PROMETHEUS: Configurar métricas
const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const msgCounter = new client.Counter({
  name: 'consumer_messages_total',
  help: 'Total de mensajes recibidos de Kafka',
  registers: [registry],
});

const insertCounter = new client.Counter({
  name: 'consumer_inserts_total',
  help: 'Total de documentos insertados en MongoDB',
  registers: [registry],
});

const errCounter = new client.Counter({
  name: 'consumer_errors_total',
  help: 'Total de errores de procesamiento',
  registers: [registry],
});

const batchLatencyHistogram = new client.Histogram({
  name: 'consumer_batch_latency_ms',
  help: 'Latencia de inserción por lote en ms',
  buckets: [10, 50, 100, 500, 1000, 5000, 10000],
  registers: [registry],
});

const batchCounter = new client.Counter({
  name: 'consumer_batches_total',
  help: 'Total de lotes procesados',
  registers: [registry],
});

const batchDocumentsHistogram = new client.Histogram({
  name: 'consumer_batch_documents',
  help: 'Cantidad de documentos por lote',
  buckets: [1, 10, 100, 1000, 5000, 10000],
  registers: [registry],
});

const batchErrorCounter = new client.Counter({
  name: 'consumer_batch_errors_total',
  help: 'Total de lotes que fallaron al insertarse',
  registers: [registry],
});

const mongoConnectionGauge = new client.Gauge({
  name: 'consumer_mongodb_connected',
  help: 'Estado de conexion con MongoDB (1 conectado, 0 desconectado)',
  registers: [registry],
});

// UTILIDADES: Calcular percentiles
function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * sorted.length);
  return sorted[idx] || 0;
}

// ALMACENAMIENTO: Guardar estadísticas
function saveStats() {
  const elapsedSec = Math.max((Date.now() - (startTime || Date.now())) / 1000, 0.001);
  const stats = {
    execution_id: EXECUTION_ID,
    timestamp: new Date().toISOString(),
    received,
    inserted,
    errors,
    batch_size: BATCH_SIZE,
    latency_p50: percentile(batchInsertLatencies, 50),
    latency_p95: percentile(batchInsertLatencies, 95),
    latency_p99: percentile(batchInsertLatencies, 99),
    throughput_inserts_per_sec: inserted / elapsedSec,
    elapsed_seconds: elapsedSec,
  };
  
  // Guardar stats.json actual (se sobrescribe)
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
  
  // Guardar execution_N.json (permanente)
  const executionFile = path.join(STATS_DIR, `execution_${EXECUTION_ID}.json`);
  fs.writeFileSync(executionFile, JSON.stringify(stats, null, 2));
  
  // Guardar en histórico (append)
  const historicLine = JSON.stringify(stats) + '\n';
  fs.appendFileSync(STATS_HISTÓRICO, historicLine);
  
  return stats;
}

// LOG: Mostrar métricas cada 10 segundos (removido - usar métricas Prometheus)

// HTTP: Servidor con endpoints
function startHttpServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', registry.contentType);
      res.end(await registry.metrics());
    }
    else if (req.url === '/stats') {
      const stats = saveStats();
      res.end(JSON.stringify(stats, null, 2));
    }
    else if (req.url === '/files') {
      const files = {};
      if (fs.existsSync(STATS_FILE)) {
        files.stats = `${STATS_FILE} (actual)`;
      }
      if (fs.existsSync(STATS_HISTÓRICO)) {
        const lines = fs.readFileSync(STATS_HISTÓRICO, 'utf8').split('\n').filter(l => l).length;
        files.stats_histórico = `${STATS_HISTÓRICO} (${lines} ejecuciones)`;
      }
      if (fs.existsSync(STATS_DIR)) {
        const execFiles = fs.readdirSync(STATS_DIR).filter(f => f.startsWith('execution_'));
        if (execFiles.length > 0) {
          files.executions = `${STATS_DIR}/ (${execFiles.length} archivos)`;
        }
      }
      res.end(JSON.stringify(files, null, 2));
    }
    else if (req.url === '/') {
      res.end(JSON.stringify({
        status: 'running',
        execution_id: EXECUTION_ID,
        messages_received: received,
        documents_inserted: inserted,
        errors,
        batch_size: BATCH_SIZE,
        mongo_uri: MONGO_URI.split('@')[0] + '@...', // Ocultar credenciales
        endpoints: {
          '/metrics': 'Prometheus metrics',
          '/stats': 'Current statistics',
          '/files': 'Available data files',
        }
      }, null, 2));
    }
    else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }
  });

  server.listen(METRICS_PORT);
  console.log(`HTTP server en http://localhost:${METRICS_PORT}`);
  console.log(`Endpoints: / | /stats | /metrics | /files`);
}

// KAFKA + MONGODB: Conectar e insertar
const BATCH_MAX_WAIT_MS = parseInt(process.env.CONSUMER_BATCH_MAX_WAIT_MS || '2000', 10);

async function run() {
  
  // MONGODB: Conectar
  console.log(`Conectando a MongoDB: ${MONGO_URI.split('@')[0]}@...`);
  const mongoClient = new MongoClient(MONGO_URI);
  await mongoClient.connect();
  mongoConnectionGauge.set(1);
  const db = mongoClient.db(DB_NAME);
  console.log(`Conectado a MongoDB - DB: ${DB_NAME}`);
  
  // KAFKA: Conectar
  console.log(`Conectando a Kafka: ${BROKERS.join(', ')}`);
  const kafka = new Kafka({ clientId: 'data-collector', brokers: BROKERS });
  const consumer = kafka.consumer({ groupId: GROUP_ID });

  await consumer.connect();
  console.log(`Suscripto al topic: ${TOPIC}`);
  await consumer.subscribe({ topic: TOPIC, fromBeginning: true });

  startTime = Date.now();
  startHttpServer();

  // UTILIDADES: Obtener nombre de colección según tipo
  function getCollectionName(dataType) {
    const typeMap = {
      'clientes': 'clientes',
      'productos': 'productos',
      'variaciones': 'variaciones',
      'facturas': 'facturas',
      'datosfacturas': 'datosfacturas'
    };
    return typeMap[dataType] || 'registros';
  }

  // UTILIDADES: Inserción de batch
  let batch = [];
  let lastBatchFlush = Date.now();
  let shuttingDown = false;
  let flushInterval;
  let flushInProgress = false;

  async function flushBatch() {
    if (!batch.length) {
      lastBatchFlush = Date.now();
      return;
    }

    const currentBatch = batch;
    batch = [];
    lastBatchFlush = Date.now();
    const t0 = Date.now();

    try {
      const byType = {};
      currentBatch.forEach(doc => {
        const type = doc._type || 'registros';
        if (!byType[type]) byType[type] = [];
        byType[type].push(doc);
      });

      for (const [type, docs] of Object.entries(byType)) {
        const collectionName = getCollectionName(type);
        const collection = db.collection(collectionName);
        await collection.insertMany(docs);
      }

      const latency = Date.now() - t0;
      batchCounter.inc();
      batchDocumentsHistogram.observe(currentBatch.length);
      inserted += currentBatch.length;
      insertCounter.inc(currentBatch.length);
      batchInsertLatencies.push(latency);
      batchLatencyHistogram.observe(latency);
    } catch (insertErr) {
      batchErrorCounter.inc();
      errors += currentBatch.length;
      errCounter.inc(currentBatch.length);
      console.error(`[ERROR] Fallo inserción: ${insertErr.message}`);
    }
  }

  async function gracefulShutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('Cerrando consumer y flush de batch pendiente...');
    clearInterval(flushInterval);
    try {
      await flushBatch();
    } catch (err) {
      console.error('Error al flush batch durante shutdown:', err.message || err);
    }
    try {
      await consumer.disconnect();
    } catch (err) {
      console.error('Error al desconectar consumer:', err.message || err);
    }
    try {
      await mongoClient.close();
    } catch (err) {
      console.error('Error al desconectar MongoDB:', err.message || err);
    }
    mongoConnectionGauge.set(0);
    const finalStats = saveStats();
    console.log('Resumen final:', finalStats);
    process.exit(0);
  }

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  flushInterval = setInterval(async () => {
    if (flushInProgress || shuttingDown) return;
    if (Date.now() - lastBatchFlush >= BATCH_MAX_WAIT_MS) {
      flushInProgress = true;
      try {
        await flushBatch();
      } catch (err) {
        console.error('Error en flush periódico:', err.message || err);
      } finally {
        flushInProgress = false;
      }
    }
  }, BATCH_MAX_WAIT_MS);

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const data = JSON.parse(message.value.toString());
        received++;
        msgCounter.inc();
        
        batch.push(data);
        const now = Date.now();
        
        if (batch.length >= BATCH_SIZE || now - lastBatchFlush >= BATCH_MAX_WAIT_MS) {
          await flushBatch();
        }
      } catch (parseErr) {
        errors++;
        errCounter.inc();
        console.error(`[ERROR] Parseo JSON: ${parseErr.message}`);
      }
    },
  });
}

// EJECUCION
run().catch(async err => {
  console.error('Error en consumer:', err);
  const finalStats = saveStats();
  console.log(`Resumen final:`, finalStats);
  process.exit(1);
});
