-- Trackify: ein Dokument pro Zeile, jede Zeile gehört genau einem Nutzer.
create table if not exists public.docs (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.docs enable row level security;

create policy "docs: eigene lesen"   on public.docs for select using (auth.uid() = user_id);
create policy "docs: eigene anlegen" on public.docs for insert with check (auth.uid() = user_id);
create policy "docs: eigene ändern"  on public.docs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "docs: eigene löschen" on public.docs for delete using (auth.uid() = user_id);

-- Profil mit Anzeigenamen
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 40),
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: eigenes lesen"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: eigenes anlegen" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: eigenes ändern"  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Live-Synchronisation zwischen Geräten
alter publication supabase_realtime add table public.docs;
