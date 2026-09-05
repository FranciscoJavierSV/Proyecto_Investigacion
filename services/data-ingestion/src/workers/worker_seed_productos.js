const { workerData, parentPort } = require("worker_threads");
const { ObjectId } = require("mongodb");
const { Kafka, Partitioners } = require("kafkajs");
const faker = require("@faker-js/faker").faker;

// Oficinas/sucursales ficticias pero constantes
const SUCURSALES = {
  "5f4564baf25d554a7f2b2818": "Sucursal Principal",
  "5f4564baf25d554a7f2b2819": "Sucursal Norte",
  "5f4564baf25d554a7f2b281a": "Sucursal Sur",
  "5f4564baf25d554a7f2b281b": "Sucursal Este",
  "5f4564baf25d554a7f2b281c": "Sucursal Oeste"
};

const EMPRESAS = {
  "5fd9545f6dce8d6e9f0c7dde": "Empresa Principal",
  "5fd9545f6dce8d6e9f0c7ddf": "Empresa Secundaria"
};

const MONEDAS = {
  "5ee39ccc67afd517cc89dcd5": "Pesos Mexicanos",
  "5ee39ccc67afd517cc89dcd6": "Dólares",
  "5ee39ccc67afd517cc89dcd7": "Euros"
};

const UNIDADES = {
  "5ee39b9b67afd517cc89d72d": "Pie Tablar",
  "5ee39b9b67afd517cc89d72e": "Pieza",
  "5ee39b9b67afd517cc89d72f": "Metro Cuadrado",
  "5ee39b9b67afd517cc89d730": "Kilogramo",
  "5ee39b9b67afd517cc89d731": "Litro"
};

const CSAT_CLAVE_PROD = {
  "5ee39b4867afd517cc8905e1": "60131600",
  "5ee39b4867afd517cc8905e2": "60131601",
  "5ee39b4867afd517cc8905e3": "60131602"
};

function generarProducto(index, sucursal, empresa, moneda, unidad, claveProd, usuarioInfo) {
  const productoNombre = faker.commerce.productName();
  const tieneVariaciones = faker.datatype.boolean({ likelihood: 60 });

  return {
    _id: new ObjectId(),
    fechaRegistro: faker.date.past(),
    activo: faker.datatype.boolean({ likelihood: 85 }),
    proveedores: [],
    tieneVariaciones: tieneVariaciones,
    incluyeIva: faker.datatype.boolean(),
    registroLote: faker.datatype.boolean({ likelihood: 30 }),
    controlLote: faker.datatype.boolean({ likelihood: 30 }),
    ingresoRapido: faker.datatype.boolean({ likelihood: 70 }),
    nombre: productoNombre,
    descripcion: faker.commerce.productDescription(),
    _idCSat_ClaveUnidad: unidad._id,
    _idCSat_ClaveProdServ: claveProd._id,
    porcentajeIva: faker.helpers.arrayElement([0, 8, 16]),
    historialProveedores: [],
    _idSucursal: sucursal._id,
    _idAccesoUsuario: usuarioInfo._idAccesoUsuario,
    _idUsuario: usuarioInfo._idUsuario,
    id: index,
    __v: 0,
    _idEmpresa: empresa._id,
    costoIncluyeIva: faker.datatype.boolean(),
    incluirDescuento: faker.datatype.boolean({ likelihood: 80 }),
    porcentajeIvaCosto: faker.helpers.arrayElement([0, 8, 16]),
    _idMoneda: moneda._id,
    _idMonedaCosto: moneda._id,
    precio: faker.number.float({ min: 10, max: 10000, precision: 0.01 }),
    costo: faker.number.float({ min: 5, max: 5000, precision: 0.01 }),
    _type: 'productos'
  };
}

async function run({ start = 0, end = 0, batch = 1000, uri = "mongodb://localhost:27017" }) {
  // coerce números y validar
  start = Number(start);
  end = Number(end);
  batch = Number(batch);
  if (isNaN(start) || isNaN(end) || isNaN(batch) || batch <= 0) {
    throw new Error(`Parámetros inválidos start=${start} end=${end} batch=${batch}`);
  }
  if (start >= end) {
    if (parentPort) parentPort.postMessage("done");
    return;
  }

  try {
    const kafka = new Kafka({
      clientId: `seed-productos-${start}`,
      brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
      connectionTimeout: 10000,
      requestTimeout: 10000,
      retry: {
        initialRetryTime: 300,
        retries: 8,
        randomizationFactor: 0.2,
        multiplier: 2,
        maxRetryTime: 30000
      }
    });
    const producer = kafka.producer({
      createPartitioner: Partitioners.LegacyPartitioner,
      compression: 1, // Gzip compression
      maxInFlightRequests: 1,
      idempotent: false
    });
    console.log(`[Productos] Intentando conectar a Kafka: ${process.env.KAFKA_BROKERS || 'kafka:9092'}...`);
    await producer.connect();
    console.log(`[Productos] Conectado exitosamente a Kafka`);

  // Crear referencias constantes
  const sucursales = Object.entries(SUCURSALES).map(([id, nombre]) => ({
    _id: new ObjectId(id),
    nombre
  }));

  const empresas = Object.entries(EMPRESAS).map(([id, nombre]) => ({
    _id: new ObjectId(id),
    nombre
  }));

  const monedas = Object.entries(MONEDAS).map(([id, nombre]) => ({
    _id: new ObjectId(id),
    nombre
  }));

  const unidades = Object.entries(UNIDADES).map(([id, nombre]) => ({
    _id: new ObjectId(id),
    nombre
  }));

  const clavesProd = Object.entries(CSAT_CLAVE_PROD).map(([id, codigo]) => ({
    _id: new ObjectId(id),
    codigo
  }));

  // Usuario para todos los productos (consistencia)
  const usuarioInfo = {
    _idUsuario: new ObjectId(),
    _idAccesoUsuario: new ObjectId()
  };

  for (let i = start; i < end; i += batch) {
      const docs = [];
      for (let j = i; j < Math.min(i + batch, end); j++) {
        const sucursal = faker.helpers.arrayElement(sucursales);
        const empresa = faker.helpers.arrayElement(empresas);
        const moneda = faker.helpers.arrayElement(monedas);
        const unidad = faker.helpers.arrayElement(unidades);
        const claveProd = faker.helpers.arrayElement(clavesProd);
        docs.push(generarProducto(j, sucursal, empresa, moneda, unidad, claveProd, usuarioInfo));
      }

      if (docs.length > 0) {
        const messages = docs.map(doc => ({
          value: JSON.stringify(doc)
        }));
        await producer.send({
          topic: 'data',
          messages: messages
        });
        if ((i / batch) % 10 === 0) {
          console.log(`[Productos] Progreso ${Math.min(i + batch, end)}/${end}`);
        }
      }
    }
    await producer.disconnect();
    if (parentPort) {
      parentPort.postMessage({ status: "done" });
    }
  } catch (error) {
    console.error(`[Productos] ERROR: ${error.message}`);
    if (parentPort) parentPort.postMessage({ status: "error", message: error.message });
    throw error;
  }
}

module.exports = { run };

// Si el archivo se ejecuta como Worker thread, arrancar automáticamente
if (typeof workerData !== "undefined" && workerData !== null) {
  run(workerData).catch((err) => {
    process.exit(1);
  });
}
