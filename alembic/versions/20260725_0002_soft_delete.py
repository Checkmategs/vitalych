"""soft delete deleted_at

Revision ID: a1b2c3d4e5f6
Revises: 8857b0637bb6
Create Date: 2026-07-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "8857b0637bb6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("project_versions", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.drop_constraint("uq_projects_slug", "projects", type_="unique")
    op.create_index(
        "uq_projects_slug_alive",
        "projects",
        ["slug"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_projects_slug_alive", table_name="projects")
    op.create_unique_constraint("uq_projects_slug", "projects", ["slug"])
    op.drop_column("project_versions", "deleted_at")
    op.drop_column("projects", "deleted_at")
