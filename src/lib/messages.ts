import type { SupabaseClient } from '@supabase/supabase-js';
import type { Conversation, Message } from '../types/index.js';
import type { FakeDirectMessagePayload } from '../types/messages.js';

async function findConversation(
  supabase: SupabaseClient,
  participantA: string,
  participantB: string,
): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('participant_1_id', participantA)
    .eq('participant_2_id', participantB)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as Conversation | null) ?? null;
}

export async function getOrCreateConversation(
  supabase: SupabaseClient,
  currentUserId: string,
  otherUserId: string,
): Promise<Conversation> {
  if (!currentUserId || !otherUserId) {
    throw new Error('Identifiants participants manquants');
  }

  const existingDirect = await findConversation(supabase, currentUserId, otherUserId);
  if (existingDirect) {
    return existingDirect;
  }

  const existingReverse = await findConversation(supabase, otherUserId, currentUserId);
  if (existingReverse) {
    return existingReverse;
  }

  const [firstParticipant, secondParticipant] = [currentUserId, otherUserId].sort();

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      participant_1_id: firstParticipant,
      participant_2_id: secondParticipant,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as Conversation;
}

export async function insertMessage(
  supabase: SupabaseClient,
  conversationId: string,
  senderId: string,
  content: string,
  mediaUrl = '',
): Promise<Message> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Contenu du message vide');
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: trimmed,
      media_url: mediaUrl,
    })
    .select('id, conversation_id, sender_id, content, media_url, is_read, created_at')
    .single();

  if (error) {
    throw error;
  }

  return data as Message;
}

export async function markConversationMessagesAsRead(
  supabase: SupabaseClient,
  conversationId: string,
  viewerId: string,
): Promise<{ updated: number }> {
  if (!conversationId || !viewerId) {
    return { updated: 0 };
  }

  const { data, error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', viewerId)
    .eq('is_read', false)
    .select('id');

  if (error) {
    throw error;
  }

  return { updated: (data?.length ?? 0) as number };
}

export async function processQueuedDirectMessages(
  supabase: SupabaseClient,
  queue: FakeDirectMessagePayload[],
  currentUserId: string | null,
): Promise<string[]> {
  if (!currentUserId || !queue.length) {
    return [];
  }

  const processedIds: string[] = [];

  for (const payload of queue) {
    try {
      if (!payload?.message || payload.message.sender !== 'user') {
        continue;
      }

      const conversation = await getOrCreateConversation(supabase, currentUserId, payload.profileId);
      await insertMessage(supabase, conversation.id, currentUserId, payload.message.content);
      processedIds.push(payload.message.id);
    } catch (error) {
      console.error('Erreur lors du traitement du message direct :', error);
    }
  }

  return processedIds;
}
