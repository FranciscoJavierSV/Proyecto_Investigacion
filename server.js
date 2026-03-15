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

startServer();