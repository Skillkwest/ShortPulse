-- Restore dashboard announcement publish RPC execute posture.
-- The admin announcements route calls this RPC with the service-role client; public
-- and browser roles must not execute it directly.

revoke all on function public.publish_dashboard_announcement(text, text, uuid) from public;
revoke all on function public.publish_dashboard_announcement(text, text, uuid) from anon;
revoke all on function public.publish_dashboard_announcement(text, text, uuid) from authenticated;
grant execute on function public.publish_dashboard_announcement(text, text, uuid) to service_role;
