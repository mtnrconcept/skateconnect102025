import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  getOrCreateConversation,
  insertMessage,
  markConversationMessagesAsRead,
  processQueuedDirectMessages,
  deleteConversation,
} from '../src/lib/messages.js';
import type { FakeDirectMessagePayload } from '../src/types/messages.js';
import type { Conversation, Message } from '../src/types/index.js';

class FakeSupabaseClient {
  tables: {
    conversations: Conversation[];
    messages: Message[];
  };

  constructor() {
    this.tables = {
      conversations: [],
      messages: [],
    };
  }

  from(table: 'conversations' | 'messages') {
    return new FakeQueryBuilder(this, table);
  }

  _touchConversation(conversationId: string, timestamp: string) {
    const conversation = this.tables.conversations.find((row) => row.id === conversationId);
    if (conversation) {
      conversation.last_message_at = timestamp;
    }
  }
}

class FakeQueryBuilder {
  private readonly client: FakeSupabaseClient;
  private readonly tableName: 'conversations' | 'messages';
  private filters: ((row: any) => boolean)[] = [];
  private operation: 'select' | 'update' | 'delete' | null = null;
  private updateValues: Record<string, unknown> | null = null;
  private selectedColumns = '*';

  constructor(client: FakeSupabaseClient, tableName: 'conversations' | 'messages') {
    this.client = client;
    this.tableName = tableName;
  }

  select(columns?: string, options?: { head?: boolean; count?: 'exact' }) {
    this.selectedColumns = columns ?? '*';

    if (options?.count === 'exact' && options?.head) {
      const rows = this.applyFilters();
      return Promise.resolve({ data: null, error: null, count: rows.length });
    }

    if (this.operation === 'update') {
      const rows = this.applyFilters({ clone: false });
      if (this.updateValues) {
        rows.forEach((row) => Object.assign(row, this.updateValues));
      }
      this.operation = null;
      return Promise.resolve({
        data: rows.map((row) => this.projectRow(row)),
        error: null,
      });
    }

    if (this.operation === 'delete') {
      const rows = this.applyFilters({ clone: false });
      const removed = rows.map((row) => ({ ...row }));
      const table = this.client.tables[this.tableName] as any[];
      rows.forEach((row) => {
        const index = table.indexOf(row);
        if (index !== -1) {
          table.splice(index, 1);
        }
      });
      this.operation = null;
      return Promise.resolve({
        data: removed.map((row) => this.projectRow(row)),
        error: null,
      });
    }

    this.operation = 'select';
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  neq(field: string, value: unknown) {
    this.filters.push((row) => row[field] !== value);
    return this;
  }

  contains(field: string, value: unknown) {
    if (!Array.isArray(value)) {
      this.filters.push(() => false);
      return this;
    }
    this.filters.push((row) => {
      const target = row[field];
      if (!Array.isArray(target)) {
        return false;
      }
      return value.every((needle) => target.includes(needle));
    });
    return this;
  }

  maybeSingle() {
    const rows = this.applyFilters();
    this.operation = null;
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  single() {
    const rows = this.applyFilters();
    this.operation = null;
    if (rows.length !== 1) {
      return Promise.resolve({ data: rows[0] ?? null, error: new Error('Expected single row') });
    }
    return Promise.resolve({ data: rows[0], error: null });
  }

  update(values: Record<string, unknown>) {
    this.operation = 'update';
    this.updateValues = values;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  insert(values: Partial<Message | Conversation> | Partial<Message | Conversation>[]) {
    const records = Array.isArray(values) ? values : [values];
    const inserted = records.map((value) => {
      const record: any = { ...value };
      record.id = record.id ?? randomUUID();
      if (this.tableName === 'messages') {
        record.created_at = record.created_at ?? new Date().toISOString();
        record.is_read = record.is_read ?? false;
        record.media_url = record.media_url ?? '';
      }
      if (this.tableName === 'conversations') {
        record.created_at = record.created_at ?? new Date().toISOString();
        record.last_message_at = record.last_message_at ?? record.created_at;
        record.participant_ids = Array.isArray(record.participant_ids) ? [...record.participant_ids] : [];
      }
      (this.client.tables[this.tableName] as any[]).push(record);
      if (this.tableName === 'messages') {
        this.client._touchConversation(record.conversation_id, record.created_at);
      }
      return record;
    });

    return {
      select: () => ({
        single: () => Promise.resolve({ data: inserted[0], error: null }),
        maybeSingle: () => Promise.resolve({ data: inserted[0] ?? null, error: null }),
      }),
    };
  }

  private applyFilters({ clone = true }: { clone?: boolean } = {}) {
    const rows = this.client.tables[this.tableName] as any[];
    const matched = this.filters.length === 0 ? rows : rows.filter((row) => this.filters.every((predicate) => predicate(row)));
    if (clone) {
      return matched.map((row) => ({ ...row }));
    }
    return matched;
  }

  private projectRow(row: any) {
    if (this.selectedColumns === '*' || !this.selectedColumns) {
      return { ...row };
    }
    const projected: Record<string, unknown> = {};
    this.selectedColumns
      .split(',')
      .map((column) => column.trim())
      .forEach((column) => {
        projected[column] = row[column];
      });
    return projected;
  }
}

test('direct messaging workflow', async () => {
  const supabase = new FakeSupabaseClient();
  const currentUserId = 'user-1';
  const recipientId = 'user-2';

  const queue: FakeDirectMessagePayload[] = [
    {
      profileId: recipientId,
      profile: { id: recipientId },
      message: {
        id: 'local-1',
        sender: 'user',
        content: 'Salut, on ride ensemble bientôt ?',
        timestamp: new Date().toISOString(),
      },
    },
  ];

  const processed = await processQueuedDirectMessages(supabase as any, queue, currentUserId);
  assert.deepStrictEqual(processed, ['local-1']);
  assert.equal(supabase.tables.conversations.length, 1);
  assert.equal(supabase.tables.messages.length, 1);
  assert.equal(supabase.tables.messages[0].sender_id, currentUserId);

  const conversation = supabase.tables.conversations[0];
  assert.ok(Array.isArray(conversation.participant_ids));
  assert.equal(conversation.participant_ids.length, 2);
  assert.ok(conversation.participant_ids.includes(currentUserId));
  assert.ok(conversation.participant_ids.includes(recipientId));

  const reply = await insertMessage(supabase as any, conversation.id, recipientId, 'Toujours partant !');
  assert.equal(reply.sender_id, recipientId);
  assert.equal(supabase.tables.messages.length, 2);
  assert.equal(supabase.tables.messages[1].is_read, false);

  const result = await markConversationMessagesAsRead(supabase as any, conversation.id, currentUserId);
  assert.equal(result.updated, 1);
  assert.equal(supabase.tables.messages[1].is_read, true);

  await deleteConversation(supabase as any, conversation.id);
  assert.equal(supabase.tables.conversations.length, 0);
  assert.equal(supabase.tables.messages.length, 0);
});
