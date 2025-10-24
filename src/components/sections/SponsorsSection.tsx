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
  Loader2,
  MapPin,
  PenSquare,
  Plus,
  Search,
  Sparkles,
  Star,
  Tag,
  ThumbsUp,
  Trash2,
  UploadCloud,
  Users,
  Video,
  X,
} from 'lucide-react';
import type {
  Profile,
  SponsorCallOpportunity,
  SponsorChallengeOpportunity,
  SponsorEditableOpportunityType,
  SponsorEventOpportunity,
  SponsorNewsItem,
} from '../../types';
import {
  getStoredChallengeRegistrations,
  getStoredEventRegistrations,
  registerForChallenge,
  registerForEvent,
} from '../../lib/engagement';
import {
  deleteSponsorCall,
  deleteSponsorChallenge,
  deleteSponsorEvent,
  fetchSponsorCalls,
  fetchSponsorChallenges,
  fetchSponsorEvents,
  fetchSponsorNews,
} from '../../lib/sponsorOpportunities';
import SponsorPostForm from '../sponsors/SponsorPostForm';

interface SponsorsSectionProps {
  profile: Profile | null;
}

type PostType = 'challenge' | 'event' | 'call' | 'news';

type FeedbackTone = 'success' | 'info' | 'error';

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
  sponsorId: string;
  location: string;
  dateLabel: string;
  dateValue: Date | null;
  reward?: string;
  highlight?: string;
  coverImage: string;
  tags: string[];
  participantsLabel: string;
  participantsCount: number;
  actionLabel: string;
  editable: boolean;
  challenge?: SponsorChallengeOpportunity;
  event?: SponsorEventOpportunity;
  call?: SponsorCallOpportunity;
  news?: SponsorNewsItem;
}

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

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1519861399405-52a9b56bd58c?auto=format&fit=crop&w=1200&q=80';

const getSponsorDisplayName = (
  sponsor: SponsorChallengeOpportunity['sponsor'] | SponsorEventOpportunity['sponsor'] | null | undefined,
): string => {
  if (!sponsor) {
    return 'Sponsor partenaire';
  }

  return (
    sponsor.sponsor_branding?.brand_name ?? sponsor.display_name ?? sponsor.username ?? 'Sponsor partenaire'
  );
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
  const [participations, setParticipations] = useState<Record<string, ParticipationMedia[]>>({});
  const [challenges, setChallenges] = useState<SponsorChallengeOpportunity[]>([]);
  const [events, setEvents] = useState<SponsorEventOpportunity[]>([]);
  const [calls, setCalls] = useState<SponsorCallOpportunity[]>([]);
  const [news, setNews] = useState<SponsorNewsItem[]>([]);
  const [loadingOpportunities, setLoadingOpportunities] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formState, setFormState] = useState<
    | { mode: 'create'; type: SponsorEditableOpportunityType }
    | { mode: 'edit'; type: 'challenge'; record: SponsorChallengeOpportunity }
    | { mode: 'edit'; type: 'event'; record: SponsorEventOpportunity }
    | { mode: 'edit'; type: 'call'; record: SponsorCallOpportunity }
    | null
  >(null);
  const [votedMedias, setVotedMedias] = useState<Set<string>>(new Set());
  const [modalFeedback, setModalFeedback] = useState<{ message: string; tone: FeedbackTone } | null>(null);
  const [submissionTitle, setSubmissionTitle] = useState('');
  const [submissionDescription, setSubmissionDescription] = useState('');
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submissionPreview, setSubmissionPreview] = useState<string | null>(null);
  const isSponsor = profile?.role === 'sponsor';

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

  const loadOpportunities = useCallback(async () => {
    setLoadingOpportunities(true);
    setLoadError(null);

    try {
      const [challengeData, eventData, callData, newsData] = await Promise.all([
        fetchSponsorChallenges(),
        fetchSponsorEvents(),
        fetchSponsorCalls(),
        fetchSponsorNews(),
      ]);

      setChallenges(challengeData);
      setEvents(eventData);
      setCalls(callData);
      setNews(newsData);
    } catch (cause) {
      console.error('Unable to load sponsor opportunities', cause);
      setLoadError('Impossible de charger les opportunités sponsor pour le moment.');
    } finally {
      setLoadingOpportunities(false);
    }
  }, []);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  const joinedChallengeSet = useMemo(() => new Set(joinedChallenges), [joinedChallenges]);
  const registeredEventSet = useMemo(() => new Set(registeredEvents), [registeredEvents]);

  const handleOpportunitySaved = useCallback(
    (
      type: SponsorEditableOpportunityType,
      record: SponsorChallengeOpportunity | SponsorEventOpportunity | SponsorCallOpportunity,
    ) => {
      if (type === 'challenge') {
        const challengeRecord = record as SponsorChallengeOpportunity;
        setChallenges((current) => {
          const exists = current.some((item) => item.id === challengeRecord.id);
          return exists
            ? current.map((item) => (item.id === challengeRecord.id ? challengeRecord : item))
            : [challengeRecord, ...current];
        });
      } else if (type === 'event') {
        const eventRecord = record as SponsorEventOpportunity;
        setEvents((current) => {
          const exists = current.some((item) => item.id === eventRecord.id);
          return exists
            ? current.map((item) => (item.id === eventRecord.id ? eventRecord : item))
            : [eventRecord, ...current];
        });
      } else {
        const callRecord = record as SponsorCallOpportunity;
        setCalls((current) => {
          const exists = current.some((item) => item.id === callRecord.id);
          return exists
            ? current.map((item) => (item.id === callRecord.id ? callRecord : item))
            : [callRecord, ...current];
        });
      }

      setLoadError(null);
      setFormState(null);
    },
    [],
  );

  const handleOpportunityDeleted = useCallback(
    async (type: SponsorEditableOpportunityType, id: string) => {
      try {
        if (type === 'challenge') {
          await deleteSponsorChallenge(id);
          setChallenges((current) => current.filter((item) => item.id !== id));
        } else if (type === 'event') {
          await deleteSponsorEvent(id);
          setEvents((current) => current.filter((item) => item.id !== id));
        } else {
          await deleteSponsorCall(id);
          setCalls((current) => current.filter((item) => item.id !== id));
        }

        setLoadError(null);
        setFormState(null);
      } catch (cause) {
        console.error('Unable to delete sponsor opportunity', cause);
        setLoadError('Impossible de supprimer cette opportunité. Réessaie plus tard.');
        throw cause;
      }
    },
    [],
  );

  const posts = useMemo(() => {
    const challengePosts: SponsorFeedPost[] = challenges.map((challenge) => {
      const endDate = challenge.end_date ? new Date(challenge.end_date) : null;
      const challengeTags = Array.isArray(challenge.tags) ? challenge.tags : [];
      return {
        id: challenge.id,
        type: 'challenge',
        title: challenge.title,
        excerpt: challenge.description,
        description: challenge.description,
        sponsor: getSponsorDisplayName(challenge.sponsor),
        sponsorId: challenge.sponsor_id,
        location: challenge.location ?? 'Lieu à définir',
        dateLabel: challenge.end_date
          ? `Clôture ${new Date(challenge.end_date).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
            })}`
          : 'Défi en cours',
        dateValue: endDate,
        reward: challenge.prize ?? undefined,
        highlight: challenge.value ?? undefined,
        coverImage: challenge.cover_image_url ?? FALLBACK_COVER,
        tags: challengeTags,
        participantsLabel: challenge.participants_label || 'Crews inscrites',
        participantsCount: challenge.participants_count + (joinedChallengeSet.has(challenge.id) ? 1 : 0),
        actionLabel: joinedChallengeSet.has(challenge.id)
          ? 'Déjà inscrit'
          : challenge.action_label || 'Voir le défi',
        editable: true,
        challenge,
      };
    });

    const eventPosts: SponsorFeedPost[] = events.map((event) => {
      const eventDate = event.event_date ? new Date(event.event_date) : null;
      const dateLabel = event.event_date
        ? `${new Date(event.event_date).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
          })}${event.event_time ? ` · ${event.event_time}` : ''}`
        : 'Date à confirmer';
      const eventTags = Array.isArray(event.tags) ? event.tags : [];

      return {
        id: event.id,
        type: 'event',
        title: event.title,
        excerpt: event.description,
        description: event.description,
        sponsor: getSponsorDisplayName(event.sponsor),
        sponsorId: event.sponsor_id,
        location: event.location ?? 'Lieu à définir',
        dateLabel,
        dateValue: eventDate,
        reward: undefined,
        highlight: event.event_type ?? undefined,
        coverImage: event.cover_image_url ?? FALLBACK_COVER,
        tags: [...eventTags, 'Sponsor', 'Networking'].filter(Boolean) as string[],
        participantsLabel: 'Participants',
        participantsCount: event.attendees + (registeredEventSet.has(event.id) ? 1 : 0),
        actionLabel: registeredEventSet.has(event.id)
          ? 'Place réservée'
          : event.action_label || 'Réserver',
        editable: true,
        event,
      };
    });

    const callPosts: SponsorFeedPost[] = calls.map((call) => {
      const deadline = call.deadline ? new Date(call.deadline) : null;
      const callTags = Array.isArray(call.tags) ? call.tags : [];
      return {
        id: call.id,
        type: 'call',
        title: call.title,
        excerpt: call.summary,
        description: call.description,
        sponsor: getSponsorDisplayName(call.sponsor),
        sponsorId: call.sponsor_id,
        location: call.location ?? 'En ligne',
        dateLabel: call.deadline
          ? `Clôture ${new Date(call.deadline).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
            })}`
          : 'Dossier en continu',
        dateValue: deadline,
        reward: call.reward ?? undefined,
        highlight: call.highlight ?? undefined,
        coverImage: call.cover_image_url ?? FALLBACK_COVER,
        tags: callTags,
        participantsLabel: call.participants_label || 'Candidatures',
        participantsCount: call.participants_count ?? 0,
        actionLabel: call.action_label,
        editable: true,
        call,
      };
    });

    const newsPosts: SponsorFeedPost[] = news.map((item) => {
      const published = item.published_at ? new Date(item.published_at) : null;
      const newsTags = Array.isArray(item.tags) ? item.tags : [];
      return {
        id: item.id,
        type: 'news',
        title: item.title,
        excerpt: item.summary,
        description: item.body,
        sponsor: getSponsorDisplayName(item.sponsor),
        sponsorId: item.sponsor_id,
        location: item.location ?? 'Annonce',
        dateLabel: item.published_at
          ? `Publié le ${new Date(item.published_at).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
            })}`
          : 'Annonce sponsor',
        dateValue: published,
        reward: undefined,
        highlight: item.highlight ?? undefined,
        coverImage: item.cover_image_url ?? FALLBACK_COVER,
        tags: newsTags,
        participantsLabel: item.participants_label || 'Lecteurs',
        participantsCount: item.participants_count ?? 0,
        actionLabel: item.action_label,
        editable: false,
        news: item,
      };
    });

    return [...challengePosts, ...eventPosts, ...callPosts, ...newsPosts].sort((a, b) => {
      const aTime = a.dateValue ? a.dateValue.getTime() : 0;
      const bTime = b.dateValue ? b.dateValue.getTime() : 0;
      return aTime - bTime;
    });
  }, [calls, challenges, events, joinedChallengeSet, news, registeredEventSet]);

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
    async (challenge: SponsorChallengeOpportunity) => {
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
      const result = await registerForChallenge(profile.id, challenge.id, { sponsor: true });
      setJoiningChallengeId(null);

      if (result.success) {
        setJoinedChallenges((prev) => [...prev, challenge.id]);
        setChallenges((prev) =>
          prev.map((item) =>
            item.id === challenge.id
              ? { ...item, participants_count: item.participants_count + 1 }
              : item,
          ),
        );
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
    async (event: SponsorEventOpportunity) => {
      if (!profile?.id) {
        setFeedback((prev) => ({
          ...prev,
          [event.id]: {
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

      if (registeredEventSet.has(event.id)) {
        setFeedback((prev) => ({
          ...prev,
          [event.id]: {
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

      setJoiningEventId(event.id);
      const result = await registerForEvent(profile.id, event.id, { sponsor: true });
      setJoiningEventId(null);

      if (result.success) {
        setRegisteredEvents((prev) => [...prev, event.id]);
        setEvents((prev) =>
          prev.map((item) =>
            item.id === event.id ? { ...item, attendees: item.attendees + 1 } : item,
          ),
        );
      }

      setFeedback((prev) => ({
        ...prev,
        [event.id]: {
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
        {isSponsor && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setFormState({ mode: 'create', type: 'challenge' })}
              className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-400"
            >
              <Plus size={16} /> Publier une opportunité
            </button>
            <span className="text-xs text-gray-400">
              Crée un défi, un événement ou un appel à projet sponsorisé.
            </span>
          </div>
        )}
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
            {loadingOpportunities ? <Loader2 size={18} className="animate-spin" /> : <Filter size={18} />}
            <span>
              {loadingOpportunities
                ? 'Chargement des opportunités...'
                : `${filteredPosts.length} opportunités disponibles`}
            </span>
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

      {loadError && (
        <div className="bg-rose-500/10 border border-rose-500/40 rounded-2xl p-4 text-sm text-rose-200">
          {loadError}
        </div>
      )}

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
                {isSponsor && post.editable && profile?.id === post.sponsorId && (
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (post.type === 'challenge' && post.challenge) {
                          setFormState({ mode: 'edit', type: 'challenge', record: post.challenge });
                        } else if (post.type === 'event' && post.event) {
                          setFormState({ mode: 'edit', type: 'event', record: post.event });
                        } else if (post.type === 'call' && post.call) {
                          setFormState({ mode: 'edit', type: 'call', record: post.call });
                        }
                      }}
                      className="inline-flex items-center justify-center rounded-full bg-black/50 p-2 text-gray-200 hover:bg-black/70"
                      aria-label="Modifier l'opportunité"
                    >
                      <PenSquare size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={async (event) => {
                        event.stopPropagation();
                        if (!confirm('Supprimer cette opportunité sponsor ?')) {
                          return;
                        }

                        try {
                          await handleOpportunityDeleted(post.type as SponsorEditableOpportunityType, post.id);
                        } catch {
                          /* already handled */
                        }
                      }}
                      className="inline-flex items-center justify-center rounded-full bg-black/50 p-2 text-gray-200 hover:bg-black/70"
                      aria-label="Supprimer l'opportunité"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
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

      {formState && profile?.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
          <div className="absolute inset-0 bg-black/70" onClick={() => setFormState(null)} />
          <div className="relative w-full max-w-3xl rounded-3xl border border-dark-700 bg-dark-900 shadow-2xl">
            <button
              type="button"
              onClick={() => setFormState(null)}
              className="absolute top-4 right-4 z-10 rounded-full bg-dark-800/80 p-2 text-gray-300 hover:bg-dark-700"
            >
              <X size={18} />
            </button>
            <div className="p-6 sm:p-8">
              <SponsorPostForm
                sponsorId={profile.id}
                mode={formState.mode}
                initial={
                  formState.mode === 'edit'
                    ? { type: formState.type, data: formState.record }
                    : undefined
                }
                onCancel={() => setFormState(null)}
                onSaved={handleOpportunitySaved}
                onDeleted={handleOpportunityDeleted}
              />
            </div>
          </div>
        </div>
      )}

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
                    onClick={() => handleJoinEvent(selectedPost.event!)}
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
                              handleJoinEvent(selectedPost.event);
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
