-- Add a narrow source/user/time index for admin stats telemetry reads.
--
-- The admin global/growth stats RPCs read a small set of telemetry sources
-- from the append-only app_error_events table. Keep the index limited to those
-- sources so operator dashboards avoid full table scans without indexing the
-- whole incident stream.

create index concurrently if not exists ix_app_error_events_admin_stats_source_user_occurred
    on public.app_error_events (source, user_id, occurred_at)
    where source in (
        'telemetry.ai_studio.generate_clicked',
        'telemetry.billing.pricing_viewed',
        'telemetry.billing.upgrade_clicked',
        'telemetry.billing.checkout_started',
        'telemetry.billing.checkout_completed'
    );

analyze public.app_error_events;
