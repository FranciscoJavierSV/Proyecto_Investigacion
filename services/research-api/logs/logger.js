const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname);

if (!fs.existsSync(logsDir)) {
	fs.mkdirSync(logsDir);
}

const logFile = path.join(logsDir, 'Historial_metricas.log');
const jsonLogFile = path.join(logsDir, 'metrics.jsonl');

function writeMetricsJson(data) {
	try {
		const line = JSON.stringify(data) + '\n';
		fs.appendFileSync(jsonLogFile, line);
	}
	catch (err) {
		// best-effort logging
		try { fs.appendFileSync(logFile, `\nJSON_LOG_ERROR: ${err.message}\n`); } catch(e){}
	}
}

function writeMetricsLog(data) {
	// Write a human-readable log and also append JSON line for offline analysis
	try { writeMetricsJson(data); } catch(e){}

	const memMb = data.memoryUsage ? (data.memoryUsage / 1024 / 1024).toFixed(2) : '0.00';
	const log = `\nCONSULTA: ${data.queryName || 'unknown'}\n\nResponse Time: ${data.responseTime || data.total_ms || 'n/a'} ms\nTTFB: ${data.ttfb || 'n/a'} ms\nPayload Size: ${data.payloadSize || data.payload_bytes || 0} bytes\nCPU Usage: ${data.cpuUsage || 0} ms\nMemory Usage: ${memMb} MB\nErrors: ${data.errors || 0}\n\n====================================================\n`;

	try { fs.appendFileSync(logFile, log); } catch(e){}
}

module.exports = {
	writeMetricsLog,
	writeMetricsJson
};