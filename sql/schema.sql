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
-- Hisobotni yuborgan real Telegram foydalanuvchisi — "kim hisobot
-- yubormadi" eslatmasi shu ustunga tayanadi (ism matnini emas, aynan
-- yuboruvchini taqqoslaydi).
alter table daily_reports add column if not exists telegram_user_id bigint;

create index if not exists idx_daily_reports_chat_id on daily_reports (chat_id);
create index if not exists idx_daily_reports_created_at on daily_reports (created_at desc);
create index if not exists idx_daily_reports_telegram_user
  on daily_reports (chat_id, telegram_user_id);

-- Reaktsiya kelganda xabarni chat_id + message_id bo'yicha tez topish uchun.
create unique index if not exists idx_daily_reports_chat_message
  on daily_reports (chat_id, message_id)
  where message_id is not null;

-- ==========================================================================
-- Guruh a'zolari ro'yxati — "hisobot yubormaganlarga eslatma" funksiyasi
-- uchun. Bot guruhda birinchi marta xabar yozgan (yoki guruhga qo'shilgan)
-- har bir odamni shu jadvalga avtomatik yozadi. is_excluded = true bo'lgan
-- odamlar (masalan rahbarlar) eslatma xabarlarida tag QILINMAYDI — buni
-- botdagi /notag va /tagback buyruqlari orqali boshqarasiz.
-- ==========================================================================
create table if not exists group_members (
  chat_id bigint not null,
  user_id bigint not null,
  username text,
  full_name text,
  is_excluded boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create index if not exists idx_group_members_chat_id on group_members (chat_id);

-- ==========================================================================
-- Eski ma'lumotlarni saqlashda joy band qilmasligi uchun: 2 oydan katta
-- yozuvlarni avtomatik o'chirish. Buni /api/cleanup endpoint'i (Vercel Cron
-- orqali har kuni chaqiriladi) bajaradi — quyidagi funksiya SQL orqali ham
-- qo'lda ishga tushirish uchun qoldirilgan.
-- ==========================================================================
create or replace function delete_old_daily_reports() returns void as $$
  delete from daily_reports where created_at < now() - interval '2 months';
$$ language sql;
