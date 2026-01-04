const http = require('http');

const url = process.env.HEALTHCHECK_URL ?? 'http://localhost:3001/v1/config';
const timeoutMs = Number(process.env.HEALTHCHECK_TIMEOUT ?? 5000);

const request = http.get(url, (res) => {
  if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
    res.resume();
    process.exit(0);
  } else {
    console.error(`[healthcheck] unexpected status: ${res.statusCode}`);
    process.exit(1);
  }
});

request.on('timeout', () => {
  console.error('[healthcheck] request timed out');
  request.abort();
  process.exit(1);
});

request.on('error', (err) => {
  console.error('[healthcheck] request failed', err.message);
  process.exit(1);
});

request.setTimeout(timeoutMs);
