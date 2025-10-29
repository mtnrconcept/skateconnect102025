import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTipProps {
  title?: string;
  children: ReactNode;
  className?: string;
  triggerLabel?: string;
}

export default function HelpTip({ title, children, className, triggerLabel }: HelpTipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) {
        return;
      }

      if (event.target instanceof Node && containerRef.current.contains(event.target)) {
        return;
      }

      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative inline-flex ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-600/60 bg-slate-900/90 text-xs font-semibold text-slate-200 transition hover:border-slate-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? descriptionId : undefined}
        aria-label={triggerLabel ?? 'Plus de contexte'}
      >
        <span className="sr-only">{triggerLabel ?? 'Plus de contexte'}</span>
        <HelpCircle size={14} aria-hidden className="pointer-events-none" />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={title ? labelId : undefined}
          aria-describedby={descriptionId}
          className="absolute right-0 top-8 z-50 w-64 rounded-2xl border border-slate-700/70 bg-slate-900/95 p-4 text-left text-sm text-slate-200 shadow-2xl shadow-black/50 backdrop-blur"
        >
          {title && (
            <p id={labelId} className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              {title}
            </p>
          )}
          <div id={descriptionId} className="space-y-2 text-sm leading-relaxed text-slate-200">
            {children}
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="mt-3 inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}
