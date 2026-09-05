const { workerData, parentPort } = require("worker_threads");
const { ObjectId, MongoClient } = require("mongodb");
const { Kafka, Partitioners } = require("kafkajs");
const faker = require("@faker-js/faker").faker;

const LISTAS_PRECIOS = {
  "5f4564bbf25d554a7f2b281a": "Lista Minorista",
  "5f4564bbf25d554a7f2b281b": "Lista Mayorista"
};
const COLORES = ["Rojo", "Azul", "Verde", "Negro", "Blanco"];
const TALLAS = ["S", "M", "L", "XL"];

function generarVariacion(producto, index, listaPrecios) {
  const precio = Math.round((producto.precio || 100) * 100) / 100;
  return {
    _id: new ObjectId(),
    fechaRegistro: faker.date.past(),
    activo: true,
    tieneColores: false,
    default: index === 0,
    colores: [],
    imagenes: [],
    precios: [{
      _id: new ObjectId(),
      fechaRegistro: faker.date.past(),
      activo: true,
      precio: Math.round(precio * 1.1 * 100) / 100,
      _idListaPrecios: listaPrecios._id
    }],
    especificaciones: [],
    nombre: `${producto.nombre} - ${faker.helpers.arrayElement(TALLAS)}`,
    upc: faker.string.alphanumeric(10).toUpperCase(),
    descripcion: producto.descripcion || "",
    equivalencias: [],
    _idProducto: producto._id,
    _idUsuario: producto._idUsuario,
    _idAccesoUsuario: producto._idAccesoUsuario,
    _idSucursal: producto._idSucursal,
    id: index,
    __v: 0,
    _idEmpresa: producto._idEmpresa,
    _type: 'variaciones'
  };
}

async function run({ start, end, batch = 1000, uri }) {
  const mongo = new MongoClient(uri, {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 120000,
    connectTimeoutMS: 60000,
    retryWrites: false,
    maxPoolSize: 5,
    minPoolSize: 1
  });
  try {
    await mongo.connect();
    const db = mongo.db(process.env.DB_NAME || process.env.CLIENTDB || 'baseDR');

    const collection = db.collection('productos');
    const totalProductos = await collection.countDocuments();
    const target = Math.max(1, Math.floor(totalProductos / 2));

    if (totalProductos === 0) {
      console.log('[Variaciones] No hay productos, abortando');
      return;
    }

    const kafka = new Kafka({
      clientId: 'seed-variaciones',
      brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
      connectionTimeout: 10000,
      requestTimeout: 10000
    });
    const producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner, compression: 1, maxInFlightRequests: 1, idempotent: false });
    await producer.connect();

    const listaPrecios = new ObjectId(Object.keys(LISTAS_PRECIOS)[0]);
    let total = 0;
    const buffer = [];
    const cursorBatchSize = Math.max(100, Math.floor(batch / 2));

    console.log(`[Variaciones] Generando variaciones para ${target} productos`);
    const cursor = collection.find().limit(target).batchSize(cursorBatchSize);
    let index = 0;

    while (await cursor.hasNext()) {
      const producto = await cursor.next();
      buffer.push(generarVariacion(producto, index, { _id: listaPrecios }));
      index += 1;

      if (buffer.length >= batch) {
        await producer.send({
          topic: 'data',
          messages: buffer.splice(0, batch).map(d => ({ value: JSON.stringify(d) }))
        });
        total += batch;
        if (total % (batch * 10) === 0) {
          console.log(`[Variaciones] Progreso ${total}/${target}`);
        }
        // Pequeño delay para no presionar MongoDB
        await new Promise(r => setTimeout(r, 100));
      }
    }

    if (buffer.length > 0) {
      await producer.send({
        topic: 'data',
        messages: buffer.map(d => ({ value: JSON.stringify(d) }))
      });
      total += buffer.length;
    }

    console.log(`[Variaciones] Generando variaciones para ${target} productos`);
    await producer.disconnect();
    if (parentPort) parentPort.postMessage({ status: "done" });
  } catch (error) {
    console.error(`[Variaciones] ERROR: ${error.message}`);
    if (parentPort) parentPort.postMessage({ status: "error", message: error.message });
    throw error;
  } finally {
    await mongo.close();
  }
}

module.exports = { run };

// Si el archivo se ejecuta como Worker thread, arrancar automáticamente
if (typeof workerData !== "undefined" && workerData !== null) {
  run(workerData).catch((err) => {
    process.exit(1);
  });
}
