// producer.js - KafkaJS producer that generates fake data with Faker
// and sends messages to a topic. Also measures simple throughput and
// latency percentiles (p50, p95, p99).

const { Kafka } = require('kafkajs');
const { faker } = require('@faker-js/faker');
// (optional) you can also add prom-client here for producer-side metrics
// see MONITORING.md for example

// configuration from env or defaults
const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPIC = process.env.KAFKA_TOPIC || 'productos';

const kafka = new Kafka({ clientId: 'faker-producer', brokers: BROKERS });
const producer = kafka.producer();

// simple metrics collectors
let sentCount = 0;
const latencies = []; // store latencies in ms

function recordLatency(ms) {
  latencies.push(ms);
  if (latencies.length > 100000) latencies.shift(); // avoid unbounded growth
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * sorted.length);
  return sorted[idx] || 0;
}

async function logMetrics() {
  const elapsedSec = (Date.now() - startTime) / 1000;
  console.log(`\n== Metrics after ${elapsedSec.toFixed(1)}s ==`);
  console.log(`throughput: ${(sentCount / elapsedSec).toFixed(1)} msg/s`);
  console.log(`latency p50=${percentile(latencies, 50)}ms p95=${percentile(latencies, 95)}ms p99=${percentile(latencies, 99)}ms`);
  sentCount = 0; // reset counter if you want per-window measurement
}

let startTime;

async function run() {
  await producer.connect();
  startTime = Date.now();
  setInterval(logMetrics, 5000);

  const max = process.env.MAX_MESSAGES ? parseInt(process.env.MAX_MESSAGES, 10) : Infinity;
  let produced = 0;

  while (produced < max) {
    // create a fake "product" document similar to your workers
    const fakeProduct = {
      _id: faker.database.mongodbObjectId(),
      nombre: faker.commerce.productName(),
      precio: parseFloat(faker.commerce.price(1, 1000)),
      tieneVariaciones: faker.datatype.boolean({ likelihood: 60 }),
      fechaCreacion: new Date(),
    };

    const t0 = Date.now();
    await producer.send({
      topic: TOPIC,
      messages: [{ key: fakeProduct._id, value: JSON.stringify(fakeProduct) }],
    });
    const t1 = Date.now();

    recordLatency(t1 - t0);
    sentCount++;
    produced++;

    // throttle a little to avoid saturating brokers too fast; remove in high-load tests
    // await new Promise(r => setTimeout(r, 1));
  }

  console.log(`finished producing ${produced} messages`);
  await producer.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('producer error', err);
  process.exit(1);
});
