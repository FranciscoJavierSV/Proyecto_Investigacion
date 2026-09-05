const { spawn } = require("child_process");
const fs = require("fs");

// VALIDACION: Verificar que se ejecuta dentro de Docker
if (!fs.existsSync("/.dockerenv")) {
  process.exit(1);
}

// CONFIGURACION: Leer y validar variables de entorno
let SEED_N = process.env.SEED_N || 500000;
let SEED_N_CLIENTES = process.env.SEED_N_CLIENTES || SEED_N;
let SEED_N_PRODUCTOS = process.env.SEED_N_PRODUCTOS || SEED_N;
let SEED_N_FACTURAS = process.env.SEED_N_FACTURAS || SEED_N;
let SEED_BATCH = process.env.SEED_BATCH || 10000;
let SEED_WORKERS = process.env.SEED_WORKERS || 4;

[SEED_N, SEED_N_CLIENTES, SEED_N_PRODUCTOS, SEED_N_FACTURAS, SEED_BATCH, SEED_WORKERS] =
  [SEED_N, SEED_N_CLIENTES, SEED_N_PRODUCTOS, SEED_N_FACTURAS, SEED_BATCH, SEED_WORKERS].map(
    (v) => Number(v)
  );

if ([SEED_N, SEED_BATCH, SEED_WORKERS].some((v) => isNaN(v) || v <= 0)) {
  console.error("Variables de entorno invalidas, revisa .env o la configuracion");
  process.exit(1);
}
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";

console.log("Iniciando seeding completo...");
console.log(`Running image built at commit ${process.env.GIT_COMMIT || 'unknown'}`);
console.log(`Configuracion:`);
console.log(`   - Total: ${SEED_N} registros`);
console.log(`   - Batch: ${SEED_BATCH}`);
console.log(`   - Workers: ${SEED_WORKERS}`);
console.log(`   - MongoDB: ${MONGO_URI}`);
console.log("");

// UTILIDADES: Ejecutar scripts secundarios como procesos hijo
function runScript(scriptPath, name, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\nEjecutando: ${name}...`);
    const startTime = Date.now();

    const childProcess = spawn("node", [scriptPath], {
      env: {
        ...process.env,
        SEED_N: SEED_N,
        SEED_BATCH: SEED_BATCH,
        SEED_WORKERS: SEED_WORKERS,
        MONGO_URI: MONGO_URI,
        ...extraEnv
      },
      stdio: "inherit"
    });

    childProcess.on("close", (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      if (code === 0) {
        console.log(`Completado: ${name} en ${duration}s`);
        resolve();
      } else {
        reject(new Error(`${name} fallo con codigo ${code}`));
      }
    });

    childProcess.on("error", (error) => {
      reject(error);
    });
  });
}

// ORQUESTACION: Ejecutar seeders en orden secuencial
async function main() {
  try {
    await runScript("./src/seeders/seed_clientes_parallel.js", "Generando clientes", {
      SEED_N: SEED_N_CLIENTES
    });

    await runScript("./src/seeders/seed_productos_parallel.js", "Generando productos", {
      SEED_N: SEED_N_PRODUCTOS
    });

    await runScript("./src/seeders/seed_variaciones_parallel.js", "Generando variaciones", {
      SEED_N: SEED_N
    });

    await runScript("./src/seeders/seed_facturas_parallel.js", "Generando facturas", {
      SEED_N: SEED_N_FACTURAS
    });

    await runScript("./src/seeders/seed_datosfacturas_parallel.js", "Generando datosfacturas", {
      SEED_N: SEED_N
    });

    console.log("\nSeeding completado con exito");
    process.exit(0);
  } catch (error) {
    console.error("\nError durante el seeding:", error.message);
    process.exit(1);
  }
}

main();
