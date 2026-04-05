const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

async function connectDB() {
    try {
        await client.connect();
        console.log('MongoDB conectado');
        db = client.db(process.env.CLIENTDB);
    } catch (error) {
        console.error('Error conectando a MongoDB:', error);
        process.exit(1);
    }
}

function getDB() {
    if (!db) {
        throw new Error('Base de datos no inicializada. Llama a connectDB primero.')
    }
    return db;
}

module.exports = { connectDB, getDB };