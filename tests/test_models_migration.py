from __future__ import annotations
import unittest
import uuid
from sqlalchemy import select
from src.db import get_engine, get_session
from src.models import Project, ProjectVersion

class ModelsMigrationTest(unittest.TestCase):
    def test_insert_project_row(self) -> None:
        pid = uuid.uuid4()
        with get_session() as s:
            s.add(Project(
                id=pid,
                slug=f"t-{pid.hex[:8]}",
                name="Test",
                data={"meta": {"title": "x"}},
                template_tz="# tz",
                template_pz="# pz",
                style_profile="page:\n  size: A4\n",
            ))
        with get_session() as s:
            row = s.scalar(select(Project).where(Project.id == pid))
            self.assertIsNotNone(row)
            self.assertEqual(row.data["meta"]["title"], "x")

    def test_project_and_version_have_deleted_at(self) -> None:
        from datetime import datetime, timezone
        from src.models import ProjectVersion

        pid = uuid.uuid4()
        vid = uuid.uuid4()
        now = datetime.now(timezone.utc)
        with get_session() as s:
            s.add(Project(
                id=pid,
                slug=f"sd-{pid.hex[:8]}",
                name="Soft",
                data={"meta": {"title": "x"}},
                template_tz="# tz",
                template_pz="# pz",
                style_profile="page:\n  size: A4\n",
                deleted_at=now,
            ))
            s.add(ProjectVersion(
                id=vid,
                project_id=pid,
                label="v1",
                note=None,
                data={"meta": {"title": "x"}},
                template_tz="# tz",
                template_pz="# pz",
                style_profile="page:\n  size: A4\n",
                deleted_at=now,
            ))
        with get_session() as s:
            project = s.scalar(select(Project).where(Project.id == pid))
            self.assertIsNotNone(project)
            assert project is not None
            self.assertIsNotNone(project.deleted_at)
            version = s.scalar(select(ProjectVersion).where(ProjectVersion.id == vid))
            self.assertIsNotNone(version)
            assert version is not None
            self.assertIsNotNone(version.deleted_at)
            self.assertIsNotNone(version.updated_at)

    def test_active_version_id_column(self) -> None:
        pid = uuid.uuid4()
        vid = uuid.uuid4()
        with get_session() as s:
            s.add(Project(
                id=pid,
                slug=f"av-{pid.hex[:8]}",
                name="Active",
                data={"meta": {"title": "x"}},
                template_tz="# tz",
                template_pz="# pz",
                style_profile="page:\n  size: A4\n",
            ))
            s.flush()
            s.add(ProjectVersion(
                id=vid,
                project_id=pid,
                label="v1",
                note=None,
                data={"meta": {"title": "x"}},
                template_tz="# tz",
                template_pz="# pz",
                style_profile="page:\n  size: A4\n",
            ))
            s.flush()
            project = s.get(Project, pid)
            assert project is not None
            project.active_version_id = vid
        with get_session() as s:
            project = s.get(Project, pid)
            self.assertIsNotNone(project)
            assert project is not None
            self.assertEqual(project.active_version_id, vid)
