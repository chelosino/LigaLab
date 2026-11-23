import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../api/index.js';
test('las rutas reescritas preservan liga y método', async () => {
  const handler = createHandler(async req => Response.json({ url: req.url, method: req.method }));
  for (const route of ['league','leagues','matches.csv']) {
    const r = await handler(new Request(`https://example.test/api/index?route=${route}&league=england`));
    assert.deepEqual(await r.json(), { url: `https://example.test/api/${route}?league=england`, method: 'GET' });
  }
  const direct = await handler(new Request('https://example.test/api/league?league=chile'));
  assert.equal((await direct.json()).url, 'https://example.test/api/league?league=chile');
  assert.equal((await handler(new Request('https://example.test/api/index?route=unknown'))).status, 404);
});
