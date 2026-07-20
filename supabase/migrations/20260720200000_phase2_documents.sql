-- Phase 2: documents + receipt storage (design spec §7, §9).
-- Uploaded files land in a private storage bucket; the documents row carries
-- OCR/extraction output and links to the expense the AI files.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  type text not null default 'receipt'
    check (type in ('receipt', 'invoice', 'statement', 'lease', 'other')),
  file_name text not null,
  storage_path text not null,
  mime text,
  size_bytes bigint,
  ocr_status text not null default 'pending'
    check (ocr_status in ('pending', 'processing', 'done', 'failed')),
  extracted jsonb,
  expense_id uuid references public.expenses (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists documents_workspace_idx on public.documents (workspace_id, created_at desc);
create index if not exists documents_property_idx on public.documents (property_id);

alter table public.documents enable row level security;

create policy "documents: member all" on public.documents
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ── Private storage bucket for receipts/invoices ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Objects are keyed under the workspace id: "<workspace_id>/<uuid>.<ext>".
-- Access is granted to members of that workspace (first path segment).
create policy "receipts: member read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );
create policy "receipts: member insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );
create policy "receipts: member delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );
