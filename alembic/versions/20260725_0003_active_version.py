"""active_version_id and version updated_at

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-25

"""
from __future__ import annotations

import json
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "project_versions",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.add_column(
        "projects",
        sa.Column("active_version_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_projects_active_version_id",
        "projects",
        "project_versions",
        ["active_version_id"],
        ["id"],
        ondelete="SET NULL",
    )

    conn = op.get_bind()
    projects = conn.execute(
        sa.text(
            """
            SELECT id, data, template_tz, template_pz, style_profile
            FROM projects
            WHERE deleted_at IS NULL
            """
        )
    ).mappings().all()

    for row in projects:
        pid = row["id"]
        existing = conn.execute(
            sa.text(
                """
                SELECT id FROM project_versions
                WHERE project_id = :pid AND deleted_at IS NULL
                ORDER BY created_at DESC
                LIMIT 1
                """
            ),
            {"pid": pid},
        ).first()
        if existing:
            vid = existing[0]
        else:
            vid = uuid.uuid4()
            data = row["data"]
            if not isinstance(data, str):
                data = json.dumps(data)
            conn.execute(
                sa.text(
                    """
                    INSERT INTO project_versions (
                        id, project_id, label, note, data,
                        template_tz, template_pz, style_profile, created_at, updated_at
                    ) VALUES (
                        :vid, :pid, 'Начальная', NULL, CAST(:data AS jsonb),
                        :tz, :pz, :style, now(), now()
                    )
                    """
                ),
                {
                    "vid": vid,
                    "pid": pid,
                    "data": data,
                    "tz": row["template_tz"],
                    "pz": row["template_pz"],
                    "style": row["style_profile"],
                },
            )
        conn.execute(
            sa.text(
                "UPDATE projects SET active_version_id = :vid WHERE id = :pid"
            ),
            {"vid": vid, "pid": pid},
        )


def downgrade() -> None:
    op.drop_constraint("fk_projects_active_version_id", "projects", type_="foreignkey")
    op.drop_column("projects", "active_version_id")
    op.drop_column("project_versions", "updated_at")
