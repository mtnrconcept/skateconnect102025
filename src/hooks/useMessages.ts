import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Message, Profile } from '../types/index.js';
import { supabase } from '../lib/supabase.js';
import { fetchProfilesByIds } from '../lib/userUtils.js';

export interface MessageWithSender extends Message {
  sender_profile?: Profile | null;
}

interface UseMessagesOptions {
  conversationId: string | null;
  viewerId: string | null;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 20;

export function useMessages({ conversationId, viewerId, pageSize = DEFAULT_PAGE_SIZE }: UseMessagesOptions) {
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const pageRef = useRef(0);
  const isMountedRef = useRef(true);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadPage = useCallback(
    async (page: number, append: boolean) => {
      if (!conversationId) {
        setMessages([]);
        setHasMore(false);
        return;
      }

      try {
        if (append) {
          setIsLoadingMore(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error: fetchError } = await supabase
          .from('messages')
          .select('id, conversation_id, sender_id, content, media_url, is_read, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (fetchError) {
          throw fetchError;
        }

        const fetched = (data ?? []) as Message[];
        const senderIds = Array.from(new Set(fetched.map((message) => message.sender_id)));
        const profileMap = await fetchProfilesByIds(senderIds);

        const normalized: MessageWithSender[] = fetched
          .map((message) => ({
            ...message,
            sender_profile: profileMap.get(message.sender_id) ?? null,
          }))
          .reverse();

        if (!isMountedRef.current) {
          return;
        }

        setMessages((previous) => {
          const current = append ? [...normalized, ...previous] : normalized;
          knownMessageIdsRef.current = new Set(current.map((message) => message.id));
          return current;
        });

        setHasMore(fetched.length === pageSize);
        pageRef.current = page;
      } catch (caught) {
        if (!isMountedRef.current) {
          return;
        }
        setError(caught as Error);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [conversationId, pageSize],
  );

  useEffect(() => {
    knownMessageIdsRef.current = new Set();
    if (!conversationId) {
      setMessages([]);
      setHasMore(false);
      return;
    }
    loadPage(0, false);
  }, [conversationId, loadPage]);

  const loadMore = useCallback(() => {
    if (!conversationId || !hasMore || isLoadingMore) {
      return Promise.resolve();
    }
    return loadPage(pageRef.current + 1, true);
  }, [conversationId, hasMore, isLoadingMore, loadPage]);

  const appendMessage = useCallback((message: MessageWithSender) => {
    if (knownMessageIdsRef.current.has(message.id)) {
      return;
    }

    knownMessageIdsRef.current.add(message.id);
    setMessages((previous) => [...previous, message]);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationId || !viewerId) {
        throw new Error('Conversation indisponible');
      }

      const trimmed = content.trim();
      if (!trimmed) {
        return null;
      }

      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: viewerId,
          content: trimmed,
        })
        .select('id, conversation_id, sender_id, content, media_url, is_read, created_at')
        .single();

      if (insertError) {
        throw insertError;
      }

      const inserted = data as Message;
      const senderProfile = viewerId
        ? (await fetchProfilesByIds([viewerId])).get(viewerId) ?? null
        : null;

      const messageWithSender: MessageWithSender = {
        ...inserted,
        sender_profile: senderProfile,
      };

      appendMessage(messageWithSender);
      return messageWithSender;
    },
    [appendMessage, conversationId, viewerId],
  );

  const markAsRead = useCallback(
    async () => {
      if (!conversationId || !viewerId) {
        return { updated: 0 };
      }

      const { data, error: updateError } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', viewerId)
        .eq('is_read', false)
        .select('id');

      if (updateError) {
        throw updateError;
      }

      const updatedIds = new Set((data ?? []).map((row: { id: string }) => row.id));
      if (updatedIds.size > 0) {
        setMessages((previous) =>
          previous.map((message) =>
            updatedIds.has(message.id)
              ? {
                  ...message,
                  is_read: true,
                }
              : message,
          ),
        );
      }

      return { updated: updatedIds.size };
    },
    [conversationId, viewerId],
  );

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const channel = supabase
      .channel(`dm:conversation:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const record = payload.new as Message;
          if (!record) {
            return;
          }
          const profileMap = await fetchProfilesByIds([record.sender_id]);
          const senderProfile = profileMap.get(record.sender_id) ?? null;
          appendMessage({
            ...record,
            sender_profile: senderProfile,
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const record = payload.new as Message | undefined;
          if (!record) {
            return;
          }
          setMessages((previous) =>
            previous.map((message) =>
              message.id === record.id
                ? {
                    ...message,
                    is_read: record.is_read,
                  }
                : message,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appendMessage, conversationId]);

  const orderedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [messages],
  );

  return {
    messages: orderedMessages,
    loading,
    error,
    hasMore,
    isLoadingMore,
    loadMore,
    sendMessage,
    markAsRead,
  };
}
