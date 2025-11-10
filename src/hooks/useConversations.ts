import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Conversation, Message, Profile } from '../types/index.js';
import { supabase } from '../lib/supabase.js';
import { isTableMissingError } from '../lib/supabaseErrors.js';

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

interface ConversationMetaRow {
  conversation_id: string;
  latest_message: Message | null;
  unread_count: number | null;
}

async function fetchConversationMeta(
  conversationIds: string[],
  viewerId: string,
): Promise<Map<string, { lastMessage: Message | null; unreadCount: number }>> {
  if (!conversationIds.length) {
    return new Map();
  }

  const { data, error } = await supabase.rpc<ConversationMetaRow[]>(
    'get_conversation_summaries',
    {
      conversation_ids: conversationIds,
      viewer_id: viewerId,
    },
  );

  if (error) {
    if (isTableMissingError(error)) {
      return new Map();
    }
    throw error;
  }

  const metaMap = new Map<string, { lastMessage: Message | null; unreadCount: number }>();

  for (const row of data ?? []) {
    const lastMessage = (row.latest_message ?? null) as Message | null;
    metaMap.set(row.conversation_id, {
      lastMessage,
      unreadCount: row.unread_count ?? 0,
    });
  }

  return metaMap;
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
    for (const participantId of conversation.participant_ids ?? []) {
      if (participantId) {
        participantIds.add(participantId);
      }
    }
  }

  const profileMap = await fetchProfileMap(Array.from(participantIds));

  const metaMap = await fetchConversationMeta(
    conversations.map((conversation) => conversation.id),
    viewerId,
  );

  return conversations.map((conversation) => {
    const otherParticipantId =
      conversation.participant_ids?.find((participantId) => participantId !== viewerId) ??
      conversation.participant_ids?.[0] ??
      null;
    const meta = metaMap.get(conversation.id);

    return {
      conversation,
      otherParticipant: otherParticipantId ? profileMap.get(otherParticipantId) ?? null : null,
      lastMessage: meta?.lastMessage ?? null,
      unreadCount: meta?.unreadCount ?? 0,
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
    .contains('participant_ids', [viewerId])
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

  const metaMap = await fetchConversationMeta([conversationId], viewerId);
  const meta = metaMap.get(conversationId);

  const conversation = data as Conversation;
  const otherParticipantId =
    conversation.participant_ids?.find((participantId) => participantId !== viewerId) ??
    conversation.participant_ids?.[0] ??
    null;

  const profileIds = otherParticipantId ? [otherParticipantId] : [];
  const profileMap = profileIds.length ? await fetchProfileMap(profileIds) : new Map();

  return {
    conversation,
    otherParticipant: otherParticipantId ? profileMap.get(otherParticipantId) ?? null : null,
    lastMessage: meta?.lastMessage ?? null,
    unreadCount: meta?.unreadCount ?? 0,
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
      if (!conversation.participant_ids?.includes(viewerId)) {
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
    ensureConversation: upsertConversation,
  };
}
