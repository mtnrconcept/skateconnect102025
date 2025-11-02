import { useRef, useState, useEffect } from 'react';

interface AdMediaProps {
  url: string;
  kind: 'image' | 'video';
  className?: string;
  landingUrl?: string;
}

export default function AdMedia({ url, kind, className = '', landingUrl }: AdMediaProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (kind === 'video' && videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.loop = true;
      void videoRef.current.play().catch(() => {
        /* autoplay might be blocked; ignore */
      });
    }
  }, [kind]);

  const togglePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (kind === 'video' && videoRef.current) {
      if (videoRef.current.paused) {
        void videoRef.current.play();
        setPaused(false);
      } else {
        videoRef.current.pause();
        setPaused(true);
      }
    }
  };

  const handleClick = () => {
    if (landingUrl) {
      window.open(landingUrl, '_blank');
    }
  };

  return (
    <div className={`relative ${className}`} onClick={handleClick}>
      {kind === 'video' ? (
        <video ref={videoRef} src={url} className="h-full w-full object-cover" muted playsInline loop />
      ) : (
        <img src={url} alt="ad" className="h-full w-full object-cover" />
      )}
      {kind === 'video' && (
        <button
          type="button"
          onClick={togglePause}
          className="absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white hover:bg-black/80"
        >
          {paused ? 'Lire' : 'Pause'}
        </button>
      )}
    </div>
  );
}

