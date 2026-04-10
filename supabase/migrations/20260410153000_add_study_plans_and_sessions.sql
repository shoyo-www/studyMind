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

create index if not exists study_plans_user_id_created_at_idx
  on public.study_plans (user_id, created_at desc);

create index if not exists study_plans_document_id_created_at_idx
  on public.study_plans (document_id, created_at desc);

create index if not exists study_sessions_user_id_created_at_idx
  on public.study_sessions (user_id, created_at desc);

create index if not exists study_sessions_plan_day_idx
  on public.study_sessions (study_plan_id, day_number);

alter table public.study_plans enable row level security;
alter table public.study_sessions enable row level security;

do $$
begin
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
end $$;
