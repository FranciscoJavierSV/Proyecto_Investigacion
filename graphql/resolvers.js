const { performance } = require("perf_hooks");

module.exports = {

	Query: {

		obtenerDataset: async (_, { input }, { db }) => {

			const inicio = performance.now();

			const limit = Math.min(input?.limit || 100, 1000); // anti abuso
			const offset = input?.offset || 0;

			// proyecciones (solo lo necesario)
			const projClientes = {
				nombre: 1, apepat: 1, correo: 1, rfc: 1, activo: 1
			};

			const projFacturas = {
				_idCliente: 1, fecha: 1, total: 1, activo: 1
			};

			const projDatosFacturas = {
				_idFactura: 1, producto: 1, cantidad_producto: 1, precio_total: 1
			};

			const projProductos = {
				nombre: 1, precio: 1, costo: 1, activo: 1
			};

			const projVariaciones = {
				nombre: 1, upc: 1, activo: 1
			};

			const [
				clientes,
				facturas,
				datosfacturas,
				productos,
				variaciones,

				totalClientes,
				totalFacturas,
				totalDatosFacturas,
				totalProductos,
				totalVariaciones

			] = await Promise.all([

				db.collection("clientes")
					.find({}, { projection: projClientes })
					.skip(offset)
					.limit(limit)
					.toArray(),

				db.collection("facturas")
					.find({}, { projection: projFacturas })
					.skip(offset)
					.limit(limit)
					.toArray(),

				db.collection("datosfacturas")
					.find({}, { projection: projDatosFacturas })
					.skip(offset)
					.limit(limit)
					.toArray(),

				db.collection("productos")
					.find({}, { projection: projProductos })
					.skip(offset)
					.limit(limit)
					.toArray(),

				db.collection("variaciones")
					.find({}, { projection: projVariaciones })
					.skip(offset)
					.limit(limit)
					.toArray(),

				// counts en paralelo
				db.collection("clientes").countDocuments(),
				db.collection("facturas").countDocuments(),
				db.collection("datosfacturas").countDocuments(),
				db.collection("productos").countDocuments(),
				db.collection("variaciones").countDocuments()

			]);

			const fin = performance.now();

			return {
				tiempoMs: fin - inicio,

				clientes: {
					total: totalClientes,
					data: clientes
				},

				facturas: {
					total: totalFacturas,
					data: facturas
				},

				datosfacturas: {
					total: totalDatosFacturas,
					data: datosfacturas
				},

				productos: {
					total: totalProductos,
					data: productos
				},

				variaciones: {
					total: totalVariaciones,
					data: variaciones
				}
			};
		}

	}

};