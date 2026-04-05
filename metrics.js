const client = require('prom-client');

const register = new client.Registry();

client.collectDefaultMetrics({ register });

// =========================
// METRICS
// =========================

// Response time
const httpRequestDuration = new client.Histogram({
	name: 'http_request_duration_ms',
	help: 'Duración de requests en ms',
	buckets: [10, 50, 100, 200, 500, 1000, 2000]
});

// Throughput
const httpRequestsTotal = new client.Counter({
	name: 'http_requests_total',
	help: 'Total de requests'
});

// Payload size
const payloadSize = new client.Histogram({
	name: 'response_size_bytes',
	help: 'Tamaño del payload en bytes',
	buckets: [500, 1000, 5000, 10000, 50000, 100000, 500000]
});

// TTFB
const ttfbMetric = new client.Histogram({
	name: 'ttfb_ms',
	help: 'Time to First Byte',
	buckets: [5, 10, 20, 50, 100, 200, 500]
});

// Error rate
const errorsTotal = new client.Counter({
	name: 'errors_total',
	help: 'Errores totales'
});

// CPU usage
const cpuUsage = new client.Gauge({
	name: 'cpu_usage_percent',
	help: 'Uso de CPU (%)'
});

// Memory usage
const memoryUsage = new client.Gauge({
	name: 'memory_usage_bytes',
	help: 'Uso de memoria'
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(payloadSize);
register.registerMetric(ttfbMetric);
register.registerMetric(errorsTotal);
register.registerMetric(cpuUsage);
register.registerMetric(memoryUsage);

module.exports = {
	register,
	httpRequestDuration,
	httpRequestsTotal,
	payloadSize,
	ttfbMetric,
	errorsTotal,
	cpuUsage,
	memoryUsage
};