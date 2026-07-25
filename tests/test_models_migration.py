from __future__ import annotations
import unittest
import uuid
from sqlalchemy import select
from src.db import get_engine, get_session
from src.models import Project

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
