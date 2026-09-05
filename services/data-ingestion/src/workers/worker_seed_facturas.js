const { workerData, parentPort } = require("worker_threads");
const { ObjectId, MongoClient } = require("mongodb");
const { Kafka, Partitioners } = require("kafkajs");
const faker = require("@faker-js/faker").faker;

function generarFactura(index, cliente) {
  const subtotal = Math.round(Math.random() * 5000 * 100) / 100;
  const descuento = Math.round(subtotal * 0.1 * 100) / 100;
  const iva = Math.round((subtotal - descuento) * 0.16 * 100) / 100;
  const total = Math.round((subtotal - descuento + iva) * 100) / 100;
  
  return {
    _id: new ObjectId(),
    _idCliente: cliente._id,
    fecha: faker.date.past(),
    activo: true,
    subtotal,
    descuento,
    iva,
    total,
    observaciones: "",
    _idSucursal: cliente._idSucursal,
    _idEmpresa: cliente._idEmpresa,
    _idUsuario: cliente._idUsuario,
    _idAccesoUsuario: cliente._idAccesoUsuario || cliente._id,
    formaDePago: new ObjectId(),
    moneda: new ObjectId(),
    tipoDeComprobante: new ObjectId(),
    metodoDePago: new ObjectId(),
    serie: faker.helpers.arrayElement(["A", "B", "C"]),
    folio: faker.number.int({ min: 1, max: 10000 }),
    uuid: faker.string.uuid(),
    version: "3.3",
    id: index,
    __v: 0,
    _type: 'facturas'
  };
}

async function run({ start = 0, end = 0, batch = 1000, uri = "mongodb://localhost:27017" }) {
  const mongo = new MongoClient(uri);
  try {
    await mongo.connect();
    const db = mongo.db(process.env.DB_NAME || process.env.CLIENTDB || 'baseDR');
    const clientes = await db.collection('clientes').find().limit(1000).toArray();
    
    if (clientes.length === 0) {
      console.log('[Facturas] No hay clientes, abortando');
      return;
    }

    start = Number(start);
    end = Number(end);
    batch = Number(batch);
    if (isNaN(start) || isNaN(end) || isNaN(batch) || batch <= 0 || start >= end) {
      if (parentPort) parentPort.postMessage({ status: "done" });
      return;
    }

    const kafka = new Kafka({
      clientId: `seed-facturas-${start}`,
      brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
      connectionTimeout: 10000,
      requestTimeout: 10000
    });
    const producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner, compression: 1, maxInFlightRequests: 1, idempotent: false });
    await producer.connect();

    let inserted = 0;
    for (let i = start; i < end; i += batch) {
      const docs = [];
      for (let j = i; j < Math.min(i + batch, end); j++) {
        const cliente = faker.helpers.arrayElement(clientes);
        docs.push(generarFactura(j, cliente));
      }
      if (docs.length > 0) {
        await producer.send({
          topic: 'data',
          messages: docs.map(d => ({ value: JSON.stringify(d) }))
        });
        inserted += docs.length;
        if (i % (batch * 5) === 0) console.log(`[Facturas] ${inserted}/${end - start}`);
      }
    }

    console.log(`[Facturas] ✅ ${inserted} facturas generadas`);
    await producer.disconnect();
    if (parentPort) parentPort.postMessage({ status: "done" });
  } catch (error) {
    console.error(`[Facturas] ERROR: ${error.message}`);
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