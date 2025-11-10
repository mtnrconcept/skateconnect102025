import type { SupabaseClient } from '@supabase/supabase-js';
import type { Conversation, Message } from '../types/index.js';
import type { FakeDirectMessagePayload } from '../types/messages.js';
import { isTableMissingError } from './supabaseErrors.js';

function normalizeParticipants(participantA: string, participantB: string): string[] {
  return [participantA, participantB].sort((left, right) => left.localeCompare(right));
}

function participantsMatch(candidate: Conversation | null, expected: string[]): boolean {
  if (!candidate?.participant_ids || candidate.participant_ids.length !== expected.length) {
    return false;
  }
  const normalized = [...candidate.participant_ids].sort((left, right) => left.localeCompare(right));
  return normalized.every((value, index) => value === expected[index]);
}

async function findConversation(
  supabase: SupabaseClient,
  participantA: string,
  participantB: string,
): Promise<Conversation | null> {
  const normalizedPair = normalizeParticipants(participantA, participantB);

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .contains('participant_ids', normalizedPair);

  if (error) {
    if (isTableMissingError(error)) {
      return null;
    }
    throw error;
  }

  const rows = (data ?? []) as Conversation[];
  const match = rows.find((row) => participantsMatch(row, normalizedPair)) ?? null;
  return match;
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

  const normalizedParticipants = normalizeParticipants(currentUserId, otherUserId);

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      participant_ids: normalizedParticipants,
    })
    .select('*')
    .single();

  if (error) {
    if (isTableMissingError(error)) {
      throw new Error("La messagerie n'est pas disponible pour le moment.");
    }
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
    if (isTableMissingError(error)) {
      throw new Error("La messagerie n'est pas disponible pour le moment.");
    }
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
    if (isTableMissingError(error)) {
      return { updated: 0 };
    }
    throw error;
  }

  return { updated: (data?.length ?? 0) as number };
}

export async function deleteConversation(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<void> {
  if (!conversationId) {
    throw new Error('Identifiant de conversation manquant');
  }

  const { error: messagesError } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId)
    .select('id');

  if (messagesError && !isTableMissingError(messagesError)) {
    throw messagesError;
  }

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .select('id');

  if (error) {
    if (isTableMissingError(error)) {
      throw new Error("La messagerie n'est pas disponible pour le moment.");
    }
    throw error;
  }
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
  let messagingUnavailableLogged = false;

  for (const payload of queue) {
    try {
      if (!payload?.message || payload.message.sender !== 'user') {
        continue;
      }

      const conversation = await getOrCreateConversation(supabase, currentUserId, payload.profileId);
      await insertMessage(supabase, conversation.id, currentUserId, payload.message.content);
      processedIds.push(payload.message.id);
    } catch (error) {
      if (isTableMissingError(error)) {
        if (!messagingUnavailableLogged) {
          console.warn("La messagerie n'est pas disponible pour le moment. Impossible de traiter les messages directs.");
          messagingUnavailableLogged = true;
        }
        break;
      }
      console.error('Erreur lors du traitement du message direct :', error);
    }
  }

  return processedIds;
}
