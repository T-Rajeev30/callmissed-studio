import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fatal-state" role="alert">
          <AlertTriangle size={24} />
          <h1>We hit a snag.</h1>
          <p>Refresh the page to get back to your workspace.</p>
          <button onClick={() => window.location.reload()}>Refresh studio</button>
        </main>
      );
    }
    return this.props.children;
  }
}
