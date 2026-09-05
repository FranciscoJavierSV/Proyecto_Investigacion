const fs = require("fs");
const args = require("minimist")(process.argv.slice(2));

let batch = args.batch || process.env.SEED_BATCH || 10000;
const uri = args.uri || process.env.MONGO_URI || "mongodb://localhost:27017";

// VALIDACION: Coercionar a numero
batch = Number(batch);

console.log(`📌 Seeding DatosFactura: basado en facturas existentes`);

require("../workers/worker_seed_datosfacturas").run({ batch, uri });
