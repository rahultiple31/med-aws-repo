const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createServer } = require('../src/app');

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const body = data ? JSON.parse(data) : null;
          resolve({ statusCode: res.statusCode, body });
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
  });
}

async function withServer(run) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    await run(port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('GET / returns ok payload', async () => {
  await withServer(async (port) => {
    const response = await requestJson(`http://127.0.0.1:${port}/`);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, 'ok');
    assert.equal(response.body.service, 'cdk-web');
  });
});

test('GET /missing returns 404', async () => {
  await withServer(async (port) => {
    const response = await requestJson(`http://127.0.0.1:${port}/missing`);
    assert.equal(response.statusCode, 404);
    assert.equal(response.body.error, 'not_found');
  });
});
