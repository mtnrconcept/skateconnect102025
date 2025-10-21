import { Calendar, MapPin, Users } from 'lucide-react';

interface EventItem {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  type: 'Compétition' | 'Contest' | 'Rencontre' | 'Avant-première';
  attendees: number;
}

const events: EventItem[] = [
  {
    id: 'battle-lyon',
    title: 'Battle of Lyon',
    description:
      'Session street géante avec modules DIY, best trick et jam par équipes toute la journée.',
    date: 'Samedi 16 mars 2025',
    time: '10h00 - 20h00',
    location: 'Place des Terreaux, Lyon',
    type: 'Compétition',
    attendees: 128,
  },
  {
    id: 'dawn-patrol',
    title: 'Dawn Patrol - Sunrise Session',
    description:
      "Rencontre matinale pour profiter du bowl avant l'affluence, café offert par la crew locale.",
    date: 'Dimanche 23 mars 2025',
    time: '07h00 - 09h30',
    location: 'Skatepark de la Friche, Marseille',
    type: 'Rencontre',
    attendees: 42,
  },
  {
    id: 'hype-video-premiere',
    title: 'Avant-première "Concrete Dreams"',
    description:
      'Projection exclusive du nouveau film de la team Shredloc avec session signature et Q&A.',
    date: 'Vendredi 4 avril 2025',
    time: '21h00 - 23h00',
    location: 'Cinéma Le Brady, Paris',
    type: 'Avant-première',
    attendees: 95,
  },
  {
    id: 'spring-jam',
    title: 'Spring Bowl Jam',
    description:
      'Contest bowl avec formats juniors, open et masters, cash for tricks et DJ set sunset.',
    date: 'Samedi 12 avril 2025',
    time: '12h00 - 22h00',
    location: 'Hangar Darwin, Bordeaux',
    type: 'Contest',
    attendees: 210,
  },
];

const typeColors: Record<EventItem['type'], string> = {
  Compétition: 'bg-red-500/10 text-red-300 border-red-500/40',
  Contest: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/40',
  Rencontre: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
  'Avant-première': 'bg-amber-500/10 text-amber-300 border-amber-500/40',
};

export default function EventsSection() {
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

      <div className="space-y-6 pb-16">
        {events.map((event) => (
          <article
            key={event.id}
            className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden shadow-lg shadow-black/20"
          >
            <div className="flex flex-col md:flex-row">
              <div className="md:w-48 bg-gradient-to-b from-orange-500/20 to-orange-500/10 p-6 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-orange-300 font-semibold">
                  <Calendar size={20} />
                  <span>{event.date}</span>
                </div>
                <div className="text-gray-300 text-sm">{event.time}</div>
                <span
                  className={`inline-flex items-center justify-center px-3 py-1 mt-auto text-xs font-semibold uppercase tracking-wide rounded-full border ${
                    typeColors[event.type]
                  }`}
                >
                  {event.type}
                </span>
              </div>

              <div className="flex-1 p-6 md:p-8 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{event.title}</h2>
                    <p className="text-gray-300 mt-2 leading-relaxed">{event.description}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 text-sm text-gray-300">
                  <div className="flex items-center gap-2">
                    <MapPin size={18} className="text-orange-400" />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-orange-400" />
                    <span>
                      {event.attendees} inscrit{event.attendees > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-orange-500 text-white font-semibold hover:bg-orange-400 transition-colors"
                  >
                    Je participe
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-dark-600 text-gray-300 hover:border-orange-400 hover:text-white transition-colors"
                  >
                    Ajouter à mon agenda
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
