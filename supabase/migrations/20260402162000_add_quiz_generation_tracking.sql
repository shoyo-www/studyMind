-- ============================================================
-- Add quiz generation tracking and model metadata
-- ============================================================

alter table public.quizzes
  add column if not exists status text not null default 'ready'
    check (status in ('pending', 'ready', 'failed')),
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'auto_upload')),
  add column if not exists error_message text,
  add column if not exists requested_count integer not null default 10
    check (requested_count between 1 and 20),
  add column if not exists generated_with_model text,
  add column if not exists generation_started_at timestamptz,
  add column if not exists generation_completed_at timestamptz;

create index if not exists quizzes_user_document_status_created_at_idx
  on public.quizzes (user_id, document_id, status, created_at desc);

update public.quizzes
set
  status = coalesce(status, 'ready'),
  source = coalesce(source, 'manual'),
  requested_count = coalesce(requested_count, greatest(1, least(20, jsonb_array_length(questions))))
where
  status is distinct from coalesce(status, 'ready')
  or source is distinct from coalesce(source, 'manual')
  or requested_count is null;
