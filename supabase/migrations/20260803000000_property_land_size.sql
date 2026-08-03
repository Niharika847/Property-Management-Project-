-- Land size, so an address lookup has somewhere to put it and owners can record
-- it by hand. Square metres, matching how Australian listings quote it.
alter table public.properties
  add column if not exists land_size numeric(10,2) check (land_size is null or land_size >= 0);
