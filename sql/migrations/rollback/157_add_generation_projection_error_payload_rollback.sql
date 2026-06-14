-- Roll back durable raw error payload capture for failed generated-output detail views.

alter table if exists public.generation_projection
    drop column if exists error_payload;
