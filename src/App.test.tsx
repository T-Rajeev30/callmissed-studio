import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';

describe('Studio shell', () => {
  beforeEach(() => localStorage.clear());

  it('switches features, keeps navigation accessible, and persists the theme', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Images' }));
    expect(await screen.findByText('Picture the')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Chat' }));
    expect(screen.getByRole('textbox', { name: 'Message Studio' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'light'));
    expect(localStorage.getItem('callmissed-theme')).toBe('light');
  });

  it('opens setup help and closes it with Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /API setup/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('opens the mobile drawer, navigates to voice, and closes the drawer', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Voice' }));
    expect(screen.getByRole('button', { name: 'Voice' })).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('starts in dark mode when stored light mode is unavailable', async () => {
    localStorage.setItem('callmissed-theme', 'light');
    render(<App />);
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'light'));
  });
});
