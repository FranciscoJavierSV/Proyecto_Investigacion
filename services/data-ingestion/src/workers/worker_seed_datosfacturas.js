const { workerData, parentPort } = require("worker_threads");
const { ObjectId, MongoClient } = require("mongodb");
const { Kafka, Partitioners } = require("kafkajs");
const faker = require("@faker-js/faker").faker;

const CLAVES_PROD = ["60131600", "60131601", "60131602"];
const CLAVES_UNIDAD = ["5ee39b9b67afd517cc89d72d", "5ee39b9b67afd517cc89d72e"];

function generarDato(factura, index) {
  const cantidad = faker.number.int({ min: 1, max: 10 });
  const precioUnitario = Math.round(Math.random() * 1000 * 100) / 100;
  const precioTotal = Math.round(cantidad * precioUnitario * 100) / 100;
  const ivaUnitario = Math.round(precioUnitario * 0.16 * 100) / 100;
  const ivaTotal = Math.round(ivaUnitario * cantidad * 100) / 100;
  
  return {
    _id: new ObjectId(),
    _idFactura: factura._id,
    claveProdServ: new ObjectId("5ee39b4867afd517cc8905e1"),
    claveUnidad: new ObjectId(CLAVES_UNIDAD[0]),
    total_retenciones: "0",
    iva_total: ivaTotal,
    descuento: 0,
    iva_unitario: ivaUnitario.toString(),
    precio_total: precioTotal.toString(),
    producto: faker.commerce.productName(),
    detalle: "",
    cantidad_producto: cantidad,
    precio_unitario: precioUnitario.toString(),
    por_iva_unitario: "16",
    ret_iva: "0",
    ret_isr: "0",
    cantidad_dcto: "0",
    id: index,
    __v: 0,
    trasladoIeps: 0,
    porcentajeTrasladoIeps: 0,
    tieneTrasladoIeps: false,
    retencionIeps: 0,
    porcentajeRetencionIeps: 0,
    tieneRetencionIeps: false,
    _idEmpresa: factura._idEmpresa,
    _type: 'datosfacturas'
  };
}

async function run({ batch = 100, uri = "mongodb://localhost:27017" }) {
  const mongo = new MongoClient(uri);
  try {
    await mongo.connect();
    const db = mongo.db(process.env.DB_NAME || process.env.CLIENTDB || 'baseDR');
    const totalFacturas = await db.collection('facturas').countDocuments();
    const targetFacturas = Math.max(1, Math.floor(totalFacturas / 2));

    if (totalFacturas === 0) {
      console.log('[DatosFactura] No hay facturas, abortando');
      return;
    }

    const kafka = new Kafka({
      clientId: 'seed-datosfacturas',
      brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
      connectionTimeout: 10000,
      requestTimeout: 10000
    });
    const producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner, compression: 1, maxInFlightRequests: 1, idempotent: false });
    await producer.connect();

    let total = 0;
    const buffer = [];
    const cursor = db.collection('facturas').find().limit(targetFacturas).batchSize(batch);
    let facturaIndex = 0;

    while (await cursor.hasNext()) {
      const fact = await cursor.next();
      const items = faker.number.int({ min: 1, max: 3 });
      for (let i = 0; i < items; i++) {
        buffer.push(generarDato(fact, i));
        if (buffer.length >= batch) {
          await producer.send({
            topic: 'data',
            messages: buffer.splice(0, batch).map(d => ({ value: JSON.stringify(d) }))
          });
          total += batch;
        }
      }
      facturaIndex += 1;
    }
    if (buffer.length > 0) {
      await producer.send({
        topic: 'data',
        messages: buffer.map(d => ({ value: JSON.stringify(d) }))
      });
      total += buffer.length;
    }

    console.log(`[DatosFactura] ✅ ${total} datos generados para ${facturaIndex} facturas`);
    await producer.disconnect();
    if (parentPort) parentPort.postMessage({ status: "done" });
  } catch (error) {
    console.error(`[DatosFactura] ERROR: ${error.message}`);
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