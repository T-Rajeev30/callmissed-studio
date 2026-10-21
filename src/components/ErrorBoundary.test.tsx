import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function CrashingChild(): ReactNode {
  throw new Error('Render failed');
}

describe('ErrorBoundary', () => {
  it('renders a recovery action when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <CrashingChild />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('We hit a snag.');
    expect(screen.getByRole('button', { name: 'Refresh studio' })).toBeInTheDocument();
  });
});
