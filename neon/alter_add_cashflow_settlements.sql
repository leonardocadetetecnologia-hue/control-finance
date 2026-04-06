create table if not exists cashflow_settlements (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  transaction_id uuid references transactions(id) on delete cascade,
  income_source_id uuid references income_sources(id) on delete cascade,
  occurrence_date date not null,
  settled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (
    (transaction_id is not null and income_source_id is null)
    or (transaction_id is null and income_source_id is not null)
  )
);

create index if not exists idx_cashflow_settlements_user_id on cashflow_settlements(user_id);

create unique index if not exists idx_cashflow_settlements_transaction_occurrence
  on cashflow_settlements(transaction_id, occurrence_date)
  where transaction_id is not null;

create unique index if not exists idx_cashflow_settlements_income_occurrence
  on cashflow_settlements(income_source_id, occurrence_date)
  where income_source_id is not null;
