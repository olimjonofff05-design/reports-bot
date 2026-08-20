-- Supabase SQL Editor'da ishga tushiring (mavjud loyihangizga qo'shiladi).

create table if not exists daily_reports (
  id bigint generated always as identity primary key,
  chat_id bigint not null,
  message_id bigint,
  employee_name text,
  conversations_count integer default 0,
  topic_text text,
  raw_text text,
  reacted boolean not null default false,
  reaction_types text,
  created_at timestamptz not null default now()
);

-- Bot avval deploy qilingan bo'lsa ham (jadval allaqachon mavjud), shu
-- ALTER'lar yangi ustunlarni xavfsiz qo'shadi — eski ma'lumotlar o'chmaydi.
alter table daily_reports add column if not exists message_id bigint;
alter table daily_reports add column if not exists reacted boolean not null default false;
alter table daily_reports add column if not exists reaction_types text;

create index if not exists idx_daily_reports_chat_id on daily_reports (chat_id);
create index if not exists idx_daily_reports_created_at on daily_reports (created_at desc);

-- Reaktsiya kelganda xabarni chat_id + message_id bo'yicha tez topish uchun.
create unique index if not exists idx_daily_reports_chat_message
  on daily_reports (chat_id, message_id)
  where message_id is not null;

-- ==========================================================================
-- Eski ma'lumotlarni saqlashda joy band qilmasligi uchun: 2 oydan katta
-- yozuvlarni avtomatik o'chirish. Buni /api/cleanup endpoint'i (Vercel Cron
-- orqali har kuni chaqiriladi) bajaradi — quyidagi funksiya SQL orqali ham
-- qo'lda ishga tushirish uchun qoldirilgan.
-- ==========================================================================
create or replace function delete_old_daily_reports() returns void as $$
  delete from daily_reports where created_at < now() - interval '2 months';
$$ language sql;
