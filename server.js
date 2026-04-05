require('dotenv').config();
const express = require('express');
const { createYoga } = require('graphql-yoga');
const { connectDB, getDB } = require('./config/db');
const { schema } = require('./graphql/schema');

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

	connectDB().then(() => {
		const db = getDB();

		const yoga = createYoga({
			schema,
			context: () => ({
				db
			})
		});

		//app.use('/api/registros', registroRoutes);
		app.use('/graphql', yoga);

		// REST ROUTES
		app.use('/rest/', allRoutes);
		app.use('/rest/clientes', clienteRoutes);
		app.use('/rest/datosfacturas', datosFacturaRoutes);
		app.use('/rest/facturas', facturaRoutes);
		app.use('/rest/productos', productoRoutes);
		app.use('/rest/variaciones', variacionRoutes);

		app.listen(PORT, () => {
			console.log(`Servidor corriendo en puerto ${PORT}`);
			console.log(`GraphQL: http://localhost:${PORT}/graphql`);
			console.log(`API REST: http://localhost:${PORT}/rest`);
		});
	});
}

const {
	httpRequestDuration,
	httpRequestsTotal,
	payloadSize,
	ttfbMetric,
	errorsTotal,
	cpuUsage,
	memoryUsage
} = require('./metrics');

const yoga = createYoga({
	schema,
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

						// RESPONSE TIME
						httpRequestDuration.observe(duration);

						// THROUGHPUT
						httpRequestsTotal.inc();

						// PAYLOAD SIZE
						const size = Buffer.byteLength(JSON.stringify(result));
						payloadSize.observe(size);

						// TTFB
						ttfbMetric.observe(performance.now() - ttfbStart);

						// CPU
						const cpuEnd = process.cpuUsage(req.cpuStart);
						const cpuPercent = (cpuEnd.user + cpuEnd.system) / 1000;
						cpuUsage.set(cpuPercent);

						// MEMORY
						const mem = process.memoryUsage().heapUsed;
						memoryUsage.set(mem);

						// ERRORS
						if (result.errors) {
							errorsTotal.inc(result.errors.length);
						}
					}
				};
			}
		}
	]
});

startServer();