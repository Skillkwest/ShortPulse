-- Roll back media_library bucket-level size/MIME guardrails.
-- This preserves the private bucket and existing storage object policies.

update storage.buckets
set
    public = false,
    file_size_limit = null,
    allowed_mime_types = null
where id = 'media_library';
