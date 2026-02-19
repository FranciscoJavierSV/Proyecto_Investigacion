const { MongoClient } = require('mongodb');

// Configuración de la conexión a MongoDB
const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);

let database;

// Función para conectar a MongoDB
async function connectDB() {
  try {
    // Conectar al cliente de MongoDB
    await client.connect();
    database = client.db('rendimientoDB');
    console.log('MongoDB conectado');
  } catch (error) {
    // Manejar errores de conexión
    console.error('Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

// Función para obtener la instancia de la base de datos
function getDB() {
  return database;
}

module.exports = { connectDB, getDB };