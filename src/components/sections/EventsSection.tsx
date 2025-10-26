import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Calendar, MapPin, Users, CheckCircle2, AlertCircle, Share2, Plus, Loader2 } from 'lucide-react';
import { getStoredEventRegistrations, registerForEvent } from '../../lib/engagement';
import type { CommunityEvent, Profile } from '../../types';
import { eventsCatalog } from '../../data/eventsCatalog';
import { generateICS, getICSFileName } from '../../lib/calendar';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { createCommunityEvent, fetchCommunityEvents, COMMUNITY_EVENT_TYPES } from '../../lib/communityEvents';

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
  const { plan } = useSubscription();
  const [registered, setRegistered] = useState<string[]>([]);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { message: string; tone: 'success' | 'info' }>>({});
  const [communityEvents, setCommunityEvents] = useState<CommunityEvent[]>([]);
  const [isLoadingCommunityEvents, setIsLoadingCommunityEvents] = useState(false);
  const [communityEventsError, setCommunityEventsError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [formMessage, setFormMessage] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const defaultEventType = COMMUNITY_EVENT_TYPES[0];
  interface EventFormValues {
    title: string;
    description: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    type: CommunityEvent['type'];
    sponsorName: string;
  }

  const [formValues, setFormValues] = useState<EventFormValues>(() => ({
    title: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    type: defaultEventType,
    sponsorName: '',
  }));

  useEffect(() => {
    setRegistered(Array.from(getStoredEventRegistrations()));
  }, []);

  const canCreateEvent = plan === 'pro-loc' || plan === 'brand-crew';

  const refreshCommunityEvents = useCallback(async () => {
    setIsLoadingCommunityEvents(true);
    setCommunityEventsError(null);

    try {
      const events = await fetchCommunityEvents();
      setCommunityEvents(events);
    } catch (error) {
      console.error('community-events:load-error', error);
      setCommunityEventsError(
        "Impossible de charger les événements créés par la communauté pour le moment. Réessaie plus tard.",
      );
    } finally {
      setIsLoadingCommunityEvents(false);
    }
  }, []);

  useEffect(() => {
    void refreshCommunityEvents();
  }, [refreshCommunityEvents]);

  const registeredSet = useMemo(() => new Set(registered), [registered]);

  const resetFormValues = useCallback(() => {
    setFormValues({
      title: '',
      description: '',
      date: '',
      startTime: '',
      endTime: '',
      location: '',
      type: defaultEventType,
      sponsorName: '',
    });
  }, [defaultEventType]);

  const handleToggleForm = () => {
    setShowForm((previous) => {
      const next = !previous;
      if (next) {
        setFormMessage(null);
        resetFormValues();
      }
      return next;
    });
  };

  const handleFormChange = <Element extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    field: keyof EventFormValues,
  ) =>
    (event: ChangeEvent<Element>) => {
      const value = event.target.value;
      setFormValues((previous) => ({
        ...previous,
        [field]: field === 'type' ? (value as CommunityEvent['type']) : value,
      }));
    };

  const formatTimeRange = (start: string, end: string): string => {
    const format = (value: string) => {
      if (!value) {
        return '';
      }
      const [hours, minutes = '00'] = value.split(':');
      if (!hours) {
        return '';
      }
      return `${hours}h${minutes.padStart(2, '0')}`;
    };

    const startLabel = format(start);
    const endLabel = format(end);

    if (startLabel && endLabel) {
      return `${startLabel} - ${endLabel}`;
    }

    return startLabel || endLabel;
  };

  const handleCancelForm = () => {
    resetFormValues();
    setShowForm(false);
    setFormMessage(null);
  };

  const handleSubmitEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profile?.id) {
      setFormMessage({ tone: 'error', message: 'Connecte-toi pour pouvoir publier ton événement.' });
      return;
    }

    if (!formValues.title.trim() || !formValues.description.trim() || !formValues.location.trim()) {
      setFormMessage({ tone: 'error', message: 'Merci de remplir tous les champs obligatoires.' });
      return;
    }

    if (!formValues.date) {
      setFormMessage({ tone: 'error', message: 'Indique une date pour ton événement.' });
      return;
    }

    const timeLabel = formatTimeRange(formValues.startTime, formValues.endTime);
    if (!timeLabel) {
      setFormMessage({ tone: 'error', message: 'Précise au moins un horaire de début.' });
      return;
    }

    setIsSubmittingEvent(true);

    try {
      await createCommunityEvent({
        title: formValues.title.trim(),
        description: formValues.description.trim(),
        date: formValues.date,
        time: timeLabel,
        location: formValues.location.trim(),
        type: formValues.type,
        sponsorName: formValues.sponsorName.trim() ? formValues.sponsorName.trim() : undefined,
        createdBy: profile.id,
      });

      await refreshCommunityEvents();
      resetFormValues();
      setShowForm(false);
      setFormMessage({ tone: 'success', message: 'Ton événement est en ligne !' });
    } catch (error) {
      console.error('community-events:create-error', error);
      setFormMessage({
        tone: 'error',
        message: "Impossible d'enregistrer l'événement pour le moment. Vérifie les champs et réessaie.",
      });
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  const eventsToDisplay = useMemo(() => [...communityEvents, ...eventsCatalog], [communityEvents]);

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

  const handleAddToCalendar = async (event: CommunityEvent) => {
    try {
      const icsContent = generateICS(event);
      const fileName = getICSFileName(event);

      if (typeof navigator !== 'undefined' && 'share' in navigator && typeof File !== 'undefined') {
        const file = new File([icsContent], fileName, { type: 'text/calendar' });
        const shareData: ShareData & { files?: File[] } = {
          title: event.title,
          text: `${event.title} – ${event.location}`,
          files: [file],
        };

        if (!('canShare' in navigator) || navigator.canShare({ files: [file] })) {
          await navigator.share(shareData);
          setFeedback((prev) => ({
            ...prev,
            [event.id]: {
              message: "Événement partagé avec ton agenda !",
              tone: 'success',
            },
          }));
          return;
        }
      }

      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setFeedback((prev) => ({
        ...prev,
        [event.id]: {
          message: "Fichier ICS téléchargé. Ajoute-le à ton agenda !",
          tone: 'success',
        },
      }));
    } catch (error) {
      console.error('calendar-export-error', error);
      setFeedback((prev) => ({
        ...prev,
        [event.id]: {
          message: "Impossible d'ouvrir le partage. Télécharge le fichier ICS manuellement.",
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

      {canCreateEvent && (
        <div className="space-y-4 pb-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <p className="text-sm text-gray-300 max-w-3xl">
              Partage tes propres contests, sessions de crew ou avant-premières avec toute la communauté.
            </p>
            <button
              type="button"
              onClick={handleToggleForm}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 text-white px-4 py-2 font-semibold hover:bg-orange-400 transition-colors"
            >
              <Plus size={18} />
              <span>{showForm ? 'Fermer le formulaire' : 'Ajouter un événement'}</span>
            </button>
          </div>

          {formMessage && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                formMessage.tone === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/40 text-red-300'
              }`}
            >
              {formMessage.message}
            </div>
          )}

          {showForm && (
            <form
              onSubmit={handleSubmitEvent}
              className="bg-dark-800 border border-dark-700 rounded-2xl p-6 md:p-8 space-y-6 shadow-lg shadow-black/30"
            >
              <div className="grid gap-6 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-200">Titre *</span>
                  <input
                    type="text"
                    value={formValues.title}
                    onChange={handleFormChange<HTMLInputElement>('title')}
                    className="bg-dark-900 border border-dark-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-400"
                    placeholder="Session spéciale au bowl..."
                    required
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-200">Lieu *</span>
                  <input
                    type="text"
                    value={formValues.location}
                    onChange={handleFormChange<HTMLInputElement>('location')}
                    className="bg-dark-900 border border-dark-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-400"
                    placeholder="Skatepark de..."
                    required
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-gray-200">Description *</span>
                <textarea
                  value={formValues.description}
                  onChange={handleFormChange<HTMLTextAreaElement>('description')}
                  className="bg-dark-900 border border-dark-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-400 min-h-[120px]"
                  placeholder="Présente ce qui va se passer, qui organise, le matériel à prévoir..."
                  required
                />
              </label>

              <div className="grid gap-6 md:grid-cols-3">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-200">Date *</span>
                  <input
                    type="date"
                    value={formValues.date}
                    onChange={handleFormChange<HTMLInputElement>('date')}
                    className="bg-dark-900 border border-dark-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-400"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-200">Heure de début *</span>
                  <input
                    type="time"
                    value={formValues.startTime}
                    onChange={handleFormChange<HTMLInputElement>('startTime')}
                    className="bg-dark-900 border border-dark-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-400"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-200">Heure de fin (optionnel)</span>
                  <input
                    type="time"
                    value={formValues.endTime}
                    onChange={handleFormChange<HTMLInputElement>('endTime')}
                    className="bg-dark-900 border border-dark-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-400"
                  />
                </label>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-200">Type d'événement *</span>
                  <select
                    value={formValues.type}
                    onChange={handleFormChange<HTMLSelectElement>('type')}
                    className="bg-dark-900 border border-dark-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-400"
                  >
                    {COMMUNITY_EVENT_TYPES.map((eventType) => (
                      <option key={eventType} value={eventType}>
                        {eventType}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-200">Sponsor (optionnel)</span>
                  <input
                    type="text"
                    value={formValues.sponsorName}
                    onChange={handleFormChange<HTMLInputElement>('sponsorName')}
                    className="bg-dark-900 border border-dark-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-400"
                    placeholder="Nom du partenaire"
                  />
                </label>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-dark-600 px-4 py-2 text-gray-300 hover:text-white hover:border-orange-400 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEvent}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 text-white px-4 py-2 font-semibold hover:bg-orange-400 transition-colors disabled:opacity-60"
                >
                  {isSubmittingEvent ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <span>Publier l'événement</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {communityEventsError && (
        <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {communityEventsError}
        </div>
      )}

      {isLoadingCommunityEvents && (
        <div className="mb-6 rounded-2xl border border-dark-700 bg-dark-800 px-4 py-5 text-sm text-gray-400">
          Chargement des événements de la communauté...
        </div>
      )}

      {canCreateEvent &&
        !isLoadingCommunityEvents &&
        !communityEventsError &&
        communityEvents.length === 0 && (
          <div className="mb-6 rounded-2xl border border-dark-700 bg-dark-800 px-4 py-5 text-sm text-gray-400">
            Tu es le premier à proposer un événement pro à la communauté. Lance-toi !
          </div>
        )}

      <div className="space-y-6 pb-20">
        {eventsToDisplay.map((event) => {
          const isRegistered = registeredSet.has(event.id);
          const eventFeedback = feedback[event.id];

          return (
            <article
              key={event.id}
              id={`event-${event.id}`}
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
                      onClick={() => handleAddToCalendar(event)}
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
