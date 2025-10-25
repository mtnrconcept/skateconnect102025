import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Conversation, Message, Profile } from '../types/index.js';
import { supabase } from '../lib/supabase.js';
import { isTableMissingError } from '../lib/supabaseErrors.js';
import type { PostgrestSingleResponse } from '@supabase/supabase-js';

export interface ConversationListItem {
  conversation: Conversation;
  otherParticipant: Profile | null;
  lastMessage: Message | null;
  unreadCount: number;
}

interface ConversationFetchResult {
  items: ConversationListItem[];
  hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 12;

async function fetchProfileMap(profileIds: string[]): Promise<Map<string, Profile>> {
  if (!profileIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, location, updated_at')
    .in('id', profileIds);

  if (error) {
    throw error;
  }

  const map = new Map<string, Profile>();
  for (const row of data ?? []) {
    map.set(row.id, row as Profile);
  }

  return map;
}

async function fetchLatestMessage(conversationId: string): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, media_url, is_read, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    if (isTableMissingError(error)) {
      return null;
    }
    throw error;
  }

  return (data?.[0] as Message | undefined) ?? null;
}

async function fetchUnreadCount(conversationId: string, viewerId: string): Promise<number> {
  const response = (await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('is_read', false)
    .neq('sender_id', viewerId)) as PostgrestSingleResponse<null>;

  if (response.error) {
    if (isTableMissingError(response.error)) {
      return 0;
    }
    throw response.error;
  }

  return response.count ?? 0;
}

async function buildConversationItems(
  conversations: Conversation[],
  viewerId: string,
): Promise<ConversationListItem[]> {
  if (!conversations.length) {
    return [];
  }

  const participantIds = new Set<string>();
  for (const conversation of conversations) {
    participantIds.add(conversation.participant_1_id);
    participantIds.add(conversation.participant_2_id);
  }

  const profileMap = await fetchProfileMap(Array.from(participantIds));

  const [latestMessages, unreadCounts] = await Promise.all([
    Promise.all(conversations.map((conversation) => fetchLatestMessage(conversation.id))),
    Promise.all(conversations.map((conversation) => fetchUnreadCount(conversation.id, viewerId))),
  ]);

  return conversations.map((conversation, index) => {
    const otherParticipantId =
      conversation.participant_1_id === viewerId
        ? conversation.participant_2_id
        : conversation.participant_1_id;

    return {
      conversation,
      otherParticipant: profileMap.get(otherParticipantId) ?? null,
      lastMessage: latestMessages[index],
      unreadCount: unreadCounts[index] ?? 0,
    };
  });
}

async function fetchConversationPage(
  viewerId: string,
  page: number,
  pageSize: number,
): Promise<ConversationFetchResult> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`participant_1_id.eq.${viewerId},participant_2_id.eq.${viewerId}`)
    .order('last_message_at', { ascending: false, nullsLast: false })
    .range(from, to);

  if (error) {
    if (isTableMissingError(error)) {
      return { items: [], hasMore: false };
    }
    throw error;
  }

  const conversations = (data ?? []) as Conversation[];
  const items = await buildConversationItems(conversations, viewerId);

  return {
    items,
    hasMore: conversations.length === pageSize,
  };
}

async function fetchConversationSummary(
  viewerId: string,
  conversationId: string,
): Promise<ConversationListItem | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    if (isTableMissingError(error)) {
      return null;
    }
    throw error;
  }

  if (!data) {
    return null;
  }

  const [latestMessage, unreadCount] = await Promise.all([
    fetchLatestMessage(conversationId),
    fetchUnreadCount(conversationId, viewerId),
  ]);

  const conversation = data as Conversation;
  const otherParticipantId =
    conversation.participant_1_id === viewerId
      ? conversation.participant_2_id
      : conversation.participant_1_id;

  const profileMap = await fetchProfileMap([otherParticipantId]);

  return {
    conversation,
    otherParticipant: profileMap.get(otherParticipantId) ?? null,
    lastMessage: latestMessage,
    unreadCount,
  };
}

export function useConversations(viewerId: string | null, pageSize = DEFAULT_PAGE_SIZE) {
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const currentPageRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadPage = useCallback(
    async (page: number, append: boolean) => {
      if (!viewerId) {
        return;
      }

      try {
        if (append) {
          setIsLoadingMore(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const result = await fetchConversationPage(viewerId, page, pageSize);

        if (!isMountedRef.current) {
          return;
        }

        currentPageRef.current = page;
        setItems((previous) => (append ? [...previous, ...result.items] : result.items));
        setHasMore(result.hasMore);
      } catch (caught) {
        if (!isMountedRef.current) {
          return;
        }

        if (isTableMissingError(caught)) {
          currentPageRef.current = 0;
          setItems([]);
          setHasMore(false);
          setError(null);
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
    [pageSize, viewerId],
  );

  useEffect(() => {
    if (!viewerId) {
      setItems([]);
      setHasMore(false);
      return;
    }

    loadPage(0, false);
  }, [loadPage, viewerId]);

  const refresh = useCallback(() => {
    if (!viewerId) {
      return;
    }
    loadPage(0, false);
  }, [loadPage, viewerId]);

  const loadMore = useCallback(() => {
    if (!viewerId || !hasMore || isLoadingMore) {
      return Promise.resolve();
    }

    return loadPage(currentPageRef.current + 1, true);
  }, [hasMore, isLoadingMore, loadPage, viewerId]);

  const markConversationReadLocally = useCallback((conversationId: string) => {
    setItems((previous) =>
      previous.map((item) =>
        item.conversation.id === conversationId
          ? {
              ...item,
              unreadCount: 0,
              lastMessage: item.lastMessage
                ? { ...item.lastMessage, is_read: true }
                : item.lastMessage,
            }
          : item,
      ),
    );
  }, []);

  const upsertConversation = useCallback(
    async (conversationId: string) => {
      if (!viewerId) {
        return;
      }

      try {
        const summary = await fetchConversationSummary(viewerId, conversationId);
        if (!summary || !isMountedRef.current) {
          return;
        }

        setItems((previous) => {
          const withoutTarget = previous.filter((item) => item.conversation.id !== conversationId);
          return [summary, ...withoutTarget];
        });
      } catch (caught) {
        if (isTableMissingError(caught)) {
          return;
        }
        console.error('Erreur lors du rafraîchissement de la conversation :', caught);
      }
    },
    [viewerId],
  );

  const handleRealtimeInsert = useCallback(
    (payload: { new: Record<string, any> }) => {
      if (!payload?.new) {
        return;
      }
      const message = payload.new as Message;
      const conversationId = message.conversation_id;
      const isOwnMessage = viewerId === message.sender_id;

      setItems((previous) => {
        const existing = previous.find((item) => item.conversation.id === conversationId);
        if (!existing) {
          void upsertConversation(conversationId);
          return previous;
        }

        const updated: ConversationListItem = {
          ...existing,
          conversation: {
            ...existing.conversation,
            last_message_at: message.created_at,
          },
          lastMessage: message,
          unreadCount: isOwnMessage ? 0 : existing.unreadCount + (message.is_read ? 0 : 1),
        };

        const others = previous.filter((item) => item.conversation.id !== conversationId);
        return [updated, ...others];
      });
    },
    [upsertConversation, viewerId],
  );

  const handleConversationChange = useCallback(
    (payload: { new: Record<string, any> }) => {
      if (!payload?.new) {
        return;
      }
      const conversation = payload.new as Conversation;
      if (conversation.participant_1_id !== viewerId && conversation.participant_2_id !== viewerId) {
        return;
      }
      void upsertConversation(conversation.id);
    },
    [upsertConversation, viewerId],
  );

  useEffect(() => {
    if (!viewerId) {
      return;
    }

    const channel = supabase
      .channel(`dm:${viewerId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        handleRealtimeInsert,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        handleConversationChange,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        handleConversationChange,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleConversationChange, handleRealtimeInsert, viewerId]);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const left = a.conversation.last_message_at ?? a.conversation.created_at;
        const right = b.conversation.last_message_at ?? b.conversation.created_at;
        return new Date(right).getTime() - new Date(left).getTime();
      }),
    [items],
  );

  return {
    conversations: sortedItems,
    loading,
    error,
    hasMore,
    isLoadingMore,
    loadMore,
    refresh,
    markConversationReadLocally,
  };
}
