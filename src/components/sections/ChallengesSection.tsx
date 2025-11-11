import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Trophy, Calendar, Users, Star, Target, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import DailyChallenges from '../DailyChallenges';
import {
  getStoredChallengeRegistrations,
  registerForChallenge,
} from '../../lib/engagement';
import { getFallbackChallenges } from '../../data/challengesCatalog';
import ChallengeDetailModal from '../challenges/ChallengeDetailModal';
import { fetchSubmissionHistory, fetchChallengeWinners } from '../../lib/challenges';
import type { Challenge, ChallengeSubmission, ContentNavigationOptions, Profile } from '../../types';
import Lobby from '../skate/Lobby';
import GameOfSkateSelfRef from '../skate/GameOfSkateSelfRef';
import MatchRoomRemote from '../skate/MatchRoomRemote';
import { createMatch, createGOSMatchWithLocal } from '../../lib/skate';
import { useRouter } from '../../lib/router';

interface ChallengesSectionProps {
  profile: Profile | null;
  focusConfig?: ContentNavigationOptions | null;
  onFocusHandled?: () => void;
}

export default function ChallengesSection({ profile, focusConfig, onFocusHandled }: ChallengesSectionProps) {
  const { navigate } = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'daily' | 'community' | 'skate'>('daily');
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { message: string; tone: 'success' | 'info' }>>({});
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [submissionHistory, setSubmissionHistory] = useState<ChallengeSubmission[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [completedChallenges, setCompletedChallenges] = useState<Challenge[]>([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [completedError, setCompletedError] = useState<string | null>(null);
  const [winnersByChallenge, setWinnersByChallenge] = useState<Record<string, ChallengeSubmission[]>>({});
  const lastFocusedIdRef = useRef<string | null>(null);
  const [liveMatchId, setLiveMatchId] = useState<string | null>(null);
  const [remoteMatchId, setRemoteMatchId] = useState<string | null>(null);
  const [skateMode, setSkateMode] = useState<'live' | 'remote' | null>(null);

  useEffect(() => {
    loadChallenges();
  }, [filter]);

  useEffect(() => {
    setJoinedIds(Array.from(getStoredChallengeRegistrations()));
  }, []);

  useEffect(() => {
    setSelectedChallengeId((current) => {
      if (!current) {
        return null;
      }

      const existsInActive = challenges.some((challenge) => challenge.id === current);
      const existsInCompleted = completedChallenges.some((challenge) => challenge.id === current);

      return existsInActive || existsInCompleted ? current : null;
    });
  }, [challenges, completedChallenges]);

  const loadChallenges = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('challenges')
        .select('*, creator:profiles(*)')
        .eq('is_active', true);

      if (filter !== 'all') {
        query = query.eq('challenge_type', filter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) {
        setChallenges(getFallbackChallenges(filter as Challenge['challenge_type'] | 'all'));
      } else {
        setChallenges(data);
      }
    } catch (error) {
      console.error('Error loading challenges:', error);
      setChallenges(getFallbackChallenges(filter as Challenge['challenge_type'] | 'all'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!focusConfig?.challengeTab) {
      return;
    }

    if (focusConfig.challengeTab !== activeTab) {
      setActiveTab(focusConfig.challengeTab);
    }
  }, [focusConfig?.challengeTab, activeTab]);

  useEffect(() => {
    if (!focusConfig?.scrollToId) {
      return;
    }

    const targetId = focusConfig.scrollToId;
    if (lastFocusedIdRef.current === targetId) {
      return;
    }

    let attempts = 0;
    const maxAttempts = 10;

    const attemptScroll = () => {
      const element = document.getElementById(targetId);
      if (element) {
        if (targetId.startsWith('challenge-')) {
          const normalizedId = targetId.replace('challenge-', '');
          setSelectedChallengeId((current) => (current === normalizedId ? current : normalizedId));
        }
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        lastFocusedIdRef.current = targetId;
        onFocusHandled?.();
        return true;
      }
      return false;
    };

    const initialScroll = attemptScroll();
    if (initialScroll) {
      return;
    }

    const interval = window.setInterval(() => {
      attempts += 1;
      if (attemptScroll() || attempts >= maxAttempts) {
        window.clearInterval(interval);
        if (attempts >= maxAttempts) {
          onFocusHandled?.();
        }
      }
    }, 200);

    return () => {
      window.clearInterval(interval);
    };
  }, [focusConfig?.scrollToId, activeTab, challenges, loading, onFocusHandled]);

  const joinedChallengeSet = useMemo(() => new Set(joinedIds), [joinedIds]);
  const selectedChallenge = useMemo(() => {
    if (!selectedChallengeId) {
      return null;
    }
    return (
      challenges.find((challenge) => challenge.id === selectedChallengeId) ||
      completedChallenges.find((challenge) => challenge.id === selectedChallengeId) ||
      null
    );
  }, [selectedChallengeId, challenges, completedChallenges]);
  const selectedChallengeJoined = selectedChallenge ? joinedChallengeSet.has(selectedChallenge.id) : false;

  const loadCompletedChallenges = useCallback(async () => {
    try {
      setCompletedLoading(true);
      setCompletedError(null);

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('challenges')
        .select('*, creator:profiles(*)')
        .eq('is_active', false)
        .lte('end_date', now)
        .order('end_date', { ascending: false })
        .limit(3);

      if (error) {
        throw error;
      }

      const completedList = (data || []) as Challenge[];
      setCompletedChallenges(completedList);

      if (completedList.length === 0) {
        setWinnersByChallenge({});
        return;
      }

      const winnersEntries = await Promise.all(
        completedList.map(async (challenge) => {
          try {
            const winners = await fetchChallengeWinners(challenge.id);
            return [challenge.id, winners] as const;
          } catch (err) {
            console.error('Error loading winners for challenge', challenge.id, err);
            return [challenge.id, []] as const;
          }
        }),
      );

      setWinnersByChallenge(Object.fromEntries(winnersEntries));
    } catch (error) {
      console.error('Error loading completed challenges:', error);
      setCompletedError("Impossible de charger les vainqueurs des précédents challenges.");
    } finally {
      setCompletedLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!profile?.id) {
      setSubmissionHistory([]);
      return;
    }

    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const data = await fetchSubmissionHistory(profile.id);
      setSubmissionHistory(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de charger ton historique de participations';
      setHistoryError(message);
    } finally {
      setHistoryLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    void loadCompletedChallenges();
  }, [loadCompletedChallenges]);

  const handleJoinChallenge = async (challenge: Challenge) => {
    if (!profile?.id) {
      setFeedback((prev) => ({
        ...prev,
        [challenge.id]: {
          message: 'Connecte-toi pour rejoindre un challenge.',
          tone: 'info',
        },
      }));
      return;
    }

    if (joinedChallengeSet.has(challenge.id)) {
      setFeedback((prev) => ({
        ...prev,
        [challenge.id]: {
          message: 'Tu participes déjà à ce challenge.',
          tone: 'info',
        },
      }));
      return;
    }

    setJoiningId(challenge.id);
    const result = await registerForChallenge(profile.id, challenge.id);
    setJoiningId(null);

    if (result.success) {
      setJoinedIds((prev) => [...prev, challenge.id]);
      setChallenges((prev) =>
        prev.map((item) =>
          item.id === challenge.id
            ? { ...item, participants_count: item.participants_count + 1 }
            : item,
        ),
      );
      setFeedback((prev) => ({
        ...prev,
        [challenge.id]: {
          message: result.message,
          tone: 'success',
        },
      }));
    } else {
      setFeedback((prev) => ({
        ...prev,
        [challenge.id]: {
          message: result.message,
          tone: 'info',
        },
      }));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / 86400000);
    return diffDays;
  };

  const filterButtons = [
    { id: 'daily', label: 'Quotidiens' },
    { id: 'weekly', label: 'Hebdomadaires' },
    { id: 'brand', label: 'Marques' },
    { id: 'community', label: 'Communauté' },
  ];

  const getChallengeColor = (type: string) => {
    switch (type) {
      case 'daily':
        return 'from-orange-500 to-red-500';
      case 'weekly':
        return 'from-blue-500 to-cyan-500';
      case 'brand':
        return 'from-purple-500 to-pink-500';
      case 'community':
        return 'from-green-500 to-emerald-500';
      default:
        return 'from-slate-500 to-slate-600';
    }
  };

  if (!profile) {
    return (
      <div className="text-center py-12 text-gray-400">
        Chargement...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Défis & Challenges</h1>
        <p className="text-gray-400 mb-6">Complète des défis pour gagner des XP et des récompenses</p>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'daily'
                ? 'bg-orange-500 text-white'
                : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
            }`}
          >
            <Target size={20} />
            <span>Défis Quotidiens</span>
          </button>
          <button
            onClick={() => setActiveTab('community')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'community'
                ? 'bg-orange-500 text-white'
                : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
            }`}
          >
            <Trophy size={20} />
            <span>Challenges Communautaires</span>
          </button>
          <button
            onClick={() => setActiveTab('skate')}
            id="challenge-tab-skate"
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'skate'
                ? 'bg-orange-500 text-white'
                : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
            }`}
          >
            <Users size={20} />
            <span>Game of S.K.A.T.E</span>
          </button>
        </div>
      </div>

      {activeTab === 'daily' && (
        <DailyChallenges profile={profile} />
      )}

      {activeTab === 'community' && (
        <div>
          <div className="mb-6 bg-dark-800 rounded-xl border border-dark-700 p-4">
            <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
              {filterButtons.map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setFilter(btn.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                    filter === btn.id
                      ? 'bg-orange-500 text-white'
                      : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-400">Chargement des défis...</div>
          ) : challenges.length === 0 ? (
            <div className="text-center py-12 bg-dark-800 rounded-xl border border-dark-700">
              <Trophy size={48} className="mx-auto mb-2 opacity-30 text-gray-600" />
              <p className="text-lg mb-2 text-white">Aucun défi actif</p>
              <p className="text-sm text-gray-400">Revenez plus tard pour de nouveaux challenges!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {(completedLoading || completedChallenges.length > 0 || completedError) && (
                <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2 text-white">
                      <Trophy size={20} className="text-orange-400" />
                      <h2 className="text-xl font-semibold">Vainqueurs des challenges terminés</h2>
                    </div>
                    <button
                      onClick={() => void loadCompletedChallenges()}
                      disabled={completedLoading}
                      className={`text-sm underline transition-colors ${
                        completedLoading
                          ? 'text-gray-500 cursor-not-allowed'
                          : 'text-orange-300 hover:text-orange-200'
                      }`}
                    >
                      {completedLoading ? 'Chargement...' : 'Actualiser'}
                    </button>
                  </div>

                  {completedLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="h-44 bg-dark-900 border border-dark-700 rounded-xl animate-pulse" />
                      ))}
                    </div>
                  ) : completedError ? (
                    <div className="text-sm text-red-300">{completedError}</div>
                  ) : completedChallenges.length === 0 ? (
                    <div className="text-sm text-gray-400">
                      Aucun challenge terminé récemment. Reste connecté pour découvrir les prochains gagnants !
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {completedChallenges.map((challenge) => {
                        const winners = winnersByChallenge[challenge.id] ?? [];
                        return (
                          <div
                            key={challenge.id}
                            className="bg-dark-900 border border-dark-700 rounded-xl p-4 space-y-4 hover:border-dark-500 transition-colors cursor-pointer"
                            onClick={() => setSelectedChallengeId(challenge.id)}
                          >
                            <div>
                              <p className="text-xs uppercase tracking-wide text-white/60">Challenge terminé</p>
                              <h3 className="text-lg font-semibold text-white mt-1">{challenge.title}</h3>
                              <p className="text-xs text-gray-400 mt-1">
                                Clôturé le {formatDate(challenge.end_date)}
                              </p>
                            </div>
                            {winners.length === 0 ? (
                              <p className="text-sm text-gray-400">Résultats en cours de vérification.</p>
                            ) : (
                              <ol className="space-y-3">
                                {winners.map((winner, index) => (
                                  <li
                                    key={winner.id}
                                    className="flex items-center justify-between gap-3 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2"
                                  >
                                    <div>
                                      <p className="text-sm font-semibold text-white">
                                        {index + 1}.{' '}
                                        {winner.user?.display_name || winner.user?.username || 'Rider mystère'}
                                      </p>
                                      {winner.caption && (
                                        <p className="text-xs text-gray-400 line-clamp-1">{winner.caption}</p>
                                      )}
                                    </div>
                                    <div className="text-xs font-semibold text-orange-300">
                                      {winner.votes_count} vote{winner.votes_count > 1 ? 's' : ''}
                                    </div>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {challenges.map((challenge) => {
                  const daysRemaining = getDaysRemaining(challenge.end_date);
                  const isExpiringSoon = daysRemaining <= 2;
                  const hasJoined = joinedChallengeSet.has(challenge.id);
                  const canJoin = challenge.challenge_type === 'community';
                  const currentFeedback = feedback[challenge.id];

                  return (
                    <div
                    key={challenge.id}
                    id={`challenge-${challenge.id}`}
                    onClick={() => setSelectedChallengeId(challenge.id)}
                    className={`bg-dark-800 rounded-xl border ${
                      selectedChallengeId === challenge.id
                        ? 'border-orange-500/60 shadow-lg shadow-orange-500/10'
                        : 'border-dark-700 hover:border-dark-600'
                    } overflow-hidden transition-all cursor-pointer`}
                  >
                    <div className={`h-32 bg-gradient-to-br ${getChallengeColor(challenge.challenge_type)} p-4 flex flex-col justify-between`}>
                      <div className="flex items-center justify-between">
                        <span className="bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-medium">
                          {challenge.challenge_type}
                        </span>
                        <Trophy className="text-white/80" size={24} />
                      </div>
                      <h3 className="text-white font-bold text-lg">{challenge.title}</h3>
                    </div>

                    <div className="p-4">
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {challenge.description}
                      </p>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Calendar size={16} />
                          <span>
                            {formatDate(challenge.start_date)} - {formatDate(challenge.end_date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Users size={16} />
                          <span>{challenge.participants_count} participants</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Star size={16} />
                          <span>Difficulté: {'⭐'.repeat(challenge.difficulty)}</span>
                        </div>
                      </div>

                      {challenge.prize && (
                        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-2 mb-4">
                          <div className="text-xs font-medium text-orange-500 mb-1">Prix</div>
                          <div className="text-sm text-orange-400">{challenge.prize}</div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        {daysRemaining > 0 ? (
                          <span className={`text-sm font-medium ${isExpiringSoon ? 'text-red-500' : 'text-gray-400'}`}>
                            {daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-red-500">Expiré</span>
                        )}
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            if (canJoin) {
                              void handleJoinChallenge(challenge);
                            }
                          }}
                          disabled={!canJoin || hasJoined || joiningId === challenge.id || daysRemaining <= 0}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1 ${
                            !canJoin
                              ? 'bg-dark-700 text-gray-500 cursor-not-allowed'
                              : hasJoined
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'bg-orange-500 text-white hover:bg-orange-600'
                          }`}
                        >
                          {hasJoined ? (
                            <>
                              <CheckCircle2 size={16} />
                              <span>Inscrit</span>
                            </>
                          ) : joiningId === challenge.id ? (
                            <span>En cours...</span>
                          ) : (
                            <span>Participer</span>
                          )}
                        </button>
                      </div>
                      {currentFeedback && (
                        <div
                          className={`mt-3 flex items-center gap-2 text-sm ${
                            currentFeedback.tone === 'success' ? 'text-emerald-400' : 'text-gray-400'
                          }`}
                        >
                          {currentFeedback.tone === 'success' ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <AlertCircle size={16} />
                          )}
                          <span>{currentFeedback.message}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
              {selectedChallenge && profile && (
                <ChallengeDetailModal
                  challenge={selectedChallenge}
                  profile={profile}
                  hasJoined={selectedChallengeJoined}
                  onClose={() => setSelectedChallengeId(null)}
                  onSubmissionCreated={(submission) => {
                    setSubmissionHistory((prev) => [
                      submission,
                      ...prev.filter((item) => item.id !== submission.id),
                    ]);
                    void loadHistory();
                  }}
                  submissionHistory={submissionHistory}
                  historyLoading={historyLoading}
                  historyError={historyError}
                  onReloadHistory={() => void loadHistory()}
                />
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'skate' && (
        <div className="space-y-6" id="skate-mode-panel">
          {!liveMatchId && !remoteMatchId && (
            <>
          <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
            <h3 className="text-2xl font-semibold text-white mb-2">Game of S.K.A.T.E</h3>
            <p className="text-gray-300">Affronte un rider en live (synchrone) ou à distance (asynchrone 24h). Réussis les tricks proposés pour éviter les lettres. Le premier à former <span className="font-bold">S.K.A.T.E</span> perd.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
              <h4 className="text-white font-semibold mb-2">Live (traditionnel)</h4>
              <ul className="list-disc list-inside text-gray-300 space-y-1 mb-4">
                <li>Lobby temps réel et room live.</li>
                <li>Tour A: proposer un trick en direct.</li>
                <li>Réponse B immédiate. Échec ⇒ lettre.</li>
              </ul>
              <button
                className="px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 font-semibold"
                onClick={() => {
                  const el = document.getElementById('skate-lobby-anchor');
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                Entrer dans le lobby
              </button>
            </div>
            <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
              <h4 className="text-white font-semibold mb-2">Remote (asynchrone 24h)</h4>
              <ul className="list-disc list-inside text-gray-300 space-y-1 mb-4">
                <li>Poste ta vidéo; rival a 24h pour répondre.</li>
                <li>Absence de réponse valide ⇒ lettre auto.</li>
                <li>Vérifications d’intégrité et anti-triche de base.</li>
              </ul>
              <button
                className="px-4 py-2 rounded-lg border border-dark-600 text-white hover:bg-dark-700 font-semibold"
                onClick={() => alert('Création de match remote: à venir')}
              >
                Créer un match remote
              </button>
            </div>
          </div>

          <div id="skate-lobby-anchor" className="bg-dark-800 rounded-xl border border-dark-700 p-6">
            <h4 className="text-white font-semibold mb-2">Lobby</h4>
            <p className="text-gray-400 mb-4">Matchmaking automatique ou défi direct via profil.</p>
            <Lobby
              currentUserId={profile?.id}
              onCreateMatch={async (opponentId, mode) => {
                if (!profile?.id) {
                  alert('Connecte-toi pour créer un match');
                  return;
                }
                try {
                  if (mode === 'live') {
                    const inviterName = profile.display_name || profile.username || undefined;
                    const created = await createGOSMatchWithLocal(opponentId, {
                      inviterName,
                      mode: 'live',
                    });
                    setLiveMatchId(created.gosMatchId);
                    setRemoteMatchId(null);
                    navigate(`/skate/live?room=${encodeURIComponent(created.gosMatchId)}`);
                  } else {
                    const created = await createMatch({ mode, opponent_id: opponentId }, profile.id);
                    setRemoteMatchId(created.id);
                    setLiveMatchId(null);
                  }
                  setSkateMode(mode);
                } catch (e) {
                  console.error(e);
                  alert('Impossible de créer le match');
                }
              }}
            />
          </div>
          </>
          )}

          {liveMatchId && skateMode === 'live' && profile?.id && (
            <GameOfSkateSelfRef matchId={liveMatchId} me={profile.id} />
          )}
          {remoteMatchId && skateMode === 'remote' && (
            <MatchRoomRemote matchId={remoteMatchId} />
          )}
        </div>
      )}
    </div>
  );
}
