alter table public.quizzes
  drop constraint if exists quizzes_requested_count_check;

alter table public.quizzes
  add constraint quizzes_requested_count_check
    check (requested_count between 1 and 50);
