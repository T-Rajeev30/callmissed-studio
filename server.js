import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.CALLMISSED_API_KEY?.trim();
const API_ROOT = 'https://api.callmissed.com/v1';
const ROOT = path.dirname(fileURLToPath(import.meta.url));

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}
if (API_KEY && !API_KEY.startsWith('cm_')) {
  throw new Error('CALLMISSED_API_KEY must be a CallMissed key beginning with cm_.');
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb', strict: true }));

const limits = new Map();
function consumeRateLimit(service, ip, max, windowMs) {
  const now = Date.now();
  if (limits.size > 10_000) {
    for (const [entryKey, entry] of limits) {
      if (now >= entry.resetAt) limits.delete(entryKey);
    }
  }
  const key = `${ip}:${service}`;
  const bucket = limits.get(key);
  if (!bucket || now >= bucket.resetAt) {
    limits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (bucket.count >= max) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count += 1;
  return { allowed: true };
}

const ratePolicies = {
  chat: { max: 20, windowMs: 60_000 },
  images: { max: 3, windowMs: 60 * 60_000 },
  voice: { max: 3, windowMs: 60 * 60_000 },
};

function validChat(body) {
  return (
    body &&
    typeof body === 'object' &&
    ['kimi-k2.5', 'gpt-5-mini'].includes(body.model) &&
    Array.isArray(body.messages) &&
    body.messages.length > 0 &&
    body.messages.length <= 50 &&
    body.messages.every(
      (message) =>
        message &&
        ['user', 'assistant'].includes(message.role) &&
        typeof message.content === 'string' &&
        message.content.length <= 16_000,
    ) &&
    body.max_tokens === 700
  );
}

function validImage(body) {
  return (
    body &&
    typeof body === 'object' &&
    body.model === 'flux-2-klein-9b' &&
    typeof body.prompt === 'string' &&
    body.prompt.trim().length > 0 &&
    body.prompt.length <= 4_000 &&
    body.n === 1 &&
    body.size === '1024x1024'
  );
}

const voiceRequest = {
  system_prompt:
    'You are a warm, concise creative assistant. Help the user brainstorm, write, and explore ideas.',
  voice: 'shubh',
  language: 'en-IN',
  llm_model: 'kimi-k2.5',
  max_duration_seconds: 180,
};

app.get('/api/status', (_req, res) => res.json({ configured: Boolean(API_KEY) }));

app.post('/api/:service', async (req, res) => {
  const service = req.params.service;
  if (!Object.hasOwn(ratePolicies, service)) {
    return res
      .status(404)
      .json({ error: { message: 'Unknown service.', code: 'unknown_service' } });
  }
  if (!API_KEY) {
    return res.status(503).json({
      error: {
        message: 'The app owner needs to configure CALLMISSED_API_KEY on the server.',
        code: 'missing_api_key',
      },
    });
  }

  const requestBody = service === 'voice' ? voiceRequest : req.body;
  if (
    (service === 'chat' && !validChat(requestBody)) ||
    (service === 'images' && !validImage(requestBody))
  ) {
    return res.status(400).json({
      error: { message: 'The request was not valid for this feature.', code: 'invalid_request' },
    });
  }

  const policy = ratePolicies[service];
  const limit = consumeRateLimit(service, req.ip, policy.max, policy.windowMs);
  if (!limit.allowed) {
    res.set('Retry-After', String(limit.retryAfter));
    return res.status(429).json({
      error: {
        message: 'This feature is being used too quickly. Please wait and try again.',
        code: 'local_rate_limit',
      },
    });
  }

  const endpoint =
    service === 'chat'
      ? '/chat/completions'
      : service === 'images'
        ? '/images/generations'
        : '/voice/sessions';
  const controller = new AbortController();
  const timeoutMs = service === 'images' ? 120_000 : 45_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };
    const idempotencyKey = req.get('Idempotency-Key');
    if (service !== 'voice' && idempotencyKey && /^[a-zA-Z0-9_-]{8,128}$/.test(idempotencyKey)) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    const upstream = await fetch(`${API_ROOT}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const contentType = upstream.headers.get('content-type') || 'application/json';
    const body = await upstream.text();
    const requestId = upstream.headers.get('x-request-id');
    if (requestId) res.set('X-Request-ID', requestId);
    res.status(upstream.status).type(contentType).send(body);
  } catch {
    const timedOut = controller.signal.aborted;
    res.status(timedOut ? 504 : 502).json({
      error: {
        message: timedOut
          ? 'CallMissed did not respond before the request timed out.'
          : 'Could not reach CallMissed.',
        code: timedOut ? 'upstream_timeout' : 'upstream_unavailable',
      },
    });
  } finally {
    clearTimeout(timeout);
  }
});

app.use(express.static(path.join(ROOT, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(ROOT, 'dist', 'index.html')));

app.listen(PORT);
