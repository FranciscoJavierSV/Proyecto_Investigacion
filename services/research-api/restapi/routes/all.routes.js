const express = require('express');
const router = express.Router();
const { performance } = require("perf_hooks");
const { getDB } = require('../../config/db');
const { dbFetchDuration } = require('../../config/metrics');


// GET ALL ELEMENTS AT ONCE
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const limit = parseInt(req.query.size) || 0;
    const offset = parseInt(req.query.offset) || 0;
    const timeStart = performance.now();
    
    const [
        clientes,
        datosfacturas,
        facturas,
        productos,
        variaciones
    ] = await Promise.all([
        db.collection('clientes').find({}).skip(offset).limit(limit).toArray(),
        db.collection('datosfacturas').find({}).skip(offset).limit(limit).toArray(),
        db.collection('facturas').find({}).skip(offset).limit(limit).toArray(),
        db.collection('productos').find({}).skip(offset).limit(limit).toArray(),
        db.collection('variaciones').find({}).skip(offset).limit(limit).toArray()
    ]);

    const timeEnd = performance.now();

    // observe DB fetch duration metric
    try {
        const dbFetchMs = timeEnd - timeStart;
        dbFetchDuration.labels({ api_type: 'rest', operation: 'all_collections' }).observe(dbFetchMs);
    } catch (e) {
        console.error('Error recording dbFetch metric (rest all):', e && e.message);
    }

    res.json({
      responseTimeMs: timeEnd - timeStart,
      clientes,
      datosfacturas,
      facturas,
      productos,
      variaciones
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;