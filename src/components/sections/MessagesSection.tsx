import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Phone,
  Video,
  Info,
  MoreVertical,
  Smile,
  Paperclip,
  Image,
  Send,
  Mic,
  ChevronDown,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import type { Profile } from '../../types';

interface Participant {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  location: string;
  lastActive: string;
}

interface ConversationMessage {
  id: string;
  sender: 'me' | 'other';
  content: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'seen';
}

interface ConversationPreview {
  id: string;
  participant: Participant;
  lastMessagePreview: string;
  lastMessageTime: string;
  unreadCount: number;
  mood?: string;
  messages: ConversationMessage[];
}

interface MessagesSectionProps {
  profile: Profile | null;
}

const initialConversations: ConversationPreview[] = [
  {
    id: 'lea-dupont',
    participant: {
      id: '1',
      name: 'Léa Dupont',
      avatar: 'https://i.pravatar.cc/150?img=32',
      isOnline: true,
      location: 'Paris, République',
      lastActive: 'En ligne',
    },
    lastMessagePreview: 'Trop hâte pour ce soir ! On y va avec Jules et Chloé.',
    lastMessageTime: '2 min',
    unreadCount: 2,
    mood: '🔥 Session street',
    messages: [
      {
        id: '1',
        sender: 'other',
        content:
          'Yo ! On se retrouve toujours à République ? La session commence à 20h, on veut être là un peu avant pour s’échauffer.',
        timestamp: '20:41',
        status: 'seen',
      },
      {
        id: '2',
        sender: 'me',
        content: "Carrément ! J’amène ma caméra, on peut filmer quelques lines.",
        timestamp: '20:42',
        status: 'seen',
      },
      {
        id: '3',
        sender: 'other',
        content: 'Trop bien ! Jules a dit qu’il tenterait un nosegrind sur le ledge.',
        timestamp: '20:43',
        status: 'seen',
      },
      {
        id: '4',
        sender: 'other',
        content: 'Tu viens avec ton rail portable ? Ça pourrait servir.',
        timestamp: '20:44',
        status: 'seen',
      },
      {
        id: '5',
        sender: 'me',
        content: 'Je le charge dans le van. À toute !',
        timestamp: '20:45',
        status: 'sent',
      },
    ],
  },
  {
    id: 'arnaud-ribeiro',
    participant: {
      id: '2',
      name: 'Arnaud Ribeiro',
      avatar: 'https://i.pravatar.cc/150?img=14',
      isOnline: false,
      location: 'Bordeaux',
      lastActive: 'Actif il y a 1 h',
    },
    lastMessagePreview: 'On cale la vidéo pour la team ? On peut monter ça dimanche.',
    lastMessageTime: '1 h',
    unreadCount: 0,
    mood: '🎬 Montage en cours',
    messages: [
      {
        id: '1',
        sender: 'me',
        content: "Les rushs sont trop lourds ! Je t’envoie le dossier ce soir.",
        timestamp: '18:12',
        status: 'seen',
      },
      {
        id: '2',
        sender: 'other',
        content: 'Parfait, je prépare déjà une tracklist chill pour le montage.',
        timestamp: '18:20',
        status: 'seen',
      },
    ],
  },
  {
    id: 'sarah-levy',
    participant: {
      id: '3',
      name: 'Sarah Lévy',
      avatar: 'https://i.pravatar.cc/150?img=47',
      isOnline: true,
      location: 'Lyon',
      lastActive: 'En ligne',
    },
    lastMessagePreview: 'On organise un ride dimanche ? Je peux ramener des pads pour tout le monde.',
    lastMessageTime: '4 h',
    unreadCount: 3,
    messages: [
      {
        id: '1',
        sender: 'other',
        content: 'On organise un ride dimanche ? Je peux ramener des pads pour tout le monde.',
        timestamp: '14:05',
        status: 'seen',
      },
      {
        id: '2',
        sender: 'other',
        content: 'On pourrait faire un mini contest friendly, ça motive toujours.',
        timestamp: '14:08',
        status: 'seen',
      },
    ],
  },
  {
    id: 'crew-chat',
    participant: {
      id: 'crew',
      name: 'Shredloc Crew',
      avatar: '/logo.png',
      isOnline: false,
      location: 'Chat de groupe',
      lastActive: 'Actif il y a 5 h',
    },
    lastMessagePreview: 'Le contest local est confirmé, on a des places VIP !',
    lastMessageTime: '5 h',
    unreadCount: 0,
    mood: '🏆 Contest local',
    messages: [
      {
        id: '1',
        sender: 'other',
        content: "Le contest local est confirmé, on a des places VIP si vous êtes chauds !",
        timestamp: '13:01',
        status: 'delivered',
      },
      {
        id: '2',
        sender: 'me',
        content: 'Yes ! On prépare une bannière Shredloc ?',
        timestamp: '13:05',
        status: 'sent',
      },
    ],
  },
  {
    id: 'coach',
    participant: {
      id: '4',
      name: 'Coach Camille',
      avatar: 'https://i.pravatar.cc/150?img=56',
      isOnline: false,
      location: 'Marseille',
      lastActive: 'Actif il y a 1 j',
    },
    lastMessagePreview: 'Super progression sur tes flips, on valide la routine pour le mois prochain.',
    lastMessageTime: '1 j',
    unreadCount: 0,
    messages: [
      {
        id: '1',
        sender: 'other',
        content: 'Super progression sur tes flips, on valide la routine pour le mois prochain.',
        timestamp: 'Hier',
        status: 'seen',
      },
      {
        id: '2',
        sender: 'me',
        content: 'Merci ! Je filme la série complète pour te l’envoyer.',
        timestamp: 'Hier',
        status: 'seen',
      },
    ],
  },
];

export default function MessagesSection({ profile }: MessagesSectionProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState(initialConversations[0]?.id ?? '');
  const [searchTerm, setSearchTerm] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [isMobileView, setIsMobileView] = useState(false);
  const [isMobileConversationOpen, setMobileConversationOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsMobileView(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isMobileView) {
      setMobileConversationOpen(false);
    }
  }, [isMobileView]);

  const filteredConversations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((conversation) => {
      const { name } = conversation.participant;
      return (
        name.toLowerCase().includes(term) ||
        conversation.lastMessagePreview.toLowerCase().includes(term)
      );
    });
  }, [conversations, searchTerm]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId),
    [conversations, selectedId],
  );
  const messagesLength = selectedConversation?.messages.length ?? 0;

  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messagesLength, selectedConversation?.id]);

  const handleSelectConversation = (conversationId: string) => {
    setSelectedId(conversationId);
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation,
      ),
    );

    if (isMobileView) {
      setMobileConversationOpen(true);
    }
  };

  const handleSendMessage = () => {
    const trimmed = messageDraft.trim();
    if (!trimmed || !selectedConversation) return;

    const newMessage: ConversationMessage = {
      id: `${Date.now()}`,
      sender: 'me',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: 'sent',
    };

    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === selectedConversation.id
          ? {
              ...conversation,
              lastMessagePreview: trimmed,
              lastMessageTime: 'À l’instant',
              unreadCount: 0,
              messages: [...conversation.messages, newMessage],
            }
          : conversation,
      ),
    );

    setMessageDraft('');
  };

  return (
    <section className="px-4 py-6 md:px-6 md:py-10">
      <div className="max-w-7xl mx-auto">
        <div className="bg-dark-800/80 border border-dark-700 rounded-3xl shadow-xl overflow-hidden backdrop-blur">
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_280px] h-[calc(100vh-180px)] min-h-[620px]">
            <aside
              className={`${
                isMobileView && isMobileConversationOpen ? 'hidden' : 'flex'
              } border-b border-dark-700 lg:border-b-0 lg:border-r bg-dark-900/60 flex-col lg:flex min-h-0`}
            >
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-semibold text-white">Messagerie</h1>
                    <p className="text-sm text-gray-400">
                      {profile?.display_name || profile?.username || 'Toi'} · Conversations privées
                    </p>
                  </div>
                  <button className="p-2 bg-orange-500/10 border border-orange-500/30 rounded-full text-orange-400 hover:bg-orange-500/20 transition-colors">
                    <Sparkles size={18} />
                  </button>
                </div>
                <div className="mt-4 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Rechercher dans les messages"
                    className="w-full pl-10 pr-4 py-2.5 bg-dark-700/60 border border-dark-600 text-sm text-white rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-transparent placeholder:text-gray-500"
                  />
                </div>
                <div className="flex gap-2 mt-4">
                  <button className="px-3 py-1.5 text-xs font-medium rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40">
                    Tous
                  </button>
                  <button className="px-3 py-1.5 text-xs font-medium rounded-full bg-dark-700/70 text-gray-300 border border-dark-600">
                    Non lus
                  </button>
                  <button className="px-3 py-1.5 text-xs font-medium rounded-full bg-dark-700/70 text-gray-300 border border-dark-600">
                    Groupes
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0">
                {filteredConversations.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">Aucun résultat pour « {searchTerm} »</div>
                ) : (
                  <ul className="divide-y divide-dark-700/60">
                    {filteredConversations.map((conversation) => {
                      const isActive = conversation.id === selectedConversation?.id;
                      return (
                        <li key={conversation.id}>
                          <button
                            onClick={() => handleSelectConversation(conversation.id)}
                            className={`w-full px-5 py-4 flex items-start gap-3 transition-colors text-left ${
                              isActive ? 'bg-dark-700/60' : 'hover:bg-dark-800/60'
                            }`}
                          >
                            <div className="relative">
                              <img
                                src={conversation.participant.avatar}
                                alt={conversation.participant.name}
                                className="w-12 h-12 rounded-full object-cover border border-dark-600"
                              />
                              {conversation.participant.isOnline && (
                                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-dark-800 rounded-full" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-white truncate">
                                  {conversation.participant.name}
                                </p>
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                  {conversation.lastMessageTime}
                                </span>
                              </div>
                              <p className="text-sm text-gray-400 mt-1 truncate">
                                {conversation.lastMessagePreview}
                              </p>
                              {conversation.mood && (
                                <p className="text-xs text-orange-300/80 mt-2">{conversation.mood}</p>
                              )}
                            </div>
                            {conversation.unreadCount > 0 && (
                              <span className="ml-2 inline-flex items-center justify-center min-w-[26px] h-[26px] text-xs font-semibold rounded-full bg-orange-500 text-white">
                                {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>

            <div
              className={`${
                isMobileView && !isMobileConversationOpen ? 'hidden' : 'flex'
              } flex-col bg-dark-900/60 border-t border-dark-700 lg:border-t-0 lg:flex min-h-0`}
            >
              {selectedConversation ? (
                <>
                  <header className="px-4 sm:px-6 py-4 border-b border-dark-700 flex items-center justify-between gap-3 bg-dark-900/80">
                    <div className="flex items-center gap-3 min-w-0">
                      {isMobileView && (
                        <button
                          onClick={() => setMobileConversationOpen(false)}
                          className="lg:hidden shrink-0 p-2 rounded-full border border-dark-600 text-gray-300 hover:bg-dark-700 transition-colors"
                          aria-label="Revenir à la liste des conversations"
                        >
                          <ArrowLeft size={18} />
                        </button>
                      )}
                      <div className="relative">
                        <img
                          src={selectedConversation.participant.avatar}
                          alt={selectedConversation.participant.name}
                          className="w-12 h-12 rounded-full object-cover border border-dark-600"
                        />
                        {selectedConversation.participant.isOnline && (
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-dark-800 rounded-full" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-semibold text-white truncate">
                            {selectedConversation.participant.name}
                          </h2>
                          <ChevronDown size={16} className="text-gray-500" />
                        </div>
                        <p className="text-sm text-gray-400">
                          {selectedConversation.participant.lastActive}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 rounded-full border border-dark-600 text-gray-300 hover:bg-dark-700 transition-colors">
                        <Phone size={18} />
                      </button>
                      <button className="p-2 rounded-full border border-dark-600 text-gray-300 hover:bg-dark-700 transition-colors">
                        <Video size={18} />
                      </button>
                      <button className="p-2 rounded-full border border-dark-600 text-gray-300 hover:bg-dark-700 transition-colors">
                        <Info size={18} />
                      </button>
                      <button className="p-2 rounded-full border border-dark-600 text-gray-300 hover:bg-dark-700 transition-colors">
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </header>

                  <div
                    className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6"
                  >
                    <div className="text-center text-xs text-gray-500 uppercase tracking-wide">
                      Conversation depuis 3 jours
                    </div>
                    {selectedConversation.messages.map((message) => {
                      const isMe = message.sender === 'me';
                      return (
                        <div key={message.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-xl rounded-2xl px-4 py-3 text-sm shadow-lg border ${
                            isMe
                              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-400/40'
                              : 'bg-dark-800/80 text-gray-100 border-dark-700'
                          }`}>
                            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                            <div className={`mt-2 text-[11px] flex items-center gap-2 ${
                              isMe ? 'text-white/80' : 'text-gray-400'
                            }`}>
                              <span>{message.timestamp}</span>
                              {isMe && (
                                <span className="uppercase tracking-wide">
                                  {message.status === 'seen'
                                    ? 'Vu'
                                    : message.status === 'delivered'
                                      ? 'Reçu'
                                      : 'Envoyé'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  <footer className="border-t border-dark-700 p-4 sm:p-6 bg-dark-900/80">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <textarea
                            value={messageDraft}
                            onChange={(event) => setMessageDraft(event.target.value)}
                            placeholder="Écrire un message..."
                            rows={1}
                            className="w-full bg-dark-700/60 border border-dark-600 text-white text-sm rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/70 resize-none"
                          />
                        </div>
                        <button
                          onClick={handleSendMessage}
                          className="h-12 w-12 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30 hover:bg-orange-400 transition-colors"
                          aria-label="Envoyer le message"
                        >
                          <Send size={18} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 rounded-full border border-dark-600 text-gray-300 hover:bg-dark-700 transition-colors">
                          <Smile size={18} />
                        </button>
                        <button className="p-2 rounded-full border border-dark-600 text-gray-300 hover:bg-dark-700 transition-colors">
                          <Image size={18} />
                        </button>
                        <button className="p-2 rounded-full border border-dark-600 text-gray-300 hover:bg-dark-700 transition-colors">
                          <Mic size={18} />
                        </button>
                        <button className="p-2 rounded-full border border-dark-600 text-gray-300 hover:bg-dark-700 transition-colors">
                          <Paperclip size={18} />
                        </button>
                      </div>
                    </div>
                  </footer>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-10 text-gray-400">
                  <img
                    src="/illustrations/messages-empty.svg"
                    alt="Commencez une conversation"
                    className="w-40 h-40 mb-6 opacity-80"
                    onError={(event) => {
                      (event.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <h2 className="text-xl font-semibold text-white mb-2">Sélectionnez une conversation</h2>
                  <p className="max-w-md">
                    Retrouvez vos discussions privées, organisez vos sessions et partagez vos meilleures vidéos avec la
                    communauté Shredloc.
                  </p>
                </div>
              )}
            </div>

            <aside className="hidden xl:flex flex-col border-l border-dark-700 bg-dark-900/60">
              {selectedConversation ? (
                <div className="p-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Infos rapides</h3>
                    <div className="mt-4 space-y-3 text-sm text-gray-300">
                      <div className="flex justify-between">
                        <span>Spot favori</span>
                        <span className="font-medium text-white">{selectedConversation.participant.location}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Dernière activité</span>
                        <span className="font-medium text-white">
                          {selectedConversation.participant.lastActive}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Statut</span>
                        <span className="font-medium text-emerald-400">
                          {selectedConversation.participant.isOnline ? 'En ligne' : 'Hors ligne'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Documents partagés</h3>
                    <div className="mt-3 space-y-3 text-sm text-gray-300">
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-dark-700 bg-dark-800/70">
                        <Image size={18} className="text-orange-300" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">session-republique.mp4</p>
                          <p className="text-xs text-gray-400">Partagé hier · 128 Mo</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-dark-700 bg-dark-800/70">
                        <Paperclip size={18} className="text-orange-300" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">roadbook-weekend.pdf</p>
                          <p className="text-xs text-gray-400">Partagé lundi · 4.8 Mo</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Actions rapides</h3>
                    <div className="mt-3 grid grid-cols-1 gap-3">
                      <button className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dark-700 bg-dark-800/80 hover:border-orange-400/60 transition-colors text-left">
                        <Phone size={18} className="text-orange-300" />
                        <span className="text-sm text-white">Planifier un appel</span>
                      </button>
                      <button className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dark-700 bg-dark-800/80 hover:border-orange-400/60 transition-colors text-left">
                        <Video size={18} className="text-orange-300" />
                        <span className="text-sm text-white">Lancer une visio session</span>
                      </button>
                      <button className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dark-700 bg-dark-800/80 hover:border-orange-400/60 transition-colors text-left">
                        <Sparkles size={18} className="text-orange-300" />
                        <span className="text-sm text-white">Créer un événement</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                  Sélectionnez une conversation pour afficher les détails
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
