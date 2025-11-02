create table if not exists spots (
  id        text primary key,
  name      text not null,
  address   text,
  latitude  real,
  longitude real
);

create table if not exists spot_media (
  id             text primary key default (hex(randomblob(16))),
  spot_id        text not null references spots(id) on delete cascade,
  media_url      text not null,
  media_type     text not null default 'photo',
  is_cover_photo integer not null default 0,
  created_at     text not null default (datetime('now'))
);

create table if not exists spot_ratings (
  id         text primary key default (hex(randomblob(16))),
  spot_id    text not null references spots(id) on delete cascade,
  user_id    text not null,
  rating     integer not null check (rating between 1 and 5),
  comment    text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create unique index if not exists spot_ratings_spot_user_uniq
  on spot_ratings (spot_id, user_id);
