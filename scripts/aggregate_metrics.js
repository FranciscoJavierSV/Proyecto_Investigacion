#!/usr/bin/env node
const fs = require('fs');
const readline = require('readline');
const path = require('path');

const METRICS_FILE = path.resolve(__dirname, '..', 'logs', 'metrics.jsonl');
const OUT_FILE = path.resolve(__dirname, '..', 'logs', 'metrics_summary.json');

function percentile(arr, p) {
  if (!arr.length) return null;
  const sorted = arr.slice().sort((a,b)=>a-b);
  const idx = (p/100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

async function main(){
  if (!fs.existsSync(METRICS_FILE)) {
    console.error('No metrics file:', METRICS_FILE);
    process.exit(1);
  }

  const groups = {}; // key -> { total_ms: [], db_fetch_ms: [], serialize_ms: [] }

  const rl = readline.createInterface({ input: fs.createReadStream(METRICS_FILE), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch(e){ continue; }
    const endpoint = obj.endpoint || obj.type || 'unknown';
    // try to extract size/limit
    let size = 'unknown';
    if (obj.params && (obj.params.size || obj.params.limit)) size = obj.params.size || obj.params.limit;
    if (obj.input && obj.input.limit) size = obj.input.limit;
    if (obj.query && obj.query.limit) size = obj.query.limit;

    const key = `${endpoint}::${size}`;
    if (!groups[key]) groups[key] = { total_ms: [], db_fetch_ms: [], serialize_ms: [], ttfb_ms: [], count:0 };
    const g = groups[key];
    if (obj.total_ms != null) g.total_ms.push(Number(obj.total_ms));
    if (obj.db_fetch_ms != null) g.db_fetch_ms.push(Number(obj.db_fetch_ms));
    if (obj.serialize_ms != null) g.serialize_ms.push(Number(obj.serialize_ms));
    if (obj.ttfb_ms != null) g.ttfb_ms.push(Number(obj.ttfb_ms));
    g.count += 1;
  }

  const out = {};
  for (const k of Object.keys(groups)){
    const g = groups[k];
    out[k] = {
      count: g.count,
      total_ms: { p50: percentile(g.total_ms,50), p95: percentile(g.total_ms,95), p99: percentile(g.total_ms,99) },
      db_fetch_ms: { p50: percentile(g.db_fetch_ms,50), p95: percentile(g.db_fetch_ms,95), p99: percentile(g.db_fetch_ms,99) },
      serialize_ms: { p50: percentile(g.serialize_ms,50), p95: percentile(g.serialize_ms,95), p99: percentile(g.serialize_ms,99) },
      ttfb_ms: { p50: percentile(g.ttfb_ms,50), p95: percentile(g.ttfb_ms,95), p99: percentile(g.ttfb_ms,99) }
    };
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
  console.log('Summary written to', OUT_FILE);
}

main().catch(err=>{ console.error(err); process.exit(1); });
