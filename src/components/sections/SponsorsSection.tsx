import { useEffect, useMemo, useState } from 'react';
import {
  Trophy,
  Users,
  Sparkles,
  Gift,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Building2,
  Star,
} from 'lucide-react';
import type { Challenge, Profile } from '../../types';
import { eventsCatalog } from '../../data/eventsCatalog';
import {
  getStoredChallengeRegistrations,
  getStoredEventRegistrations,
  registerForChallenge,
  registerForEvent,
} from '../../lib/engagement';

interface SponsorsSectionProps {
  profile: Profile | null;
}

interface SponsorChallenge extends Challenge {
  sponsor: string;
  value: string;
}

const sponsorChallenges: SponsorChallenge[] = [
  {
    id: 'sponsor-challenge-1',
    created_by: null,
    title: 'Signature Line - Switch Hardflip',
    description:
      'Filme ton plus beau switch hardflip sur un gap ou un set d’escalier. Les meilleurs clips intégreront la prochaine campagne Globe.',
    challenge_type: 'community',
    difficulty: 4,
    prize: 'Budget vidéo de 800€ + pack complet Globe',
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
    participants_count: 162,
    is_active: true,
    created_at: new Date().toISOString(),
    sponsor: 'Globe',
    value: 'Production & visibilité',
  },
  {
    id: 'sponsor-challenge-2',
    created_by: null,
    title: 'Spot Upgrade powered by Vans',
    description:
      'Présente ton crew et propose un plan détaillé pour upgrader votre DIY local. Vans finance le chantier gagnant.',
    challenge_type: 'community',
    difficulty: 3,
    prize: '2 500€ de budget matériaux + workshop Vans',
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21).toISOString(),
    participants_count: 74,
    is_active: true,
    created_at: new Date().toISOString(),
    sponsor: 'Vans',
    value: 'Amélioration de spot',
  },
  {
    id: 'sponsor-challenge-3',
    created_by: null,
    title: 'Creative Lines by Carhartt WIP',
    description:
      'Imagine un run créatif de 45 secondes au skatepark et mixe street & transition. Carhartt équipe la crew la plus inventive.',
    challenge_type: 'community',
    difficulty: 2,
    prize: 'Carte cadeau Carhartt WIP 600€ + shooting photo',
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(),
    participants_count: 98,
    is_active: true,
    created_at: new Date().toISOString(),
    sponsor: 'Carhartt WIP',
    value: 'Visibilité crew',
  },
];

export default function SponsorsSection({ profile }: SponsorsSectionProps) {
  const [joinedChallenges, setJoinedChallenges] = useState<string[]>([]);
  const [registeredEvents, setRegisteredEvents] = useState<string[]>([]);
  const [joiningChallengeId, setJoiningChallengeId] = useState<string | null>(null);
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { message: string; tone: 'success' | 'info' }>>({});

  useEffect(() => {
    setJoinedChallenges(Array.from(getStoredChallengeRegistrations()));
    setRegisteredEvents(Array.from(getStoredEventRegistrations()));
  }, []);

  const joinedChallengeSet = useMemo(() => new Set(joinedChallenges), [joinedChallenges]);
  const registeredEventSet = useMemo(() => new Set(registeredEvents), [registeredEvents]);

  const sponsorEvents = eventsCatalog.filter((event) => event.is_sponsor_event);

  const handleJoinChallenge = async (challenge: SponsorChallenge) => {
    if (!profile?.id) {
      setFeedback((prev) => ({
        ...prev,
        [challenge.id]: {
          message: 'Connecte-toi pour rejoindre les programmes sponsors.',
          tone: 'info',
        },
      }));
      return;
    }

    if (joinedChallengeSet.has(challenge.id)) {
      setFeedback((prev) => ({
        ...prev,
        [challenge.id]: {
          message: 'Tu es déjà inscrit sur ce challenge.',
          tone: 'info',
        },
      }));
      return;
    }

    setJoiningChallengeId(challenge.id);
    const result = await registerForChallenge(profile.id, challenge.id);
    setJoiningChallengeId(null);

    if (result.success) {
      setJoinedChallenges((prev) => [...prev, challenge.id]);
    }

    setFeedback((prev) => ({
      ...prev,
      [challenge.id]: {
        message: result.message,
        tone: result.success ? 'success' : 'info',
      },
    }));
  };

  const handleJoinEvent = async (eventId: string) => {
    if (!profile?.id) {
      setFeedback((prev) => ({
        ...prev,
        [eventId]: {
          message: 'Connecte-toi pour t’inscrire.',
          tone: 'info',
        },
      }));
      return;
    }

    if (registeredEventSet.has(eventId)) {
      setFeedback((prev) => ({
        ...prev,
        [eventId]: {
          message: 'Déjà inscrit !',
          tone: 'info',
        },
      }));
      return;
    }

    setJoiningEventId(eventId);
    const result = await registerForEvent(profile.id, eventId);
    setJoiningEventId(null);

    if (result.success) {
      setRegisteredEvents((prev) => [...prev, eventId]);
    }

    setFeedback((prev) => ({
      ...prev,
      [eventId]: {
        message: result.message,
        tone: result.success ? 'success' : 'info',
      },
    }));
  };

  return (
    <section className="max-w-6xl mx-auto px-4 pb-24 space-y-10">
      <header className="bg-gradient-to-br from-orange-500/10 via-amber-500/10 to-rose-500/10 border border-orange-500/20 rounded-3xl px-6 py-10 sm:px-10 flex flex-col gap-5">
        <div className="flex items-center gap-3 text-orange-300">
          <Sparkles size={24} />
          <span className="uppercase tracking-[0.4em] text-xs">Espace Sponsors</span>
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
            Partenariats, programmes exclusifs et appels à projets
          </h1>
          <p className="text-gray-300 text-sm sm:text-base max-w-3xl">
            Accède aux initiatives proposées par nos sponsors : défis à forte visibilité, appels à projets pour financer
            ton spot, événements privés et opportunités de collaboration.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-dark-900/60 border border-dark-700 rounded-2xl p-4 flex items-start gap-3">
            <Trophy className="text-orange-400" size={22} />
            <div>
              <h2 className="text-sm font-semibold text-white">Challenges sponsorisés</h2>
              <p className="text-xs text-gray-400">Gagne du budget, du matos et de la visibilité pour ta crew.</p>
            </div>
          </div>
          <div className="bg-dark-900/60 border border-dark-700 rounded-2xl p-4 flex items-start gap-3">
            <Building2 className="text-orange-400" size={22} />
            <div>
              <h2 className="text-sm font-semibold text-white">Appels à projets</h2>
              <p className="text-xs text-gray-400">Les marques soutiennent les rénovations DIY et les initiatives locales.</p>
            </div>
          </div>
          <div className="bg-dark-900/60 border border-dark-700 rounded-2xl p-4 flex items-start gap-3">
            <Users className="text-orange-400" size={22} />
            <div>
              <h2 className="text-sm font-semibold text-white">Événements privés</h2>
              <p className="text-xs text-gray-400">Rencontre les teams sponsors et présente ton profil.</p>
            </div>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-white">Défis sponsorisés</h2>
            <p className="text-gray-400 text-sm">Boost ta carrière skate avec des récompenses premium.</p>
          </div>
          <span className="text-xs uppercase tracking-wide bg-orange-500/10 border border-orange-500/30 rounded-full px-3 py-1 text-orange-300">
            Mise à jour hebdo
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sponsorChallenges.map((challenge) => {
            const joined = joinedChallengeSet.has(challenge.id);
            const challengeFeedback = feedback[challenge.id];

            return (
              <article
                key={challenge.id}
                className="bg-dark-800 border border-dark-700 rounded-2xl p-6 flex flex-col gap-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs uppercase tracking-wide text-orange-300">{challenge.sponsor}</span>
                    <h3 className="text-xl font-semibold text-white leading-snug mt-1">{challenge.title}</h3>
                  </div>
                  <Gift size={22} className="text-orange-400" />
                </div>
                <p className="text-sm text-gray-400 leading-relaxed flex-1">{challenge.description}</p>
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <Users size={16} />
                    <span>{challenge.participants_count + (joined ? 1 : 0)} crews inscrites</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star size={16} className="text-orange-400" />
                    <span>{challenge.value}</span>
                  </div>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-sm text-orange-300">
                  Récompense : {challenge.prize}
                </div>
                <button
                  type="button"
                  onClick={() => handleJoinChallenge(challenge)}
                  disabled={joined || joiningChallengeId === challenge.id}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                    joined
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-orange-500 text-white hover:bg-orange-400'
                  }`}
                >
                  {joined ? (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Inscrit</span>
                    </>
                  ) : joiningChallengeId === challenge.id ? (
                    <span>Inscription...</span>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Je participe</span>
                    </>
                  )}
                </button>
                {challengeFeedback && (
                  <div
                    className={`flex items-center gap-2 text-sm ${
                      challengeFeedback.tone === 'success' ? 'text-emerald-400' : 'text-gray-400'
                    }`}
                  >
                    {challengeFeedback.tone === 'success' ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                    <span>{challengeFeedback.message}</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-white">Événements partenaires</h2>
            <p className="text-gray-400 text-sm">Compétitions privées, avant-premières et appels à sponsor.</p>
          </div>
          <span className="text-xs uppercase tracking-wide bg-dark-700 border border-dark-600 rounded-full px-3 py-1 text-gray-300">
            Accès limité
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sponsorEvents.map((event) => {
            const registered = registeredEventSet.has(event.id);
            const eventFeedback = feedback[event.id];

            return (
              <article key={event.id} className="bg-dark-800 border border-dark-700 rounded-2xl p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs uppercase tracking-wide text-orange-300">{event.sponsor_name}</span>
                    <h3 className="text-xl font-semibold text-white leading-snug mt-1">{event.title}</h3>
                    <p className="text-sm text-gray-400 mt-2 leading-relaxed">{event.description}</p>
                  </div>
                  <Calendar size={22} className="text-orange-400" />
                </div>
                <div className="flex flex-col sm:flex-row gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-orange-400" />
                    <span>{event.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-orange-400" />
                    <span>{event.attendees + (registered ? 1 : 0)} participants</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleJoinEvent(event.id)}
                  disabled={registered || joiningEventId === event.id}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                    registered
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-orange-500 text-white hover:bg-orange-400'
                  }`}
                >
                  {registered ? (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Inscrit</span>
                    </>
                  ) : joiningEventId === event.id ? (
                    <span>Inscription...</span>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Je réserve ma place</span>
                    </>
                  )}
                </button>
                {eventFeedback && (
                  <div
                    className={`flex items-center gap-2 text-sm ${
                      eventFeedback.tone === 'success' ? 'text-emerald-400' : 'text-gray-400'
                    }`}
                  >
                    {eventFeedback.tone === 'success' ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                    <span>{eventFeedback.message}</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
