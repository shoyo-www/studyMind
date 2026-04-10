alter table public.quizzes
  add column if not exists language text not null default 'en'
    check (language in ('en', 'hi'));

create index if not exists quizzes_user_document_language_type_created_at_idx
  on public.quizzes (user_id, document_id, language, type, created_at desc);

update public.quizzes
set language = 'en'
where language is null;
