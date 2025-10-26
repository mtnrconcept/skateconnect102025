import type {
  SponsorCallOpportunity,
  SponsorChallengeOpportunity,
  SponsorEventOpportunity,
  SponsorNewsItem,
  SponsorOpportunityOwnerSummary,
  SponsorProfileSummary,
} from '../types';

interface GetOptions {
  sponsorId?: string | null;
}

const baseOwner: SponsorOpportunityOwnerSummary = {
  id: 'owner-cm-001',
  username: 'clara.manager',
  display_name: 'Clara Manager',
  avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=256&q=80',
};

const demoSponsors: Record<string, SponsorProfileSummary> = {
  'sponsor-echo': {
    id: 'sponsor-echo',
    username: 'echo_wheels',
    display_name: 'Echo Wheels',
    sponsor_branding: {
      brand_name: 'Echo Wheels',
      logo_url: 'https://images.unsplash.com/photo-1516478177764-9fe5bd2f5754?auto=format&fit=crop&w=200&q=80',
      website_url: 'https://echo-wheels.example',
    },
  },
  'sponsor-flare': {
    id: 'sponsor-flare',
    username: 'flare_energy',
    display_name: 'Flare Energy Drink',
    sponsor_branding: {
      brand_name: 'Flare Energy Drink',
      logo_url: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=200&q=80',
      website_url: 'https://flare-energy.example',
    },
  },
  'sponsor-aurora': {
    id: 'sponsor-aurora',
    username: 'aurora_collective',
    display_name: 'Aurora Creative',
    sponsor_branding: {
      brand_name: 'Aurora Creative',
      logo_url: 'https://images.unsplash.com/photo-1461727885569-b2ddec0c4320?auto=format&fit=crop&w=200&q=80',
      website_url: 'https://aurora-creative.example',
    },
  },
  'sponsor-wavelength': {
    id: 'sponsor-wavelength',
    username: 'wavelength_audio',
    display_name: 'Wavelength Audio',
    sponsor_branding: {
      brand_name: 'Wavelength Audio',
      logo_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=200&q=80',
      website_url: 'https://wavelength-audio.example',
    },
  },
};

const makeDate = (date: string) => new Date(date).toISOString();

const challenges: SponsorChallengeOpportunity[] = [
  {
    id: 'challenge-echo-rails',
    sponsor_id: 'sponsor-echo',
    title: 'Echo Rails Jam',
    description:
      "Pose ton meilleur grind en street sur un rail urbain. Bonus si c'est dans un lieu iconique de ta ville !",
    prize: 'Sponsoring complet Echo Wheels pendant 6 mois',
    value: '3 500 € en dotations',
    location: 'Paris, spots street',
    cover_image_url:
      'https://images.unsplash.com/photo-1520367745676-234fdd6e9ff3?auto=format&fit=crop&w=1280&q=80',
    tags: ['Street', 'Grind', 'Vidéo'],
    start_date: makeDate('2024-05-10'),
    end_date: makeDate('2024-06-30'),
    participants_count: 18,
    participants_label: 'Crews inscrites',
    action_label: 'Participer au défi',
    created_at: makeDate('2024-05-01'),
    updated_at: makeDate('2024-05-15'),
    sponsor: demoSponsors['sponsor-echo'],
    status: 'promotion',
    owner_id: baseOwner.id,
    owner: baseOwner,
  },
  {
    id: 'challenge-flare-transition',
    sponsor_id: 'sponsor-flare',
    title: 'Flare Transition Lines',
    description:
      "Compose la ligne la plus fluide sur un bowl ou mini. On veut du flow, de la vitesse et une créativité folle !",
    prize: 'Collab signature Flare',
    value: '2 000 € + tournée européenne',
    location: 'Lyon Skatepark de Gerland',
    cover_image_url:
      'https://images.unsplash.com/photo-1519861399405-52a9b56bd58c?auto=format&fit=crop&w=1280&q=80',
    tags: ['Bowl', 'Flow', 'Contest'],
    start_date: makeDate('2024-04-20'),
    end_date: makeDate('2024-07-01'),
    participants_count: 26,
    participants_label: 'Riders inscrits',
    action_label: 'Poster sa ligne',
    created_at: makeDate('2024-04-01'),
    updated_at: makeDate('2024-04-28'),
    sponsor: demoSponsors['sponsor-flare'],
    status: 'live',
    owner_id: baseOwner.id,
    owner: baseOwner,
  },
  {
    id: 'challenge-aurora-diy',
    sponsor_id: 'sponsor-aurora',
    title: 'Aurora DIY Build-off',
    description:
      "Construis ou rénove un module DIY et filme la session de test avec ta crew. Aurora accompagne les meilleurs projets.",
    prize: 'Budget aménagement 5 000 €',
    value: '5 000 € + coaching design',
    location: 'France (tournée DIY)',
    cover_image_url:
      'https://images.unsplash.com/photo-1526404428533-89d0a83a84f5?auto=format&fit=crop&w=1280&q=80',
    tags: ['DIY', 'Construction', 'Communauté'],
    start_date: makeDate('2024-05-01'),
    end_date: makeDate('2024-07-15'),
    participants_count: 14,
    participants_label: 'Collectifs inscrits',
    action_label: 'Construire un module',
    created_at: makeDate('2024-04-18'),
    updated_at: makeDate('2024-05-22'),
    sponsor: demoSponsors['sponsor-aurora'],
    status: 'production',
    owner_id: baseOwner.id,
    owner: baseOwner,
  },
  {
    id: 'challenge-wavelength-soundtrack',
    sponsor_id: 'sponsor-wavelength',
    title: 'Wavelength Soundtrack Session',
    description:
      "Tourne une part avec une bande-son originale : un beat maison ou une collab locale. On veut du style et du rythme !",
    prize: 'Session studio + clip officiel',
    value: '3 000 € de production audio',
    location: 'Marseille & en ligne',
    cover_image_url:
      'https://images.unsplash.com/photo-1516910912857-6071ff48f6e4?auto=format&fit=crop&w=1280&q=80',
    tags: ['Vidéo', 'Musique', 'Créativité'],
    start_date: makeDate('2024-06-01'),
    end_date: makeDate('2024-08-01'),
    participants_count: 9,
    participants_label: 'Clips reçus',
    action_label: 'Uploader un clip',
    created_at: makeDate('2024-05-20'),
    updated_at: makeDate('2024-05-28'),
    sponsor: demoSponsors['sponsor-wavelength'],
    status: 'briefing',
    owner_id: baseOwner.id,
    owner: baseOwner,
  },
];

const events: SponsorEventOpportunity[] = [
  {
    id: 'event-flare-night-session',
    sponsor_id: 'sponsor-flare',
    title: 'Flare Night Session',
    description:
      "Session privée nocturne avec dj set, testing boards et battle best trick avec la team Flare.",
    event_date: makeDate('2024-06-15'),
    event_time: '21:00',
    location: 'Skatepark de Bercy, Paris',
    event_type: 'Session privée',
    attendees: 42,
    cover_image_url:
      'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1280&q=80',
    tags: ['Session', 'Night', 'Networking'],
    action_label: 'Réserver sa place',
    created_at: makeDate('2024-04-25'),
    updated_at: makeDate('2024-05-19'),
    sponsor: demoSponsors['sponsor-flare'],
    status: 'promotion',
    owner_id: baseOwner.id,
    owner: baseOwner,
  },
  {
    id: 'event-echo-mentoring-day',
    sponsor_id: 'sponsor-echo',
    title: 'Echo Mentoring Day',
    description:
      "Ateliers coaching carrière, rendez-vous sponsoring individuel et shooting photo pour les profils sélectionnés.",
    event_date: makeDate('2024-07-06'),
    event_time: '10:00',
    location: 'Echo Studio, Barcelone',
    event_type: 'Mentoring',
    attendees: 18,
    cover_image_url:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1280&q=80',
    tags: ['Mentoring', 'Carrière'],
    action_label: 'Postuler au mentoring',
    created_at: makeDate('2024-05-08'),
    updated_at: makeDate('2024-05-27'),
    sponsor: demoSponsors['sponsor-echo'],
    status: 'briefing',
    owner_id: baseOwner.id,
    owner: baseOwner,
  },
  {
    id: 'event-aurora-diy-tour',
    sponsor_id: 'sponsor-aurora',
    title: 'Aurora DIY Tour',
    description:
      "Tournée des chantiers DIY soutenus par Aurora avec ateliers design, tables rondes et sessions filmées.",
    event_date: makeDate('2024-07-20'),
    event_time: '14:00',
    location: 'Tournée France Sud',
    event_type: 'Tournée',
    attendees: 32,
    cover_image_url:
      'https://images.unsplash.com/photo-1505739998589-00fc191ce01e?auto=format&fit=crop&w=1280&q=80',
    tags: ['DIY', 'Tour', 'Communauté'],
    action_label: 'S’inscrire à une étape',
    created_at: makeDate('2024-05-15'),
    updated_at: makeDate('2024-05-25'),
    sponsor: demoSponsors['sponsor-aurora'],
    status: 'production',
    owner_id: baseOwner.id,
    owner: baseOwner,
  },
];

const calls: SponsorCallOpportunity[] = [
  {
    id: 'call-aurora-creative-grant',
    sponsor_id: 'sponsor-aurora',
    title: 'Aurora Creative Grant',
    summary: 'Financement d’un spot DIY ou d’une web-série skate.',
    description:
      "Dépose ton dossier complet : moodboard, budget, planning et impact local. Aurora finance deux projets phares.",
    location: 'France entière',
    deadline: makeDate('2024-07-10'),
    reward: 'Jusqu’à 8 000 € de financement',
    highlight: '2 lauréats accompagnés',
    cover_image_url:
      'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1280&q=80',
    tags: ['Grant', 'DIY', 'Vidéo'],
    participants_label: 'Dossiers reçus',
    participants_count: 23,
    action_label: 'Déposer un dossier',
    created_at: makeDate('2024-04-30'),
    updated_at: makeDate('2024-05-21'),
    sponsor: demoSponsors['sponsor-aurora'],
    status: 'briefing',
    owner_id: baseOwner.id,
    owner: baseOwner,
  },
  {
    id: 'call-wavelength-sound-lab',
    sponsor_id: 'sponsor-wavelength',
    title: 'Wavelength Sound Lab',
    summary: 'Résidence pour produire la bande-son d’un film skate.',
    description:
      "Présente ton projet vidéo, ton univers sonore et l’équipe impliquée. Les sessions studio démarrent en août.",
    location: 'Marseille & en ligne',
    deadline: makeDate('2024-08-05'),
    reward: 'Résidence artistique + distribution audio',
    highlight: 'Pitch final devant le label',
    cover_image_url:
      'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=1280&q=80',
    tags: ['Musique', 'Film', 'Résidence'],
    participants_label: 'Candidatures',
    participants_count: 11,
    action_label: 'Pitcher son projet',
    created_at: makeDate('2024-05-12'),
    updated_at: makeDate('2024-05-26'),
    sponsor: demoSponsors['sponsor-wavelength'],
    status: 'idea',
    owner_id: baseOwner.id,
    owner: baseOwner,
  },
];

const news: SponsorNewsItem[] = [
  {
    id: 'news-flare-tour',
    sponsor_id: 'sponsor-flare',
    title: 'Flare annonce son summer tour',
    summary: 'Rencontre la team Flare dans 5 skateparks français et profite de démos exclusives.',
    body: 'Flare Energy lance un tour estival du 1er juillet au 15 août avec des stops à Lille, Paris, Lyon, Marseille et Bordeaux. Au programme : contests best trick, ateliers nutrition et after-sessions.',
    location: 'France',
    published_at: makeDate('2024-05-18'),
    highlight: '5 dates confirmées',
    cover_image_url:
      'https://images.unsplash.com/photo-1502786129293-79981df4e689?auto=format&fit=crop&w=1280&q=80',
    tags: ['Actualité', 'Tournée'],
    participants_label: 'Lecteurs',
    participants_count: 540,
    action_label: 'Découvrir les dates',
    created_at: makeDate('2024-05-18'),
    updated_at: makeDate('2024-05-18'),
    sponsor: demoSponsors['sponsor-flare'],
  },
];

const challengeParticipations: Record<string, Array<{
  id: string;
  author: string;
  avatar: string;
  caption: string;
  mediaType: 'video' | 'photo';
  thumbnail: string;
  votes: number;
  submittedAt: string;
}>> = {
  'challenge-echo-rails': [
    {
      id: 'media-rails-1',
      author: 'Crew République',
      avatar: 'https://images.unsplash.com/photo-1529946825183-536c4c2348f1?auto=format&fit=crop&w=200&q=80',
      caption: 'Front feeble sur la rambarde du Palais de Tokyo',
      mediaType: 'video',
      thumbnail: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=900&q=80',
      votes: 128,
      submittedAt: makeDate('2024-05-20'),
    },
    {
      id: 'media-rails-2',
      author: 'Les Vagues',
      avatar: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=200&q=80',
      caption: 'Line sunrise sur les rails de la Défense',
      mediaType: 'video',
      thumbnail: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80',
      votes: 94,
      submittedAt: makeDate('2024-05-22'),
    },
  ],
  'challenge-flare-transition': [
    {
      id: 'media-transition-1',
      author: 'Flowstate',
      avatar: 'https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?auto=format&fit=crop&w=200&q=80',
      caption: 'Run switch dans le bowl principal',
      mediaType: 'video',
      thumbnail: 'https://images.unsplash.com/photo-1511310835117-481c5c7bc33d?auto=format&fit=crop&w=900&q=80',
      votes: 156,
      submittedAt: makeDate('2024-05-24'),
    },
    {
      id: 'media-transition-2',
      author: 'Team Gerland',
      avatar: 'https://images.unsplash.com/photo-1499996860823-5214fcc65f8f?auto=format&fit=crop&w=200&q=80',
      caption: 'Aerial nosegrab sur le deep end',
      mediaType: 'photo',
      thumbnail: 'https://images.unsplash.com/photo-1500496733687-85a68ca1d28e?auto=format&fit=crop&w=900&q=80',
      votes: 121,
      submittedAt: makeDate('2024-05-25'),
    },
  ],
  'challenge-aurora-diy': [
    {
      id: 'media-diy-1',
      author: 'DIY Nantes',
      avatar: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=200&q=80',
      caption: 'Mini spine béton coulée en 48h',
      mediaType: 'photo',
      thumbnail: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=900&q=80',
      votes: 88,
      submittedAt: makeDate('2024-05-26'),
    },
    {
      id: 'media-diy-2',
      author: 'Les Planchistes',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
      caption: 'Quarter pipe mobile modulable',
      mediaType: 'video',
      thumbnail: 'https://images.unsplash.com/photo-1521038199265-bc482db0f187?auto=format&fit=crop&w=900&q=80',
      votes: 73,
      submittedAt: makeDate('2024-05-27'),
    },
  ],
};

export function getDemoSponsorChallenges(options: GetOptions = {}): SponsorChallengeOpportunity[] {
  const { sponsorId } = options;
  const list = sponsorId ? challenges.filter((challenge) => challenge.sponsor_id === sponsorId) : challenges;
  return list;
}

export function getDemoSponsorEvents(options: GetOptions = {}): SponsorEventOpportunity[] {
  const { sponsorId } = options;
  const list = sponsorId ? events.filter((event) => event.sponsor_id === sponsorId) : events;
  return list;
}

export function getDemoSponsorCalls(options: GetOptions = {}): SponsorCallOpportunity[] {
  const { sponsorId } = options;
  const list = sponsorId ? calls.filter((call) => call.sponsor_id === sponsorId) : calls;
  return list;
}

export function getDemoSponsorNews(options: GetOptions = {}): SponsorNewsItem[] {
  const { sponsorId } = options;
  const list = sponsorId ? news.filter((item) => item.sponsor_id === sponsorId) : news;
  return list;
}

export function getDemoChallengeParticipations() {
  return challengeParticipations;
}
