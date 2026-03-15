const { performance } = require("perf_hooks");

module.exports = {

	Query: {

		obtenerDataset: async (_, __, { db }) => {

			const inicio = performance.now();

			const [
				clientes,
				facturas,
				datosfacturas,
				productos,
				variaciones
			] = await Promise.all([
				db.collection("clientes").find({}).toArray(),
				db.collection("facturas").find({}).toArray(),
				db.collection("datosfacturas").find({}).toArray(),
				db.collection("productos").find({}).toArray(),
				db.collection("variaciones").find({}).toArray()
			]);

			const fin = performance.now();

			return {
				tiempoMs: fin - inicio,
				clientes,
				facturas,
				datosfacturas,
				productos,
				variaciones
			};
		}

	}

};