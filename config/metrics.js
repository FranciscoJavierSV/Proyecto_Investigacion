const client = require('prom-client');
const { performance } = require("perf_hooks");
const { writeMetricsLog } = require('../logs/logger');

const register = new client.Registry();

client.collectDefaultMetrics({ register });

// =========================
// METRICS
// =========================

// Response time
const httpRequestDuration = new client.Histogram({
	name: 'http_request_duration_ms',
	help: 'Duración de requests en ms',
	labelNames: ['api_type'],
	buckets: [10, 50, 100, 200, 500, 1000, 2000]
});

// Throughput
const httpRequestsTotal = new client.Counter({
	name: 'http_requests_total',
	help: 'Total de requests',
	labelNames: ['api_type']
});

// Payload size
const payloadSize = new client.Histogram({
	name: 'response_size_bytes',
	help: 'Tamaño del payload en bytes',
	labelNames: ['api_type'],
	buckets: [500, 1000, 5000, 10000, 50000, 100000, 500000]
});

// TTFB
const ttfbMetric = new client.Histogram({
	name: 'ttfb_ms',
	help: 'Time to First Byte',
	labelNames: ['api_type'],
	buckets: [5, 10, 20, 50, 100, 200, 500]
});

// Error rate
const errorsTotal = new client.Counter({
	name: 'errors_total',
	help: 'Errores totales',
	labelNames: ['api_type']
});

errorsTotal.labels({ api_type: 'rest' }).inc(0);
errorsTotal.labels({ api_type: 'graphql' }).inc(0);

// CPU usage
const cpuUsage = new client.Gauge({
	name: 'cpu_usage_percent',
	help: 'Uso de CPU (%)',
	labelNames: ['api_type']
});

// Memory usage
const memoryUsage = new client.Gauge({
	name: 'memory_usage_bytes',
	help: 'Uso de memoria',
	labelNames: ['api_type']
});

// Middleware (REST API only!)
const metricsMiddleware = (req, res, next) => {
	const endTimer = httpRequestDuration.startTimer();
	const startCpu = process.cpuUsage();
	let responseSize = 0;

	const originalWrite = res.write;
	const originalEnd = res.end;

	res.write = function (chunk, encoding, callback) {
		if (chunk) {
			responseSize += Buffer.isBuffer(chunk)
				? chunk.length
				: Buffer.byteLength(chunk, encoding);
		}
		return originalWrite.call(this, chunk, encoding, callback);
	};

	res.end = function (chunk, encoding, callback) {
		if (chunk) {
			responseSize += Buffer.isBuffer(chunk)
				? chunk.length
				: Buffer.byteLength(chunk, encoding);
		}
		return originalEnd.call(this, chunk, encoding, callback);
	};

	res.on('finish', () => {
		const labels = {
			api_type: 'rest'
		};
		
		// Throughput
		httpRequestsTotal.labels(labels).inc();

		// Response time
		const timer = endTimer(labels);

		// Payload size
		if (responseSize > 0) {
			payloadSize.labels(labels).observe(responseSize);
		}

		// TTFB
		ttfbMetric.labels(labels).observe(timer);

		// Error rate
		if (res.statusCode >= 500) {
			errorsTotal.labels(labels).inc();
		}
		const endCpu = process.cpuUsage(startCpu);
        const cpuMs = (endCpu.user + endCpu.system) / 1000;
        const mem = process.memoryUsage().heapUsed;
        const durationMs = timer * 1000; 

		cpuUsage.labels(labels).set(cpuMs);
		memoryUsage.labels(labels).set(mem);

        writeMetricsLog({
            queryName: `REST - ${req.method} ${req.originalUrl}`,
            responseTime: durationMs.toFixed(2),
            ttfb: durationMs.toFixed(2),
            payloadSize: responseSize,
            cpuUsage: cpuMs.toFixed(2),
            memoryUsage: mem,
            errors: res.statusCode >= 400 ? 1 : 0
        });
	});

	next();
}

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
	memoryUsage,
	metricsMiddleware
};