-- Roll back Elements library foundational schema.

drop trigger if exists trg_element_media_assets_updated_at on public.element_media_assets;
drop trigger if exists trg_element_reference_sets_updated_at on public.element_reference_sets;
drop trigger if exists trg_elements_updated_at on public.elements;
drop function if exists public.set_elements_library_updated_at();

drop table if exists public.element_media_assets;
drop table if exists public.element_reference_sets;
drop table if exists public.elements;
