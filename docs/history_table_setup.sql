-- Ejecutar una sola vez en el SQL Editor de Supabase (proyecto nxgpiwrrydrpigijdnst)
-- Añade la tabla que sincroniza el Histórico de Liquidaciones (findes archivados) entre
-- dispositivos. Antes de esto, "Cerrar y Archivar Finde" solo guardaba en localStorage,
-- así que el histórico de un dispositivo nunca aparecía en los demás.

create table if not exists history (
  id text primary key,
  datelabel text,
  createdat timestamptz not null default now(),
  count int,
  weight numeric,
  money numeric,
  packages jsonb
);

alter table history enable row level security;

create policy "anon puede leer historico"
  on history for select
  to anon
  using (true);

create policy "anon puede insertar historico"
  on history for insert
  to anon
  with check (true);

create policy "anon puede actualizar historico"
  on history for update
  to anon
  using (true)
  with check (true);

create policy "anon puede borrar historico"
  on history for delete
  to anon
  using (true);
