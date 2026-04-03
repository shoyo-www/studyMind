alter table public.documents
  add column if not exists document_text text;
