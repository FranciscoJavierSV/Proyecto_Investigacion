const { performance } = require("perf_hooks");
const { writeMetricsJson } = require('../logs/logger');
const { dbFetchDuration } = require('../config/metrics');

// Función auxiliar para extraer los sub-campos solicitados por GraphQL (evita over-fetching en la BD)
function getRequestedSubFields(info, parentField) {
    try {
        const selections = info.fieldNodes[0].selectionSet.selections;
        const targetFieldNode = selections.find(s => s.name && s.name.value === parentField);
        if (!targetFieldNode) return null;

        // Busca dentro de { data { campo1 campo2 } } o selección directa
        const dataSelection = targetFieldNode.selectionSet?.selections.find(s => s.name && s.name.value === 'data');
        const fieldsToExtract = dataSelection ? dataSelection.selectionSet.selections : targetFieldNode.selectionSet.selections;

        const projection = {};
        fieldsToExtract.forEach(f => {
            if (f.name && f.name.value) {
                projection[f.name.value] = 1;
            }
        });
        return Object.keys(projection).length > 0 ? projection : null;
    } catch (e) {
        return null;
    }
}

module.exports = {
    Query: {
        obtenerDataset: async (_, { input }, { db, request }, info) => {
            const inicio = performance.now();
            const limit = input?.limit || 100;
            const offset = input?.offset || 0;

            // Descubrir qué colecciones y qué campos exactos pidió el cliente
            let requestedTopFields = [];
            try {
                const selections = info.fieldNodes[0].selectionSet.selections;
                requestedTopFields = selections.map(s => s.name && s.name.value).filter(Boolean);
            } catch (e) {
                requestedTopFields = ['clientes', 'facturas', 'datosfacturas', 'productos', 'variaciones'];
            }

            // Solo consultamos a Mongo lo que se pidió
            const dbPromises = [];
            const collectionKeys = [];

            // Helper para evaluar si se pidió la colección
            const shouldFetch = (colName) => requestedTopFields.includes(colName);

            const dbStart = performance.now();

            // Clientes
            if (shouldFetch('clientes')) {
                const proj = getRequestedSubFields(info, 'clientes');
                dbPromises.push(db.collection("clientes").find({}, { projection: proj }).skip(offset).limit(limit).toArray());
                collectionKeys.push('clientes');
            } else {
                dbPromises.push(Promise.resolve([]));
                collectionKeys.push('clientes');
            }

            // Facturas
            if (shouldFetch('facturas')) {
                const proj = getRequestedSubFields(info, 'facturas');
                dbPromises.push(db.collection("facturas").find({}, { projection: proj }).skip(offset).limit(limit).toArray());
                collectionKeys.push('facturas');
            } else {
                dbPromises.push(Promise.resolve([]));
                collectionKeys.push('facturas');
            }

            // Datos Facturas
            if (shouldFetch('datosfacturas')) {
                const proj = getRequestedSubFields(info, 'datosfacturas');
                dbPromises.push(db.collection("datosfacturas").find({}, { projection: proj }).skip(offset).limit(limit).toArray());
                collectionKeys.push('datosfacturas');
            } else {
                dbPromises.push(Promise.resolve([]));
                collectionKeys.push('datosfacturas');
            }

            // Productos
            if (shouldFetch('productos')) {
                const proj = getRequestedSubFields(info, 'productos');
                dbPromises.push(db.collection("productos").find({}, { projection: proj }).skip(offset).limit(limit).toArray());
                collectionKeys.push('productos');
            } else {
                dbPromises.push(Promise.resolve([]));
                collectionKeys.push('productos');
            }

            // Variaciones
            if (shouldFetch('variaciones')) {
                const proj = getRequestedSubFields(info, 'variaciones');
                dbPromises.push(db.collection("variaciones").find({}, { projection: proj }).skip(offset).limit(limit).toArray());
                collectionKeys.push('variaciones');
            } else {
                dbPromises.push(Promise.resolve([]));
                collectionKeys.push('variaciones');
            }

            const results = await Promise.all(dbPromises);
            const dbEnd = performance.now();
            const dbFetchMs = dbEnd - dbStart;

            const clientes = results[collectionKeys.indexOf('clientes')];
            const facturas = results[collectionKeys.indexOf('facturas')];
            const datosfacturas = results[collectionKeys.indexOf('datosfacturas')];
            const productos = results[collectionKeys.indexOf('productos')];
            const variaciones = results[collectionKeys.indexOf('variaciones')];

            try {
                dbFetchDuration.labels({ api_type: 'graphql', operation: 'obtenerDataset' }).observe(dbFetchMs);
            } catch (e) {
                console.error('Error recording dbFetch metric:', e && e.message);
            }

            const fin = performance.now();
            const totalMs = fin - inicio;

            let serializeMs = 0;
            let payloadBytes = 0;
            try {
                const resultObj = {
                    tiempoMs: totalMs,
                    clientes: { data: clientes },
                    facturas: { data: facturas },
                    datosfacturas: { data: datosfacturas },
                    productos: { data: productos },
                    variaciones: { data: variaciones }
                };
                const sStart = performance.now();
                const serialized = JSON.stringify(resultObj);
                const sEnd = performance.now();
                serializeMs = sEnd - sStart;
                payloadBytes = Buffer.byteLength(serialized);
            } catch (e) {
                serializeMs = 0;
                payloadBytes = 0;
            }

            try {
                writeMetricsJson({
                    request_id: request?.headers?.['x-request-id'] || null,
                    api_type: 'graphql',
                    operation: 'obtenerDataset',
                    limit,
                    offset,
                    requestedFields: requestedTopFields,
                    db_fetch_ms: Number(dbFetchMs.toFixed(2)),
                    total_ms: Number(totalMs.toFixed(2)),
                    timestamp: new Date().toISOString(),
                    returned_counts: {
                        clientes: clientes.length,
                        facturas: facturas.length,
                        datosfacturas: datosfacturas.length,
                        productos: productos.length,
                        variaciones: variaciones.length
                    },
                    serialize_ms: Number(serializeMs.toFixed(2)),
                    payload_bytes: Number(payloadBytes)
                });
            } catch (err) {
                console.error('Error writing JSON metrics:', err.message);
            }

            return {
                tiempoMs: totalMs,
                clientes: { data: clientes },
                facturas: { data: facturas },
                datosfacturas: { data: datosfacturas },
                productos: { data: productos },
                variaciones: { data: variaciones }
            };
        }
    }
};