import { useState, useEffect } from 'react';
import { X, Award, Star, Sparkles } from 'lucide-react';
import type { Badge } from '../types';
import { useRealtime } from '../contexts/RealtimeContext';

interface Achievement {
  badge: Badge;
  timestamp: string;
}

export default function AchievementNotification() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const { registerBadgeAwardListener } = useRealtime();

  useEffect(() => {
    const unsubscribe = registerBadgeAwardListener((badge) => {
      setAchievements((prev) => [
        ...prev,
        {
          badge,
          timestamp: new Date().toISOString(),
        },
      ]);
    });

    return () => {
      unsubscribe();
    };
  }, [registerBadgeAwardListener]);

  useEffect(() => {
    if (achievements.length > 0 && !isVisible) {
      setIsVisible(true);

      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          setAchievements((prev) => prev.slice(1));
        }, 500);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [achievements, isVisible]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      setAchievements((prev) => prev.slice(1));
    }, 300);
  };

  if (achievements.length === 0 || !isVisible) {
    return null;
  }

  const currentAchievement = achievements[0];

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return 'from-yellow-500 to-orange-500';
      case 'epic':
        return 'from-purple-500 to-pink-500';
      case 'rare':
        return 'from-blue-500 to-cyan-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const getRarityLabel = (rarity: string) => {
    const labels: Record<string, string> = {
      legendary: 'LÉGENDAIRE',
      epic: 'ÉPIQUE',
      rare: 'RARE',
      common: 'COMMUN',
    };
    return labels[rarity] || rarity.toUpperCase();
  };

  return (
    <div
      className={`fixed top-24 right-4 z-50 transition-all duration-500 ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div
        className={`bg-gradient-to-br ${getRarityColor(
          currentAchievement.badge.rarity
        )} p-1 rounded-xl shadow-2xl max-w-md animate-bounce`}
      >
        <div className="bg-dark-800 rounded-lg p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

          <div className="absolute top-2 left-2">
            <Sparkles className="text-yellow-400 animate-pulse" size={20} />
          </div>

          <button
            onClick={handleClose}
            className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-4 relative z-10">
            <div
              className={`w-20 h-20 rounded-full bg-gradient-to-br ${getRarityColor(
                currentAchievement.badge.rarity
              )} flex items-center justify-center text-4xl shadow-lg animate-pulse`}
            >
              {currentAchievement.badge.icon}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Award className="text-orange-500" size={16} />
                <span className="text-xs font-bold text-orange-500">
                  NOUVEAU BADGE!
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-1">
                {currentAchievement.badge.name}
              </h3>

              <p className="text-sm text-gray-300 mb-2">
                {currentAchievement.badge.description}
              </p>

              <div
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${getRarityColor(
                  currentAchievement.badge.rarity
                )}`}
              >
                <Star size={12} className="text-white" />
                <span className="text-white">
                  {getRarityLabel(currentAchievement.badge.rarity)}
                </span>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-2 -right-2 opacity-20">
            <Award size={80} className="text-white" />
          </div>
        </div>
      </div>

      {achievements.length > 1 && (
        <div className="mt-2 text-center">
          <span className="text-xs text-gray-400 bg-dark-800 px-3 py-1 rounded-full">
            +{achievements.length - 1} autre{achievements.length > 2 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
