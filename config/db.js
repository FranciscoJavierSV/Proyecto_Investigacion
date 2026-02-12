const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);

let database;

async function connectDB() {
  try {
    await client.connect();
    database = client.db('rendimientoDB');
    console.log('MongoDB conectado');
  } catch (error) {
    console.error('Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

function getDB() {
  return database;
}

module.exports = { connectDB, getDB };