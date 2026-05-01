const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname);

if (!fs.existsSync(logsDir)) {
	fs.mkdirSync(logsDir);
}

const logFile = path.join(logsDir, 'Historial_metricas.log');

function writeMetricsLog(data) {

	const log = `
CONSULTA: ${data.queryName}

Response Time: ${data.responseTime} ms
TTFB: ${data.ttfb} ms
Payload Size: ${data.payloadSize} bytes
CPU Usage: ${data.cpuUsage} ms
Memory Usage: ${(data.memoryUsage / 1024 / 1024).toFixed(2)} MB
Errors: ${data.errors}

====================================================\n`;

	fs.appendFileSync(logFile, log);
}

module.exports = {
	writeMetricsLog
};