-- =====================================================================
-- Ative Hub · estrutura do banco no Supabase
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.
-- Pode ser executado de novo sem perder dados (usa IF NOT EXISTS).
--
-- Desenho pronto para vários clientes (SaaS): cada registro pertence a
-- uma organização (empresa cliente), e cada usuário só enxerga os dados
-- das organizações de que é membro.
-- =====================================================================

-- Organizações: cada empresa que usa o sistema
create table if not exists public.organizacoes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  criado_em   timestamptz not null default now()
);

-- Membros: quem pode acessar cada organização
create table if not exists public.membros (
  org_id      uuid not null references public.organizacoes(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  papel       text not null default 'membro' check (papel in ('admin','membro')),
  criado_em   timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists membros_user_idx on public.membros(user_id);

-- Registros: todos os dados do sistema (clientes, orçamentos, projetos, lançamentos...)
-- "colecao" é o tipo de registro e "dados" guarda o registro completo em JSON.
create table if not exists public.registros (
  org_id          uuid not null references public.organizacoes(id) on delete cascade,
  colecao         text not null,
  id              text not null,
  dados           jsonb not null,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid default auth.uid(),
  primary key (org_id, colecao, id)
);
create index if not exists registros_org_colecao_idx on public.registros(org_id, colecao);

create or replace function public.tocar_registro() returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;
drop trigger if exists registros_tocar on public.registros;
create trigger registros_tocar before insert or update on public.registros
  for each row execute function public.tocar_registro();

-- ---------------------------------------------------------------------
-- Funções de apoio (security definer: rodam com permissão do dono, para
-- as regras de acesso não precisarem consultar "membros" em recursão)
-- ---------------------------------------------------------------------
create or replace function public.eh_membro(p_org uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.membros where org_id = p_org and user_id = auth.uid())
$$;

create or replace function public.eh_admin(p_org uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.membros where org_id = p_org and user_id = auth.uid() and papel = 'admin')
$$;

-- Cria uma organização e torna quem chamou o administrador dela
create or replace function public.criar_organizacao(p_nome text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null then raise exception 'É preciso estar logado.'; end if;
  if coalesce(trim(p_nome),'') = '' then raise exception 'Informe o nome da empresa.'; end if;
  insert into public.organizacoes(nome) values (trim(p_nome)) returning id into v_org;
  insert into public.membros(org_id, user_id, papel) values (v_org, auth.uid(), 'admin');
  return v_org;
end $$;

-- O administrador dá acesso a um usuário já criado em Authentication > Users
create or replace function public.adicionar_membro(p_org uuid, p_email text, p_papel text default 'membro') returns void
  language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.eh_admin(p_org) then raise exception 'Só o administrador da empresa pode adicionar pessoas.'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'Usuário % não encontrado. Crie-o antes em Authentication > Users.', p_email; end if;
  insert into public.membros(org_id, user_id, papel) values (p_org, v_user, coalesce(p_papel,'membro'))
    on conflict (org_id, user_id) do update set papel = excluded.papel;
end $$;

revoke all on function public.criar_organizacao(text) from public, anon;
revoke all on function public.adicionar_membro(uuid, text, text) from public, anon;
grant execute on function public.criar_organizacao(text) to authenticated;
grant execute on function public.adicionar_membro(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Regras de acesso (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.organizacoes enable row level security;
alter table public.membros      enable row level security;
alter table public.registros    enable row level security;

drop policy if exists org_ler on public.organizacoes;
create policy org_ler on public.organizacoes for select to authenticated using (public.eh_membro(id));
drop policy if exists org_editar on public.organizacoes;
create policy org_editar on public.organizacoes for update to authenticated using (public.eh_admin(id)) with check (public.eh_admin(id));

drop policy if exists membros_ler on public.membros;
create policy membros_ler on public.membros for select to authenticated using (public.eh_membro(org_id));
drop policy if exists membros_remover on public.membros;
create policy membros_remover on public.membros for delete to authenticated using (public.eh_admin(org_id));

drop policy if exists registros_ler on public.registros;
create policy registros_ler on public.registros for select to authenticated using (public.eh_membro(org_id));
drop policy if exists registros_incluir on public.registros;
create policy registros_incluir on public.registros for insert to authenticated with check (public.eh_membro(org_id));
drop policy if exists registros_alterar on public.registros;
create policy registros_alterar on public.registros for update to authenticated using (public.eh_membro(org_id)) with check (public.eh_membro(org_id));
drop policy if exists registros_excluir on public.registros;
create policy registros_excluir on public.registros for delete to authenticated using (public.eh_membro(org_id));

grant select, insert, update, delete on public.registros to authenticated;
grant select, update on public.organizacoes to authenticated;
grant select, delete on public.membros to authenticated;

-- ---------------------------------------------------------------------
-- Tempo real: avisa os outros usuários quando um registro muda
-- ---------------------------------------------------------------------
alter table public.registros replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'registros') then
    alter publication supabase_realtime add table public.registros;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Arquivos (plantas, documentos, vias assinadas): bucket privado "anexos"
-- Cada arquivo fica numa pasta com o id da organização: <org_id>/...
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('anexos', 'anexos', false)
  on conflict (id) do nothing;

drop policy if exists anexos_ler on storage.objects;
create policy anexos_ler on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and public.eh_membro(((storage.foldername(name))[1])::uuid));
drop policy if exists anexos_enviar on storage.objects;
create policy anexos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and public.eh_membro(((storage.foldername(name))[1])::uuid));
drop policy if exists anexos_alterar on storage.objects;
create policy anexos_alterar on storage.objects for update to authenticated
  using (bucket_id = 'anexos' and public.eh_membro(((storage.foldername(name))[1])::uuid));
drop policy if exists anexos_apagar on storage.objects;
create policy anexos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and public.eh_membro(((storage.foldername(name))[1])::uuid));
