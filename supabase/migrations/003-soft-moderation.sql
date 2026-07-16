-- Мягкая модерация: скрытые кадры не попадают в публичную галерею,
-- но остаются в базе и Storage, чтобы администратор мог их восстановить.
alter table photos
  add column if not exists hidden_at timestamptz;
