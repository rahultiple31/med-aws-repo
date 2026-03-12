const { createServer } = require('./app');

const port = Number.parseInt(process.env.PORT || '3000', 10);
const host = '0.0.0.0';

const server = createServer();

server.listen(port, host, () => {
  console.log(`[cdk-web] listening on http://${host}:${port}`);
});

function shutdown(signal) {
  console.log(`[cdk-web] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.on('error', (err) => {
  console.error('[cdk-web] server error', err);
  process.exit(1);
});
