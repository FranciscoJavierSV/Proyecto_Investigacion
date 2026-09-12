const express = require('express');
const router = express.Router();
const { performance } = require("perf_hooks");
const { getDB } = require('../../config/db');


// GET ALL variations
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    // Parametros de paginacion: size define la cantidad y offset el desplazamiento
    const limit = parseInt(req.query.size) || 0;
    const offset = parseInt(req.query.offset) || 0;
    const collection = db.collection('variaciones');

    const timeStart = performance.now();
    const variaciones = await collection.find({}).skip(offset).limit(limit).toArray();
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