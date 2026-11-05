-- Leanie backend schema (Supabase)
create table if not exists public.leanie_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  objective text not null,
  context text not null default '',
  outcome text not null default '',
  target_date text,
  budget text,
  resources text,
  status text not null default 'Analyzing'
    check (status in ('Draft','Analyzing','Plan ready','Validated')),
  phases jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  analysis jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leanie_projects_user_updated_idx
  on public.leanie_projects(user_id, updated_at desc);

alter table public.leanie_projects enable row level security;

create policy "Users can view their own Leanie projects"
  on public.leanie_projects for select
  using (auth.uid() = user_id);

create policy "Users can insert their own Leanie projects"
  on public.leanie_projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own Leanie projects"
  on public.leanie_projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own Leanie projects"
  on public.leanie_projects for delete
  using (auth.uid() = user_id);

create or replace function public.set_leanie_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leanie_projects_set_updated_at on public.leanie_projects;
create trigger leanie_projects_set_updated_at
  before update on public.leanie_projects
  for each row
  execute function public.set_leanie_updated_at();

create table if not exists public.leanie_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.leanie_projects(id) on delete cascade,
  format text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.leanie_exports enable row level security;

create policy "Users can view their own exports"
  on public.leanie_exports for select
  using (auth.uid() = user_id);

create policy "Users can insert their own exports"
  on public.leanie_exports for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own exports"
  on public.leanie_exports for delete
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('leanie-exports', 'leanie-exports', false)
on conflict (id) do nothing;

create policy "Users can read their exports"
  on storage.objects for select
  using (bucket_id = 'leanie-exports' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can upload their exports"
  on storage.objects for insert
  with check (bucket_id = 'leanie-exports' and auth.uid()::text = (storage.foldername(name))[1]);
