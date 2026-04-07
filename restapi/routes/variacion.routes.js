const express = require('express');
const router = express.Router();
const { performance } = require("perf_hooks");
const { getDB } = require('../../config/db');
const { metricsMiddleware } = require('../../config/metrics');

router.use(metricsMiddleware);

// GET ALL variations
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const limit = parseInt(req.query.size) || 0;
    const collection = db.collection('variaciones');

    const timeStart = performance.now();
    const variaciones = await collection.find({}).limit(limit).toArray();
    const timeEnd = performance.now();

    res.json({
      responseTimeMs: timeEnd - timeStart,
      variaciones
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;