const express = require('express');
const { createYoga } = require('graphql-yoga');
const { connectDB } = require('./config/db');
const registroRoutes = require('./routes/registro.routes');
const { schema } = require('./graphql/schema');

const app = express();

app.use(express.json());

async function startServer() {
  await connectDB();

  // REST
  app.use('/api/registros', registroRoutes);

  // GraphQL
  const yoga = createYoga({
    schema,
    graphqlEndpoint: '/graphql'
  });

  app.use(yoga);

  app.listen(4000, () => {
    console.log('Servidor corriendo en puerto 4000');
  });
}

startServer();