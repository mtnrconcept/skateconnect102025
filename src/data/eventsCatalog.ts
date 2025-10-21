import type { CommunityEvent } from '../types';

export const eventsCatalog: CommunityEvent[] = [
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
    is_sponsor_event: true,
    sponsor_name: 'Concrete Co.',
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
    is_sponsor_event: true,
    sponsor_name: 'Vans',
  },
  {
    id: 'call-for-crews',
    title: 'Appel à projet - Upgrade ton spot',
    description:
      'Nos partenaires financent des crews motivées pour rénover leurs spots locaux. Dépose ton projet avec photos et budget.',
    date: 'Clôture le 30 avril 2025',
    time: 'Soumission en ligne',
    location: 'Plateforme Shredloc',
    type: 'Appel à projet',
    attendees: 58,
    is_sponsor_event: true,
    sponsor_name: 'Foundation Skate Fund',
  },
  {
    id: 'brand-meetup',
    title: 'Rencontre sponsor - Team Element',
    description:
      'Session privée et mentoring avec la team Element, ouverte aux riders sélectionnés. Présente ton portfolio pour rejoindre la journée.',
    date: 'Samedi 24 mai 2025',
    time: '14h00 - 18h00',
    location: 'Skatepark de la Muette, Paris',
    type: 'Rencontre',
    attendees: 76,
    is_sponsor_event: true,
    sponsor_name: 'Element',
  },
];
