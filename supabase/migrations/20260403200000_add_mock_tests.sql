-- Migration: Mock Test tables
-- Run in: Supabase Dashboard → SQL Editor

-- ── Table 1: mock_tests ───────────────────────────────────────────
-- Stores the generated question paper
CREATE TABLE IF NOT EXISTS public.mock_tests (
  id                    uuid         PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id               uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_id           uuid         NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  title                 text         NOT NULL,
  subject               text,
  duration_minutes      integer      NOT NULL DEFAULT 180,
  total_marks           integer      NOT NULL DEFAULT 100,
  questions             jsonb        NOT NULL DEFAULT '[]',
  status                text         NOT NULL DEFAULT 'ready'
                          CHECK (status IN ('generating', 'ready', 'failed')),
  generated_with_model  text,
  created_at            timestamptz  NOT NULL DEFAULT now()
);

-- ── Table 2: mock_test_submissions ───────────────────────────────
-- Stores user written answers + AI marking result
CREATE TABLE IF NOT EXISTS public.mock_test_submissions (
  id               uuid         PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id          uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mock_test_id     uuid         NOT NULL REFERENCES public.mock_tests(id) ON DELETE CASCADE,
  answers          jsonb        NOT NULL DEFAULT '[]',
  analysis         jsonb,
  total_marks      integer,
  marks_obtained   integer,
  percentage       numeric(5,2),
  time_taken_secs  integer      DEFAULT 0,
  submitted_at     timestamptz  NOT NULL DEFAULT now(),
  analysed_at      timestamptz
);

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mock_tests_user     ON public.mock_tests(user_id);
CREATE INDEX IF NOT EXISTS idx_mock_tests_document ON public.mock_tests(document_id);
CREATE INDEX IF NOT EXISTS idx_mock_subs_user      ON public.mock_test_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_mock_subs_test      ON public.mock_test_submissions(mock_test_id);

-- ── Row Level Security ────────────────────────────────────────────
ALTER TABLE public.mock_tests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_test_submissions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mock_tests_select"  ON public.mock_tests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mock_tests_insert"  ON public.mock_tests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mock_tests_update"  ON public.mock_tests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "mock_tests_delete"  ON public.mock_tests FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "mock_subs_select"   ON public.mock_test_submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mock_subs_insert"   ON public.mock_test_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add grade column to submissions if not already present (safe to re-run)
ALTER TABLE public.mock_test_submissions
  ADD COLUMN IF NOT EXISTS grade text;
