require('dotenv').config();

const express = require('express');
const { createYoga } = require('graphql-yoga');
const { performance } = require('perf_hooks');
const client = require('prom-client');

const { connectDB, getDB } = require('./config/db');
const { schema } = require('./graphql/schema');

const {
	httpRequestDuration,
	httpRequestsTotal,
	payloadSize,
	ttfbMetric,
	errorsTotal,
	cpuUsage,
	memoryUsage
} = require('./config/metrics');

// REST ROUTES
const allRoutes = require('./restapi/routes/all.routes');
const clienteRoutes = require('./restapi/routes/cliente.routes');
const productoRoutes = require('./restapi/routes/producto.routes');
const variacionRoutes = require('./restapi/routes/variacion.routes');
const facturaRoutes = require('./restapi/routes/factura.routes');
const datosFacturaRoutes = require('./restapi/routes/datosFactura.routes');
const { writeMetricsLog } = require('./logs/logger');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

let maxRss = 0;

function updateMemoryPeak() {
	const rss = process.memoryUsage().rss;

	if (rss > maxRss) {
		maxRss = rss;
	}
}

async function startServer() {

	await connectDB();
	const db = getDB();

	// Yoga con metricas
	const yoga = createYoga({
		schema,

		context: ({ request }) => ({
			db,
			request
		}),

		plugins: [
			{
				onRequest({ request }) {
					request.startTime = performance.now();
					request.cpuStart = process.cpuUsage();
				},

				onExecute() {
					const ttfbStart = performance.now();

					return {
						onExecuteDone({ result, args }) {

							const labels = {
								api_type: 'graphql'
							};
						
							const req = args.contextValue.request;
						
							const duration = performance.now() - req.startTime;
						
							// RESPONSE TIME
							httpRequestDuration.labels(labels).observe(duration);
						
							// THROUGHPUT
							httpRequestsTotal.labels(labels).inc();
						
							// PAYLOAD SIZE
							let size = 0;
						
							try {
								size = Buffer.byteLength(JSON.stringify(result));
								payloadSize.labels(labels).observe(size);
							}
							catch {
								size = 0;
							}
						
							// TTFB
							const ttfb = performance.now() - ttfbStart;
							ttfbMetric.labels(labels).observe(ttfb);
						
							// CPU
							const cpuEnd = process.cpuUsage(req.cpuStart);
							const cpuMs = (cpuEnd.user + cpuEnd.system) / 1000;
						
							cpuUsage.labels(labels).set(cpuMs);
						
							// MEMORY
							const mem = process.memoryUsage().heapUsed; 
							updateMemoryPeak();

							memoryUsage.labels(labels).set(mem);
						
							// ERRORS
							const errorCount = result.errors
								? result.errors.length
								: 0;
						
							if (errorCount > 0) {
								errorsTotal.labels(labels).inc(errorCount);
							}
						
							let queryName = 'GraphQL';
						
							try {
							    const queryText = args?.contextValue?.params?.query || '';
														
							    let operation = args?.operationName;
														
							    if (!operation) {
							        const operationMatch = queryText.match(/obtenerDataset/i);
							        operation = operationMatch ? operationMatch[0] : 'UnknownOperation';
							    }
							
							    const variables = args?.variableValues || {};
							
							    const limit = variables.limit !== undefined 
							        ? variables.limit 
							        : (queryText.match(/limit\s*:\s*(\d+)/i)?.[1] || null);
							
							    const offset = variables.offset !== undefined 
							        ? variables.offset 
							        : (queryText.match(/offset\s*:\s*(\d+)/i)?.[1] || null);
							
							    queryName = `GraphQL - ${operation}`
							        + (limit !== null ? ` - limit ${limit}` : '')
							        + (offset !== null ? ` - offset ${offset}` : '');
							
							} catch (error) {
							    console.error("Error extrayendo datos del query para el log:", error);
							}
						
							writeMetricsLog({
								queryName,
								responseTime: duration.toFixed(2),
								ttfb: ttfb.toFixed(2),
								payloadSize: size,
								cpuUsage: cpuMs.toFixed(2),
								memoryUsage: mem,
								errors: errorCount
							});
						}
					};
				}
			}
		]
	});

	// GRAPHQL
	app.use('/graphql', yoga);

	// MIDDLEWARE PARA RAM MAXIMA EN REST
	app.use((req, res, next) => {
		updateMemoryPeak();
		next();
	});

	// REST
	app.use('/rest/', allRoutes);
	app.use('/rest/clientes', clienteRoutes);
	app.use('/rest/datosfacturas', datosFacturaRoutes);
	app.use('/rest/facturas', facturaRoutes);
	app.use('/rest/productos', productoRoutes);
	app.use('/rest/variaciones', variacionRoutes);

	// METRICS ENDPOINT (Prometheus)
	app.get('/metrics', async (req, res) => {
		res.set('Content-Type', client.register.contentType);
		res.end(await client.register.metrics());
	});

	app.listen(PORT, () => {
		console.log(`Servidor corriendo en puerto ${PORT}`);
		console.log(`GraphQL: http://localhost:${PORT}/graphql`);
		console.log(`REST: http://localhost:${PORT}/rest`);
		console.log(`Prometheus: http://localhost:9090`);
		console.log(`Grafana: http://localhost:3000`);
	});

	setInterval(() => {

	console.log(`
========= RAM MÁXIMA =========

${(maxRss / 1024 / 1024).toFixed(2)} MB

==============================
`);

}, 10000);
}

startServer();