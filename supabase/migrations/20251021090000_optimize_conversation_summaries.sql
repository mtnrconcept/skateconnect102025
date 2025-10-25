-- Optimize conversation summary fetching by aggregating metadata server-side
create or replace function get_conversation_summaries(
  conversation_ids uuid[],
  viewer_id uuid
)
returns table (
  conversation_id uuid,
  latest_message jsonb,
  unread_count integer
)
language sql
stable
as $$
  with latest as (
    select distinct on (conversation_id)
      id,
      conversation_id,
      sender_id,
      content,
      media_url,
      is_read,
      created_at
    from messages
    where conversation_id = any(conversation_ids)
    order by conversation_id, created_at desc
  ),
  unread as (
    select
      conversation_id,
      count(*)::integer as unread_count
    from messages
    where conversation_id = any(conversation_ids)
      and is_read = false
      and sender_id <> viewer_id
    group by conversation_id
  )
  select
    c.id as conversation_id,
    to_jsonb(l.*) as latest_message,
    coalesce(u.unread_count, 0) as unread_count
  from conversations c
  left join latest l on l.conversation_id = c.id
  left join unread u on u.conversation_id = c.id
  where c.id = any(conversation_ids);
$$;

comment on function get_conversation_summaries(uuid[], uuid) is
  'Returns the latest message and unread count for each conversation id for a viewer.';
