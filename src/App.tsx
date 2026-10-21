import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import {
  AudioLines,
  Check,
  ChevronRight,
  Images,
  KeyRound,
  Menu,
  MessageCircle,
  Moon,
  Sun,
  X,
} from 'lucide-react';
import { Toaster } from 'sonner';
import { useApiStatus } from './hooks/useApiStatus';
import { useTheme } from './hooks/useTheme';

const ChatPage = lazy(() => import('./pages/ChatPage'));
const ImagePage = lazy(() => import('./pages/ImagePage'));
const VoicePage = lazy(() => import('./pages/VoicePage'));

type PageId = 'chat' | 'images' | 'voice';
const pages = [
  { id: 'chat' as const, label: 'Chat', icon: MessageCircle, title: 'New conversation' },
  { id: 'images' as const, label: 'Images', icon: Images, title: 'Image studio' },
  { id: 'voice' as const, label: 'Voice', icon: AudioLines, title: 'Voice agent' },
];

export default function App() {
  const [page, setPage] = useState<PageId>('chat');
  const [visited, setVisited] = useState<Record<PageId, boolean>>({
    chat: true,
    images: false,
    voice: false,
  });
  const [voiceActive, setVoiceActive] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const setupDialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const configured = useApiStatus();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSetupOpen(false);
        setDrawerOpen(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPage('chat');
        setDrawerOpen(false);
        setSetupOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!setupOpen) return;
    const dialog = setupDialogRef.current;
    const firstControl = dialog?.querySelector<HTMLElement>(
      'button, a[href], input, textarea, [tabindex]:not([tabindex="-1"])',
    );
    firstControl?.focus();
    return () => returnFocusRef.current?.focus();
  }, [setupOpen]);

  function openSetup() {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSetupOpen(true);
  }

  function trapDialogFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;
    const dialog = setupDialogRef.current;
    const controls = dialog?.querySelectorAll<HTMLElement>(
      'button, a[href], input, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  useEffect(() => {
    const onVoiceStatus = (event: Event) => {
      const state = (event as CustomEvent<string>).detail;
      setVoiceActive(['connecting', 'listening', 'thinking', 'speaking'].includes(state));
    };
    window.addEventListener('callmissed:voice-status', onVoiceStatus);
    return () => window.removeEventListener('callmissed:voice-status', onVoiceStatus);
  }, []);

  function navigate(next: PageId) {
    setPage(next);
    setVisited((current) => ({ ...current, [next]: true }));
    setDrawerOpen(false);
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className={`app-shell theme-${theme}`}>
        {drawerOpen && (
          <button
            className="drawer-scrim"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
          />
        )}
        <aside
          className={`sidebar ${drawerOpen ? 'drawer-open' : ''}`}
          aria-label="Main navigation"
        >
          <a
            className="brand"
            href="#home"
            onClick={(event) => {
              event.preventDefault();
              navigate('chat');
            }}
          >
            <span className="brand-mark">
              <AudioLines size={20} />
            </span>
            <span>
              callmissed<span className="brand-dot">.</span>
            </span>
          </a>
          <button className="new-chat" onClick={() => navigate('chat')}>
            <MessageCircle size={16} /> New conversation <span className="shortcut">⌘ K</span>
          </button>
          <div className="nav-label">WORKSPACE</div>
          <nav>
            {pages.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`nav-item ${page === id ? 'active' : ''}`}
                aria-current={page === id ? 'page' : undefined}
                onClick={() => navigate(id)}
              >
                <Icon size={16} />
                {label}
                {id === 'voice' && voiceActive && (
                  <span className="live-dot" aria-label="Voice session active" />
                )}
                <ChevronRight className="nav-chevron" size={16} />
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="usage-card">
              <div className="usage-title">
                <AudioLines size={16} /> Your creative space
              </div>
              <p>Chat, make images, or have a real conversation.</p>
              <button onClick={openSetup}>
                <KeyRound size={16} />
                {configured ? 'API key connected' : 'API key not configured'}
                <span className={`key-indicator ${configured ? 'connected' : ''}`} />
              </button>
            </div>
            <div className="sidebar-footer">
              <span className="avatar" aria-hidden="true">
                R
              </span>
              <span className="profile-copy">
                <b>CallMissed Studio</b>
                <small>Personal workspace</small>
              </span>
              <span className="footer-mark">CM</span>
            </div>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <div className="topbar-left">
              <button
                className="menu-button icon-button"
                aria-label="Open navigation"
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen((value) => !value)}
              >
                {drawerOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div className="breadcrumbs">
                <span>Workspace</span>
                <span className="slash">/</span>
                <strong>{pages.find((item) => item.id === page)?.title}</strong>
              </div>
            </div>
            <div className="top-actions">
              <button
                className="theme-toggle icon-button"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button className="api-status" onClick={openSetup}>
                <span className={`status-dot ${configured ? 'on' : ''}`} />
                {configured ? 'API connected' : 'API setup'}
                <ChevronRight size={16} />
              </button>
            </div>
          </header>
          <div className="page-stack">
            {pages.map(
              ({ id }) =>
                visited[id] && (
                  <section
                    key={id}
                    className="route-surface"
                    hidden={page !== id}
                    aria-label={pages.find((item) => item.id === id)?.label}
                  >
                    <Suspense
                      fallback={
                        <div className="page-loading" role="status">
                          <span className="loading-orb" />
                          <span>Opening your workspace…</span>
                        </div>
                      }
                    >
                      {id === 'chat' ? (
                        <ChatPage />
                      ) : id === 'images' ? (
                        <ImagePage />
                      ) : (
                        <VoicePage />
                      )}
                    </Suspense>
                  </section>
                ),
            )}
          </div>
        </main>

        {setupOpen && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSetupOpen(false);
            }}
          >
            <motion.section
              ref={setupDialogRef}
              className="key-modal"
              onKeyDown={trapDialogFocus}
              role="dialog"
              aria-modal="true"
              aria-labelledby="setup-title"
              aria-describedby="setup-description"
              initial={{ opacity: 0, scale: 0.98, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
            >
              <button
                className="modal-close icon-button"
                onClick={() => setSetupOpen(false)}
                aria-label="Close setup"
              >
                <X size={16} />
              </button>
              <div className="modal-icon">
                <KeyRound size={20} />
              </div>
              <div className="eyebrow">SERVER-SIDE API KEY</div>
              <h2 id="setup-title">
                {configured ? 'CallMissed is connected' : 'One quick setup step'}
              </h2>
              <p id="setup-description">
                {configured
                  ? 'The API key is configured on the server and is never sent to your browser.'
                  : 'Set CALLMISSED_API_KEY in the hosting environment or local .env file, then restart the server.'}
              </p>
              <div className="setup-code">CALLMISSED_API_KEY=cm_••••••••</div>
              <div className="modal-help">
                Create a key in the{' '}
                <a href="https://console.callmissed.com" target="_blank" rel="noreferrer">
                  CallMissed console ↗
                </a>{' '}
                with llm, image, stt, and tts permissions.
              </div>
              <div className="modal-buttons">
                <button className="save-button" onClick={() => setSetupOpen(false)}>
                  <Check size={16} /> Got it
                </button>
              </div>
            </motion.section>
          </div>
        )}
        <Toaster theme={theme} position="bottom-right" richColors closeButton />
      </div>
    </MotionConfig>
  );
}
