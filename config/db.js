const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function connectDB() {
	try {

		await client.connect();

		console.log('MongoDB conectado');

		return client.db('rendimientoDB');

	} catch (error) {

		console.error('Error conectando a MongoDB:', error);
		process.exit(1);

	}
}

module.exports = { connectDB };