from __future__ import annotations

import unittest
import uuid
from pathlib import Path

from src.db import get_session
from src.project_store import (
    create_project,
    delete_project,
    get_project_by_slug,
    list_projects,
)
from src.style_profile import load_style_profile_text

ROOT = Path(__file__).resolve().parents[1]


class LoadStyleProfileTextTest(unittest.TestCase):
    def test_parses_mapping(self) -> None:
        profile = load_style_profile_text("page:\n  size: A4\n")
        self.assertEqual(profile, {"page": {"size": "A4"}})

    def test_rejects_non_mapping(self) -> None:
        with self.assertRaises(ValueError):
            load_style_profile_text("- just\n- a list\n")


class SeedFromFilesTest(unittest.TestCase):
    def test_seed_is_noop_when_projects_exist(self) -> None:
        from scripts.seed_from_files import seed_from_files

        slug = f"seed-guard-{uuid.uuid4().hex[:8]}"
        with get_session() as session:
            guard = create_project(
                session,
                name="Seed Guard",
                slug=slug,
                data={"meta": {"title": "guard"}},
                template_tz="# tz",
                template_pz="# pz",
                style_profile="page:\n  size: A4\n",
            )
            guard_id = guard.id
            before = {p.id for p in list_projects(session)}

        try:
            result = seed_from_files(ROOT)
            self.assertEqual(result, "already seeded")
            with get_session() as session:
                after = {p.id for p in list_projects(session)}
                self.assertEqual(after, before)
        finally:
            with get_session() as session:
                project = get_project_by_slug(session, slug)
                if project is not None and project.id == guard_id:
                    delete_project(session, project)

    def test_seed_inserts_default_when_empty(self) -> None:
        from scripts.seed_from_files import seed_from_files

        with get_session() as session:
            for project in list(list_projects(session)):
                delete_project(session, project)
            self.assertEqual(list_projects(session), [])

        result = seed_from_files(ROOT)
        self.assertEqual(result, "seeded")

        with get_session() as session:
            project = get_project_by_slug(session, "default")
            self.assertIsNotNone(project)
            assert project is not None
            self.assertEqual(project.slug, "default")
            self.assertEqual(project.name, "default")
            self.assertIsInstance(project.data, dict)
            self.assertIn("meta", project.data)
            self.assertTrue(project.template_tz)
            self.assertTrue(project.template_pz)
            self.assertTrue(project.style_profile)
            delete_project(session, project)


if __name__ == "__main__":
    unittest.main()
