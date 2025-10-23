import type { Comment, Post, Profile, UserXP } from '../types';

export type FeedSegment = 'all' | 'following' | 'local';

export type FakeProfileDetails = Profile & {
  location: string;
  followers: number;
  following: number;
  sponsors: string[];
  favoriteTricks: string[];
  achievements: string[];
};

export type FakeComment = Comment & {
  user: FakeProfileDetails;
};

export type FakeMessage = {
  id: string;
  sender: 'fake' | 'user';
  content: string;
  timestamp: string;
};

export type FakeFeedPost = Post & {
  user: FakeProfileDetails;
  isFake: true;
  segments: FeedSegment[];
  fakeComments?: FakeComment[];
};

export type FakeLeaderboardEntry = UserXP & {
  profile: FakeProfileDetails;
};

const createProfile = (profile: FakeProfileDetails): FakeProfileDetails => profile;

export const fakeProfiles: FakeProfileDetails[] = [
  createProfile({
    id: 'fake-rider-aurora',
    username: 'aurora_slide',
    display_name: 'Aurora “Slide” Martinez',
    bio: 'Filmer, voyager, partager les vibes des spots les plus créatifs d\'Europe.',
    avatar_url: 'https://images.unsplash.com/photo-1502462041640-b3d7e50d0660?auto=format&fit=crop&w=400&q=80',
    cover_url: 'https://images.unsplash.com/photo-1519861051841-16c69bc5d0c6?auto=format&fit=crop&w=1200&q=80',
    skill_level: 'Avancé',
    stance: 'Goofy',
    created_at: '2024-01-08T09:12:00Z',
    updated_at: '2024-01-08T09:12:00Z',
    location: 'Barcelone, ES',
    followers: 18320,
    following: 412,
    sponsors: ['Solstice Wheels', 'Atlas Bearings'],
    favoriteTricks: ['FS Nosegrind', 'Wallride', 'No-Comply 180'],
    achievements: ['Vainqueur Urban Lines 2023', 'Clip de l\'année · EuroSkate Mag'],
  }),
  createProfile({
    id: 'fake-rider-keita',
    username: 'keita.flow',
    display_name: 'Keita Flow',
    bio: 'Street skater parisien — adepte des lines fluides et des sessions sunrise.',
    avatar_url: 'https://images.unsplash.com/photo-1501250987900-211872d97eaa?auto=format&fit=crop&w=400&q=80',
    cover_url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    skill_level: 'Intermédiaire',
    stance: 'Regular',
    created_at: '2024-01-05T07:45:00Z',
    updated_at: '2024-01-05T07:45:00Z',
    location: 'Paris, FR',
    followers: 9420,
    following: 288,
    sponsors: ['Drift Deck Co.'],
    favoriteTricks: ['Manual combos', 'BS Tailslide', '360 Flip'],
    achievements: ['Finaliste Cash For Tricks République', 'Ambassadeur Skate4All'],
  }),
  createProfile({
    id: 'fake-rider-ivy',
    username: 'ivy.loop',
    display_name: 'Ivy Loop',
    bio: 'Filmer et rideuse — spotlight sur les crews féminins & queer.',
    avatar_url: 'https://images.unsplash.com/photo-1517254451971-0829fc3c3e47?auto=format&fit=crop&w=400&q=80',
    cover_url: 'https://images.unsplash.com/photo-1511910849309-0cd922d74902?auto=format&fit=crop&w=1200&q=80',
    skill_level: 'Avancé',
    stance: 'Switch',
    created_at: '2024-01-02T11:22:00Z',
    updated_at: '2024-01-02T11:22:00Z',
    location: 'Berlin, DE',
    followers: 15280,
    following: 501,
    sponsors: ['Night Owl Apparel', 'Motion Lens'],
    favoriteTricks: ['BS Disaster', 'Layback Air', 'Boneless'],
    achievements: ['Organisatrice Berlin Push 2024', 'Featured · Concrete Dreams'],
  }),
  createProfile({
    id: 'fake-rider-tom',
    username: 'tom.slice',
    display_name: 'Tom “Slice” Nguyen',
    bio: 'Obsédé par les spots DIY & les sessions nocturnes sous les ponts.',
    avatar_url: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=400&q=80',
    cover_url: 'https://images.unsplash.com/photo-1498593551527-54546b72b1c0?auto=format&fit=crop&w=1200&q=80',
    skill_level: 'Expert',
    stance: 'Goofy',
    created_at: '2023-12-26T22:05:00Z',
    updated_at: '2023-12-26T22:05:00Z',
    location: 'Lyon, FR',
    followers: 20890,
    following: 189,
    sponsors: ['Concrete Pulse', 'NightLight'],
    favoriteTricks: ['BS Smith Grind', 'Hardflip', 'Wallie'],
    achievements: ['Best Trick · DIY Lyon Jam', 'Coach invité · Night Session Camp'],
  }),
  createProfile({
    id: 'fake-rider-sahana',
    username: 'sahana_rides',
    display_name: 'Sahana Rides',
    bio: 'Rideuse itinérante — spots du monde et tricks minimalistes.',
    avatar_url: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=400&q=80',
    cover_url: 'https://images.unsplash.com/photo-1477414348463-c0eb7f1359b6?auto=format&fit=crop&w=1200&q=80',
    skill_level: 'Intermédiaire',
    stance: 'Regular',
    created_at: '2024-01-10T05:30:00Z',
    updated_at: '2024-01-10T05:30:00Z',
    location: 'Lisbonne, PT',
    followers: 12450,
    following: 340,
    sponsors: ['Flow State Boards'],
    favoriteTricks: ['Shuvit', 'No-Comply 360', 'Body Varial'],
    achievements: ['Podcast “Ride The World”', 'Guide · Spots cachés de Lisbonne'],
  }),
];

const now = new Date('2024-03-01T12:00:00Z');

const daysAgo = (days: number) => {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
};

export const fakeFeedPosts: FakeFeedPost[] = [
  {
    id: 'fake-post-aurora-1',
    user_id: 'fake-rider-aurora',
    content:
      'Session sunrise à la plaza de la Universitat. Deux lines filmées pour la prochaine part, vibes incroyables avec le crew local! ☀️🛹',
    media_urls: [
      'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=1000&q=80',
    ],
    spot_id: null,
    post_type: 'photo',
    likes_count: 1284,
    comments_count: 4,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
    user: fakeProfiles[0],
    liked_by_user: false,
    isFake: true,
    segments: ['all', 'following'],
    fakeComments: [
      {
        id: 'fake-comment-aurora-1',
        post_id: 'fake-post-aurora-1',
        user_id: 'fake-rider-keita',
        content: 'La lumière est dingue, on cale une session sunrise ensemble bientôt !',
        created_at: daysAgo(1),
        updated_at: daysAgo(1),
        user: fakeProfiles[1],
      },
      {
        id: 'fake-comment-aurora-2',
        post_id: 'fake-post-aurora-1',
        user_id: 'fake-rider-ivy',
        content: 'Toujours partante pour filmer ta prochaine part, c’est hypnotisant ✨',
        created_at: daysAgo(1),
        updated_at: daysAgo(1),
        user: fakeProfiles[2],
      },
      {
        id: 'fake-comment-aurora-3',
        post_id: 'fake-post-aurora-1',
        user_id: 'fake-rider-sahana',
        content: 'Les vibes de Barcelone me manquent, merci pour l’inspiration !',
        created_at: daysAgo(1),
        updated_at: daysAgo(1),
        user: fakeProfiles[4],
      },
      {
        id: 'fake-comment-aurora-4',
        post_id: 'fake-post-aurora-1',
        user_id: 'fake-rider-tom',
        content: 'La plaza est parfaite pour shooter un clip de nuit aussi 👀',
        created_at: daysAgo(1),
        updated_at: daysAgo(1),
        user: fakeProfiles[3],
      },
    ],
  },
  {
    id: 'fake-post-keita-1',
    user_id: 'fake-rider-keita',
    content:
      'Line improvisée sur les blocs de République — manual combo + flip out. Qui est chaud pour filmer ce soir? 🎥',
    media_urls: [
      'https://images.unsplash.com/photo-1531986733711-de47444e2e1f?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80',
    ],
    spot_id: null,
    post_type: 'photo',
    likes_count: 876,
    comments_count: 3,
    created_at: daysAgo(2),
    updated_at: daysAgo(2),
    user: fakeProfiles[1],
    liked_by_user: false,
    isFake: true,
    segments: ['all', 'local'],
    fakeComments: [
      {
        id: 'fake-comment-keita-1',
        post_id: 'fake-post-keita-1',
        user_id: 'fake-rider-aurora',
        content: 'Tu veux que je filme ce soir ? J’ai une nouvelle focale à tester.',
        created_at: daysAgo(2),
        updated_at: daysAgo(2),
        user: fakeProfiles[0],
      },
      {
        id: 'fake-comment-keita-2',
        post_id: 'fake-post-keita-1',
        user_id: 'fake-rider-ivy',
        content: 'Je passe avec le crew Berlin en visite, on amène l’énergie !',
        created_at: daysAgo(2),
        updated_at: daysAgo(2),
        user: fakeProfiles[2],
      },
      {
        id: 'fake-comment-keita-3',
        post_id: 'fake-post-keita-1',
        user_id: 'fake-rider-sahana',
        content: 'Grave chaud, j’ai un stabilisateur à tester pour les manuals 🔥',
        created_at: daysAgo(2),
        updated_at: daysAgo(2),
        user: fakeProfiles[4],
      },
    ],
  },
  {
    id: 'fake-post-ivy-1',
    user_id: 'fake-rider-ivy',
    content:
      'On a transformé ce toit en mini-bowl pour le crew Berlin Push. Merci à tou.te.s pour l\'énergie, part complète en montage! 💾',
    media_urls: [
      'https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=1000&q=80',
    ],
    spot_id: null,
    post_type: 'photo',
    likes_count: 1420,
    comments_count: 5,
    created_at: daysAgo(3),
    updated_at: daysAgo(3),
    user: fakeProfiles[2],
    liked_by_user: false,
    isFake: true,
    segments: ['all', 'following'],
    fakeComments: [
      {
        id: 'fake-comment-ivy-1',
        post_id: 'fake-post-ivy-1',
        user_id: 'fake-rider-aurora',
        content: 'Ce toit est une œuvre d’art ! Tu partages le plan d’accès ?',
        created_at: daysAgo(3),
        updated_at: daysAgo(3),
        user: fakeProfiles[0],
      },
      {
        id: 'fake-comment-ivy-2',
        post_id: 'fake-post-ivy-1',
        user_id: 'fake-rider-keita',
        content: 'Les lines de ce spot ont l’air irréelles, je veux tester ça !',
        created_at: daysAgo(3),
        updated_at: daysAgo(3),
        user: fakeProfiles[1],
      },
      {
        id: 'fake-comment-ivy-3',
        post_id: 'fake-post-ivy-1',
        user_id: 'fake-rider-tom',
        content: 'Je peux t’aider à bétonner une extension si tu veux !',
        created_at: daysAgo(3),
        updated_at: daysAgo(3),
        user: fakeProfiles[3],
      },
      {
        id: 'fake-comment-ivy-4',
        post_id: 'fake-post-ivy-1',
        user_id: 'fake-rider-sahana',
        content: 'Ça me donne envie de faire un tour de toits à Lisbonne ✨',
        created_at: daysAgo(3),
        updated_at: daysAgo(3),
        user: fakeProfiles[4],
      },
      {
        id: 'fake-comment-ivy-5',
        post_id: 'fake-post-ivy-1',
        user_id: 'fake-rider-aurora',
        content: 'J’apporte le drone la prochaine fois qu’on ride ensemble !',
        created_at: daysAgo(3),
        updated_at: daysAgo(3),
        user: fakeProfiles[0],
      },
    ],
  },
  {
    id: 'fake-post-tom-1',
    user_id: 'fake-rider-tom',
    content:
      'Nouveau module DIY coulé hier soir sous le pont de la Mulatière. Venez tester ce curb raw! 🧱',
    media_urls: [
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=80',
    ],
    spot_id: null,
    post_type: 'photo',
    likes_count: 990,
    comments_count: 3,
    created_at: daysAgo(4),
    updated_at: daysAgo(4),
    user: fakeProfiles[3],
    liked_by_user: false,
    isFake: true,
    segments: ['all', 'local'],
    fakeComments: [
      {
        id: 'fake-comment-tom-1',
        post_id: 'fake-post-tom-1',
        user_id: 'fake-rider-keita',
        content: 'Tu me montres comment vous avez coulé ça ? Je veux lancer un spot DIY chez moi.',
        created_at: daysAgo(4),
        updated_at: daysAgo(4),
        user: fakeProfiles[1],
      },
      {
        id: 'fake-comment-tom-2',
        post_id: 'fake-post-tom-1',
        user_id: 'fake-rider-ivy',
        content: 'Je viens filmer la session nocturne, c’est trop beau !',
        created_at: daysAgo(4),
        updated_at: daysAgo(4),
        user: fakeProfiles[2],
      },
      {
        id: 'fake-comment-tom-3',
        post_id: 'fake-post-tom-1',
        user_id: 'fake-rider-aurora',
        content: 'On pourrait organiser un atelier DIY pour la communauté 👷‍♀️',
        created_at: daysAgo(4),
        updated_at: daysAgo(4),
        user: fakeProfiles[0],
      },
    ],
  },
  {
    id: 'fake-post-sahana-1',
    user_id: 'fake-rider-sahana',
    content:
      'Petit tour des spots cachés de l\'Alfama — rien de tel que les pavés pour bosser le flow. Nouvelle carte des spots dispo demain! 🗺️',
    media_urls: [
      'https://images.unsplash.com/photo-1468645547353-56d325bb57ff?auto=format&fit=crop&w=1000&q=80',
    ],
    spot_id: null,
    post_type: 'photo',
    likes_count: 654,
    comments_count: 2,
    created_at: daysAgo(5),
    updated_at: daysAgo(5),
    user: fakeProfiles[4],
    liked_by_user: false,
    isFake: true,
    segments: ['all'],
    fakeComments: [
      {
        id: 'fake-comment-sahana-1',
        post_id: 'fake-post-sahana-1',
        user_id: 'fake-rider-aurora',
        content: 'Tes cartes sont devenues indispensables pour mes trips européens.',
        created_at: daysAgo(5),
        updated_at: daysAgo(5),
        user: fakeProfiles[0],
      },
      {
        id: 'fake-comment-sahana-2',
        post_id: 'fake-post-sahana-1',
        user_id: 'fake-rider-keita',
        content: 'J’ai envie de découvrir l’Alfama maintenant, merci pour les bonnes ondes !',
        created_at: daysAgo(5),
        updated_at: daysAgo(5),
        user: fakeProfiles[1],
      },
    ],
  },
  {
    id: 'fake-post-aurora-2',
    user_id: 'fake-rider-aurora',
    content:
      'Première du docu “Lines of Light” demain à Barcelone. Merci à tout le monde pour le support, hâte de partager ça! 🎬',
    media_urls: [],
    spot_id: null,
    post_type: 'text',
    likes_count: 532,
    comments_count: 2,
    created_at: daysAgo(6),
    updated_at: daysAgo(6),
    user: fakeProfiles[0],
    liked_by_user: false,
    isFake: true,
    segments: ['all', 'following'],
    fakeComments: [
      {
        id: 'fake-comment-aurora-5',
        post_id: 'fake-post-aurora-2',
        user_id: 'fake-rider-ivy',
        content: 'On réserve nos places ! Tu organises un Q&A après la projo ?',
        created_at: daysAgo(6),
        updated_at: daysAgo(6),
        user: fakeProfiles[2],
      },
      {
        id: 'fake-comment-aurora-6',
        post_id: 'fake-post-aurora-2',
        user_id: 'fake-rider-keita',
        content: 'J’ai hâte de voir ça, tu vas inspirer tout le monde.',
        created_at: daysAgo(6),
        updated_at: daysAgo(6),
        user: fakeProfiles[1],
      },
    ],
  },
];

export const fakeMessagesByProfileId: Record<string, FakeMessage[]> = {
  'fake-rider-aurora': [
    {
      id: 'fake-message-aurora-1',
      sender: 'fake',
      content: 'Merci pour le soutien sur “Lines of Light” ! Tu viens à la première ?',
      timestamp: daysAgo(1),
    },
  ],
  'fake-rider-keita': [
    {
      id: 'fake-message-keita-1',
      sender: 'fake',
      content: 'Toujours partant pour une session à République, envoie quand tu veux !',
      timestamp: daysAgo(2),
    },
  ],
  'fake-rider-ivy': [
    {
      id: 'fake-message-ivy-1',
      sender: 'fake',
      content: 'Si tu veux qu’on filme un clip ensemble, je suis open la semaine prochaine.',
      timestamp: daysAgo(3),
    },
  ],
  'fake-rider-tom': [
    {
      id: 'fake-message-tom-1',
      sender: 'fake',
      content: 'On organise une session DIY vendredi soir, tu passes ?',
      timestamp: daysAgo(4),
    },
  ],
  'fake-rider-sahana': [
    {
      id: 'fake-message-sahana-1',
      sender: 'fake',
      content: 'Je t’envoie la carte des spots cachés si tu veux préparer un trip.',
      timestamp: daysAgo(5),
    },
  ],
};

export const fakeLeaderboardEntries: FakeLeaderboardEntry[] = [
  {
    user_id: 'fake-rider-tom',
    total_xp: 24850,
    current_level: 27,
    xp_to_next_level: 650,
    level_title: 'Architecte du Spot',
    updated_at: daysAgo(1),
    profile: fakeProfiles[3],
  },
  {
    user_id: 'fake-rider-aurora',
    total_xp: 23640,
    current_level: 26,
    xp_to_next_level: 860,
    level_title: 'Réalisatrice de Flow',
    updated_at: daysAgo(1),
    profile: fakeProfiles[0],
  },
  {
    user_id: 'fake-rider-ivy',
    total_xp: 22190,
    current_level: 24,
    xp_to_next_level: 410,
    level_title: 'Visionnaire Rooftop',
    updated_at: daysAgo(2),
    profile: fakeProfiles[2],
  },
  {
    user_id: 'fake-rider-sahana',
    total_xp: 20510,
    current_level: 22,
    xp_to_next_level: 990,
    level_title: 'Cartographe Nomade',
    updated_at: daysAgo(3),
    profile: fakeProfiles[4],
  },
  {
    user_id: 'fake-rider-keita',
    total_xp: 18940,
    current_level: 21,
    xp_to_next_level: 780,
    level_title: 'Maître des Lines',
    updated_at: daysAgo(2),
    profile: fakeProfiles[1],
  },
];

export const fakeProfilesById: Record<string, FakeProfileDetails> = fakeProfiles.reduce((acc, profile) => {
  acc[profile.id] = profile;
  return acc;
}, {} as Record<string, FakeProfileDetails>);

export const fakePostsByProfileId: Record<string, FakeFeedPost[]> = fakeFeedPosts.reduce((acc, post) => {
  if (!acc[post.user_id]) {
    acc[post.user_id] = [];
  }
  acc[post.user_id].push(post);
  return acc;
}, {} as Record<string, FakeFeedPost[]>);
