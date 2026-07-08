-- Миграция 002: размеры превью в photos — галерея резервирует место до загрузки картинки (нет прыжков вёрстки).
-- Выполнить в Supabase SQL Editor.

alter table photos
  add column if not exists width int,
  add column if not exists height int;

-- Старая сигнатура удаляется, иначе останутся две перегрузки и RPC станет неоднозначным.
drop function if exists claim_photo_slot(uuid, text, text);

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
