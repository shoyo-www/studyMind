-- ============================================================
-- StudyMind — Supabase Database Schema
-- Source of truth also lives in supabase/migrations/.
-- ============================================================

create extension if not exists "uuid-ossp" with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'institute')),
  uploads_this_month integer not null default 0 check (uploads_this_month >= 0),
  messages_today integer not null default 0 check (messages_today >= 0),
  messages_reset_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  subject text,
  storage_path text not null unique,
  total_pages integer not null default 0 check (total_pages >= 0),
  summary text,
  document_text text,
  topics jsonb not null default '[]'::jsonb,
  file_size bigint,
  mime_type text,
  pct_covered integer not null default 0 check (pct_covered between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.quizzes (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  language text not null default 'en' check (language in ('en', 'hi')),
  topic text,
  type text not null default 'mcq' check (type in ('mcq', 'truefalse', 'flashcard')),
  questions jsonb not null default '[]'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  current_index integer not null default 0 check (current_index >= 0),
  score integer,
  attempted boolean not null default false,
  status text not null default 'ready' check (status in ('pending', 'ready', 'failed')),
  source text not null default 'manual' check (source in ('manual', 'auto_upload')),
  error_message text,
  requested_count integer not null default 10 check (requested_count between 1 and 50),
  generated_with_model text,
  generation_started_at timestamptz,
  generation_completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mock_tests (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  title text not null,
  subject text,
  duration_minutes integer not null default 180,
  total_marks integer not null default 100,
  questions jsonb not null default '[]'::jsonb,
  status text not null default 'ready' check (status in ('generating', 'ready', 'failed')),
  generated_with_model text,
  created_at timestamptz not null default now()
);

create table if not exists public.mock_test_submissions (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mock_test_id uuid not null references public.mock_tests(id) on delete cascade,
  answers jsonb not null default '[]'::jsonb,
  analysis jsonb,
  total_marks integer,
  marks_obtained integer,
  percentage numeric(5,2),
  time_taken_secs integer default 0,
  submitted_at timestamptz not null default now(),
  analysed_at timestamptz
);

create table if not exists public.study_plans (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  analysis jsonb not null default '{}'::jsonb,
  roadmap jsonb not null default '{"totalDays":0,"days":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, document_id)
);

create table if not exists public.study_sessions (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  study_plan_id uuid not null references public.study_plans(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  day_number integer not null check (day_number >= 1),
  mission_topics jsonb not null default '[]'::jsonb,
  mission jsonb not null default '{}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  quick_quiz_score integer check (quick_quiz_score between 0 and 100),
  mini_test_score integer check (mini_test_score between 0 and 100),
  overall_score integer check (overall_score between 0 and 100),
  mastery_status text check (mastery_status in ('WEAK', 'IMPROVING', 'STRONG')),
  feedback jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (study_plan_id, day_number)
);

create index if not exists documents_user_id_created_at_idx
  on public.documents (user_id, created_at desc);

create index if not exists messages_user_id_created_at_idx
  on public.messages (user_id, created_at desc);

create index if not exists messages_document_id_created_at_idx
  on public.messages (document_id, created_at desc);

create index if not exists quizzes_user_id_created_at_idx
  on public.quizzes (user_id, created_at desc);

create index if not exists quizzes_document_id_created_at_idx
  on public.quizzes (document_id, created_at desc);

create index if not exists quizzes_user_document_status_created_at_idx
  on public.quizzes (user_id, document_id, status, created_at desc);

create index if not exists mock_tests_user_id_created_at_idx
  on public.mock_tests (user_id, created_at desc);

create index if not exists mock_tests_document_id_created_at_idx
  on public.mock_tests (document_id, created_at desc);

create index if not exists mock_test_submissions_user_id_created_at_idx
  on public.mock_test_submissions (user_id, submitted_at desc);

create index if not exists mock_test_submissions_test_id_created_at_idx
  on public.mock_test_submissions (mock_test_id, submitted_at desc);

create index if not exists study_plans_user_id_created_at_idx
  on public.study_plans (user_id, created_at desc);

create index if not exists study_plans_document_id_created_at_idx
  on public.study_plans (document_id, created_at desc);

create index if not exists study_sessions_user_id_created_at_idx
  on public.study_sessions (user_id, created_at desc);

create index if not exists study_sessions_plan_day_idx
  on public.study_sessions (study_plan_id, day_number);

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.messages enable row level security;
alter table public.quizzes enable row level security;
alter table public.mock_tests enable row level security;
alter table public.mock_test_submissions enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_sessions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can view own profile'
  ) then
    create policy "Users can view own profile"
      on public.profiles
      for select
      to authenticated
      using ((select auth.uid()) = id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can update own profile'
  ) then
    create policy "Users can update own profile"
      on public.profiles
      for update
      to authenticated
      using ((select auth.uid()) = id)
      with check ((select auth.uid()) = id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'documents'
      and policyname = 'Users can view own documents'
  ) then
    create policy "Users can view own documents"
      on public.documents
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'documents'
      and policyname = 'Users can insert own documents'
  ) then
    create policy "Users can insert own documents"
      on public.documents
      for insert
      to authenticated
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'documents'
      and policyname = 'Users can delete own documents'
  ) then
    create policy "Users can delete own documents"
      on public.documents
      for delete
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'messages'
      and policyname = 'Users can view own messages'
  ) then
    create policy "Users can view own messages"
      on public.messages
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'messages'
      and policyname = 'Users can insert own messages'
  ) then
    create policy "Users can insert own messages"
      on public.messages
      for insert
      to authenticated
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'quizzes'
      and policyname = 'Users can view own quizzes'
  ) then
    create policy "Users can view own quizzes"
      on public.quizzes
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'quizzes'
      and policyname = 'Users can insert own quizzes'
  ) then
    create policy "Users can insert own quizzes"
      on public.quizzes
      for insert
      to authenticated
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'study_plans'
      and policyname = 'Users can view own study plans'
  ) then
    create policy "Users can view own study plans"
      on public.study_plans
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'study_plans'
      and policyname = 'Users can insert own study plans'
  ) then
    create policy "Users can insert own study plans"
      on public.study_plans
      for insert
      to authenticated
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'study_plans'
      and policyname = 'Users can update own study plans'
  ) then
    create policy "Users can update own study plans"
      on public.study_plans
      for update
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'study_sessions'
      and policyname = 'Users can view own study sessions'
  ) then
    create policy "Users can view own study sessions"
      on public.study_sessions
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'study_sessions'
      and policyname = 'Users can insert own study sessions'
  ) then
    create policy "Users can insert own study sessions"
      on public.study_sessions
      for insert
      to authenticated
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'study_sessions'
      and policyname = 'Users can update own study sessions'
  ) then
    create policy "Users can update own study sessions"
      on public.study_sessions
      for update
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'quizzes'
      and policyname = 'Users can update own quizzes'
  ) then
    create policy "Users can update own quizzes"
      on public.quizzes
      for update
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'mock_tests'
      and policyname = 'Users can view own mock tests'
  ) then
    create policy "Users can view own mock tests"
      on public.mock_tests
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'mock_tests'
      and policyname = 'Users can insert own mock tests'
  ) then
    create policy "Users can insert own mock tests"
      on public.mock_tests
      for insert
      to authenticated
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'mock_tests'
      and policyname = 'Users can update own mock tests'
  ) then
    create policy "Users can update own mock tests"
      on public.mock_tests
      for update
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'mock_tests'
      and policyname = 'Users can delete own mock tests'
  ) then
    create policy "Users can delete own mock tests"
      on public.mock_tests
      for delete
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'mock_test_submissions'
      and policyname = 'Users can view own mock test submissions'
  ) then
    create policy "Users can view own mock test submissions"
      on public.mock_test_submissions
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'mock_test_submissions'
      and policyname = 'Users can insert own mock test submissions'
  ) then
    create policy "Users can insert own mock test submissions"
      on public.mock_test_submissions
      for insert
      to authenticated
      with check ((select auth.uid()) = user_id);
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

insert into public.profiles (id, email, full_name, avatar_url)
select
  users.id,
  users.email,
  coalesce(users.raw_user_meta_data ->> 'full_name', users.raw_user_meta_data ->> 'name'),
  users.raw_user_meta_data ->> 'avatar_url'
from auth.users as users
on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update
  set name = excluded.name,
      public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users upload to own folder'
  ) then
    create policy "Users upload to own folder"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'documents'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users read own files'
  ) then
    create policy "Users read own files"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'documents'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users delete own files'
  ) then
    create policy "Users delete own files"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'documents'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end
$$;
