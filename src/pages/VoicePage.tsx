import { motion } from 'framer-motion';
import { AudioLines, LoaderCircle, Mic, MicOff, Square, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { useVoiceAgent } from '../hooks/useVoiceAgent';

const voiceCopy = {
  idle: ['Ready when you are', 'Start a real-time conversation with your creative sidekick.'],
  connecting: ['Connecting to your agent…', 'Setting up a secure voice session.'],
  listening: ['Listening', 'Speak naturally — your agent is here.'],
  thinking: ['Thinking', 'Your agent is putting together a reply.'],
  speaking: ['Speaking', 'Your agent is replying. You can interrupt at any time.'],
  error: ['Couldn’t connect', 'Check microphone access and try again.'],
} as const;

export default function VoicePage() {
  const { status, transcript, error, muted, start, end, toggleMute } = useVoiceAgent();
  const [title, description] = voiceCopy[status];
  async function connect() {
    const success = await start();
    if (success) toast.success('Voice session started.');
  }
  return (
    <motion.section
      className="feature-page voice-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
    >
      <div className="feature-intro">
        <div className="eyebrow">
          <AudioLines size={16} /> VOICE AGENT
        </div>
        <h1>
          Ideas sound
          <br />
          <em>better out loud.</em>
        </h1>
        <p>Have a hands-free conversation with your creative sidekick.</p>
      </div>
      <div className="voice-card">
        <div className={`voice-orb ${status}`} aria-hidden="true">
          <div className="orb-inner">
            <AudioLines size={24} />
          </div>
          <span className="orb-ring ring-one" />
          <span className="orb-ring ring-two" />
        </div>
        <div className="voice-state" aria-live="polite">
          {title}
        </div>
        <div className="voice-substate">{error ?? description}</div>
        {status === 'listening' || status === 'thinking' || status === 'speaking' ? (
          <div className="voice-controls">
            <button className="call-button hangup" onClick={() => void end()}>
              <Square size={16} fill="currentColor" /> End conversation
            </button>
            <button
              className="mute-button"
              onClick={() => void toggleMute()}
              aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {muted ? <MicOff size={16} /> : <Mic size={16} />}
              <span>{muted ? 'Unmute' : 'Mute'}</span>
            </button>
          </div>
        ) : (
          <button
            className="call-button"
            onClick={() => void connect()}
            disabled={status === 'connecting'}
          >
            {status === 'connecting' ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Mic size={16} />
            )}{' '}
            {status === 'error' ? 'Try again' : 'Start conversation'}
          </button>
        )}
        <div className="voice-secure">
          <span
            className={`status-dot ${status === 'listening' || status === 'speaking' ? 'on' : ''}`}
          />
          {status === 'listening' || status === 'thinking' || status === 'speaking'
            ? `${muted ? 'Microphone muted' : 'Microphone active'} · WebRTC`
            : 'Microphone access requested when you connect'}
        </div>
      </div>
      {transcript.length > 0 && (
        <div className="transcript" aria-live="polite">
          <div className="transcript-header">
            <span>LIVE TRANSCRIPT</span>
            <button onClick={() => toast('Transcript clears when the next call starts.')}>
              SESSION ONLY
            </button>
          </div>
          {transcript.map((message, index) => (
            <div className="transcript-line" key={`${index}-${message.role}`}>
              <b>{message.role === 'user' ? 'You' : 'Agent'}</b>
              <span>{message.content}</span>
            </div>
          ))}
        </div>
      )}
      <div className="voice-footnote">
        <Volume2 size={16} /> Your agent will greet you when the call connects. Voice sessions are
        capped at 3 minutes.
      </div>
    </motion.section>
  );
}
