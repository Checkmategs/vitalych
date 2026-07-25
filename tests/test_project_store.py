from __future__ import annotations

import time
import unittest
import uuid
from pathlib import Path

from src.db import get_session
from src.project_store import (
    SlugConflictError,
    create_project,
    create_version,
    delete_project,
    get_project,
    get_project_by_slug,
    list_projects,
    list_versions,
    load_seed_assets,
    restore_version,
    slugify,
    update_project,
)

ROOT = Path(__file__).resolve().parents[1]


class SlugifyTest(unittest.TestCase):
    def test_slugify_lowercases_and_collapses(self) -> None:
        self.assertEqual(slugify("Hello World!!"), "hello-world")
        self.assertEqual(slugify("  Foo---Bar  "), "foo-bar")
        self.assertEqual(slugify("@@@"), "project")


class ProjectStoreTest(unittest.TestCase):
    def test_create_update_does_not_version_checkpoint_restore_and_slug_conflict(self) -> None:
        suffix = uuid.uuid4().hex[:8]
        slug = f"store-{suffix}"
        data0 = {"meta": {"title": "v0"}}
        tz0, pz0, style0 = "# tz0", "# pz0", "page:\n  size: A4\n"

        with get_session() as session:
            project = create_project(
                session,
                name="Store Test",
                slug=slug,
                data=data0,
                template_tz=tz0,
                template_pz=pz0,
                style_profile=style0,
            )
            project_id = project.id

        with get_session() as session:
            project = get_project(session, project_id)
            self.assertIsNotNone(project)
            assert project is not None
            self.assertEqual(project.slug, slug)
            by_slug = get_project_by_slug(session, slug)
            self.assertIsNotNone(by_slug)
            assert by_slug is not None
            self.assertEqual(by_slug.id, project_id)
            self.assertTrue(any(p.id == project_id for p in list_projects(session)))

            updated_before = project.updated_at
            time.sleep(0.05)
            update_project(
                session,
                project,
                data={"meta": {"title": "v1"}},
                template_tz="# tz1",
                template_pz="# pz1",
                style_profile="page:\n  size: A3\n",
                name="Store Test Updated",
            )
            self.assertEqual(len(list_versions(session, project_id)), 0)
            self.assertEqual(project.data["meta"]["title"], "v1")
            self.assertEqual(project.name, "Store Test Updated")
            self.assertGreaterEqual(project.updated_at, updated_before)

            version = create_version(session, project, label="checkpoint-1", note="after v1")
            versions = list_versions(session, project_id)
            self.assertEqual(len(versions), 1)
            self.assertEqual(versions[0].id, version.id)
            self.assertEqual(version.label, "checkpoint-1")
            self.assertEqual(version.note, "after v1")
            self.assertEqual(version.data, {"meta": {"title": "v1"}})
            self.assertEqual(version.template_tz, "# tz1")
            self.assertEqual(version.template_pz, "# pz1")
            self.assertEqual(version.style_profile, "page:\n  size: A3\n")

            update_project(
                session,
                project,
                data={"meta": {"title": "v2"}},
                template_tz="# tz2",
                template_pz="# pz2",
                style_profile="page:\n  size: Letter\n",
            )
            self.assertEqual(len(list_versions(session, project_id)), 1)
            self.assertEqual(project.data["meta"]["title"], "v2")

            restored = restore_version(session, project, version)
            self.assertEqual(restored.data, {"meta": {"title": "v1"}})
            self.assertEqual(restored.template_tz, "# tz1")
            self.assertEqual(restored.template_pz, "# pz1")
            self.assertEqual(restored.style_profile, "page:\n  size: A3\n")
            self.assertEqual(len(list_versions(session, project_id)), 1)

        with get_session() as session:
            with self.assertRaises(SlugConflictError):
                create_project(
                    session,
                    name="Conflict",
                    slug=slug,
                    data={"meta": {"title": "x"}},
                    template_tz="# tz",
                    template_pz="# pz",
                    style_profile="page:\n  size: A4\n",
                )

        with get_session() as session:
            project = get_project(session, project_id)
            self.assertIsNotNone(project)
            assert project is not None
            delete_project(session, project)

        with get_session() as session:
            self.assertIsNone(get_project(session, project_id))
            self.assertEqual(list_versions(session, project_id), [])

    def test_create_auto_slug_appends_suffix_on_collision(self) -> None:
        base_name = f"Auto Slug {uuid.uuid4().hex[:8]}"
        payload = {
            "data": {"meta": {"title": "a"}},
            "template_tz": "# tz",
            "template_pz": "# pz",
            "style_profile": "page:\n  size: A4\n",
        }
        with get_session() as session:
            first = create_project(session, name=base_name, slug=None, **payload)
            second = create_project(session, name=base_name, slug=None, **payload)
            self.assertEqual(first.slug, slugify(base_name))
            self.assertNotEqual(second.slug, first.slug)
            self.assertTrue(second.slug.startswith(first.slug))
            delete_project(session, first)
            delete_project(session, second)

    def test_load_seed_assets(self) -> None:
        data, template_tz, template_pz, style_profile = load_seed_assets(ROOT)
        self.assertIsInstance(data, dict)
        self.assertIn("meta", data)
        self.assertIsInstance(template_tz, str)
        self.assertTrue(template_tz)
        self.assertIsInstance(template_pz, str)
        self.assertTrue(template_pz)
        self.assertIsInstance(style_profile, str)
        self.assertTrue(style_profile)


if __name__ == "__main__":
    unittest.main()
