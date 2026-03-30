-- Seed de categorias padrão ao criar nova conta
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.categories (user_id, name, emoji, color, type) values
    (new.id, 'Salário',       '💼', '#00e676', 'income'),
    (new.id, 'Freelance',     '💻', '#00e5ff', 'income'),
    (new.id, 'Investimento',  '📈', '#00e676', 'income'),
    (new.id, 'Alimentação',   '🍔', '#ff9100', 'expense'),
    (new.id, 'Transporte',    '🚗', '#00e5ff', 'expense'),
    (new.id, 'Lazer',         '🎬', '#b388ff', 'expense'),
    (new.id, 'Saúde',         '💊', '#ff3d57', 'expense'),
    (new.id, 'Moradia',       '🏠', '#ff9100', 'expense'),
    (new.id, 'Aluguel',       '🏠', '#ff9100', 'expense'),
    (new.id, 'Financiamento', '🏦', '#ff9100', 'expense'),
    (new.id, 'Cartão',        '💳', '#b388ff', 'expense'),
    (new.id, 'Assinatura',    '🔁', '#00e5ff', 'expense'),
    (new.id, 'Outros',        '📦', '#555555', 'both');
  return new;
end;
$$;

-- Trigger que executa a função ao criar usuário
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
