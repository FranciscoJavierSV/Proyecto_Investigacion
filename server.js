const express = require('express');
const { createYoga } = require('graphql-yoga');
const { connectDB } = require('./config/db');
const registroRoutes = require('./routes/registro.routes');
const { schema } = require('./graphql/schema');

const app = express();

app.use(express.json());

async function startServer() {

	const db = await connectDB();

	const yoga = createYoga({
		schema,
		context: () => ({
			db
		})
	});

	//app.use('/api/registros', registroRoutes);
	app.use('/graphql', yoga);

	app.listen(4000, () => {
		console.log('Servidor corriendo en puerto 4000');
		console.log('GraphQL: http://localhost:4000/graphql');
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