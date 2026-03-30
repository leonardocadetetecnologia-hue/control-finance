-- Extensões
create extension if not exists "uuid-ossp";

-- CATEGORIAS
create table if not exists categories (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users on delete cascade not null,
  name       text not null,
  emoji      text not null default '📦',
  color      text not null default '#555555',
  type       text not null check (type in ('income','expense','both')),
  created_at timestamptz default now()
);

-- TRANSAÇÕES
create table if not exists transactions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users on delete cascade not null,
  description     text not null,
  value           numeric(12,2) not null,
  type            text not null check (type in ('income','expense')),
  category        text not null,
  rec_mode        text not null check (rec_mode in ('once','installment','monthly')) default 'once',
  date            date not null,
  total_parcelas  int,
  dia_venc        int,
  dur_months      int,
  created_at      timestamptz default now()
);

-- PARCELAS
create table if not exists installments (
  id             uuid primary key default uuid_generate_v4(),
  transaction_id uuid references transactions on delete cascade not null,
  user_id        uuid references auth.users on delete cascade not null,
  n              int not null,
  date           date not null,
  value          numeric(12,2) not null,
  paid           boolean default false,
  rolled_over    int default 0,
  created_at     timestamptz default now()
);

-- EVENTOS DE CALENDÁRIO
create table if not exists events (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid references auth.users on delete cascade not null,
  transaction_id uuid references transactions on delete cascade,
  installment_n  int,
  description    text not null,
  value          numeric(12,2) not null,
  type           text not null check (type in ('income','expense')),
  repeat         text not null check (repeat in ('once','monthly','yearly')) default 'once',
  day            int,
  date           date,
  category       text,
  created_at     timestamptz default now()
);

-- FONTES DE RENDA
create table if not exists income_sources (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users on delete cascade not null,
  name        text not null,
  value       numeric(12,2) not null,
  day         int not null,
  source_type text not null,
  start_date  date not null,
  created_at  timestamptz default now()
);

-- METAS
create table if not exists goals (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users on delete cascade not null,
  name          text not null,
  emoji         text default '💰',
  current_value numeric(12,2) default 0,
  target_value  numeric(12,2) not null,
  created_at    timestamptz default now()
);
