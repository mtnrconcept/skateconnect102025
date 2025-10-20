import { Star, TrendingUp } from 'lucide-react';
import type { UserXP } from '../types';

interface XPProgressBarProps {
  userXP: UserXP;
  compact?: boolean;
}

export default function XPProgressBar({ userXP, compact = false }: XPProgressBarProps) {
  const progressPercentage = ((userXP.total_xp - (Math.pow(userXP.current_level, 2) * 100)) /
    (Math.pow(userXP.current_level + 1, 2) * 100 - Math.pow(userXP.current_level, 2) * 100)) * 100;

  const getLevelColor = (level: number) => {
    if (level >= 30) return 'from-purple-500 to-pink-500';
    if (level >= 20) return 'from-yellow-500 to-orange-500';
    if (level >= 10) return 'from-blue-500 to-cyan-500';
    if (level >= 5) return 'from-green-500 to-emerald-500';
    return 'from-gray-500 to-gray-600';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getLevelColor(userXP.current_level)} flex items-center justify-center text-white font-bold text-sm`}>
          {userXP.current_level}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">{userXP.level_title}</span>
            <span className="text-xs text-gray-400">{userXP.total_xp} XP</span>
          </div>
          <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-500`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 rounded-lg border border-dark-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getLevelColor(userXP.current_level)} flex items-center justify-center text-white font-bold text-2xl shadow-lg`}>
            {userXP.current_level}
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{userXP.level_title}</h3>
            <p className="text-sm text-gray-400">Niveau {userXP.current_level}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-orange-500">
            <TrendingUp size={20} />
            <span className="text-2xl font-bold">{userXP.total_xp}</span>
          </div>
          <p className="text-xs text-gray-400">Total XP</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Progression</span>
          <span className="text-white font-semibold">
            {userXP.xp_to_next_level} XP restants
          </span>
        </div>
        <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-500 flex items-center justify-end pr-2"
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
          >
            {progressPercentage > 15 && (
              <span className="text-xs font-bold text-white">{Math.round(progressPercentage)}%</span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Niveau {userXP.current_level}</span>
          <span>Niveau {userXP.current_level + 1}</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-dark-700">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Star size={16} className="text-orange-500" />
          <span>
            Prochain titre: <span className="text-white font-semibold">
              {userXP.current_level >= 30 ? 'Max Level!' :
               userXP.current_level >= 20 ? 'Skate Master' :
               userXP.current_level >= 10 ? 'Street Icon' :
               userXP.current_level >= 5 ? 'Pro Rider' : 'Local Legend'}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
