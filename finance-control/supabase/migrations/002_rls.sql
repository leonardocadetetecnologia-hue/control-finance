-- Habilitar RLS em todas as tabelas
alter table categories     enable row level security;
alter table transactions   enable row level security;
alter table installments   enable row level security;
alter table events         enable row level security;
alter table income_sources enable row level security;
alter table goals          enable row level security;

-- CATEGORIES
create policy "owner_categories" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- TRANSACTIONS
create policy "owner_transactions" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- INSTALLMENTS
create policy "owner_installments" on installments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- EVENTS
create policy "owner_events" on events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- INCOME SOURCES
create policy "owner_income_sources" on income_sources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- GOALS
create policy "owner_goals" on goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
