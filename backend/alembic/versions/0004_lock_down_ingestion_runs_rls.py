"""lock down ingestion_runs with rls"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("alter table ingestion_runs enable row level security")
    op.execute("drop policy if exists ingestion_runs_service_role_only on ingestion_runs")
    op.execute(
        """
        create policy ingestion_runs_service_role_only on ingestion_runs
        for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
        """
    )


def downgrade():
    op.execute("drop policy if exists ingestion_runs_service_role_only on ingestion_runs")
    op.execute("alter table ingestion_runs disable row level security")
