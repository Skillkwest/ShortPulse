-- Roll back private screenshot evidence for signed-in customer issue reports.

revoke all on function public.create_user_issue_report_with_screenshots(
    uuid,
    text,
    text,
    text,
    text,
    jsonb
) from public;
revoke all on function public.create_user_issue_report_with_screenshots(
    uuid,
    text,
    text,
    text,
    text,
    jsonb
) from anon;
revoke all on function public.create_user_issue_report_with_screenshots(
    uuid,
    text,
    text,
    text,
    text,
    jsonb
) from authenticated;
revoke all on function public.create_user_issue_report_with_screenshots(
    uuid,
    text,
    text,
    text,
    text,
    jsonb
) from service_role;

drop function if exists public.create_user_issue_report_with_screenshots(
    uuid,
    text,
    text,
    text,
    text,
    jsonb
);

drop table if exists public.user_issue_report_screenshots;

delete from storage.buckets
 where id = 'issue_report_screenshots'
   and not exists (
       select 1
         from storage.objects
        where bucket_id = 'issue_report_screenshots'
   );
