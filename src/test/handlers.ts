import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('*/api/status', () => HttpResponse.json({ configured: true })),
  http.post('*/api/chat', () =>
    HttpResponse.json({
      choices: [{ message: { role: 'assistant', content: 'A mocked reply.' } }],
    }),
  ),
  http.post('*/api/images', () => HttpResponse.json({ data: [{ b64_json: 'ZmFrZS1pbWFnZQ==' }] })),
  http.post('*/api/voice', () =>
    HttpResponse.json({
      id: 'session-test',
      ws_url: 'wss://voice.invalid',
      token: 'mock-token',
      status: 'created',
    }),
  ),
];
