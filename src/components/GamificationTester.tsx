import { useState } from 'react';
import { Play, CheckCircle, XCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface GamificationTesterProps {
  profile: Profile;
}

interface TestResult {
  test_name: string;
  result: string;
  details: any;
}

export default function GamificationTester({ profile }: GamificationTesterProps) {
  const [testing, setTesting] = useState(false);
  const [xpTest, setXpTest] = useState<TestResult | null>(null);
  const [badgeTests, setBadgeTests] = useState<any[]>([]);
  const [challengeTests, setChallengeTests] = useState<any[]>([]);

  const runTests = async () => {
    setTesting(true);
    try {
      const { data: xpData, error: xpError } = await supabase.rpc('test_xp_system', {
        p_user_id: profile.id,
      });

      if (xpError) throw xpError;
      setXpTest(xpData[0]);

      const { data: badgeData, error: badgeError } = await supabase.rpc('test_badge_system', {
        p_user_id: profile.id,
      });

      if (badgeError) throw badgeError;
      setBadgeTests(badgeData || []);

      const { data: challengeData, error: challengeError } = await supabase.rpc(
        'test_challenge_system',
        {
          p_user_id: profile.id,
        }
      );

      if (challengeError) throw challengeError;
      setChallengeTests(challengeData || []);
    } catch (error) {
      console.error('Test error:', error);
      alert('Erreur lors des tests: ' + JSON.stringify(error));
    } finally {
      setTesting(false);
    }
  };

  const simulateActions = async (spots: number, posts: number, comments: number, likes: number) => {
    setTesting(true);
    try {
      const { data, error } = await supabase.rpc('simulate_user_actions', {
        p_user_id: profile.id,
        p_spots: spots,
        p_posts: posts,
        p_comments: comments,
        p_likes: likes,
      });

      if (error) throw error;

      alert(
        `Simulation terminée!\n\nXP gagné: ${data.xp_gained}\nXP total: ${data.final_xp}\nBadges totaux: ${data.total_badges}`
      );

      await runTests();
    } catch (error) {
      console.error('Simulation error:', error);
      alert('Erreur lors de la simulation: ' + JSON.stringify(error));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
      <h2 className="text-2xl font-bold text-white mb-4">
        Testeur de Gamification
      </h2>

      <div className="space-y-4">
        <div>
          <button
            onClick={runTests}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {testing ? (
              <>
                <Loader className="animate-spin" size={20} />
                <span>Tests en cours...</span>
              </>
            ) : (
              <>
                <Play size={20} />
                <span>Lancer les tests</span>
              </>
            )}
          </button>
        </div>

        {xpTest && (
          <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              {xpTest.result === 'PASS' ? (
                <CheckCircle className="text-green-500" size={20} />
              ) : (
                <XCircle className="text-red-500" size={20} />
              )}
              {xpTest.test_name}: {xpTest.result}
            </h3>
            <pre className="text-sm text-gray-400 overflow-auto">
              {JSON.stringify(xpTest.details, null, 2)}
            </pre>
          </div>
        )}

        {badgeTests.length > 0 && (
          <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-2">
              État des Badges
            </h3>
            <div className="space-y-2">
              {badgeTests.map((badge, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-sm p-2 bg-dark-800 rounded"
                >
                  <span className="text-white">{badge.badge_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">{badge.current_progress}</span>
                    {badge.earned ? (
                      <CheckCircle className="text-green-500" size={16} />
                    ) : badge.conditions_met ? (
                      <span className="text-yellow-500 text-xs">Prêt!</span>
                    ) : (
                      <XCircle className="text-gray-600" size={16} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {challengeTests.length > 0 && (
          <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-2">
              Progression des Défis
            </h3>
            <div className="space-y-2">
              {challengeTests.map((challenge, idx) => (
                <div key={idx} className="text-sm p-2 bg-dark-800 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white">{challenge.challenge_title}</span>
                    <span className="text-orange-500">+{challenge.xp_reward} XP</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          challenge.is_completed
                            ? 'bg-green-500'
                            : 'bg-orange-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            (challenge.current_progress / challenge.target) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {challenge.current_progress}/{challenge.target}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
          <h3 className="text-lg font-semibold text-white mb-3">
            Simuler des Actions
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button
              onClick={() => simulateActions(1, 0, 0, 0)}
              disabled={testing}
              className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              +1 Spot
            </button>
            <button
              onClick={() => simulateActions(0, 1, 0, 0)}
              disabled={testing}
              className="px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              +1 Post
            </button>
            <button
              onClick={() => simulateActions(0, 0, 5, 0)}
              disabled={testing}
              className="px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors disabled:opacity-50"
            >
              +5 Comments
            </button>
            <button
              onClick={() => simulateActions(0, 0, 0, 10)}
              disabled={testing}
              className="px-3 py-2 bg-pink-600 text-white rounded text-sm hover:bg-pink-700 transition-colors disabled:opacity-50"
            >
              +10 Likes
            </button>
          </div>
          <div className="mt-2">
            <button
              onClick={() => simulateActions(3, 10, 20, 50)}
              disabled={testing}
              className="w-full px-3 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              Simulation Complète (3 spots, 10 posts, 20 comments, 50 likes)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
