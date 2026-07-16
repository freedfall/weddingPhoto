create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 50),
  created_at timestamptz not null default now()
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  storage_path text not null,
  thumb_path text not null,
  width int,
  height int,
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists photos_guest_id_idx on photos (guest_id);

-- Доступ только через service role: RLS включён, политик нет.
alter table guests enable row level security;
alter table photos enable row level security;

create or replace function claim_photo_slot(
  p_guest_id uuid,
  p_storage_path text,
  p_thumb_path text,
  p_width int default null,
  p_height int default null
) returns table (photo_id uuid, photos_used int)
language plpgsql
as $$
declare
  v_id uuid;
  v_used int;
begin
  perform 1 from guests where id = p_guest_id for update;
  if not found then
    raise exception 'guest_not_found';
  end if;

  select count(*) into v_used from photos where guest_id = p_guest_id;
  if v_used >= 10 then
    raise exception 'limit_reached';
  end if;

  insert into photos (guest_id, storage_path, thumb_path, width, height)
  values (p_guest_id, p_storage_path, p_thumb_path, p_width, p_height)
  returning id into v_id;

  return query select v_id, v_used + 1;
end;
$$;

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;
