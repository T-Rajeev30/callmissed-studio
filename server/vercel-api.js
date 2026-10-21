const API_ROOT = 'https://api.callmissed.com/v1';

const ratePolicies = {
  chat: { max: 20, windowMs: 60_000 },
  images: { max: 3, windowMs: 60 * 60_000 },
  voice: { max: 3, windowMs: 60 * 60_000 },
};

const voiceRequest = {
  system_prompt:
    'You are a warm, concise creative assistant. Help the user brainstorm, write, and explore ideas.',
  voice: 'shubh',
  language: 'en-IN',
  llm_model: 'kimi-k2.5',
  max_duration_seconds: 180,
};

const limits = new Map();

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

function consumeRateLimit(service, ip, policy) {
  const now = Date.now();
  for (const [entryKey, entry] of limits) {
    if (now >= entry.resetAt) limits.delete(entryKey);
  }
  const key = `${ip}:${service}`;
  const bucket = limits.get(key);
  if (!bucket) {
    limits.set(key, { count: 1, resetAt: now + policy.windowMs });
    return { allowed: true };
  }
  if (bucket.count >= policy.max) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count += 1;
  return { allowed: true };
}

export function statusHandler(_req, res) {
  res.status(200).json({ configured: Boolean(process.env.CALLMISSED_API_KEY?.trim()) });
}

export async function serviceHandler(req, res) {
  const service = req.query.service;
  const policy = ratePolicies[service];
  if (!policy) {
    return res
      .status(404)
      .json({ error: { message: 'Unknown service.', code: 'unknown_service' } });
  }

  const apiKey = process.env.CALLMISSED_API_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({
      error: {
        message: 'The app owner needs to configure CALLMISSED_API_KEY on the server.',
        code: 'missing_api_key',
      },
    });
  }
  if (!apiKey.startsWith('cm_')) {
    return res.status(500).json({
      error: {
        message: 'CALLMISSED_API_KEY must be a CallMissed key beginning with cm_.',
        code: 'invalid_server_config',
      },
    });
  }

  const body = service === 'voice' ? voiceRequest : req.body;
  if ((service === 'chat' && !validChat(body)) || (service === 'images' && !validImage(body))) {
    return res.status(400).json({
      error: { message: 'The request was not valid for this feature.', code: 'invalid_request' },
    });
  }

  const limit = consumeRateLimit(
    service,
    req.headers['x-forwarded-for']?.split(',')[0] || 'unknown',
    policy,
  );
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
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
    const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    const idempotencyKey = req.headers['idempotency-key'];
    if (service !== 'voice' && idempotencyKey && /^[a-zA-Z0-9_-]{8,128}$/.test(idempotencyKey)) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    const upstream = await fetch(`${API_ROOT}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const responseBody = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';
    const requestId = upstream.headers.get('x-request-id');
    if (requestId) res.setHeader('X-Request-ID', requestId);
    res.status(upstream.status).setHeader('Content-Type', contentType);
    return res.send(responseBody);
  } catch {
    const timedOut = controller.signal.aborted;
    return res.status(timedOut ? 504 : 502).json({
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
}
