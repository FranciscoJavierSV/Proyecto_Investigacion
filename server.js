// Importar dependencias necesarias
const express = require('express');
const { createYoga } = require('graphql-yoga');
const { connectDB } = require('./config/db');
const registroRoutes = require('./routes/registro.routes');
const { schema } = require('./graphql/schema');

// Crear la aplicación Express
const app = express();
// Middleware para parsear JSON
app.use(express.json());

async function startServer() {
  // Conectar a la base de datos
  await connectDB();

  // REST
  app.use('/api/registros', registroRoutes);

  // GraphQL
  const yoga = createYoga({
    schema,
    graphqlEndpoint: '/graphql'
  });

  // Integrar GraphQL Yoga con Express e iniciar el servidor
  app.use(yoga);
  app.listen(4000, () => {
    console.log('Servidor corriendo en puerto 4000');
  });
}

startServer();