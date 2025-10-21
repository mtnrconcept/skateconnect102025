import { useEffect, useMemo, useState } from 'react';
import { Calendar, MapPin, Users, CheckCircle2, AlertCircle, Share2 } from 'lucide-react';
import { getStoredEventRegistrations, registerForEvent } from '../../lib/engagement';
import type { CommunityEvent, Profile } from '../../types';
import { eventsCatalog } from '../../data/eventsCatalog';

interface EventsSectionProps {
  profile?: Profile | null;
}
const typeColors: Record<CommunityEvent['type'], string> = {
  Compétition: 'bg-red-500/10 text-red-300 border-red-500/40',
  Contest: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/40',
  Rencontre: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
  'Avant-première': 'bg-amber-500/10 text-amber-300 border-amber-500/40',
  'Appel à projet': 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/40',
  'Appel à sponsor': 'bg-cyan-500/10 text-cyan-300 border-cyan-500/40',
};

export default function EventsSection({ profile }: EventsSectionProps) {
  const [registered, setRegistered] = useState<string[]>([]);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { message: string; tone: 'success' | 'info' }>>({});

  useEffect(() => {
    setRegistered(Array.from(getStoredEventRegistrations()));
  }, []);

  const registeredSet = useMemo(() => new Set(registered), [registered]);

  const handleRegister = async (event: CommunityEvent) => {
    if (!profile?.id) {
      setFeedback((prev) => ({
        ...prev,
        [event.id]: {
          message: 'Connecte-toi pour confirmer ta participation.',
          tone: 'info',
        },
      }));
      return;
    }

    if (registeredSet.has(event.id)) {
      setFeedback((prev) => ({
        ...prev,
        [event.id]: {
          message: 'Tu es déjà inscrit.',
          tone: 'info',
        },
      }));
      return;
    }

    setJoiningId(event.id);
    const result = await registerForEvent(profile.id, event.id);
    setJoiningId(null);

    if (result.success) {
      setRegistered((prev) => [...prev, event.id]);
      setFeedback((prev) => ({
        ...prev,
        [event.id]: {
          message: result.message,
          tone: 'success',
        },
      }));
    } else {
      setFeedback((prev) => ({
        ...prev,
        [event.id]: {
          message: result.message,
          tone: 'info',
        },
      }));
    }
  };

  return (
    <section className="max-w-5xl mx-auto px-4">
      <header className="py-10 flex flex-col gap-3">
        <span className="uppercase text-sm tracking-[0.4em] text-orange-400/70">Agenda</span>
        <h1 className="text-3xl md:text-4xl font-bold text-white">Les événements à ne pas manquer</h1>
        <p className="text-gray-400 max-w-3xl">
          Retrouve les contests, projections, rencontres communautaires et compétitions officielles qui
          animent la scène skate. Ajoute-les à ton calendrier et rejoins la communauté IRL.
        </p>
      </header>

      <div className="space-y-6 pb-20">
        {eventsCatalog.map((event) => {
          const isRegistered = registeredSet.has(event.id);
          const eventFeedback = feedback[event.id];

          return (
            <article
              key={event.id}
              className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden shadow-lg shadow-black/20"
            >
              <div className="flex flex-col md:flex-row">
                <div className="md:w-56 bg-gradient-to-b from-orange-500/20 to-orange-500/10 p-6 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-orange-300 font-semibold">
                    <Calendar size={20} />
                    <span className="leading-tight">{event.date}</span>
                  </div>
                  <div className="text-gray-300 text-sm">{event.time}</div>
                  {event.is_sponsor_event && event.sponsor_name && (
                    <span className="text-xs uppercase tracking-wide text-orange-200 bg-orange-500/20 border border-orange-500/40 rounded-full px-3 py-1">
                      Sponsor: {event.sponsor_name}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center justify-center px-3 py-1 mt-auto text-xs font-semibold uppercase tracking-wide rounded-full border ${
                      typeColors[event.type]
                    }`}
                  >
                    {event.type}
                  </span>
                </div>

                <div className="flex-1 p-6 md:p-8 flex flex-col gap-4">
                  <div className="flex flex-col gap-3">
                    <h2 className="text-2xl font-bold text-white leading-snug">{event.title}</h2>
                    <p className="text-gray-300 leading-relaxed text-sm sm:text-base">{event.description}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 text-sm text-gray-300">
                    <div className="flex items-center gap-2">
                      <MapPin size={18} className="text-orange-400 shrink-0" />
                      <span>{event.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users size={18} className="text-orange-400 shrink-0" />
                      <span>
                        {event.attendees + (isRegistered ? 1 : 0)} inscrit
                        {event.attendees + (isRegistered ? 1 : 0) > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleRegister(event)}
                      disabled={isRegistered || joiningId === event.id}
                      className={`inline-flex items-center justify-center px-4 py-2 rounded-full font-semibold transition-colors gap-2 ${
                        isRegistered
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-orange-500 text-white hover:bg-orange-400'
                      }`}
                    >
                      {isRegistered ? (
                        <>
                          <CheckCircle2 size={18} />
                          <span>Inscrit</span>
                        </>
                      ) : joiningId === event.id ? (
                        <span>Inscription...</span>
                      ) : (
                        <>
                          <CheckCircle2 size={18} />
                          <span>Je participe</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-dark-600 text-gray-300 hover:border-orange-400 hover:text-white transition-colors gap-2"
                    >
                      <Share2 size={18} />
                      <span>Ajouter à mon agenda</span>
                    </button>
                  </div>
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
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
