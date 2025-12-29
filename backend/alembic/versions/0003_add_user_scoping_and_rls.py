"""add user scoping and rls"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    sentinel_user = sa.text("'00000000-0000-0000-0000-000000000000'::uuid")

    op.add_column(
        "reels_raw_events",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sentinel_user),
    )
    op.add_column(
        "reels_latest_state",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sentinel_user),
    )

    op.alter_column("reels_raw_events", "user_id", server_default=None)
    op.alter_column("reels_latest_state", "user_id", server_default=None)

    op.drop_constraint("uq_reel_scrape_run", "reels_raw_events", type_="unique")
    op.create_unique_constraint("uq_reel_scrape_run", "reels_raw_events", ["user_id", "reel_id", "scraped_at", "apify_run_id"])

    op.drop_index("ix_reels_raw_events_reel_id_publish", table_name="reels_raw_events")
    op.drop_index("ix_reels_raw_events_scraped_at", table_name="reels_raw_events")
    op.drop_index("ix_reels_raw_events_publish_time", table_name="reels_raw_events")
    op.create_index("ix_reels_raw_events_reel_id_publish", "reels_raw_events", ["user_id", "reel_id", "publish_time"])
    op.create_index("ix_reels_raw_events_scraped_at", "reels_raw_events", ["user_id", "scraped_at"])
    op.create_index("ix_reels_raw_events_publish_time", "reels_raw_events", ["user_id", "publish_time"])

    op.drop_constraint("reels_latest_state_pkey", "reels_latest_state", type_="primary")
    op.create_primary_key("reels_latest_state_pkey", "reels_latest_state", ["user_id", "reel_id"])

    op.drop_index("ix_reels_latest_state_publish_time", table_name="reels_latest_state")
    op.create_index("ix_reels_latest_state_publish_time", "reels_latest_state", ["user_id", "publish_time"])

    op.execute("alter table reels_raw_events enable row level security")
    op.execute("drop policy if exists select_reels_raw_events_isolation on reels_raw_events")
    op.execute(
        "create policy select_reels_raw_events_isolation on reels_raw_events for select using (user_id = auth.uid())"
    )
    op.execute("drop policy if exists modify_reels_raw_events_isolation on reels_raw_events")
    op.execute(
        "create policy modify_reels_raw_events_isolation on reels_raw_events for all using (user_id = auth.uid()) with check (user_id = auth.uid())"
    )

    op.execute("alter table reels_latest_state enable row level security")
    op.execute("drop policy if exists select_reels_latest_state_isolation on reels_latest_state")
    op.execute(
        "create policy select_reels_latest_state_isolation on reels_latest_state for select using (user_id = auth.uid())"
    )
    op.execute("drop policy if exists modify_reels_latest_state_isolation on reels_latest_state")
    op.execute(
        "create policy modify_reels_latest_state_isolation on reels_latest_state for all using (user_id = auth.uid()) with check (user_id = auth.uid())"
    )


def downgrade():
    op.execute("drop policy if exists modify_reels_latest_state_isolation on reels_latest_state")
    op.execute("drop policy if exists select_reels_latest_state_isolation on reels_latest_state")
    op.execute("alter table reels_latest_state disable row level security")

    op.execute("drop policy if exists modify_reels_raw_events_isolation on reels_raw_events")
    op.execute("drop policy if exists select_reels_raw_events_isolation on reels_raw_events")
    op.execute("alter table reels_raw_events disable row level security")

    op.drop_index("ix_reels_latest_state_publish_time", table_name="reels_latest_state")
    op.create_index("ix_reels_latest_state_publish_time", "reels_latest_state", ["publish_time"])
    op.drop_constraint("reels_latest_state_pkey", "reels_latest_state", type_="primary")
    op.create_primary_key("reels_latest_state_pkey", "reels_latest_state", ["reel_id"])
    op.drop_column("reels_latest_state", "user_id")

    op.drop_index("ix_reels_raw_events_reel_id_publish", table_name="reels_raw_events")
    op.drop_index("ix_reels_raw_events_scraped_at", table_name="reels_raw_events")
    op.drop_index("ix_reels_raw_events_publish_time", table_name="reels_raw_events")
    op.create_index("ix_reels_raw_events_reel_id_publish", "reels_raw_events", ["reel_id", "publish_time"])
    op.create_index("ix_reels_raw_events_scraped_at", "reels_raw_events", ["scraped_at"])
    op.create_index("ix_reels_raw_events_publish_time", "reels_raw_events", ["publish_time"])

    op.drop_constraint("uq_reel_scrape_run", "reels_raw_events", type_="unique")
    op.create_unique_constraint("uq_reel_scrape_run", "reels_raw_events", ["reel_id", "scraped_at", "apify_run_id"])

    op.drop_column("reels_raw_events", "user_id")
