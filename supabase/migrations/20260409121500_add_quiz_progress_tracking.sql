alter table public.quizzes
  add column if not exists answers jsonb not null default '[]'::jsonb,
  add column if not exists current_index integer not null default 0
    check (current_index >= 0);

update public.quizzes
set
  answers = coalesce(answers, '[]'::jsonb),
  current_index = greatest(coalesce(current_index, 0), 0)
where
  answers is null
  or current_index is null
  or current_index < 0;
