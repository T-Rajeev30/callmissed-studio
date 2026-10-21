import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.CALLMISSED_API_KEY;
const apiRoot = 'https://api.callmissed.com/v1';
const root = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: '1mb' }));

app.get('/api/status', (_req, res) => res.json({ configured: Boolean(apiKey) }));
app.post('/api/:service', async (req, res) => {
  if (!apiKey) return res.status(503).json({ error: { message: 'The app owner needs to configure CALLMISSED_API_KEY on the server.' } });
  const endpoints = { chat: '/chat/completions', images: '/images/generations', voice: '/voice/sessions' };
  const endpoint = endpoints[req.params.service];
  if (!endpoint) return res.status(404).json({ error: { message: 'Unknown service.' } });
  try {
    const upstream = await fetch(`${apiRoot}${endpoint}`, {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(req.body)
    });
    const body = await upstream.text();
    res.status(upstream.status).type(upstream.headers.get('content-type') || 'application/json').send(body);
  } catch (error) {
    res.status(502).json({ error: { message: error instanceof Error ? error.message : 'CallMissed request failed.' } });
  }
});
app.use(express.static(path.join(root, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
app.listen(port, () => console.log(`CallMissed Studio listening on ${port}`));
