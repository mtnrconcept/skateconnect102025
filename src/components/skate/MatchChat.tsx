import { useState, useRef, useEffect } from 'react';
import { Paperclip, Smile, ThumbsUp, Star, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import type { Profile } from '../../types';

interface MatchChatProps {
  matchId: string;
  currentUserId: string;
  opponentProfile: Profile | null;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  isCurrentUser: boolean;
}

export default function MatchChat({ matchId, currentUserId, opponentProfile }: MatchChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Create or get conversation for this match
    let mounted = true;
    let channel: any = null;

    (async () => {
      if (!opponentProfile) return;

      // Find existing conversation between players
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(participant_1_id.eq.${currentUserId},participant_2_id.eq.${opponentProfile.id}),and(participant_1_id.eq.${opponentProfile.id},participant_2_id.eq.${currentUserId})`)
        .limit(1)
        .single();

      let conversationId = existingConv?.id;

      if (!conversationId) {
        // Create new conversation
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({
            participant_1_id: currentUserId,
            participant_2_id: opponentProfile.id,
          })
          .select('id')
          .single();

        if (newConv) {
          conversationId = newConv.id;
        }
      }

      if (!conversationId) return;

      // Load messages
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (mounted && data) {
        setMessages(
          data.map((msg: any) => ({
            id: msg.id,
            sender_id: msg.sender_id,
            content: msg.content,
            created_at: msg.created_at,
            isCurrentUser: msg.sender_id === currentUserId,
          })),
        );
      }

      // Subscribe to new messages
      channel = supabase
        .channel(`match-chat-${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const newMsg = payload.new as any;
            if (mounted) {
              setMessages((prev) => [
                ...prev,
                {
                  id: newMsg.id,
                  sender_id: newMsg.sender_id,
                  content: newMsg.content,
                  created_at: newMsg.created_at,
                  isCurrentUser: newMsg.sender_id === currentUserId,
                },
              ]);
            }
          },
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [matchId, currentUserId, opponentProfile]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || !opponentProfile) return;

    // Find or create conversation
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(participant_1_id.eq.${currentUserId},participant_2_id.eq.${opponentProfile.id}),and(participant_1_id.eq.${opponentProfile.id},participant_2_id.eq.${currentUserId})`)
      .limit(1)
      .single();

    let conversationId = existingConv?.id;

    if (!conversationId) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          participant_1_id: currentUserId,
          participant_2_id: opponentProfile.id,
        })
        .select('id')
        .single();
      conversationId = newConv?.id;
    }

    if (conversationId) {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: content.trim(),
      });
      setInputValue('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-dark-800 rounded-lg border border-dark-700">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-4">
            Aucun message. Commencez la conversation!
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isCurrentUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  message.isCurrentUser
                    ? 'bg-orange-500/80 text-white rounded-br-sm'
                    : 'bg-dark-700 text-gray-100 rounded-bl-sm'
                }`}
              >
                <p>{message.content}</p>
                <span className={`text-[11px] mt-1 block ${message.isCurrentUser ? 'text-orange-100/80' : 'text-gray-400'}`}>
                  {formatTime(message.created_at)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-dark-700 bg-dark-900">
        <div className="flex items-center gap-2">
          <button type="button" className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
            <Paperclip size={18} className="text-gray-400" />
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
          />
          <div className="flex items-center gap-1">
            <button type="button" className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
              <ThumbsUp size={18} className="text-gray-400" />
            </button>
            <button type="button" className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
              <Smile size={18} className="text-gray-400" />
            </button>
            <button type="button" className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
              <Star size={18} className="text-gray-400" />
            </button>
          </div>
          <button
            type="submit"
            className="p-2 bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
          >
            <Send size={18} className="text-white" />
          </button>
        </div>
      </form>
    </div>
  );
}

