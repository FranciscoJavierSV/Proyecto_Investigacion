const { createSchema } = require('graphql-yoga');
const resolvers = require('./resolvers');

const typeDefs = /* GraphQL */ `

	type Query {
		obtenerDataset: DatasetResult
	}

	type DatasetResult {
		tiempoMs: Float
		clientes: [JSON]
		facturas: [JSON]
		datosfacturas: [JSON]
		productos: [JSON]
		variaciones: [JSON]
	}

	scalar JSON
`;

const schema = createSchema({
	typeDefs,
	resolvers
});

module.exports = { schema };