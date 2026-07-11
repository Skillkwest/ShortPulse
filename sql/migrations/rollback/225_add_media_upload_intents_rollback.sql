begin;

drop function if exists public.expire_media_upload_intent(uuid, uuid);
drop function if exists public.reject_media_upload_intent(
    uuid, uuid, text, text, text, text, bigint, text
);
drop function if exists public.finalize_media_upload_intent(
    uuid, uuid, text, text, text, bigint, text
);
drop function if exists public.claim_media_upload_intent(uuid, uuid, text, text);
drop function if exists public.reserve_media_upload_intent(
    uuid, text, text, text, text, bigint, text, text, text, text, integer
);

drop table if exists public.media_upload_intents;

delete from storage.buckets b
where b.id = 'media_upload_staging'
  and not exists (
      select 1 from storage.objects o where o.bucket_id = b.id
  );

commit;
