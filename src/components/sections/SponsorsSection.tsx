import { useEffect, useMemo, useState, useCallback } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  AlertCircle,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Filter,
  Gift,
  Handshake,
  MapPin,
  Search,
  Sparkles,
  Star,
  Tag,
  ThumbsUp,
  UploadCloud,
  Users,
  Video,
  X,
} from 'lucide-react';
import type { Challenge, CommunityEvent, Profile } from '../../types';
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

type PostType = 'challenge' | 'event' | 'call' | 'news';

type FeedbackTone = 'success' | 'info' | 'error';

interface SponsorChallenge extends Challenge {
  sponsor: string;
  value: string;
  location: string;
  coverImage: string;
  tags: string[];
}

interface ParticipationMedia {
  id: string;
  author: string;
  avatar: string;
  caption: string;
  mediaType: 'photo' | 'video';
  thumbnail: string;
  votes: number;
  submittedAt: string;
}

interface SponsorFeedPost {
  id: string;
  type: PostType;
  title: string;
  excerpt: string;
  description: string;
  sponsor: string;
  location: string;
  dateLabel: string;
  dateValue: Date | null;
  reward?: string;
  highlight?: string;
  coverImage: string;
  tags: string[];
  participantsLabel: string;
  participantsCount: number;
  challenge?: SponsorChallenge;
  event?: CommunityEvent;
  actionLabel: string;
}

const monthMap: Record<string, number> = {
  janvier: 0,
  février: 1,
  fevrier: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  août: 7,
  aout: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  décembre: 11,
  decembre: 11,
};

const parseFrenchDate = (value: string): Date | null => {
  const regex = /(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/i;
  const match = value.match(regex);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = monthMap[match[2].toLowerCase()];
  const year = Number(match[3]);

  if (Number.isNaN(day) || month === undefined || Number.isNaN(year)) {
    return null;
  }

  return new Date(year, month, day);
};

const formatRelativeDate = (date: Date | null): string | null => {
  if (!date) return null;

  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Aujourd'hui";
  }

  if (diffDays > 0) {
    return diffDays === 1 ? 'Dans 1 jour' : `Dans ${diffDays} jours`;
  }

  const absDays = Math.abs(diffDays);
  return absDays === 1 ? 'Il y a 1 jour' : `Il y a ${absDays} jours`;
};

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
    location: 'Square Diderot, Paris',
    coverImage:
      'https://images.unsplash.com/photo-1504598318550-17eba1008a68?auto=format&fit=crop&w=1200&q=80',
    tags: ['Street', 'Video part', 'Technique'],
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
    location: 'Hangar Darwin, Bordeaux',
    coverImage:
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80',
    tags: ['DIY', 'Appel à projet', 'Crew'],
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
    location: 'La Friche, Marseille',
    coverImage:
      'https://images.unsplash.com/photo-1501820488136-72669149e0d4?auto=format&fit=crop&w=1200&q=80',
    tags: ['Creativité', 'Park', 'Run'],
  },
];

const additionalStories: Array<{
  id: string;
  type: PostType;
  title: string;
  excerpt: string;
  description: string;
  sponsor: string;
  location: string;
  dateLabel: string;
  dateValue: Date;
  reward?: string;
  highlight?: string;
  coverImage: string;
  tags: string[];
  participantsLabel: string;
  participantsCount: number;
  actionLabel: string;
}> = [
  {
    id: 'sponsor-story-1',
    type: 'call',
    title: 'Fond de soutien #BuildYourSpot',
    excerpt:
      'Les sponsors financent trois crews pour rénover des spots DIY. Dépose ton dossier avec plan de financement, moodboard et planning.',
    description:
      'Présente ton spot, l’impact pour la scène locale et ton plan d’activation média. Les projets retenus bénéficieront d’un accompagnement pro et d’un suivi sur le long terme.',
    sponsor: 'Foundation Skate Fund',
    location: 'Plateforme Shredloc',
    dateLabel: 'Clôture le 30 avril 2025',
    dateValue: new Date(new Date().setDate(new Date().getDate() + 25)),
    reward: 'Jusqu’à 4 000€ de budget + mentorat',
    highlight: 'Accompagnement complet des sponsors',
    coverImage:
      'https://images.unsplash.com/photo-1541712034-cd3c93b71d07?auto=format&fit=crop&w=1200&q=80',
    tags: ['Appel à projet', 'DIY', 'Financement'],
    participantsLabel: 'Dossiers reçus',
    participantsCount: 32,
    actionLabel: 'Déposer un projet',
  },
  {
    id: 'sponsor-story-2',
    type: 'news',
    title: 'Team adidas Skateboarding - scouting tour',
    excerpt:
      'La team adidas lance un repérage national. Partage ton portfolio et inscris-toi à la session proche de chez toi.',
    description:
      'Sessions privées dans 4 villes avec coaching, analyse de style et sessions media. Les riders retenus rejoindront un stage intensif à Berlin.',
    sponsor: 'adidas Skateboarding',
    location: 'Tournée nationale',
    dateLabel: 'Roadshow mai - juin 2025',
    dateValue: new Date(new Date().setDate(new Date().getDate() + 45)),
    reward: 'Stage pro à Berlin',
    highlight: 'Sélection finale par la team internationale',
    coverImage:
      'https://images.unsplash.com/photo-1504274066651-8d31a536b11a?auto=format&fit=crop&w=1200&q=80',
    tags: ['Scouting', 'Coaching', 'Portfolio'],
    participantsLabel: 'Candidatures',
    participantsCount: 218,
    actionLabel: 'Découvrir la tournée',
  },
];

const initialParticipations: Record<string, ParticipationMedia[]> = {
  'sponsor-challenge-1': [
    {
      id: 'media-globe-1',
      author: 'Lina M.',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Lina',
      caption: 'Switch hardflip over 5 marches',
      mediaType: 'video',
      thumbnail:
        'https://images.unsplash.com/photo-1533038590840-1cde6e668a91?auto=format&fit=crop&w=900&q=80',
      votes: 142,
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    },
    {
      id: 'media-globe-2',
      author: 'Crew 93 District',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=93',
      caption: 'Line double angle',
      mediaType: 'video',
      thumbnail:
        'https://images.unsplash.com/photo-1526402462956-0e0cc4c0de95?auto=format&fit=crop&w=900&q=80',
      votes: 98,
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    },
  ],
  'sponsor-challenge-2': [
    {
      id: 'media-vans-1',
      author: 'DIY Bellecour',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=DIY',
      caption: 'Plan 3D + budget collaboratif',
      mediaType: 'photo',
      thumbnail:
        'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=80',
      votes: 64,
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
    },
  ],
  'sponsor-challenge-3': [
    {
      id: 'media-carhartt-1',
      author: 'Mira S.',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Mira',
      caption: 'Run hybride street / bowl',
      mediaType: 'video',
      thumbnail:
        'https://images.unsplash.com/photo-1465808022351-76d943549a98?auto=format&fit=crop&w=900&q=80',
      votes: 120,
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      id: 'media-carhartt-2',
      author: 'Crew Marseille Nord',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=CMN',
      caption: 'Line sunset',
      mediaType: 'photo',
      thumbnail:
        'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=900&q=80',
      votes: 84,
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    },
  ],
};

export default function SponsorsSection({ profile }: SponsorsSectionProps) {
  const [joinedChallenges, setJoinedChallenges] = useState<string[]>([]);
  const [registeredEvents, setRegisteredEvents] = useState<string[]>([]);
  const [joiningChallengeId, setJoiningChallengeId] = useState<string | null>(null);
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { message: string; tone: FeedbackTone }>>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<PostType | 'all'>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'soon' | 'month' | 'past'>('all');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'participations' | 'participer'>('details');
  const [participationSort, setParticipationSort] = useState<'votes' | 'recent'>('votes');
  const [participations, setParticipations] = useState<Record<string, ParticipationMedia[]>>(initialParticipations);
  const [votedMedias, setVotedMedias] = useState<Set<string>>(new Set());
  const [modalFeedback, setModalFeedback] = useState<{ message: string; tone: FeedbackTone } | null>(null);
  const [submissionTitle, setSubmissionTitle] = useState('');
  const [submissionDescription, setSubmissionDescription] = useState('');
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submissionPreview, setSubmissionPreview] = useState<string | null>(null);

  useEffect(() => {
    setJoinedChallenges(Array.from(getStoredChallengeRegistrations()));
    setRegisteredEvents(Array.from(getStoredEventRegistrations()));
  }, []);

  useEffect(() => {
    return () => {
      if (submissionPreview) {
        URL.revokeObjectURL(submissionPreview);
      }
    };
  }, [submissionPreview]);

  const joinedChallengeSet = useMemo(() => new Set(joinedChallenges), [joinedChallenges]);
  const registeredEventSet = useMemo(() => new Set(registeredEvents), [registeredEvents]);

  const sponsorEvents = useMemo(
    () => eventsCatalog.filter((event) => event.is_sponsor_event),
    []
  );

  const posts = useMemo(() => {
    const challengePosts: SponsorFeedPost[] = sponsorChallenges.map((challenge) => ({
      id: challenge.id,
      type: 'challenge',
      title: challenge.title,
      excerpt: challenge.description,
      description: challenge.description,
      sponsor: challenge.sponsor,
      location: challenge.location,
      dateLabel: `Clôture ${new Date(challenge.end_date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
      })}`,
      dateValue: new Date(challenge.end_date),
      reward: challenge.prize,
      highlight: challenge.value,
      coverImage: challenge.coverImage,
      tags: challenge.tags,
      participantsLabel: 'Crews inscrites',
      participantsCount: challenge.participants_count + (joinedChallengeSet.has(challenge.id) ? 1 : 0),
      challenge,
      actionLabel: joinedChallengeSet.has(challenge.id) ? 'Déjà inscrit' : 'Voir le défi',
    }));

    const eventPosts: SponsorFeedPost[] = sponsorEvents.map((event) => {
      const parsedDate = parseFrenchDate(event.date);
      return {
        id: event.id,
        type: 'event',
        title: event.title,
        excerpt: event.description,
        description: event.description,
        sponsor: event.sponsor_name ?? 'Événement partenaire',
        location: event.location,
        dateLabel: `${event.date} · ${event.time}`,
        dateValue: parsedDate,
        reward: undefined,
        highlight: event.type,
        coverImage:
          'https://images.unsplash.com/photo-1519861399405-52a9b56bd58c?auto=format&fit=crop&w=1200&q=80',
        tags: [event.type, 'Sponsor', 'Networking'],
        participantsLabel: 'Participants',
        participantsCount: event.attendees + (registeredEventSet.has(event.id) ? 1 : 0),
        event,
        actionLabel: registeredEventSet.has(event.id) ? 'Place réservée' : 'Réserver',
      };
    });

    return [...challengePosts, ...eventPosts, ...additionalStories].sort((a, b) => {
      const aTime = a.dateValue ? a.dateValue.getTime() : 0;
      const bTime = b.dateValue ? b.dateValue.getTime() : 0;
      return aTime - bTime;
    });
  }, [joinedChallengeSet, registeredEventSet, sponsorEvents]);

  const locationOptions = useMemo(() => {
    const unique = new Set<string>();
    posts.forEach((post) => unique.add(post.location));
    return Array.from(unique);
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();
    const now = new Date();

    return posts.filter((post) => {
      const matchesSearch =
        lowerSearch.length === 0 ||
        [post.title, post.description, post.sponsor, post.tags.join(' ')].some((value) =>
          value.toLowerCase().includes(lowerSearch)
        );

      const matchesType = typeFilter === 'all' || post.type === typeFilter;
      const matchesLocation = locationFilter === 'all' || post.location === locationFilter;

      const matchesDate = (() => {
        if (!post.dateValue || dateFilter === 'all') return true;

        const diffDays = Math.round((post.dateValue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        switch (dateFilter) {
          case 'soon':
            return diffDays >= 0 && diffDays <= 7;
          case 'month':
            return diffDays >= 0 && diffDays <= 30;
          case 'past':
            return diffDays < 0;
          default:
            return true;
        }
      })();

      return matchesSearch && matchesType && matchesLocation && matchesDate;
    });
  }, [posts, searchTerm, typeFilter, locationFilter, dateFilter]);

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) ?? null,
    [posts, selectedPostId]
  );

  const selectedPostParticipations = useMemo(() => {
    if (!selectedPost) return [];
    return participations[selectedPost.id] ?? [];
  }, [participations, selectedPost]);

  const sortedParticipations = useMemo(() => {
    const list = [...selectedPostParticipations];

    if (participationSort === 'votes') {
      list.sort((a, b) => b.votes - a.votes);
    } else {
      list.sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );
    }

    return list;
  }, [selectedPostParticipations, participationSort]);

  const handleJoinChallenge = useCallback(
    async (challenge: SponsorChallenge) => {
      if (!profile?.id) {
        setFeedback((prev) => ({
          ...prev,
          [challenge.id]: {
            message: 'Connecte-toi pour rejoindre les programmes sponsors.',
            tone: 'info',
          },
        }));
        setModalFeedback({
          message: 'Connecte-toi pour rejoindre ce défi.',
          tone: 'info',
        });
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
        setModalFeedback({
          message: 'Tu es déjà inscrit sur ce défi.',
          tone: 'info',
        });
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

      setModalFeedback({
        message: result.message,
        tone: result.success ? 'success' : 'info',
      });
    },
    [joinedChallengeSet, profile]
  );

  const handleJoinEvent = useCallback(
    async (eventId: string) => {
      if (!profile?.id) {
        setFeedback((prev) => ({
          ...prev,
          [eventId]: {
            message: 'Connecte-toi pour t’inscrire.',
            tone: 'info',
          },
        }));
        setModalFeedback({
          message: 'Connecte-toi pour réserver ta place.',
          tone: 'info',
        });
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
        setModalFeedback({
          message: 'Ta place est déjà réservée.',
          tone: 'info',
        });
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

      setModalFeedback({
        message: result.message,
        tone: result.success ? 'success' : 'info',
      });
    },
    [profile, registeredEventSet]
  );

  const handleOpenPost = (postId: string) => {
    setSelectedPostId(postId);
    setActiveTab('details');
    setModalFeedback(null);
    setParticipationSort('votes');
  };

  const handleCloseModal = () => {
    setSelectedPostId(null);
    setSubmissionTitle('');
    setSubmissionDescription('');
    setSubmissionFile(null);
    if (submissionPreview) {
      URL.revokeObjectURL(submissionPreview);
      setSubmissionPreview(null);
    }
  };

  const handleVote = (postId: string, mediaId: string) => {
    const key = `${postId}-${mediaId}`;
    if (votedMedias.has(key)) {
      setModalFeedback({
        message: 'Tu as déjà voté pour ce média.',
        tone: 'info',
      });
      return;
    }

    setParticipations((prev) => {
      const mediaList = prev[postId] ?? [];
      const updatedList = mediaList.map((media) =>
        media.id === mediaId ? { ...media, votes: media.votes + 1 } : media
      );
      return {
        ...prev,
        [postId]: updatedList,
      };
    });

    setVotedMedias((prev) => new Set(prev).add(key));
  };

  const handleSubmissionFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (submissionPreview) {
      URL.revokeObjectURL(submissionPreview);
      setSubmissionPreview(null);
    }
    setSubmissionFile(file);

    if (file) {
      const preview = URL.createObjectURL(file);
      setSubmissionPreview(preview);
    }
  };

  const handleSubmitParticipation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedPost || selectedPost.type !== 'challenge') {
      setModalFeedback({
        message: 'Les participations média sont réservées aux défis.',
        tone: 'info',
      });
      return;
    }

    if (!profile) {
      setModalFeedback({
        message: 'Connecte-toi pour soumettre ta participation.',
        tone: 'info',
      });
      return;
    }

    if (!submissionFile) {
      setModalFeedback({
        message: 'Ajoute une vidéo ou une photo pour participer.',
        tone: 'error',
      });
      return;
    }

    const newMedia: ParticipationMedia = {
      id: `user-media-${Date.now()}`,
      author: profile.display_name ?? profile.username,
      avatar:
        profile.avatar_url ??
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.username)}`,
      caption: submissionTitle || 'Participation communauté',
      mediaType: submissionFile.type.startsWith('video') ? 'video' : 'photo',
      thumbnail:
        submissionPreview ??
        'https://images.unsplash.com/photo-1519861399405-52a9b56bd58c?auto=format&fit=crop&w=900&q=80',
      votes: 0,
      submittedAt: new Date().toISOString(),
    };

    setParticipations((prev) => {
      const list = prev[selectedPost.id] ?? [];
      return {
        ...prev,
        [selectedPost.id]: [newMedia, ...list],
      };
    });

    setSubmissionTitle('');
    setSubmissionDescription('');
    setSubmissionFile(null);
    if (submissionPreview) {
      URL.revokeObjectURL(submissionPreview);
      setSubmissionPreview(null);
    }

    setActiveTab('participations');
    setModalFeedback({
      message: 'Participation envoyée !',
      tone: 'success',
    });
  };

  return (
    <section className="max-w-6xl mx-auto px-4 pb-24 space-y-10">
      <header className="bg-gradient-to-br from-orange-500/10 via-amber-500/10 to-rose-500/10 border border-orange-500/20 rounded-3xl px-6 py-10 sm:px-10 flex flex-col gap-6">
        <div className="flex items-center gap-3 text-orange-300">
          <Sparkles size={24} />
          <span className="uppercase tracking-[0.35em] text-xs">Espace Sponsors</span>
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
            Le hub des opportunités sponsors
          </h1>
          <p className="text-gray-300 text-sm sm:text-base max-w-3xl">
            Explore les défis, événements et appels à projets proposés par nos partenaires. Filtre selon ta localisation, tes objectifs et participe directement depuis le fil d’actualité.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-dark-900/60 border border-dark-700 rounded-2xl p-4 flex items-start gap-3">
            <Gift className="text-orange-400" size={22} />
            <div>
              <h2 className="text-sm font-semibold text-white">Défis à forte visibilité</h2>
              <p className="text-xs text-gray-400">Sélectionne un défi sponsorisé et poste ta participation média.</p>
            </div>
          </div>
          <div className="bg-dark-900/60 border border-dark-700 rounded-2xl p-4 flex items-start gap-3">
            <Handshake className="text-orange-400" size={22} />
            <div>
              <h2 className="text-sm font-semibold text-white">Rencontres & networking</h2>
              <p className="text-xs text-gray-400">Événements privés, scouting et mentoring avec les marques.</p>
            </div>
          </div>
          <div className="bg-dark-900/60 border border-dark-700 rounded-2xl p-4 flex items-start gap-3">
            <Star className="text-orange-400" size={22} />
            <div>
              <h2 className="text-sm font-semibold text-white">Appels à projets</h2>
              <p className="text-xs text-gray-400">Dépose ton dossier pour financer un spot ou un contenu média.</p>
            </div>
          </div>
        </div>
      </header>

      <section className="bg-dark-900/60 border border-dark-700 rounded-3xl p-6 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Recherche événement, sponsor, mot-clé..."
                className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 text-white rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-gray-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-orange-300">
            <Filter size={18} />
            <span>{filteredPosts.length} opportunités disponibles</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {[
            { value: 'all' as const, label: 'Tout' },
            { value: 'challenge' as const, label: 'Défis' },
            { value: 'event' as const, label: 'Événements' },
            { value: 'call' as const, label: 'Appels à projet' },
            { value: 'news' as const, label: 'Actu sponsors' },
          ].map((filterItem) => {
            const isActive = typeFilter === filterItem.value;
            return (
              <button
                key={filterItem.value}
                type="button"
                onClick={() => setTypeFilter(filterItem.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                  isActive
                    ? 'bg-orange-500 text-white border-orange-400'
                    : 'bg-dark-800 text-gray-300 border-dark-700 hover:border-dark-600'
                }`}
              >
                {filterItem.label}
              </button>
            );
          })}
          <div className="flex items-center gap-2 ml-auto flex-wrap sm:flex-nowrap">
            <select
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
              className="bg-dark-800 border border-dark-700 rounded-xl px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Toutes les localisations</option>
              {locationOptions.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
            <select
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value as typeof dateFilter)}
              className="bg-dark-800 border border-dark-700 rounded-xl px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Toutes les dates</option>
              <option value="soon">Cette semaine</option>
              <option value="month">Ce mois-ci</option>
              <option value="past">Événements passés</option>
            </select>
            {(searchTerm || typeFilter !== 'all' || locationFilter !== 'all' || dateFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setTypeFilter('all');
                  setLocationFilter('all');
                  setDateFilter('all');
                }}
                className="text-sm text-gray-400 hover:text-gray-200"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        {filteredPosts.map((post) => {
          const relativeDate = formatRelativeDate(post.dateValue);
          const postFeedback = feedback[post.id];
          const isChallenge = post.type === 'challenge' && joinedChallengeSet.has(post.id);
          const isEvent = post.type === 'event' && registeredEventSet.has(post.id);

          return (
            <article
              key={post.id}
              className="bg-dark-900/60 border border-dark-700 rounded-3xl overflow-hidden transition-transform hover:-translate-y-1 hover:border-orange-500/40"
              onClick={() => handleOpenPost(post.id)}
            >
              <div className="relative h-60 w-full">
                <img
                  src={post.coverImage}
                  alt={post.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/40 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-wide text-orange-300">
                      {post.sponsor}
                    </span>
                    <h3 className="text-2xl font-semibold text-white leading-snug">
                      {post.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleOpenPost(post.id);
                    }}
                    className="px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium border border-white/20 hover:bg-white/20"
                  >
                    {post.actionLabel}
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-300 leading-relaxed">{post.excerpt}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                  <span className="flex items-center gap-2">
                    <Calendar size={16} className="text-orange-400" />
                    {post.dateLabel}
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin size={16} className="text-orange-400" />
                    {post.location}
                  </span>
                  <span className="flex items-center gap-2">
                    <Users size={16} className="text-orange-400" />
                    {post.participantsLabel}: {post.participantsCount}
                  </span>
                  {relativeDate && (
                    <span className="flex items-center gap-2">
                      <Clock size={16} className="text-orange-400" />
                      {relativeDate}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-dark-800 text-xs text-gray-300 border border-dark-700"
                    >
                      <Tag size={14} className="text-orange-400" />
                      {tag}
                    </span>
                  ))}
                </div>
                {(post.reward || post.highlight) && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-orange-300">
                    <div className="flex items-center gap-2">
                      <Gift size={18} />
                      <span>{post.reward}</span>
                    </div>
                    {post.highlight && <span className="text-xs uppercase tracking-wide">{post.highlight}</span>}
                  </div>
                )}
                {(postFeedback || isChallenge || isEvent) && (
                  <div
                    className={`flex items-center gap-2 text-sm ${
                      postFeedback?.tone === 'success'
                        ? 'text-emerald-400'
                        : postFeedback?.tone === 'error'
                        ? 'text-rose-400'
                        : 'text-gray-400'
                    }`}
                  >
                    {postFeedback?.tone === 'success' ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                    <span>
                      {postFeedback?.message ||
                        (isChallenge ? 'Tu es inscrit sur ce défi.' : 'Participation confirmée.')}
                    </span>
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {filteredPosts.length === 0 && (
          <div className="bg-dark-900/60 border border-dark-700 rounded-3xl p-12 text-center space-y-3">
            <Filter size={32} className="mx-auto text-gray-600" />
            <h3 className="text-lg font-semibold text-white">Aucun résultat pour ces filtres</h3>
            <p className="text-sm text-gray-400">
              Ajuste ta recherche ou réinitialise les filtres pour découvrir d’autres programmes sponsors.
            </p>
          </div>
        )}
      </section>

      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
          <div className="absolute inset-0 bg-black/70" onClick={handleCloseModal} />
          <div className="relative w-full max-w-4xl bg-dark-900 border border-dark-700 rounded-3xl shadow-2xl overflow-hidden">
            <button
              type="button"
              onClick={handleCloseModal}
              className="absolute top-4 right-4 z-10 p-2 bg-dark-800/80 hover:bg-dark-700 rounded-full text-gray-300"
            >
              <X size={18} />
            </button>

            <div className="relative h-56">
              <img
                src={selectedPost.coverImage}
                alt={selectedPost.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/40 to-transparent" />
              <div className="absolute bottom-4 left-6 right-6 space-y-2">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 text-xs uppercase tracking-wide">
                  {selectedPost.sponsor}
                </span>
                <h2 className="text-2xl font-semibold text-white">{selectedPost.title}</h2>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
                  <span className="flex items-center gap-2">
                    <Calendar size={16} className="text-orange-400" />
                    {selectedPost.dateLabel}
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin size={16} className="text-orange-400" />
                    {selectedPost.location}
                  </span>
                  <span className="flex items-center gap-2">
                    <Users size={16} className="text-orange-400" />
                    {selectedPost.participantsLabel}: {selectedPost.participantsCount}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex flex-wrap gap-2">
                {selectedPost.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-dark-800 text-xs text-gray-300 border border-dark-700"
                  >
                    <Tag size={14} className="text-orange-400" />
                    {tag}
                  </span>
                ))}
              </div>

              {(selectedPost.reward || selectedPost.highlight) && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-orange-300">
                  <div className="flex items-center gap-2">
                    <Gift size={18} />
                    <span>{selectedPost.reward}</span>
                  </div>
                  {selectedPost.highlight && (
                    <span className="text-xs uppercase tracking-wide">{selectedPost.highlight}</span>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-300 leading-relaxed max-w-3xl">
                  {selectedPost.description}
                </div>
                {selectedPost.type === 'challenge' && selectedPost.challenge && (
                  <button
                    type="button"
                    onClick={() => handleJoinChallenge(selectedPost.challenge!)}
                    disabled={joinedChallengeSet.has(selectedPost.id) || joiningChallengeId === selectedPost.id}
                    className={`px-5 py-3 rounded-full text-sm font-semibold transition-colors border ${
                      joinedChallengeSet.has(selectedPost.id)
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                        : 'bg-orange-500 text-white border-orange-500 hover:bg-orange-400'
                    }`}
                  >
                    {joinedChallengeSet.has(selectedPost.id)
                      ? 'Déjà inscrit'
                      : joiningChallengeId === selectedPost.id
                      ? 'Inscription...'
                      : 'Je participe au défi'}
                  </button>
                )}
                {selectedPost.type === 'event' && selectedPost.event && (
                  <button
                    type="button"
                    onClick={() => handleJoinEvent(selectedPost.event!.id)}
                    disabled={registeredEventSet.has(selectedPost.id) || joiningEventId === selectedPost.id}
                    className={`px-5 py-3 rounded-full text-sm font-semibold transition-colors border ${
                      registeredEventSet.has(selectedPost.id)
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                        : 'bg-orange-500 text-white border-orange-500 hover:bg-orange-400'
                    }`}
                  >
                    {registeredEventSet.has(selectedPost.id)
                      ? 'Place réservée'
                      : joiningEventId === selectedPost.id
                      ? 'Réservation...'
                      : 'Je réserve ma place'}
                  </button>
                )}
                {selectedPost.type !== 'challenge' && selectedPost.type !== 'event' && (
                  <a
                    href="#participer"
                    onClick={(event) => {
                      event.preventDefault();
                      setActiveTab('participer');
                    }}
                    className="px-5 py-3 rounded-full text-sm font-semibold border border-orange-400 text-orange-300 hover:bg-orange-500/10"
                  >
                    {selectedPost.actionLabel}
                  </a>
                )}
              </div>

              {modalFeedback && (
                <div
                  className={`flex items-center gap-2 text-sm ${
                    modalFeedback.tone === 'success'
                      ? 'text-emerald-400'
                      : modalFeedback.tone === 'error'
                      ? 'text-rose-400'
                      : 'text-gray-300'
                  }`}
                >
                  {modalFeedback.tone === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{modalFeedback.message}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-b border-dark-700 pb-2">
                {[
                  { id: 'details' as const, label: 'Détails' },
                  { id: 'participations' as const, label: 'Participations' },
                  { id: 'participer' as const, label: 'Participer' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-orange-500 text-white'
                        : 'bg-dark-800 text-gray-300 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'details' && (
                <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
                  <p>
                    {selectedPost.type === 'challenge'
                      ? 'Publie ta meilleure ligne, renseigne les spots utilisés et partage ta vision créative. Les jurys sponsor analyseront style, prise de risque et storytelling.'
                      : selectedPost.type === 'event'
                      ? "Profite d'une immersion privilégiée avec la team sponsor. Places limitées : présente ton profil et ta motivation pour valider ta participation."
                      : selectedPost.description}
                  </p>
                  <p className="text-gray-400">
                    Besoin d’aide ? Contacte la team partenariat pour un accompagnement sur ton dossier.
                  </p>
                </div>
              )}

              {activeTab === 'participations' && (
                <div className="space-y-4" id="participations">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-gray-300">
                      {sortedParticipations.length} média(s) partagé(s)
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400">Trier par</span>
                      <button
                        type="button"
                        onClick={() => setParticipationSort('votes')}
                        className={`px-3 py-1 rounded-full border ${
                          participationSort === 'votes'
                            ? 'bg-orange-500 text-white border-orange-400'
                            : 'bg-dark-800 text-gray-300 border-dark-700'
                        }`}
                      >
                        Votes
                      </button>
                      <button
                        type="button"
                        onClick={() => setParticipationSort('recent')}
                        className={`px-3 py-1 rounded-full border ${
                          participationSort === 'recent'
                            ? 'bg-orange-500 text-white border-orange-400'
                            : 'bg-dark-800 text-gray-300 border-dark-700'
                        }`}
                      >
                        Plus récents
                      </button>
                    </div>
                  </div>

                  {sortedParticipations.length === 0 ? (
                    <div className="bg-dark-800 border border-dark-700 rounded-2xl p-8 text-center text-gray-400 text-sm">
                      Aucune participation pour le moment. Sois le premier à poster ton média !
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {sortedParticipations.map((media) => (
                        <article
                          key={media.id}
                          className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden"
                        >
                          <div className="relative h-48">
                            <img
                              src={media.thumbnail}
                              alt={media.caption}
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                            <div className="absolute top-3 left-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 text-white text-xs uppercase">
                              {media.mediaType === 'video' ? (
                                <Video size={14} className="text-orange-400" />
                              ) : (
                                <Camera size={14} className="text-orange-400" />
                              )}
                              <span>{media.mediaType === 'video' ? 'Vidéo' : 'Photo'}</span>
                            </div>
                          </div>
                          <div className="p-4 space-y-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={media.avatar}
                                alt={media.author}
                                className="h-10 w-10 rounded-full border border-dark-600"
                              />
                              <div>
                                <p className="text-sm font-semibold text-white">{media.author}</p>
                                <p className="text-xs text-gray-400">
                                  Publié le {new Date(media.submittedAt).toLocaleDateString('fr-FR')}
                                </p>
                              </div>
                            </div>
                            <p className="text-sm text-gray-300 leading-relaxed">{media.caption}</p>
                            <button
                              type="button"
                              onClick={() => handleVote(selectedPost.id, media.id)}
                              className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                                votedMedias.has(`${selectedPost.id}-${media.id}`)
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                                  : 'bg-dark-900 text-gray-200 border-dark-700 hover:border-orange-400'
                              }`}
                            >
                              <ThumbsUp size={16} />
                              {media.votes} vote(s)
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'participer' && (
                <div className="space-y-6" id="participer">
                  {selectedPost.type === 'challenge' ? (
                    <form className="space-y-4" onSubmit={handleSubmitParticipation}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="space-y-2 text-sm text-gray-300">
                          <span className="font-semibold text-white">Titre de la vidéo</span>
                          <input
                            type="text"
                            value={submissionTitle}
                            onChange={(event) => setSubmissionTitle(event.target.value)}
                            placeholder="Ex: Mon meilleur kickflip"
                            className="w-full px-4 py-2 rounded-xl bg-dark-800 border border-dark-700 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </label>
                        <label className="space-y-2 text-sm text-gray-300">
                          <span className="font-semibold text-white">Description</span>
                          <input
                            type="text"
                            value={submissionDescription}
                            onChange={(event) => setSubmissionDescription(event.target.value)}
                            placeholder="Décris ton trick et le spot..."
                            className="w-full px-4 py-2 rounded-xl bg-dark-800 border border-dark-700 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </label>
                      </div>
                      <div className="space-y-2">
                        <span className="font-semibold text-sm text-white">Vidéo ou photo</span>
                        <label className="group flex flex-col items-center justify-center gap-3 border-2 border-dashed border-dark-700 rounded-2xl py-10 cursor-pointer hover:border-orange-400">
                          <UploadCloud className="text-orange-400" size={36} />
                          <div className="text-center text-sm text-gray-400">
                            Glisse ton média ici ou clique pour sélectionner
                          </div>
                          <div className="text-xs text-gray-500">MP4, MOV, JPG jusqu’à 100MB</div>
                          <input
                            type="file"
                            accept="video/*,image/*"
                            className="hidden"
                            onChange={handleSubmissionFileChange}
                          />
                        </label>
                        {submissionFile && (
                          <div className="text-xs text-gray-400">
                            Fichier sélectionné : <span className="text-orange-300">{submissionFile.name}</span>
                          </div>
                        )}
                      </div>
                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-orange-500 text-white font-semibold hover:bg-orange-400"
                      >
                        <UploadCloud size={18} />
                        Soumettre ma participation
                      </button>
                    </form>
                  ) : (
                    <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6 space-y-4 text-sm text-gray-300">
                      <p>
                        {selectedPost.type === 'event'
                          ? 'Valide ta présence et reçois toutes les infos pratiques par mail. Les partenaires te contacteront pour confirmer ton créneau.'
                          : 'Prépare un dossier complet (vision, budget, planning) et dépose-le directement. Notre équipe reviendra vers toi pour un coaching personnalisé.'}
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedPost.type === 'event' && selectedPost.event) {
                              handleJoinEvent(selectedPost.event.id);
                            } else if (selectedPost.type === 'call') {
                              setModalFeedback({
                                message: 'Espace de dépôt bientôt disponible, contacte partnerships@shredloc.com.',
                                tone: 'info',
                              });
                            } else {
                              setModalFeedback({
                                message: 'Contacte la marque pour finaliser ta candidature.',
                                tone: 'info',
                              });
                            }
                          }}
                          className="px-5 py-3 rounded-full bg-orange-500 text-white font-semibold hover:bg-orange-400"
                        >
                          {selectedPost.type === 'event'
                            ? 'Confirmer ma présence'
                            : selectedPost.type === 'call'
                            ? 'Déposer un dossier'
                            : 'Contacter le sponsor'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('participations')}
                          className="px-5 py-3 rounded-full border border-dark-700 text-gray-300 hover:border-orange-400"
                        >
                          Voir les participations
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
