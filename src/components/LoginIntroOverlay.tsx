import { useEffect, useRef, useState } from 'react';

interface LoginIntroOverlayProps {
  onComplete: () => void;
  videoSrc?: string;
}

export default function LoginIntroOverlay({
  onComplete,
  videoSrc = '/Création_d_animation_de_chargement_skate_urbain.mp4',
}: LoginIntroOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const completionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (completionTimeoutRef.current) {
        window.clearTimeout(completionTimeoutRef.current);
      }
    };
  }, []);

  const finishIntro = (delay = 680) => {
    if (completionTimeoutRef.current) {
      window.clearTimeout(completionTimeoutRef.current);
    }

    completionTimeoutRef.current = window.setTimeout(() => {
      onComplete();
    }, delay);
  };

  const handleVideoEnded = () => {
    setIsZooming(true);
    finishIntro();
  };

  const handleVideoError = () => {
    setIsZooming(true);
    finishIntro(400);
  };

  return (
    <div
      className={`login-intro-overlay${isVisible ? ' login-intro-overlay--visible' : ''}${
        isZooming ? ' login-intro-overlay--zooming' : ''
      }`}
      aria-hidden="true"
    >
      <div className="login-intro-backdrop" aria-hidden="true" />
      <div
        className={`login-intro-video-wrapper${
          isZooming ? ' login-intro-video-wrapper--zoom' : ''
        }`}
      >
        <video
          className="login-intro-video"
          src={videoSrc}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={handleVideoEnded}
          onError={handleVideoError}
        />
        <div className="login-intro-video-fog" aria-hidden="true" />
      </div>
    </div>
  );
}
