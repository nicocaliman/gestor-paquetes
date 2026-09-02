-- Ejecutar una sola vez en el SQL Editor de Supabase (proyecto nxgpiwrrydrpigijdnst)
-- Crea la tabla donde se registran las correcciones del OCR (lo que leyó Gemini vs. lo que el usuario guardó finalmente).
-- El agente semanal la lee para detectar errores recurrentes y sugerir mejoras al prompt de GeminiService.js.

create table if not exists ocr_corrections (
  id bigint generated always as identity primary key,
  campo text not null,
  valor_ocr text,
  valor_corregido text,
  created_at timestamptz not null default now()
);

alter table ocr_corrections enable row level security;

create policy "anon puede insertar correcciones"
  on ocr_corrections for insert
  to anon
  with check (true);

create policy "anon puede leer correcciones"
  on ocr_corrections for select
  to anon
  using (true);
