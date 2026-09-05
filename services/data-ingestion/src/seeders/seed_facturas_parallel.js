const fs = require("fs");
const { Worker } = require("worker_threads");
const args = require("minimist")(process.argv.slice(2));

// número de facturas a generar (puede venir de SEED_N_FACTURAS)
let total =
  args.n ||
  process.env.SEED_N_FACTURAS ||
  process.env.SEED_N ||
  100000;
let batch = args.batch || process.env.SEED_BATCH || 10000;
let workers = args.workers || process.env.SEED_WORKERS || 4;
const uri = args.uri || process.env.MONGO_URI || "mongodb://localhost:27017";

// coerce y validar
total = Number(total);
batch = Number(batch);
workers = Number(workers);
if (isNaN(total) || total < 0) {
  console.error("❌ Valor inválido para total de facturas:", total);
  process.exit(1);
}
if (isNaN(batch) || batch <= 0) {
  console.error("❌ Valor inválido para batch:", batch);
  process.exit(1);
}
if (isNaN(workers) || workers <= 0) {
  console.error("❌ Valor inválido para workers:", workers);
  process.exit(1);
}

console.log(`📌 Seeding Facturas: ${total} registros con ${workers} workers`);

async function runWorkers() {
  if (workers > 1) {
    const perWorker = Math.ceil(total / workers);
    const promises = [];
    for (let i = 0; i < workers; i++) {
      const start = i * perWorker;
      const end = Math.min(start + perWorker, total);
      promises.push(new Promise((resolve, reject) => {
        const w = new Worker("./src/workers/worker_seed_facturas.js", {
          workerData: { start, end, batch, uri }
        });

        w.on("message", (msg) => {
          if (msg && msg.status === "done") return resolve();
          if (msg && msg.status === "error") return reject(new Error(msg.message || "Worker error"));
        });

        w.on("error", (err) => reject(err));

        w.on("exit", (code) => {
          if (code === 0) return resolve();
          return reject(new Error(`Worker exited with code ${code}`));
        });
      }));
    }
    await Promise.all(promises);
    console.log("✅ Todos los workers de facturas terminaron");
  } else {
    await require("../workers/worker_seed_facturas").run({ start: 0, end: total, batch, uri });
    console.log("✅ Seed facturas single-threaded completado");
  }
}

runWorkers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error en seed_facturas_parallel:", err.message);
    process.exit(1);
  });
