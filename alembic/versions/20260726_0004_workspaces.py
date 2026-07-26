"""workspaces table and projects.workspace_id

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-26

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

LOCAL_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001"


def upgrade() -> None:
    op.create_table(
        "workspaces",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.execute(
        f"INSERT INTO workspaces (id, name) VALUES ('{LOCAL_WORKSPACE_ID}', 'Local')"
    )
    op.add_column(
        "projects",
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute(f"UPDATE projects SET workspace_id = '{LOCAL_WORKSPACE_ID}'")
    op.alter_column("projects", "workspace_id", nullable=False)
    op.create_foreign_key(
        "fk_projects_workspace_id",
        "projects",
        "workspaces",
        ["workspace_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_projects_workspace_id", "projects", ["workspace_id"])


def downgrade() -> None:
    op.drop_index("ix_projects_workspace_id", table_name="projects")
    op.drop_constraint("fk_projects_workspace_id", "projects", type_="foreignkey")
    op.drop_column("projects", "workspace_id")
    op.drop_table("workspaces")
