-- AI system for Game of S.K.A.T.E
-- Tables for storing clips, features, labels, and AI analysis sessions

-- Enum for trick labels
do $$ begin
  create type trick_label as enum (
    'ollie', 'nollie', 'shove-it', 'pop-shove-it',
    'kickflip', 'heelflip', '180-front', '180-back',
    '360-front', '360-back', 'boardslide', '50-50',
    'unknown'
  );
exception when duplicate_object then null; end $$;

-- Enum for AI analysis state
do $$ begin
  create type ai_analysis_state as enum (
    'idle', 'capturing', 'analyzing', 'validated', 'failed'
  );
exception when duplicate_object then null; end $$;

-- Table: AI analysis sessions
create table if not exists public.skate_ai_sessions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.skate_matches(id) on delete cascade,
  turn_id uuid references public.skate_turns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  trick_requested text, -- trick name requested by AI or opponent
  state ai_analysis_state not null default 'idle',
  confidence_score real default 0.0, -- 0.0-1.0
  detected_trick trick_label default 'unknown',
  video_url text, -- URL to recorded clip
  duration_ms int, -- clip duration in milliseconds
  fps real, -- actual fps of processed stream
  started_at timestamptz default now(),
  completed_at timestamptz,
  metadata jsonb default '{}'::jsonb, -- extra analysis metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists skate_ai_sessions_match_idx on public.skate_ai_sessions (match_id);
create index if not exists skate_ai_sessions_turn_idx on public.skate_ai_sessions (turn_id);
create index if not exists skate_ai_sessions_user_idx on public.skate_ai_sessions (user_id);
create index if not exists skate_ai_sessions_state_idx on public.skate_ai_sessions (state);

-- Table: Keypoints per frame (skeleton data)
create table if not exists public.skate_ai_keypoints (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.skate_ai_sessions(id) on delete cascade,
  frame_index int not null, -- frame number in sequence
  timestamp_ms int not null, -- relative timestamp in ms from session start
  rider_keypoints jsonb not null, -- 2D keypoints from MoveNet/MediaPipe (17-33 points)
  board_keypoints jsonb, -- 4 keypoints: nose, tail, truck_left, truck_right (or null if not detected)
  board_angle_roll real, -- roll angle in degrees
  board_angle_pitch real, -- pitch angle in degrees
  board_angle_yaw real, -- yaw angle in degrees
  created_at timestamptz default now()
);

create index if not exists skate_ai_keypoints_session_idx on public.skate_ai_keypoints (session_id, frame_index);

-- Table: Temporal features (aggregated over sliding windows)
create table if not exists public.skate_ai_features (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.skate_ai_sessions(id) on delete cascade,
  window_start_frame int not null,
  window_end_frame int not null,
  window_duration_ms int not null,
  features_vector jsonb not null, -- normalized features: distances, angles, velocities, board vectors
  trick_prediction trick_label,
  prediction_confidence real default 0.0,
  created_at timestamptz default now()
);

create index if not exists skate_ai_features_session_idx on public.skate_ai_features (session_id, window_start_frame);

-- Table: Trick validation results (arbitrage IA)
create table if not exists public.skate_ai_validations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.skate_ai_sessions(id) on delete cascade,
  trick_requested text not null,
  trick_detected trick_label not null,
  is_valid boolean not null,
  validation_score real not null, -- composite score 0.0-1.0
  criteria jsonb not null, -- breakdown: {pop: bool, rotation: bool, catch: bool, stability: bool, ...}
  failure_reasons text[], -- if invalid, reasons why
  stability_duration_ms int, -- post-landing stability window
  rotation_angle_deg real, -- detected rotation (for flips/spins)
  foot_contact_count int, -- number of foot contacts post-rotation
  created_at timestamptz default now()
);

create index if not exists skate_ai_validations_session_idx on public.skate_ai_validations (session_id);

-- Table: Training dataset annotations (for future model improvements)
create table if not exists public.skate_ai_training_clips (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.skate_ai_sessions(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  video_url text not null,
  trick_label trick_label not null,
  is_success boolean not null, -- true = successful execution
  annotated_by uuid references auth.users(id), -- human annotator
  annotation_quality int check (annotation_quality between 1 and 5), -- 1=low, 5=expert
  phase_markers jsonb, -- {start_ms, peak_ms, landing_ms}
  board_angle_target jsonb, -- expected angles for trick
  foot_contacts jsonb, -- expected foot contact patterns
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists skate_ai_training_clips_label_idx on public.skate_ai_training_clips (trick_label, is_success);
create index if not exists skate_ai_training_clips_annotated_idx on public.skate_ai_training_clips (annotated_by);

-- Function to update updated_at timestamp
create or replace function public.set_skate_ai_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

-- Triggers for updated_at
drop trigger if exists skate_ai_sessions_updated_at on public.skate_ai_sessions;
create trigger skate_ai_sessions_updated_at
  before update on public.skate_ai_sessions
  for each row
  execute procedure public.set_skate_ai_updated_at();

drop trigger if exists skate_ai_training_clips_updated_at on public.skate_ai_training_clips;
create trigger skate_ai_training_clips_updated_at
  before update on public.skate_ai_training_clips
  for each row
  execute procedure public.set_skate_ai_updated_at();

-- RLS policies
alter table public.skate_ai_sessions enable row level security;
alter table public.skate_ai_keypoints enable row level security;
alter table public.skate_ai_features enable row level security;
alter table public.skate_ai_validations enable row level security;
alter table public.skate_ai_training_clips enable row level security;

-- Sessions: users can see their own, or participants in same match
do $$ begin
  create policy skate_ai_sessions_select on public.skate_ai_sessions
  for select using (
    auth.uid() = user_id or
    exists (
      select 1 from public.skate_matches m
      where m.id = session_id and (auth.uid() = m.player_a or auth.uid() = m.player_b)
    )
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy skate_ai_sessions_insert on public.skate_ai_sessions
  for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Keypoints, features, validations: inherit access from session
do $$ begin
  create policy skate_ai_keypoints_select on public.skate_ai_keypoints
  for select using (
    exists (select 1 from public.skate_ai_sessions s where s.id = session_id and (
      s.user_id = auth.uid() or
      exists (
        select 1 from public.skate_matches m
        where m.id = s.match_id and (auth.uid() = m.player_a or auth.uid() = m.player_b)
      )
    ))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy skate_ai_features_select on public.skate_ai_features
  for select using (
    exists (select 1 from public.skate_ai_sessions s where s.id = session_id and (
      s.user_id = auth.uid() or
      exists (
        select 1 from public.skate_matches m
        where m.id = s.match_id and (auth.uid() = m.player_a or auth.uid() = m.player_b)
      )
    ))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy skate_ai_validations_select on public.skate_ai_validations
  for select using (
    exists (select 1 from public.skate_ai_sessions s where s.id = session_id and (
      s.user_id = auth.uid() or
      exists (
        select 1 from public.skate_matches m
        where m.id = s.match_id and (auth.uid() = m.player_a or auth.uid() = m.player_b)
      )
    ))
  );
exception when duplicate_object then null; end $$;

-- Training clips: read for all authenticated, write for owners/annotators
do $$ begin
  create policy skate_ai_training_clips_select on public.skate_ai_training_clips
  for select using (auth.uid() is not null);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy skate_ai_training_clips_insert on public.skate_ai_training_clips
  for insert with check (auth.uid() is not null);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy skate_ai_training_clips_update on public.skate_ai_training_clips
  for update using (auth.uid() = annotated_by or auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Add AI judge flag to skate_turns
alter table public.skate_turns
add column if not exists ai_judge_enabled boolean default false,
add column if not exists ai_analysis_session_id uuid references public.skate_ai_sessions(id) on delete set null;

create index if not exists skate_turns_ai_session_idx on public.skate_turns (ai_analysis_session_id);







