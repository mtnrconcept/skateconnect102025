-- Provide aggregated metadata (latest message + unread count) for a list of conversations

drop function if exists public.get_conversation_summaries(uuid[], uuid);

create or replace function public.get_conversation_summaries(
  conversation_ids uuid[],
  viewer_id uuid
)
returns table (
  conversation_id uuid,
  latest_message jsonb,
  unread_count integer
)
language plpgsql
as $$
begin
  if viewer_id is null then
    return;
  end if;

  if conversation_ids is null or coalesce(array_length(conversation_ids, 1), 0) = 0 then
    return;
  end if;

  return query
    with requested_conversations as (
      select distinct cid as conversation_id
      from unnest(conversation_ids) as rc(cid)
      where cid is not null
    ),
    authorized_conversations as (
      select c.id
      from requested_conversations r
      join public.conversations c on c.id = r.conversation_id
      where viewer_id = any(c.participant_ids)
    ),
    latest_messages as (
      select distinct on (m.conversation_id)
        m.conversation_id,
        to_jsonb(m) as payload
      from public.messages m
      join authorized_conversations ac on ac.id = m.conversation_id
      order by m.conversation_id, m.created_at desc, m.id desc
    ),
    unread_counts as (
      select
        m.conversation_id,
        count(*)::integer as unread_count
      from public.messages m
      join authorized_conversations ac on ac.id = m.conversation_id
      where m.sender_id <> viewer_id
        and m.is_read = false
      group by m.conversation_id
    )
    select
      ac.id as conversation_id,
      lm.payload as latest_message,
      coalesce(uc.unread_count, 0) as unread_count
    from authorized_conversations ac
    left join latest_messages lm on lm.conversation_id = ac.id
    left join unread_counts uc on uc.conversation_id = ac.id;
end;
$$;
