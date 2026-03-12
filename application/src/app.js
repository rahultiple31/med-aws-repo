const http = require('node:http');

const SERVICE_NAME = process.env.SERVICE_NAME || 'cdk-web';
const STARTED_AT = new Date();

function summarize(value) {
  if (!value) {
    return { present: false };
  }

  const text = String(value);
  const display =
    text.length <= 8 ? text : `${text.slice(0, 4)}...${text.slice(-3)}`;

  return { present: true, value: display };
}

function buildStatus() {
  return {
    status: 'ok',
    service: SERVICE_NAME,
    time: new Date().toISOString(),
    startedAt: STARTED_AT.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    env: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: Number(process.env.PORT || 3000),
      appVersion: process.env.APP_VERSION || 'dev',
    },
    integrations: {
      postgresHost: summarize(process.env.POSTGRES_HOST),
      postgresPort: process.env.POSTGRES_PORT || '5432',
      memcachedEndpoint: summarize(process.env.MEMCACHED_ENDPOINT),
      dynamodbTable: summarize(process.env.DYNAMODB_TABLE),
    },
  };
}

function sendJson(res, code, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('content-length', Buffer.byteLength(body));
  res.end(body);
}

function createServer() {
  return http.createServer((req, res) => {
    const method = req.method || 'GET';
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;

    if (method !== 'GET') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return;
    }

    if (path === '/' || path === '/health' || path === '/ready' || path === '/live') {
      sendJson(res, 200, buildStatus());
      return;
    }

    if (path === '/env') {
      sendJson(res, 200, buildStatus());
      return;
    }

    sendJson(res, 404, { error: 'not_found' });
  });
}

module.exports = {
  createServer,
  buildStatus,
};
