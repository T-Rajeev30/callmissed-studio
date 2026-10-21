import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatPage from './ChatPage';
import ImagePage from './ImagePage';
import VoicePage from './VoicePage';
import { server } from '../test/setup';

const voiceMock = vi.hoisted(() => ({
  instances: [] as Array<{
    handlers: Record<string, (...args: unknown[]) => void>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    localParticipant: { setMicrophoneEnabled: ReturnType<typeof vi.fn> };
  }>,
}));

vi.mock('livekit-client', () => ({
  RoomEvent: {
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    TranscriptionReceived: 'transcriptionReceived',
    ActiveSpeakersChanged: 'activeSpeakersChanged',
    Disconnected: 'disconnected',
  },
  Track: { Kind: { Audio: 'audio' } },
  Room: class {
    handlers: Record<string, (...args: unknown[]) => void> = {};
    connect = vi.fn().mockResolvedValue(undefined);
    disconnect = vi.fn().mockResolvedValue(undefined);
    localParticipant = { setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined) };
    on = vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      this.handlers[event] = callback;
    });
    constructor() {
      voiceMock.instances.push(this as unknown as (typeof voiceMock.instances)[number]);
    }
  },
}));

beforeEach(() => {
  voiceMock.instances.length = 0;
});

describe('feature pages', () => {
  it('shows the chat empty-state prompts and sends a message on Enter', async () => {
    const user = userEvent.setup();
    render(<ChatPage />);
    expect(
      screen.getByRole('button', { name: /help me shape a product idea/i }),
    ).toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: 'Message Studio' });
    await user.type(input, 'Can you brainstorm?{Enter}');
    expect(await screen.findByText('A mocked reply.')).toBeInTheDocument();
  });

  it('shows a chat error and retries it successfully', async () => {
    let calls = 0;
    server.use(
      http.post('*/api/chat', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ error: { message: 'Temporary denial' } }, { status: 401 })
          : HttpResponse.json({
              choices: [{ message: { role: 'assistant', content: 'The retry worked.' } }],
            });
      }),
    );
    const user = userEvent.setup();
    render(<ChatPage />);
    await user.type(
      screen.getByRole('textbox', { name: 'Message Studio' }),
      'A test question{Enter}',
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Temporary denial');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('The retry worked.')).toBeInTheDocument();
  });

  it('clears the chat back to the starting state', async () => {
    const user = userEvent.setup();
    render(<ChatPage />);
    await user.click(screen.getByRole('button', { name: 'Clear conversation' }));
    expect(screen.getByText('An open line for')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /help me shape/i })).toBeInTheDocument();
  });

  it('renders markdown code and copies code blocks', async () => {
    server.use(
      http.post('*/api/chat', () =>
        HttpResponse.json({
          choices: [{ message: { role: 'assistant', content: '```ts\nconst answer = 42;\n```' } }],
        }),
      ),
    );
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(navigator.clipboard?.writeText).toBe(writeText);
    render(<ChatPage />);
    await user.type(screen.getByRole('textbox', { name: 'Message Studio' }), 'Show code{Enter}');
    const codeBlock = await screen.findByRole('code');
    expect(codeBlock.textContent).toContain('const answer = 42;');
    await user.click(screen.getByRole('button', { name: 'Copy code' }));
    expect(writeText).toHaveBeenCalledWith('const answer = 42;');
    expect(screen.getByRole('button', { name: 'Copy code' })).toHaveTextContent('Copied');
  });

  it('shows the image empty state and generates a downloadable gallery image', async () => {
    const user = userEvent.setup();
    render(<ImagePage />);
    expect(screen.getByText('Your next idea, visualized.')).toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: 'What should we create?' }),
      'A tiny greenhouse',
    );
    await user.click(screen.getByRole('button', { name: /create image/i }));
    expect(await screen.findByRole('img', { name: 'A tiny greenhouse' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download image' })).toBeInTheDocument();
  });

  it('shows an image generation error without making a gallery item', async () => {
    server.use(
      http.post('*/api/images', () =>
        HttpResponse.json({ error: { message: 'No image credits' } }, { status: 402 }),
      ),
    );
    const user = userEvent.setup();
    render(<ImagePage />);
    await user.type(screen.getByRole('textbox', { name: 'What should we create?' }), 'Test image');
    await user.click(screen.getByRole('button', { name: /create image/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No image credits');
    expect(screen.getByText('Your next idea, visualized.')).toBeInTheDocument();
  });

  it('previews an image and closes the lightbox with Escape', async () => {
    const user = userEvent.setup();
    render(<ImagePage />);
    await user.type(screen.getByRole('textbox', { name: 'What should we create?' }), 'A blue lamp');
    await user.click(screen.getByRole('button', { name: /create image/i }));
    await screen.findByRole('img', { name: 'A blue lamp' });
    await user.click(screen.getByRole('button', { name: 'Preview image: A blue lamp' }));
    expect(screen.getByRole('dialog', { name: 'Image preview' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('starts, mutes, transcribes, and ends a voice session', async () => {
    const user = userEvent.setup();
    render(<VoicePage />);
    expect(screen.getByText('Ready when you are')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start conversation' }));
    expect(await screen.findByText('Listening')).toBeInTheDocument();
    const room = voiceMock.instances[0];
    act(() => actTriggerTranscript(room?.handlers.transcriptionReceived));
    expect(await screen.findByText('Hello from the caller')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mute microphone' }));
    expect(screen.getByText(/Microphone muted/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /end conversation/i }));
    await waitFor(() => expect(screen.getByText('Ready when you are')).toBeInTheDocument());
  });

  it('surfaces voice setup failures and can retry', async () => {
    server.use(
      http.post('*/api/voice', () =>
        HttpResponse.json({ error: { message: 'Mic permission denied' } }, { status: 403 }),
      ),
    );
    const user = userEvent.setup();
    render(<VoicePage />);
    await user.click(screen.getByRole('button', { name: 'Start conversation' }));
    expect(await screen.findByText('Mic permission denied')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

function actTriggerTranscript(callback?: (...args: unknown[]) => void) {
  callback?.([{ final: true, text: 'Hello from the caller' }], { isLocal: true });
}
