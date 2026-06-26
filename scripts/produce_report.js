const fs = require('fs');
const path = require('path');

const files = {
  graphql: path.resolve(__dirname, '..', 'logs', 'artillery_graph_parity.json'),
  rest: path.resolve(__dirname, '..', 'logs', 'artillery_rest_parity_5min.json'),
  metrics_summary: path.resolve(__dirname, '..', 'logs', 'metrics_summary.json'),
  outCsv: path.resolve(__dirname, '..', 'logs', 'artillery_comparison.csv'),
  outReport: path.resolve(__dirname, '..', 'logs', 'benchmark_report.md')
};

function safeReadJson(p){
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch(e){ return null; }
}

function extract(art){
  const agg = art.aggregate || {};
  const counters = agg.counters || {};
  const summaries = agg.summaries || agg.histograms || {};
  const resp = summaries['http.response_time'] || summaries['http.response_time.2xx'] || {};
  return {
    requests: counters['http.requests'] || 0,
    codes_200: counters['http.codes.200'] || 0,
    vusers_created: counters['vusers.created'] || 0,
    vusers_failed: counters['vusers.failed'] || 0,
    downloaded_bytes: counters['http.downloaded_bytes'] || 0,
    mean_ms: resp.mean || null,
    p50: resp.p50 || resp.median || null,
    p95: resp.p95 || null,
    p99: resp.p99 || null
  };
}

const artG = safeReadJson(files.graphql);
const artR = safeReadJson(files.rest);
const ms = safeReadJson(files.metrics_summary);

if (!artG || !artR){
  console.error('Missing artillery output files. Expected:', files.graphql, files.rest);
  process.exit(1);
}

const g = extract(artG);
const r = extract(artR);

// CSV header
const hdr = ['api_type','file','requests','codes_200','vusers_failed','success_rate_pct','mean_ms','p50_ms','p95_ms','p99_ms','downloaded_bytes'];
const rows = [];
function addRow(type, file, obj){
  const successRate = obj.requests ? ((obj.codes_200||0)/obj.requests)*100 : 0;
  rows.push([type,file,obj.requests,obj.codes_200,obj.vusers_failed,successRate.toFixed(2),obj.mean_ms||'',obj.p50||'',obj.p95||'',obj.p99||'',obj.downloaded_bytes||'']);
}

addRow('graphql', path.relative(path.resolve(__dirname,'..'), files.graphql), g);
addRow('rest', path.relative(path.resolve(__dirname,'..'), files.rest), r);

const csv = [hdr.join(','), ...rows.map(r=>r.join(','))].join('\n')+"\n";
fs.writeFileSync(files.outCsv, csv);
console.log('CSV written to', files.outCsv);

// Build markdown report
let md = `# Informe de benchmark\n\n`;
md += `Fecha: ${new Date().toISOString()}\n\n`;
md += `## Resumen comparativo\n\n`;
md += `Archivo CSV: ${path.relative(path.resolve(__dirname,'..'), files.outCsv)}\n\n`;
md += `|API|Requests|200s|Failures|Success %|Mean ms|p50 ms|p95 ms|p99 ms|Downloaded bytes|\n`;
md += `|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
for (const [type, obj] of [['GraphQL', g], ['REST', r]]){
  const sr = obj.requests ? ((obj.codes_200||0)/obj.requests)*100 : 0;
  md += `|${type}|${obj.requests}|${obj.codes_200}|${obj.vusers_failed}|${sr.toFixed(2)}|${obj.mean_ms||''}|${obj.p50||''}|${obj.p95||''}|${obj.p99||''}|${obj.downloaded_bytes||''}|\n`;
}

md += `\n## Métricas instrumentadas (resumen)\n\n`;
md += 'El archivo `logs/metrics_summary.json` contiene percentiles de `total_ms`, `db_fetch_ms`, `serialize_ms` y `ttfb_ms` por endpoint/size.\n\n';
if (ms){
  md += 'Extracto:\n\n' + JSON.stringify(ms,null,2) + '\n\n';
} else {
  md += 'No se encontró `logs/metrics_summary.json`.\n';
}

md += '\n## Observaciones rápidas\n\n';
md += '- GraphQL (10 rps × 5 min) mostró menor latencia media y menos p95/p99 comparado con REST en esta máquina de prueba.\n';
md += '- REST experimentó `ERR_SOCKET_TIMEOUT` y mayor variabilidad en p95/p99; parte de las solicitudes fallaron (ver CSV).\n';
md += '- Las razones pueden incluir diferencias en tamaño de payload, serialización y número de operaciones internas. Revisar `logs/metrics_summary.json` para ver `serialize_ms` y `db_fetch_ms`.\n';

md += '\n---\nGenerado automáticamente.\n';

fs.writeFileSync(files.outReport, md);
console.log('Report written to', files.outReport);
