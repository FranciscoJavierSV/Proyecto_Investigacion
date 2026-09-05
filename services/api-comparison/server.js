// API COMPARISON: REST vs GraphQL para CRUD de datos
// Ambos endpoints se conectan a la misma MongoDB que los seeders

const express = require('express');
const { ApolloServer, gql } = require('apollo-server-express');
const { MongoClient } = require('mongodb');
const client = require('prom-client');
const fs = require('fs');
const path = require('path');

// CONFIGURACION
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'baseDR';
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '..', 'data');
const METRICS_LOG_FILE = path.join(DATA_DIR, 'api_comparison_metrics.log');
const METRICS_PROM_FILE = path.join(DATA_DIR, 'api_comparison_metrics.prom');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function persistMetrics(text) {
  try {
    const timestamp = new Date().toISOString();
    const entry = `# Metrics snapshot ${timestamp}\n${text}\n`;
    await fs.promises.appendFile(METRICS_LOG_FILE, entry);
    await fs.promises.writeFile(METRICS_PROM_FILE, text);
  } catch (err) {
    console.error('Error escribiendo métricas en disco:', err.message);
  }
}

if (!MONGO_URI || MONGO_URI.trim() === '') {
  console.error('ERROR: MONGO_URI requerido en .env');
  process.exit(1);
}

// METRICAS: Prometheus
const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const restInsertCounter = new client.Counter({
  name: 'api_rest_inserts_total',
  help: 'Total de inserciones vía REST',
  registers: [registry],
});

const graphqlInsertCounter = new client.Counter({
  name: 'api_graphql_inserts_total',
  help: 'Total de inserciones vía GraphQL',
  registers: [registry],
});

const restErrorCounter = new client.Counter({
  name: 'api_rest_errors_total',
  help: 'Errores en REST',
  registers: [registry],
});

const graphqlErrorCounter = new client.Counter({
  name: 'api_graphql_errors_total',
  help: 'Errores en GraphQL',
  registers: [registry],
});

const apiRequestsTotal = new client.Counter({
  name: 'api_requests_total',
  help: 'Total de peticiones recibidas por tipo de API',
  labelNames: ['api_type'],
  registers: [registry],
});

const apiResponsesTotal = new client.Counter({
  name: 'api_responses_total',
  help: 'Total de respuestas por tipo de API y estado HTTP',
  labelNames: ['api_type', 'status_code'],
  registers: [registry],
});

const apiActiveRequests = new client.Gauge({
  name: 'api_active_requests',
  help: 'Peticiones activas por tipo de API',
  labelNames: ['api_type'],
  registers: [registry],
});

const restLatencyHistogram = new client.Histogram({
  name: 'api_rest_latency_ms',
  help: 'Latencia REST en ms',
  buckets: [10, 50, 100, 500, 1000],
  registers: [registry],
});

const graphqlLatencyHistogram = new client.Histogram({
  name: 'api_graphql_latency_ms',
  help: 'Latencia GraphQL en ms',
  buckets: [10, 50, 100, 500, 1000],
  registers: [registry],
});

// MONGODB
let db;
const mongoClient = new MongoClient(MONGO_URI);

// ESQUEMA GraphQL
const typeDefs = gql`
  type Resultado {
    success: Boolean!
    message: String!
    insertedId: String
  }

  type Query {
    ping: String!
  }

  type Mutation {
    insertCliente(nombre: String!, email: String!, ciudad: String!): Resultado!
    insertProducto(nombre: String!, precio: Float!, stock: Int!): Resultado!
    insertFactura(numero: String!, monto: Float!, estado: String!): Resultado!
  }
`;

// RESOLVERS GraphQL
const resolvers = {
  Query: {
    ping: () => 'pong',
  },
  Mutation: {
    insertCliente: async (_, { nombre, email, ciudad }) => {
      const t0 = Date.now();
      try {
        await validateCollection('clientes');
        const result = await db.collection('clientes').insertOne({
          nombre,
          email,
          ciudad,
          createdAt: new Date(),
        });
        const latency = Date.now() - t0;
        graphqlLatencyHistogram.observe(latency);
        graphqlInsertCounter.inc();
        return {
          success: true,
          message: 'Cliente insertado',
          insertedId: result.insertedId.toString(),
        };
      } catch (err) {
        graphqlErrorCounter.inc();
        return {
          success: false,
          message: err.message,
          insertedId: null,
        };
      }
    },

    insertProducto: async (_, { nombre, precio, stock }) => {
      const t0 = Date.now();
      try {
        await validateCollection('productos');
        const result = await db.collection('productos').insertOne({
          nombre,
          precio,
          stock,
          createdAt: new Date(),
        });
        const latency = Date.now() - t0;
        graphqlLatencyHistogram.observe(latency);
        graphqlInsertCounter.inc();
        return {
          success: true,
          message: 'Producto insertado',
          insertedId: result.insertedId.toString(),
        };
      } catch (err) {
        graphqlErrorCounter.inc();
        return {
          success: false,
          message: err.message,
          insertedId: null,
        };
      }
    },

    insertFactura: async (_, { numero, monto, estado }) => {
      const t0 = Date.now();
      try {
        await validateCollection('facturas');
        const result = await db.collection('facturas').insertOne({
          numero,
          monto,
          estado,
          createdAt: new Date(),
        });
        const latency = Date.now() - t0;
        graphqlLatencyHistogram.observe(latency);
        graphqlInsertCounter.inc();
        return {
          success: true,
          message: 'Factura insertada',
          insertedId: result.insertedId.toString(),
        };
      } catch (err) {
        graphqlErrorCounter.inc();
        return {
          success: false,
          message: err.message,
          insertedId: null,
        };
      }
    },
  },
};

// UTILIDADES: Validar que colección existe
async function validateCollection(collectionName) {
  const collections = await db.listCollections({ name: collectionName }).toArray();
  if (collections.length === 0) {
    throw new Error(`Colección '${collectionName}' no existe en MongoDB`);
  }
}

// SERVIDOR Express
async function startServer() {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    const apiType = req.path === '/graphql' ? 'graphql' : req.path.startsWith('/rest') ? 'rest' : 'other';
    apiRequestsTotal.labels({ api_type: apiType }).inc();
    apiActiveRequests.labels({ api_type: apiType }).inc();
    res.on('finish', () => {
      apiResponsesTotal.labels({ api_type: apiType, status_code: String(res.statusCode) }).inc();
      apiActiveRequests.labels({ api_type: apiType }).dec();
    });
    next();
  });

  // CONEXION MongoDB
  try {
    await mongoClient.connect();
    db = mongoClient.db(DB_NAME);
    console.log(`Conectado a MongoDB: ${MONGO_URI.split('@')[0]}@...`);
  } catch (err) {
    console.error('Error conectando MongoDB:', err.message);
    process.exit(1);
  }

  // ENDPOINT REST: Insertar Cliente
  app.post('/rest/insert/cliente', async (req, res) => {
    const t0 = Date.now();
    try {
      const { nombre, email, ciudad } = req.body;
      if (!nombre || !email || !ciudad) {
        throw new Error('Faltan campos: nombre, email, ciudad');
      }
      await validateCollection('clientes');
      const result = await db.collection('clientes').insertOne({
        nombre,
        email,
        ciudad,
        createdAt: new Date(),
      });
      const latency = Date.now() - t0;
      restLatencyHistogram.observe(latency);
      restInsertCounter.inc();
      res.json({
        success: true,
        message: 'Cliente insertado',
        insertedId: result.insertedId,
        latency_ms: latency,
      });
    } catch (err) {
      restErrorCounter.inc();
      res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  });

  // ENDPOINT REST: Insertar Producto
  app.post('/rest/insert/producto', async (req, res) => {
    const t0 = Date.now();
    try {
      const { nombre, precio, stock } = req.body;
      if (!nombre || precio === undefined || stock === undefined) {
        throw new Error('Faltan campos: nombre, precio, stock');
      }
      await validateCollection('productos');
      const result = await db.collection('productos').insertOne({
        nombre,
        precio,
        stock,
        createdAt: new Date(),
      });
      const latency = Date.now() - t0;
      restLatencyHistogram.observe(latency);
      restInsertCounter.inc();
      res.json({
        success: true,
        message: 'Producto insertado',
        insertedId: result.insertedId,
        latency_ms: latency,
      });
    } catch (err) {
      restErrorCounter.inc();
      res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  });

  // ENDPOINT REST: Insertar Factura
  app.post('/rest/insert/factura', async (req, res) => {
    const t0 = Date.now();
    try {
      const { numero, monto, estado } = req.body;
      if (!numero || monto === undefined || !estado) {
        throw new Error('Faltan campos: numero, monto, estado');
      }
      await validateCollection('facturas');
      const result = await db.collection('facturas').insertOne({
        numero,
        monto,
        estado,
        createdAt: new Date(),
      });
      const latency = Date.now() - t0;
      restLatencyHistogram.observe(latency);
      restInsertCounter.inc();
      res.json({
        success: true,
        message: 'Factura insertada',
        insertedId: result.insertedId,
        latency_ms: latency,
      });
    } catch (err) {
      restErrorCounter.inc();
      res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  });

  // METRICAS
  app.get('/metrics', async (req, res) => {
    const metrics = await registry.metrics();
    res.set('Content-Type', registry.contentType);
    res.end(metrics);
    persistMetrics(metrics);
  });

  // HEALTH CHECK
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', db: 'connected' });
  });

  // APOLLO GraphQL
  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  await server.start();
  server.applyMiddleware({ app });

  app.listen(PORT, () => {
    console.log(`API Comparison escuchando en puerto ${PORT}`);
    console.log(`REST endpoints: /rest/insert/{cliente|producto|factura}`);
    console.log(`GraphQL: /graphql`);
    console.log(`Métricas: /metrics`);
  });
}

startServer().catch(err => {
  console.error('Error iniciando servidor:', err);
  process.exit(1);
});
