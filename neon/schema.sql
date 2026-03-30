create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key,
  email text not null unique,
  password_hash text not null,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  emoji text not null default '📦',
  color text not null default '#555555',
  type text not null check (type in ('income','expense','both')),
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  description text not null,
  value numeric(12,2) not null,
  type text not null check (type in ('income','expense')),
  category text not null,
  rec_mode text not null check (rec_mode in ('once','installment','monthly')) default 'once',
  date date not null,
  total_parcelas int,
  dia_venc int,
  dur_months int,
  created_at timestamptz not null default now()
);

create table if not exists installments (
  id uuid primary key,
  transaction_id uuid not null references transactions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  n int not null,
  date date not null,
  value numeric(12,2) not null,
  paid boolean not null default false,
  rolled_over int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  transaction_id uuid references transactions(id) on delete cascade,
  installment_n int,
  description text not null,
  value numeric(12,2) not null,
  type text not null check (type in ('income','expense')),
  repeat text not null check (repeat in ('once','monthly','yearly')) default 'once',
  day int,
  date date,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists income_sources (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  value numeric(12,2) not null,
  day int not null,
  source_type text not null,
  start_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists goals (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  emoji text not null default '💰',
  current_value numeric(12,2) not null default 0,
  target_value numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_categories_user_id on categories(user_id);
create index if not exists idx_transactions_user_id on transactions(user_id);
create index if not exists idx_installments_user_id on installments(user_id);
create index if not exists idx_events_user_id on events(user_id);
create index if not exists idx_income_sources_user_id on income_sources(user_id);
create index if not exists idx_goals_user_id on goals(user_id);
