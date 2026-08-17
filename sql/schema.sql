-- Supabase SQL Editor'da ishga tushiring (mavjud loyihangizga qo'shiladi).

create table if not exists daily_reports (
  id bigint generated always as identity primary key,
  chat_id bigint not null,
  employee_name text,
  conversations_count integer default 0,
  topic_text text,
  raw_text text,
  created_at timestamptz not null default now()
);

create index if not exists idx_daily_reports_chat_id on daily_reports (chat_id);
create index if not exists idx_daily_reports_created_at on daily_reports (created_at desc);
