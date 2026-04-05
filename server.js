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
} = require('./metrics');

// REST ROUTES
const allRoutes = require('./restapi/routes/all.routes');
const clienteRoutes = require('./restapi/routes/cliente.routes');
const productoRoutes = require('./restapi/routes/producto.routes');
const variacionRoutes = require('./restapi/routes/variacion.routes');
const facturaRoutes = require('./restapi/routes/factura.routes');
const datosFacturaRoutes = require('./restapi/routes/datosFactura.routes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

async function startServer() {

	await connectDB();
	const db = getDB();

	// ✅ UNA sola instancia de Yoga con métricas
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

							const req = args.contextValue.request;

							const duration = performance.now() - req.startTime;

							// 📊 RESPONSE TIME
							httpRequestDuration.observe(duration);

							// 📊 THROUGHPUT
							httpRequestsTotal.inc();

							// 📊 PAYLOAD SIZE
							const size = Buffer.byteLength(JSON.stringify(result));
							payloadSize.observe(size);

							// 📊 TTFB
							ttfbMetric.observe(performance.now() - ttfbStart);

							// 📊 CPU
							const cpuEnd = process.cpuUsage(req.cpuStart);
							const cpuMs = (cpuEnd.user + cpuEnd.system) / 1000;
							cpuUsage.set(cpuMs);

							// 📊 MEMORY
							const mem = process.memoryUsage().heapUsed;
							memoryUsage.set(mem);

							// 📊 ERRORS
							if (result.errors) {
								errorsTotal.inc(result.errors.length);
							}
						}
					};
				}
			}
		]
	});

	// GRAPHQL
	app.use('/graphql', yoga);

	// REST
	app.use('/rest/', allRoutes);
	app.use('/rest/clientes', clienteRoutes);
	app.use('/rest/datosfacturas', datosFacturaRoutes);
	app.use('/rest/facturas', facturaRoutes);
	app.use('/rest/productos', productoRoutes);
	app.use('/rest/variaciones', variacionRoutes);

	// 📊 METRICS ENDPOINT (Prometheus)
	app.get('/metrics', async (req, res) => {
		res.set('Content-Type', client.register.contentType);
		res.end(await client.register.metrics());
	});

	app.listen(PORT, () => {
		console.log(`Servidor corriendo en puerto ${PORT}`);
		console.log(`GraphQL: http://localhost:${PORT}/graphql`);
		console.log(`REST: http://localhost:${PORT}/rest`);
		console.log(`Metrics: http://localhost:${PORT}/metrics`);
	});
}

startServer();