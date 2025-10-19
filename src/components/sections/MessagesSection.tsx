import { useState, useEffect } from 'react';
import { Send, ArrowLeft, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Conversation, Message, Profile } from '../../types';

interface MessagesSectionProps {
  currentUser: Profile | null;
}

export default function MessagesSection({ currentUser }: MessagesSectionProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadConversations();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, participant_1:profiles!participant_1_id(*), participant_2:profiles!participant_2_id(*)')
        .or(`participant_1_id.eq.${currentUser.id},participant_2_id.eq.${currentUser.id}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:profiles(*)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      await markMessagesAsRead(conversationId);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const markMessagesAsRead = async (conversationId: string) => {
    if (!currentUser) return;

    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', currentUser.id)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || !currentUser) return;

    setSending(true);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: currentUser.id,
          content: newMessage,
        })
        .select('*, sender:profiles(*)')
        .single();

      if (error) throw error;

      setMessages([...messages, data]);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const getOtherParticipant = (conversation: Conversation): Profile | undefined => {
    if (!currentUser) return undefined;
    return conversation.participant_1_id === currentUser.id
      ? conversation.participant_2
      : conversation.participant_1;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  if (!currentUser) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>Please log in to view messages</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>Loading conversations...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex">
      <div
        className={`${
          selectedConversation ? 'hidden md:block' : 'block'
        } w-full md:w-80 border-r border-slate-200 bg-white`}
      >
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-3">Messages</h2>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-y-auto h-[calc(100%-120px)]">
          {conversations.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No conversations yet</p>
              <p className="text-sm mt-1">Start chatting with other skaters!</p>
            </div>
          ) : (
            conversations.map((conversation) => {
              const otherUser = getOtherParticipant(conversation);
              if (!otherUser) return null;

              return (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation)}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100 ${
                    selectedConversation?.id === conversation.id ? 'bg-blue-50' : ''
                  }`}
                >
                  {otherUser.avatar_url ? (
                    <img
                      src={otherUser.avatar_url}
                      alt={otherUser.display_name}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {otherUser.display_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="font-semibold text-slate-800 truncate">
                      {otherUser.display_name}
                    </div>
                    <div className="text-sm text-slate-500 truncate">@{otherUser.username}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-slate-50">
        {selectedConversation ? (
          <>
            <div className="bg-white border-b border-slate-200 p-4 flex items-center gap-3">
              <button
                onClick={() => setSelectedConversation(null)}
                className="md:hidden text-slate-600 hover:text-slate-800"
              >
                <ArrowLeft size={24} />
              </button>
              {(() => {
                const otherUser = getOtherParticipant(selectedConversation);
                if (!otherUser) return null;

                return (
                  <>
                    {otherUser.avatar_url ? (
                      <img
                        src={otherUser.avatar_url}
                        alt={otherUser.display_name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
                        {otherUser.display_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-slate-800">{otherUser.display_name}</div>
                      <div className="text-sm text-slate-500">@{otherUser.username}</div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => {
                const isOwn = message.sender_id === currentUser.id;

                return (
                  <div
                    key={message.id}
                    className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {!isOwn && message.sender?.avatar_url ? (
                      <img
                        src={message.sender.avatar_url}
                        alt={message.sender.display_name}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : !isOwn ? (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        {message.sender?.display_name.charAt(0).toUpperCase()}
                      </div>
                    ) : null}
                    <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div
                        className={`px-4 py-2 rounded-2xl ${
                          isOwn
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-slate-800 border border-slate-200'
                        }`}
                      >
                        <p className="break-words">{message.content}</p>
                      </div>
                      <span className="text-xs text-slate-500 mt-1">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSendMessage} className="bg-white border-t border-slate-200 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="bg-blue-600 text-white rounded-full p-3 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={20} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <div className="text-center">
              <p className="text-lg">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
