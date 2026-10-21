import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__CM_E2E_VOICE_ROOM_FACTORY__ = () => ({
      on: () => undefined,
      connect: async () => undefined,
      disconnect: async () => undefined,
      localParticipant: { setMicrophoneEnabled: async () => undefined },
    });
  });
  await page.route('**/api/status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ configured: true }),
    }),
  );
  await page.route('**/api/chat', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{ message: { role: 'assistant', content: 'Mocked reply for the smoke test.' } }],
      }),
    }),
  );
  await page.route('**/api/images', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ b64_json: 'ZmFrZS1pbWFnZQ==' }] }),
    }),
  );
  await page.route('**/api/voice', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'e2e-session',
        ws_url: 'wss://voice.invalid',
        token: 'e2e-token',
        status: 'created',
      }),
    }),
  );
});

test('chat sends a message and receives its mocked response', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Message Studio' }).fill('Hello from Playwright');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Mocked reply for the smoke test.')).toBeVisible();
});

test('image studio generates and previews a mocked image', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Images' }).click();
  await page.getByRole('textbox', { name: 'What should we create?' }).fill('A blue paper kite');
  await page.getByRole('button', { name: /create image/i }).click();
  await expect(page.getByRole('img', { name: 'A blue paper kite' })).toBeVisible();
  await page.getByRole('button', { name: 'Preview image: A blue paper kite' }).click();
  await expect(page.getByRole('dialog', { name: 'Image preview' })).toBeVisible();
});

test('voice agent starts, mutes, and ends without a network call', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Voice' }).click();
  await page.getByRole('button', { name: 'Start conversation' }).click();
  await expect(page.locator('.voice-state')).toHaveText('Listening');
  await page.getByRole('button', { name: 'Mute microphone' }).click();
  await expect(page.getByText(/Microphone muted/)).toBeVisible();
  await page.getByRole('button', { name: /end conversation/i }).click();
  await expect(page.getByText('Ready when you are')).toBeVisible();
});

test('theme toggles and the mobile drawer reaches every feature', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  if (isMobile) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'Images' }).click();
    await expect(page.getByRole('textbox', { name: 'What should we create?' })).toBeVisible();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'Chat' }).click();
  }
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
    const composerWidth = await page
      .locator('.composer')
      .evaluate((element) => element.getBoundingClientRect().width);
    expect(composerWidth, `composer is too narrow at ${width}px`).toBeGreaterThanOrEqual(
      Math.min(400, width * 0.8),
    );
  }
});
