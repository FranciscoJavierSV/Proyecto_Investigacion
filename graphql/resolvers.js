const { performance } = require("perf_hooks");

module.exports = {

	Query: {

		obtenerDataset: async (_, { input }, { db }) => {

			const inicio = performance.now();
			const limit = input?.limit || 100;
			const offset = input?.offset || 0;

			const [
				clientes,
				facturas,
				datosfacturas,
				productos,
				variaciones
			] = await Promise.all([

				db.collection("clientes")
                    .find({})
                    .skip(offset)
                    .limit(limit)
                    .toArray(),

                db.collection("facturas")
                    .find({})
                    .skip(offset)
                    .limit(limit)
                    .toArray(),

                db.collection("datosfacturas")
                    .find({})
                    .skip(offset)
                    .limit(limit)
                    .toArray(),

                db.collection("productos")
                    .find({})
                    .skip(offset)
                    .limit(limit)
                    .toArray(),

                db.collection("variaciones")
                    .find({})
                    .skip(offset)
                    .limit(limit)
                    .toArray(),

			]);

			const fin = performance.now();

			return {
				tiempoMs: fin - inicio,

				clientes: {
					data: clientes
				},

				facturas: {
					data: facturas
				},

				datosfacturas: {
					data: datosfacturas
				},

				productos: {
					data: productos
				},

				variaciones: {
					data: variaciones
				}
			};
		}

	}
};