import { Badge } from '../types';

interface BadgeIconProps {
  badge: Badge;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  earned?: boolean;
  showGlow?: boolean;
}

export default function BadgeIcon({ badge, size = 'md', earned = true, showGlow = false }: BadgeIconProps) {
  const getRarityColors = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return {
          bg: 'from-yellow-500 via-orange-500 to-red-500',
          border: 'border-yellow-500',
          shadow: 'shadow-yellow-500/50',
          glow: 'shadow-[0_0_30px_rgba(251,191,36,0.6)]',
        };
      case 'epic':
        return {
          bg: 'from-purple-500 via-pink-500 to-purple-600',
          border: 'border-purple-500',
          shadow: 'shadow-purple-500/50',
          glow: 'shadow-[0_0_30px_rgba(168,85,247,0.6)]',
        };
      case 'rare':
        return {
          bg: 'from-blue-500 via-cyan-500 to-blue-600',
          border: 'border-blue-500',
          shadow: 'shadow-blue-500/50',
          glow: 'shadow-[0_0_30px_rgba(59,130,246,0.6)]',
        };
      default:
        return {
          bg: 'from-gray-500 via-gray-600 to-gray-700',
          border: 'border-gray-500',
          shadow: 'shadow-gray-500/50',
          glow: 'shadow-[0_0_20px_rgba(107,114,128,0.4)]',
        };
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'w-12 h-12',
          icon: 'text-2xl',
          shine: 'w-6 h-6',
        };
      case 'md':
        return {
          container: 'w-16 h-16',
          icon: 'text-3xl',
          shine: 'w-8 h-8',
        };
      case 'lg':
        return {
          container: 'w-20 h-20',
          icon: 'text-4xl',
          shine: 'w-10 h-10',
        };
      case 'xl':
        return {
          container: 'w-24 h-24',
          icon: 'text-5xl',
          shine: 'w-12 h-12',
        };
    }
  };

  const colors = getRarityColors(badge.rarity);
  const sizes = getSizeClasses();

  return (
    <div className="relative inline-block">
      <div
        className={`${sizes.container} rounded-full bg-gradient-to-br ${colors.bg} flex items-center justify-center border-4 ${colors.border} shadow-lg ${colors.shadow} relative overflow-hidden transition-all duration-300 ${
          earned ? 'opacity-100' : 'opacity-40 grayscale'
        } ${showGlow ? colors.glow : ''}`}
      >
        {earned && (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent" />

            <div
              className={`absolute top-1 right-1 ${sizes.shine} rounded-full bg-white/40 blur-md animate-pulse`}
            />
          </>
        )}

        <span className={`${sizes.icon} relative z-10 drop-shadow-lg`}>
          {badge.icon}
        </span>

        {!earned && (
          <div className="absolute inset-0 bg-dark-900/60 backdrop-blur-sm flex items-center justify-center">
            <svg
              className="w-1/2 h-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
        )}
      </div>

      {badge.rarity === 'legendary' && earned && showGlow && (
        <div className="absolute inset-0 animate-spin-slow">
          <div className="absolute top-0 left-1/2 w-1 h-1 bg-yellow-400 rounded-full blur-sm" />
          <div className="absolute bottom-0 left-1/2 w-1 h-1 bg-orange-400 rounded-full blur-sm" />
          <div className="absolute left-0 top-1/2 w-1 h-1 bg-red-400 rounded-full blur-sm" />
          <div className="absolute right-0 top-1/2 w-1 h-1 bg-yellow-400 rounded-full blur-sm" />
        </div>
      )}
    </div>
  );
}
