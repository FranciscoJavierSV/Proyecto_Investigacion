const express = require('express');
const router = express.Router();
const { performance } = require("perf_hooks");
const { getDB } = require('../../config/db');

// GET ALL ELEMENTS AT ONCE
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const limit = parseInt(req.query.size) || 0;
    const timeStart = performance.now();
    
    const [
        clientes,
        datosfacturas,
        facturas,
        productos,
        variaciones
    ] = await Promise.all([
        db.collection('clientes').find({}).limit(limit).toArray(),
        db.collection('datosfacturas').find({}).limit(limit).toArray(),
        db.collection('facturas').find({}).limit(limit).toArray(),
        db.collection('productos').find({}).limit(limit).toArray(),
        db.collection('variaciones').find({}).limit(limit).toArray()
    ]);

    const timeEnd = performance.now();

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