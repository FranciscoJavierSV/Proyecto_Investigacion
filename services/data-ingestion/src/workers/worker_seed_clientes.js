const { workerData, parentPort } = require("worker_threads");
const { ObjectId, Decimal128 } = require("mongodb");
const { Kafka, Partitioners } = require("kafkajs");
const faker = require("@faker-js/faker").faker;

// REFERENCIAS: Sucursales ficticias pero constantes y reutilizables
const SUCURSALES = {
  "5f4564baf25d554a7f2b2818": "Sucursal Principal",
  "5f4564baf25d554a7f2b2819": "Sucursal Norte",
  "5f4564baf25d554a7f2b281a": "Sucursal Sur",
  "5f4564baf25d554a7f2b281b": "Sucursal Este",
  "5f4564baf25d554a7f2b281c": "Sucursal Oeste"
};

// REFERENCIAS: Empresas constantes
const EMPRESAS = {
  "5fd9545f6dce8d6e9f0c7dde": "Empresa Principal",
  "5fd9545f6dce8d6e9f0c7ddf": "Empresa Secundaria"
};

// REFERENCIAS: Listas de precios constantes
const LISTAS_PRECIOS = {
  "5f453c37ba107821fcc5a9f6": "Lista Minorista",
  "5f453c37ba107821fcc5a9f7": "Lista Mayorista",
  "5f453c37ba107821fcc5a9f8": "Lista Distribuidor"
};

// GENERACION: Crear documento cliente con datos coherentes
function generarCliente(index, sucursal, empresa, listaPrecios) {
  const nombreGenerado = faker.person.firstName();
  const apellidoPaterno = faker.person.lastName();
  const apellidoMaterno = faker.person.lastName();

  return {
    _id: new ObjectId(),
    listaPrecios: {
      fechaRegistro: faker.date.past(),
      _idListaPrecios: listaPrecios._id
    },
    fechaRegistro: faker.date.past(),
    activo: faker.datatype.boolean({ likelihood: 80 }),
    direccionEnvio: {
      idCodigoPostal: faker.number.int({ min: 1, max: 999 }),
      idEstado: faker.number.int({ min: 1, max: 32 }),
      idCiudad: faker.number.int({ min: 1, max: 500 }),
      calle: faker.location.street(),
      colonia: faker.location.secondaryAddress(),
      numeroExterior: faker.number.int({ min: 1, max: 999 }).toString(),
      numeroInterior: null
    },
    direccionesIguales: faker.datatype.boolean({ likelihood: 70 }),
    direccionFacturacion: {
      idCodigoPostal: faker.number.int({ min: 1, max: 999 }),
      idEstado: faker.number.int({ min: 1, max: 32 }),
      idCiudad: faker.number.int({ min: 1, max: 500 }),
      calle: faker.location.street(),
      colonia: faker.location.secondaryAddress(),
      numeroExterior: faker.number.int({ min: 1, max: 999 }).toString(),
      numeroInterior: null
    },
    tieneRepresentante: faker.datatype.boolean({ likelihood: 20 }),
    telefonos: Array.from({ length: faker.number.int({ min: 0, max: 3 }) }, () => ({
      tipo: faker.helpers.arrayElement(["casa", "móvil", "trabajo"]),
      numero: faker.phone.number()
    })),
    historialListaPrecios: [],
    tipoDePersona: faker.helpers.arrayElement([1, 2]),
    correo: faker.internet.email(),
    rutaFoto: "default\\foto\\foto.jpg",
    nombreFoto: "foto.jpg",
    nombre: nombreGenerado.toUpperCase(),
    apepat: apellidoPaterno.toUpperCase(),
    apemat: apellidoMaterno.toUpperCase(),
    rfc: `${apellidoPaterno.slice(0, 2)}${apellidoMaterno.slice(0, 2)}${nombreGenerado.slice(0, 2)}${faker.number.int({ min: 100000, max: 999999 })}`.toUpperCase(),
    _idSucursal: sucursal._id,
    _idAccesoUsuario: sucursal._idAccesoUsuario,
    _idUsuario: sucursal._idUsuario,
    id: index,
    __v: 0,
    _idEmpresa: empresa._id,
    saldoAFavor: Decimal128.fromString(
      faker.number.float({ min: 0, max: 5000, precision: 0.01 }).toFixed(2)
    ),
    tipo: faker.helpers.arrayElement([1, 2, 3]),
    _type: 'clientes'
  };
}

async function run({ start = 0, end = 0, batch = 1000, uri = "mongodb://localhost:27017" }) {
  // VALIDACION: Coercionar parametros a numeros
  start = Number(start);
  end = Number(end);
  batch = Number(batch);

  // LOG: Diagnostico de parametros para debugging en CI
  console.log(`[Clientes worker] Parametros: start=${start} end=${end} batch=${batch} uri=${uri}`);

  // VALIDACION: Detectar parametros invalidos
  if (isNaN(start) || isNaN(end) || isNaN(batch) || batch <= 0) {
    throw new Error(`Parametros invalidos start=${start} end=${end} batch=${batch}`);
  }

  // CONTROL: Si no hay trabajo, salir sin tocar BD
  if (start >= end) {
    if (parentPort) parentPort.postMessage({ status: "done" });
    return;
  }

  try {
    const kafka = new Kafka({
      clientId: `seed-clientes-${start}`,
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
    console.log(`[Clientes] Intentando conectar a Kafka: ${process.env.KAFKA_BROKERS || 'kafka:9092'}...`);
    await producer.connect();
    console.log(`[Clientes] Conectado exitosamente a Kafka`);

    // REFERENCIAS: Construir arrays de sucursales, empresas y listas de precios
    const sucursales = Object.entries(SUCURSALES).map(([id, nombre]) => ({
      _id: new ObjectId(id),
      _idAccesoUsuario: new ObjectId(),
      _idUsuario: new ObjectId(),
      nombre
    }));

    const empresas = Object.entries(EMPRESAS).map(([id, nombre]) => ({
      _id: new ObjectId(id),
      nombre
    }));

    const listasPreciosArray = Object.entries(LISTAS_PRECIOS).map(([id, nombre]) => ({
      _id: new ObjectId(id),
      nombre
    }));

    // PROCESAMIENTO: Generar e insertar clientes en lotes
    for (let i = start; i < end; i += batch) {
      const docs = [];
      for (let j = i; j < Math.min(i + batch, end); j++) {
        const sucursal = faker.helpers.arrayElement(sucursales);
        const empresa = faker.helpers.arrayElement(empresas);
        const listaPrecios = faker.helpers.arrayElement(listasPreciosArray);
        docs.push(generarCliente(j, sucursal, empresa, listaPrecios));
      }

      // VALIDACION: Verificar que el lote no este vacio antes de insertar
      if (docs.length > 0) {
        const messages = docs.map(doc => ({
          value: JSON.stringify(doc)
        }));
        await producer.send({
          topic: 'data',
          messages: messages
        });
        if ((i / batch) % 10 === 0) {
          console.log(`[Clientes] Progreso ${Math.min(i + batch, end)}/${end}`);
        }
      }
    }

    // FINALIZACION: Cerrar conexion y notificar
    await producer.disconnect();
    if (parentPort) {
      parentPort.postMessage({ status: "done" });
    }
    return;
  } catch (err) {
    console.error("Error en worker_seed_clientes:", err);
    if (parentPort) {
      parentPort.postMessage({ status: "error", message: err.message || String(err) });
    }
    throw err;
  }
}

module.exports = { run };

// Si el archivo se ejecuta como Worker thread, arrancar automáticamente
if (typeof workerData !== "undefined" && workerData !== null) {
  run(workerData).catch((err) => {
    // ya se envió mensaje al padre en el catch interno; asegurar salida no silenciosa
    process.exit(1);
  });
}
