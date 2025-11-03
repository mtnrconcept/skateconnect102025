import { useState, useEffect } from 'react';

interface CountdownAnimationProps {
  onComplete: () => void;
}

export default function CountdownAnimation({ onComplete }: CountdownAnimationProps) {
  const [count, setCount] = useState(10);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (count <= 0) {
      // Animation de sortie
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete();
      }, 500);
      return () => clearTimeout(timer);
    }

    const interval = setInterval(() => {
      setCount((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [count, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div
        className={`transition-all duration-300 ${
          count <= 3
            ? 'scale-150 animate-pulse'
            : count <= 7
              ? 'scale-125'
              : 'scale-100'
        }`}
      >
        <div className="relative">
          {/* Cercle animé */}
          <svg
            className="w-64 h-64 md:w-80 md:h-80"
            viewBox="0 0 200 200"
          >
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="rgba(249, 115, 22, 0.2)"
              strokeWidth="4"
              className="animate-pulse"
            />
            <circle
              cx="100"
              cy="100"
              r="85"
              fill="none"
              stroke="rgba(249, 115, 22, 0.4)"
              strokeWidth="3"
              strokeDasharray={`${(count / 10) * 534} 534`}
              strokeLinecap="round"
              transform="rotate(-90 100 100)"
              className="transition-all duration-1000 ease-linear"
            />
          </svg>

          {/* Nombre au centre */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={`text-8xl md:text-9xl font-bold transition-all duration-500 ${
                count <= 3
                  ? 'text-red-500 animate-bounce'
                  : count <= 7
                    ? 'text-orange-400'
                    : 'text-orange-500'
              }`}
              style={{
                textShadow: '0 0 30px rgba(249, 115, 22, 0.8), 0 0 60px rgba(249, 115, 22, 0.6)',
              }}
            >
              {count > 0 ? count : 'GO!'}
            </div>
          </div>
        </div>

        {/* Effet de particules pour les dernières secondes */}
        {count <= 3 && count > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-orange-400 rounded-full animate-ping"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  animationDuration: `${0.5 + Math.random() * 0.5}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}







