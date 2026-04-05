const express = require('express');
const router = express.Router();
const { performance } = require("perf_hooks");
const { getDB } = require('../../config/db');

// GET ALL products
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const limit = parseInt(req.query.size) || 0;
    const collection = db.collection('productos');

    const timeStart = performance.now();
    const productos = await collection.find({}).limit(limit).toArray();
    const timeEnd = performance.now();

    res.json({
      responseTimeMs: timeEnd - timeStart,
      productos
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;