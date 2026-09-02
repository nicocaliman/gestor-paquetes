-- Ejecutar una sola vez en el SQL Editor de Supabase (proyecto nxgpiwrrydrpigijdnst)
-- Añade las tablas para que las mejoras de prompt del agente semanal se puedan
-- aplicar directamente desde la app (Ajustes), sin pasar por Claude Code.

-- Config activa: una sola fila (id=1) con el prompt que está en uso ahora mismo.
-- Si esta tabla está vacía, la app usa el prompt por defecto embebido en GeminiService.js.
create table if not exists ocr_prompt_config (
  id int primary key default 1,
  prompt_text text not null,
  updated_at timestamptz not null default now(),
  constraint ocr_prompt_config_single_row check (id = 1)
);

alter table ocr_prompt_config enable row level security;

create policy "anon puede leer config activa"
  on ocr_prompt_config for select
  to anon
  using (true);

create policy "anon puede insertar config activa"
  on ocr_prompt_config for insert
  to anon
  with check (true);

create policy "anon puede actualizar config activa"
  on ocr_prompt_config for update
  to anon
  using (true)
  with check (true);

-- Sugerencias del agente semanal, pendientes de revisión en Ajustes > Gemini Vision.
create table if not exists ocr_prompt_suggestions (
  id bigint generated always as identity primary key,
  prompt_text text not null,
  summary text,
  corrections_count int default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table ocr_prompt_suggestions enable row level security;

create policy "anon puede leer sugerencias"
  on ocr_prompt_suggestions for select
  to anon
  using (true);

create policy "anon puede insertar sugerencias"
  on ocr_prompt_suggestions for insert
  to anon
  with check (true);

create policy "anon puede actualizar sugerencias"
  on ocr_prompt_suggestions for update
  to anon
  using (true)
  with check (true);
