// PROCESAR: Leer datos capturados y generar reportes para visualizacion

const fs = require('fs');
const path = require('path');

// CONFIGURACION
const DATA_DIR = process.env.DATA_DIR || './data';
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.jsonl');
const OUTPUT_DIR = path.join(DATA_DIR, 'processed');

// CREAR directorio de salida si no existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// LEER: Mensajes desde archivo JSONL
function readMessages() {
  if (!fs.existsSync(MESSAGES_FILE)) {
    console.log('No hay archivo de mensajes');
    return [];
  }

  const content = fs.readFileSync(MESSAGES_FILE, 'utf-8');
  const lines = content.trim().split('\n');
  return lines
    .filter(line => line.length > 0)
    .map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.error('Error parsing line:', line);
        return null;
      }
    })
    .filter(msg => msg !== null);
}

// PROCESAR: Generar estadisticas por campos
function generateFieldStats(messages) {
  const stats = {
    total_messages: messages.length,
    unique_empresas: new Set(),
    unique_sucursales: new Set(),
    unique_usuarios: new Set(),
    tieneVariaciones_count: { true: 0, false: 0 },
    precios_stats: { min: Infinity, max: 0, avg: 0 },
  };

  let totalPrecios = 0;
  let precioCount = 0;

  messages.forEach(msg => {
    if (msg._idEmpresa) stats.unique_empresas.add(msg._idEmpresa);
    if (msg._idSucursal) stats.unique_sucursales.add(msg._idSucursal);
    if (msg._idUsuario) stats.unique_usuarios.add(msg._idUsuario);
    
    if (msg.tieneVariaciones !== undefined) {
      const key = msg.tieneVariaciones ? 'true' : 'false';
      stats.tieneVariaciones_count[key]++;
    }

    if (msg.precio) {
      const precio = parseFloat(msg.precio);
      if (!isNaN(precio)) {
        stats.precios_stats.min = Math.min(stats.precios_stats.min, precio);
        stats.precios_stats.max = Math.max(stats.precios_stats.max, precio);
        totalPrecios += precio;
        precioCount++;
      }
    }
  });

  // Convertir Sets a arrays
  stats.unique_empresas = Array.from(stats.unique_empresas).length;
  stats.unique_sucursales = Array.from(stats.unique_sucursales).length;
  stats.unique_usuarios = Array.from(stats.unique_usuarios).length;

  if (precioCount > 0) {
    stats.precios_stats.avg = (totalPrecios / precioCount).toFixed(2);
  }

  return stats;
}

// EXPORTAR: A formato CSV
function exportAsCSV(messages) {
  if (messages.length === 0) {
    console.log('Sin mensajes para exportar');
    return;
  }

  // HEADERS: Usar las claves del primer mensaje
  const headers = Object.keys(messages[0]);
  
  // CONTENIDO: Convertir objetos a valores CSV
  const rows = messages.map(msg => {
    return headers.map(header => {
      const value = msg[header];
      // Escapar comillas y envolver valores con comas
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });

  // ESCRIBIR archivo
  const csvContent = [headers.join(','), ...rows].join('\n');
  const csvFile = path.join(OUTPUT_DIR, 'export.csv');
  fs.writeFileSync(csvFile, csvContent);
  console.log(`CSV exportado: ${csvFile}`);
}

// AGRUPAR: Por campo especifico
function groupBy(messages, field) {
  const grouped = {};
  
  messages.forEach(msg => {
    const key = msg[field] || 'undefined';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(msg);
  });

  return grouped;
}

// GENERAR: Resumen para graficas
function generateChartData(messages) {
  const data = {
    tieneVariaciones: groupBy(messages, 'tieneVariaciones'),
    porcentajeIva: groupBy(messages, 'porcentajeIva'),
    activo: groupBy(messages, 'activo'),
  };

  // Convertir a conteos
  const chartData = {};
  Object.entries(data).forEach(([field, groups]) => {
    chartData[field] = {};
    Object.entries(groups).forEach(([key, msgs]) => {
      chartData[field][key] = msgs.length;
    });
  });

  return chartData;
}

// MAIN: Ejecutar procesamiento
console.log('Leyendo mensajes...');
const messages = readMessages();
console.log(`Total de mensajes: ${messages.length}`);

if (messages.length > 0) {
  console.log('Generando estadisticas...');
  const stats = generateFieldStats(messages);
  
  console.log('\n=== Estadisticas de Campos ===');
  console.log(JSON.stringify(stats, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'stats.json'), JSON.stringify(stats, null, 2));

  console.log('\nGenerando datos para graficas...');
  const chartData = generateChartData(messages);
  console.log(JSON.stringify(chartData, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'charts.json'), JSON.stringify(chartData, null, 2));

  console.log('\nExportando a CSV...');
  exportAsCSV(messages);

  console.log('\n=== Procesamiento completado ===');
  console.log(`Archivos generados en: ${OUTPUT_DIR}`);
} else {
  console.log('No hay mensajes para procesar');
}
