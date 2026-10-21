import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  Image as ImageIcon,
  LoaderCircle,
  Maximize2,
  ImagePlus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useImageGen, type GeneratedAsset } from '../hooks/useImageGen';

const examples = [
  'A quiet morning in the mountains',
  'A retro travel poster for Bengaluru',
  'A tiny house hidden in a greenhouse',
];

function saveImage(asset: GeneratedAsset) {
  const link = document.createElement('a');
  link.href = asset.src;
  link.download = `callmissed-${asset.id}.png`;
  link.click();
}

export default function ImagePage() {
  const { gallery, busy, error, generate } = useImageGen();
  const [prompt, setPrompt] = useState('');
  const [selected, setSelected] = useState<GeneratedAsset | null>(null);
  async function create() {
    if (!prompt.trim() || busy) return;
    const success = await generate(prompt);
    if (success) {
      setPrompt('');
      toast.success('Image generation finished.');
    }
  }

  return (
    <motion.section
      className="feature-page tool-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
    >
      <div className="feature-intro">
        <div className="eyebrow">
          <ImagePlus size={16} /> IMAGE STUDIO
        </div>
        <h1>
          Picture the
          <br />
          <em>possibilities.</em>
        </h1>
        <p>Describe a scene. We’ll bring it to life.</p>
      </div>
      <div className="image-workspace">
        <div className="image-input-card">
          <label htmlFor="image-prompt">What should we create?</label>
          <textarea
            id="image-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void create();
              }
            }}
            placeholder="A sun-drenched reading nook, soft linen, a sleepy cat…"
            rows={3}
          />
          <div className="image-input-footer">
            <span>
              <ImagePlus size={16} /> One square image per request
            </span>
            <button
              className="generate-button"
              disabled={!prompt.trim() || busy}
              onClick={() => void create()}
            >
              {busy ? <LoaderCircle size={16} className="spin" /> : <ImagePlus size={16} />}{' '}
              {busy ? 'Creating…' : 'Create image'} <ArrowUp size={16} />
            </button>
          </div>
        </div>
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        {busy && (
          <div className="gallery-grid" aria-live="polite" aria-label="Generating image">
            <div className="gallery-skeleton">
              <span className="skeleton-shimmer" />
              <span>Dreaming it up…</span>
            </div>
          </div>
        )}
        {gallery.length > 0 ? (
          <div className="gallery-grid" aria-label="Generated images">
            {gallery.map((asset, index) => (
              <motion.article
                className="gallery-card"
                key={asset.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.2) }}
              >
                <button
                  className="gallery-open"
                  aria-label={`Preview image: ${asset.prompt}`}
                  onClick={() => setSelected(asset)}
                >
                  <img src={asset.src} alt={asset.prompt} />
                  <span>
                    <Maximize2 size={16} />
                  </span>
                </button>
                <div className="gallery-caption">
                  <p>{asset.prompt}</p>
                  <button onClick={() => saveImage(asset)} aria-label="Download image">
                    <ArrowDown size={16} />
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        ) : (
          !busy && (
            <div className="image-empty">
              <div className="placeholder-icon">
                <ImageIcon size={24} />
              </div>
              <b>Your next idea, visualized.</b>
              <span>Your creations will show up here.</span>
            </div>
          )
        )}
        <div className="suggestions">
          <span>NEED A SPARK?</span>
          {examples.map((value) => (
            <button key={value} onClick={() => setPrompt(value)}>
              {value}
              <ArrowUp size={16} />
            </button>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {selected && (
          <motion.div
            className="lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setSelected(null);
            }}
          >
            <motion.div
              className="lightbox-panel"
              initial={{ scale: 0.98 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.98 }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="lightbox-close"
                aria-label="Close preview"
                onClick={() => setSelected(null)}
              >
                <X size={20} />
              </button>
              <img src={selected.src} alt={selected.prompt} />
              <div className="lightbox-caption">
                <span>{selected.prompt}</span>
                <button onClick={() => saveImage(selected)}>
                  <ArrowDown size={16} /> Download
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
