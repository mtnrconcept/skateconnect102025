import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, X } from 'lucide-react';
import { getUserDisplayName, getUserInitial } from '../lib/userUtils';
import type { Profile } from '../types';
import type { FakeMessage, FakeProfileDetails } from '../data/fakeFeed';

interface FakeDirectMessageModalProps {
  profile: FakeProfileDetails;
  messages: FakeMessage[];
  currentUser: Profile | null;
  onClose: () => void;
  onSendMessage: (message: string) => void;
}

export default function FakeDirectMessageModal({
  profile,
  messages,
  currentUser,
  onClose,
  onSendMessage,
}: FakeDirectMessageModalProps) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !draft.trim()) {
      return;
    }
    onSendMessage(draft.trim());
    setDraft('');
  };

  const renderAvatar = () => {
    if (profile.avatar_url) {
      return (
        <img
          src={profile.avatar_url}
          alt={getUserDisplayName(profile)}
          className="w-10 h-10 rounded-full object-cover border border-orange-400/60"
        />
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-400/60 flex items-center justify-center text-orange-100 font-semibold">
        {getUserInitial(profile)}
      </div>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6">
      <div className="w-full max-w-lg rounded-3xl bg-[#101019] border border-dark-700 shadow-xl flex flex-col max-h-[90vh]">
        <header className="flex items-center gap-3 px-5 py-4 border-b border-dark-700">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-dark-700/70 text-gray-300 hover:text-white"
            aria-label="Fermer la conversation"
          >
            <ArrowLeft size={18} />
          </button>
          {renderAvatar()}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{getUserDisplayName(profile)}</p>
            <p className="text-xs text-gray-400 truncate">Toujours partant·e pour discuter sessions & projets.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-dark-700/70 text-gray-400 hover:text-white"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-4 bg-gradient-to-b from-dark-900 to-dark-800">
          {messages.map((message) => {
            const isUser = message.sender === 'user';
            return (
              <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm ${
                    isUser
                      ? 'bg-orange-500 text-white rounded-br-sm'
                      : 'bg-dark-700/80 text-gray-100 border border-dark-600 rounded-bl-sm'
                  }`}
                >
                  <p>{message.content}</p>
                  <span className={`mt-1 block text-[11px] ${isUser ? 'text-orange-100/80' : 'text-gray-400'}`}>
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>
              </div>
            );
          })}
          {messages.length === 0 && (
            <div className="text-center text-sm text-gray-400">
              Démarrez la discussion avec {getUserDisplayName(profile)}.
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t border-dark-700 bg-[#13131d]">
          {currentUser ? (
            <div className="flex items-end gap-3">
              {currentUser.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={getUserDisplayName(currentUser)}
                  className="w-9 h-9 rounded-full object-cover border border-orange-400/60"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-orange-500/20 border border-orange-400/60 flex items-center justify-center text-orange-100 text-sm font-semibold">
                  {getUserInitial(currentUser)}
                </div>
              )}
              <div className="flex-1 flex items-center gap-2 bg-dark-800/80 border border-dark-600 rounded-2xl px-4 py-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={`Envoyer un message à ${getUserDisplayName(profile)}...`}
                  className="flex-1 resize-none bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
                  rows={2}
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="p-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center">
              Connectez-vous pour envoyer un message à {getUserDisplayName(profile)}.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
