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

startServer();