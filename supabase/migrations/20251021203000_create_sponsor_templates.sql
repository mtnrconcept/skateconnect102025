-- Create sponsor templates table for reusable opportunity configurations
create table if not exists sponsor_templates (
  id uuid primary key default uuid_generate_v4(),
  sponsor_id uuid references profiles(id) on delete cascade,
  name text not null,
  type text not null check (type in ('challenge', 'event', 'call')),
  default_fields jsonb not null default '{}'::jsonb,
  assets jsonb not null default '[]'::jsonb,
  share_key text unique,
  is_public boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table sponsor_templates is 'Reusable sponsor opportunity templates with default field values and linked assets.';
comment on column sponsor_templates.default_fields is 'JSON payload of default form values keyed by opportunity type fields.';
comment on column sponsor_templates.assets is 'Array of related storage assets (logo, cover, video) to surface alongside the template.';
comment on column sponsor_templates.share_key is 'Optional share token allowing sponsors to import a template by key.';

create index if not exists sponsor_templates_sponsor_id_idx on sponsor_templates (sponsor_id);
create index if not exists sponsor_templates_share_key_idx on sponsor_templates (share_key) where share_key is not null;

create or replace function trigger_set_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger set_timestamp
before update on sponsor_templates
for each row
execute function trigger_set_timestamp();
