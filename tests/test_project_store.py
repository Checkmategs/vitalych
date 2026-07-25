from __future__ import annotations

import time
import unittest
import uuid
from pathlib import Path

from src.db import get_session
from src.project_store import (
    SlugConflictError,
    activate_version,
    create_project,
    create_version,
    delete_project,
    delete_version,
    get_project,
    get_project_by_slug,
    get_version,
    list_projects,
    list_versions,
    load_seed_assets,
    slugify,
    update_project,
    update_version,
)

ROOT = Path(__file__).resolve().parents[1]


class SlugifyTest(unittest.TestCase):
    def test_slugify_lowercases_and_collapses(self) -> None:
        self.assertEqual(slugify("Hello World!!"), "hello-world")
        self.assertEqual(slugify("  Foo---Bar  "), "foo-bar")
        self.assertEqual(slugify("@@@"), "project")


class ProjectStoreTest(unittest.TestCase):
    def test_create_has_active_version_and_mutable_versions(self) -> None:
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
            self.assertIsNotNone(project.active_version_id)
            versions = list_versions(session, project_id)
            self.assertEqual(len(versions), 1)
            self.assertEqual(versions[0].id, project.active_version_id)
            self.assertEqual(versions[0].label, "Начальная")
            v0_id = versions[0].id

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
            self.assertEqual(len(list_versions(session, project_id)), 1)
            self.assertEqual(project.data["meta"]["title"], "v1")
            self.assertEqual(project.name, "Store Test Updated")
            self.assertGreaterEqual(project.updated_at, updated_before)

            active = get_version(session, project_id, project.active_version_id)  # type: ignore[arg-type]
            self.assertIsNotNone(active)
            assert active is not None
            self.assertEqual(active.data, {"meta": {"title": "v1"}})
            self.assertEqual(active.template_tz, "# tz1")

            # Snapshot without activating — then mutate active
            snap = create_version(
                session, project, label="snap-v1", activate=False
            )
            self.assertEqual(snap.data["meta"]["title"], "v1")
            self.assertEqual(project.active_version_id, v0_id)

            update_project(
                session,
                project,
                data={"meta": {"title": "v2"}},
                template_tz="# tz2",
                template_pz="# pz2",
                style_profile="page:\n  size: Letter\n",
            )
            self.assertEqual(len(list_versions(session, project_id)), 2)
            self.assertEqual(project.data["meta"]["title"], "v2")
            snap_reload = get_version(session, project_id, snap.id)
            assert snap_reload is not None
            self.assertEqual(snap_reload.data["meta"]["title"], "v1")

            activated = activate_version(session, project, snap_reload)
            self.assertEqual(activated.data["meta"]["title"], "v1")
            self.assertEqual(activated.active_version_id, snap.id)

            # Mutate only the non-active version
            other = create_version(
                session,
                project,
                label="other",
                data={"meta": {"title": "isolated"}},
                template_tz="# iso",
                template_pz="# iso",
                style_profile="page:\n  size: A4\n",
                activate=False,
            )
            update_version(
                session,
                other,
                data={"meta": {"title": "isolated-2"}},
            )
            project_reload = get_project(session, project_id)
            assert project_reload is not None
            self.assertEqual(project_reload.data["meta"]["title"], "v1")
            other_reload = get_version(session, project_id, other.id)
            assert other_reload is not None
            self.assertEqual(other_reload.data["meta"]["title"], "isolated-2")

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
            self.assertEqual(len(list_versions(session, project_id)), 3)

    def test_soft_delete_project_and_version(self) -> None:
        suffix = uuid.uuid4().hex[:8]
        slug = f"soft-{suffix}"
        payload = {
            "data": {"meta": {"title": "a"}},
            "template_tz": "# tz",
            "template_pz": "# pz",
            "style_profile": "page:\n  size: A4\n",
        }
        with get_session() as session:
            project = create_project(session, name="Soft", slug=slug, **payload)
            project_id = project.id
            v1_id = project.active_version_id
            assert v1_id is not None
            version = create_version(session, project, label="keep-me", activate=False)
            version_id = version.id

        with get_session() as session:
            project = get_project(session, project_id)
            self.assertIsNotNone(project)
            assert project is not None
            version = get_version(session, project_id, version_id)
            self.assertIsNotNone(version)
            assert version is not None
            delete_version(session, version)

        with get_session() as session:
            self.assertIsNone(get_version(session, project_id, version_id))
            self.assertEqual(len(list_versions(session, project_id)), 1)
            from sqlalchemy import select
            from src.models import ProjectVersion

            raw = session.scalar(select(ProjectVersion).where(ProjectVersion.id == version_id))
            self.assertIsNotNone(raw)
            assert raw is not None
            self.assertIsNotNone(raw.deleted_at)

            project = get_project(session, project_id)
            self.assertIsNotNone(project)
            assert project is not None
            self.assertEqual(project.active_version_id, v1_id)
            delete_project(session, project)

        with get_session() as session:
            self.assertIsNone(get_project(session, project_id))
            self.assertFalse(any(p.id == project_id for p in list_projects(session)))
            from sqlalchemy import select
            from src.models import Project, ProjectVersion

            raw_p = session.scalar(select(Project).where(Project.id == project_id))
            self.assertIsNotNone(raw_p)
            assert raw_p is not None
            self.assertIsNotNone(raw_p.deleted_at)

            again = create_project(session, name="Soft Again", slug=slug, **payload)
            self.assertEqual(again.slug, slug)
            delete_project(session, again)

    def test_delete_active_version_activates_newest_remaining(self) -> None:
        suffix = uuid.uuid4().hex[:8]
        payload = {
            "data": {"meta": {"title": "a"}},
            "template_tz": "# tz",
            "template_pz": "# pz",
            "style_profile": "page:\n  size: A4\n",
        }
        with get_session() as session:
            project = create_project(
                session, name="Del Active", slug=f"del-act-{suffix}", **payload
            )
            project_id = project.id
            first_id = project.active_version_id
            assert first_id is not None
            second = create_version(
                session,
                project,
                label="second",
                data={"meta": {"title": "b"}},
                activate=True,
            )
            second_id = second.id
            self.assertEqual(project.active_version_id, second_id)
            delete_version(session, second)
            self.assertEqual(project.active_version_id, first_id)
            self.assertEqual(project.data["meta"]["title"], "a")
            delete_project(session, project)
            _ = project_id

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

    def test_update_version_bumps_updated_at_and_list_order(self) -> None:
        suffix = uuid.uuid4().hex[:8]
        payload = {
            "data": {"meta": {"title": "a"}},
            "template_tz": "# tz",
            "template_pz": "# pz",
            "style_profile": "page:\n  size: A4\n",
        }
        with get_session() as session:
            project = create_project(
                session, name="Time", slug=f"time-{suffix}", **payload
            )
            initial_id = project.active_version_id
            assert initial_id is not None
            create_version(session, project, label="later", activate=True)

            initial = get_version(session, project.id, initial_id)
            assert initial is not None
            before = initial.updated_at
            time.sleep(0.02)
            update_version(
                session, initial, data={"meta": {"title": "touched"}}
            )
            initial_reload = get_version(session, project.id, initial_id)
            assert initial_reload is not None
            self.assertGreater(initial_reload.updated_at, before)

            listed_after = list_versions(session, project.id)
            self.assertEqual(listed_after[0].id, initial_id)

            delete_project(session, project)


if __name__ == "__main__":
    unittest.main()
