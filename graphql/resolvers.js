const { performance } = require("perf_hooks");
const { writeMetricsJson } = require('../logs/logger');

module.exports = {
	Query: {
		obtenerDataset: async (_, { input }, { db, request }, info) => {

			const inicio = performance.now();
			const limit = input?.limit || 100;
			const offset = input?.offset || 0;

			// determine which top-level fields were requested
			let requestedFields = [];
			try {
				const selections = info.fieldNodes[0].selectionSet.selections;
				requestedFields = selections.map(s => s.name && s.name.value).filter(Boolean);
			} catch (e) {
				requestedFields = [];
			}

			// measure DB fetch
			const dbStart = performance.now();
			const [
				clientes,
				facturas,
				datosfacturas,
				productos,
				variaciones
			] = await Promise.all([
				db.collection("clientes").find({}).skip(offset).limit(limit).toArray(),
				db.collection("facturas").find({}).skip(offset).limit(limit).toArray(),
				db.collection("datosfacturas").find({}).skip(offset).limit(limit).toArray(),
				db.collection("productos").find({}).skip(offset).limit(limit).toArray(),
				db.collection("variaciones").find({}).skip(offset).limit(limit).toArray(),
			]);
			const dbEnd = performance.now();
			const dbFetchMs = dbEnd - dbStart;

			const fin = performance.now();
			const totalMs = fin - inicio;

			// measure serialization time and payload bytes (approximate)
			let serializeMs = 0;
			let payloadBytes = 0;
			try {
				const resultObj = {
					tiempoMs: totalMs,
					clientes: { data: clientes },
					facturas: { data: facturas },
					datosfacturas: { data: datosfacturas },
					productos: { data: productos },
					variaciones: { data: variaciones }
				};
				const sStart = performance.now();
				const serialized = JSON.stringify(resultObj);
				const sEnd = performance.now();
				serializeMs = sEnd - sStart;
				payloadBytes = Buffer.byteLength(serialized);
			} catch (e) {
				serializeMs = 0;
				payloadBytes = 0;
			}

			// write per-request JSON metrics (minimal fields)
			try {
				writeMetricsJson({
					request_id: request?.headers?.['x-request-id'] || null,
					api_type: 'graphql',
					operation: 'obtenerDataset',
					limit,
					offset,
					requestedFields,
					db_fetch_ms: Number(dbFetchMs.toFixed(2)),
					total_ms: Number(totalMs.toFixed(2)),
					timestamp: new Date().toISOString(),
					returned_counts: {
						clientes: clientes.length,
						facturas: facturas.length,
						datosfacturas: datosfacturas.length,
						productos: productos.length,
						variaciones: variaciones.length
					}
					,
					serialize_ms: Number(serializeMs.toFixed(2)),
					payload_bytes: Number(payloadBytes)
					
				});
			} catch (err) {
				// don't break the response on logging error
				console.error('Error writing JSON metrics:', err.message);
			}

			return {
				tiempoMs: totalMs,
				clientes: { data: clientes },
				facturas: { data: facturas },
				datosfacturas: { data: datosfacturas },
				productos: { data: productos },
				variaciones: { data: variaciones }
			};
		}
	}
};