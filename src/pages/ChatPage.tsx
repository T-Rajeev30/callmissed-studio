import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import {
  ArrowUp,
  AudioLines,
  Check,
  ChevronDown,
  Copy,
  MessageCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useChat } from '../hooks/useChat';
import type { ChatMessage } from '../api/client';

const suggestions = [
  'Help me shape a product idea',
  'Write a warm welcome message',
  'Explain something I’ve been curious about',
];

function CodeBlock({ children }: { children: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  async function copy() {
    const value = preRef.current?.innerText.trim() ?? '';
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error('Could not copy this code block.');
    }
  }
  return (
    <div className="code-wrap">
      <button className="code-copy" onClick={copy} aria-label="Copy code">
        {copied ? <Check size={16} /> : <Copy size={16} />}
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
      <pre ref={preRef}>{children}</pre>
    </div>
  );
}

function MessageBody({ message }: { message: ChatMessage }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{ pre: ({ children }) => <CodeBlock>{children}</CodeBlock> }}
    >
      {message.content}
    </ReactMarkdown>
  );
}

export default function ChatPage() {
  const { messages, busy, error, model, setModel, send, retry, clear } = useChat();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (typeof container.scrollTo === 'function')
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    else container.scrollTop = container.scrollHeight;
  }, [messages, busy]);

  async function submit(value = draft) {
    const text = value.trim();
    if (!text || busy) return;
    setDraft('');
    await send(text);
    const container = scrollRef.current;
    if (container && typeof container.scrollTo === 'function')
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    else if (container) container.scrollTop = container.scrollHeight;
  }

  return (
    <motion.section
      className="chat-page feature-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
    >
      <div className="chat-hero">
        <div className="feature-intro">
          <div className="eyebrow">
            <AudioLines size={16} /> YOUR CREATIVE LINE
          </div>
          <h1>
            An open line for
            <br />
            <em>what’s next.</em>
          </h1>
          <p>Think it through, sketch it out, or say it out loud.</p>
        </div>
        <div className="signal-mark" aria-hidden="true">
          <span className="signal-orbit orbit-a" />
          <span className="signal-orbit orbit-b" />
          <span className="signal-core">
            <AudioLines size={30} strokeWidth={1.5} />
          </span>
          <span className="signal-caption">
            <i /> READY TO RESPOND
          </span>
          <span className="signal-index">CM / 01</span>
        </div>
      </div>
      <div className="conversation-tools">
        <span>
          <MessageCircle size={16} /> Conversation
        </span>
        <button onClick={clear} aria-label="Clear conversation">
          <Trash2 size={16} /> Clear
        </button>
      </div>
      <div className="messages" ref={scrollRef} aria-live="polite" aria-relevant="additions text">
        {messages.length === 1 && messages[0]?.role === 'assistant' && (
          <div className="suggestion-grid" aria-label="Suggested prompts">
            {suggestions.map((item, index) => (
              <motion.button
                key={item}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => void submit(item)}
              >
                {item}
                <ArrowUp size={16} />
              </motion.button>
            ))}
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.article
              className={`message-row ${message.role}`}
              key={`${index}-${message.role}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="message-avatar" aria-hidden="true">
                {message.role === 'assistant' ? <AudioLines size={16} /> : 'Y'}
              </div>
              <div className="message-content">
                <div className="message-author">
                  {message.role === 'assistant' ? 'Studio' : 'You'}
                </div>
                <div className="message-bubble">
                  <MessageBody message={message} />
                </div>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
        {busy && (
          <div className="message-row" role="status" aria-label="Studio is thinking">
            <div className="message-avatar">
              <AudioLines size={16} />
            </div>
            <div className="message-content">
              <div className="message-author">Studio</div>
              <div className="typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="composer-wrap">
        <div className="composer">
          <label className="sr-only" htmlFor="chat-input">
            Message Studio
          </label>
          <textarea
            id="chat-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder="Ask anything…"
            rows={1}
            disabled={busy}
          />
          <div className="composer-tools">
            <div className="composer-left">
              <button className="icon-button" aria-label="New conversation" onClick={clear}>
                <Plus size={16} />
              </button>
              <button
                className="model-select"
                onClick={() => setModel(model === 'kimi-k2.5' ? 'gpt-5-mini' : 'kimi-k2.5')}
                aria-label={`Switch model. Current model ${model}`}
              >
                <span className="model-dot" />
                {model}
                <ChevronDown size={16} />
              </button>
            </div>
            <button
              className="send-button"
              onClick={() => void submit()}
              disabled={!draft.trim() || busy}
              aria-label="Send message"
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
        <div className="composer-note">
          Enter to send · Shift + Enter for a new line · AI can make mistakes
        </div>
        {error && (
          <div className="inline-error" role="alert">
            <span>{error}</span>
            <button onClick={retry} disabled={busy}>
              Retry
            </button>
          </div>
        )}
      </div>
    </motion.section>
  );
}
