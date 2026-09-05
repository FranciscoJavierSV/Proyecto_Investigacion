const express = require('express');
const router = express.Router();
const { performance } = require("perf_hooks");
const { getDB } = require('../../config/db');
const { dbFetchDuration } = require('../../config/metrics');


// GET ALL clients
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const limit = parseInt(req.query.size) || 0;
    const collection = db.collection('clientes');

    const timeStart = performance.now();
    const clientes = await collection.find({}).limit(limit).toArray();
    const timeEnd = performance.now();

    try {
        const dbFetchMs = timeEnd - timeStart;
        dbFetchDuration.labels({ api_type: 'rest', operation: 'clientes_list' }).observe(dbFetchMs);
    } catch (e) {
        console.error('Error recording dbFetch metric (clientes):', e && e.message);
    }

    res.json({
      responseTimeMs: timeEnd - timeStart,
      clientes
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;