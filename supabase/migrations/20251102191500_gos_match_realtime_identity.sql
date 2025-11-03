-- Ensure realtime UPDATE payloads include the full row
alter table public.gos_match replica identity full;

-- Optional but useful for chat events as well
alter table public.gos_chat_message replica identity full;
