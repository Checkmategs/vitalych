"""API tests for Postgres project-scoped routes (disposable projects only)."""

from __future__ import annotations

import unittest
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient

from api.main import app
from src.db import get_session
from src.project_store import delete_project, get_project


class ApiProjectsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        self.created_ids: list[str] = []

    def tearDown(self) -> None:
        for pid in self.created_ids:
            try:
                with get_session() as session:
                    project = get_project(session, uuid.UUID(pid))
                    if project is not None:
                        delete_project(session, project)
            except Exception:
                pass

    def _track(self, project_id: str) -> str:
        self.created_ids.append(project_id)
        return project_id

    def test_create_get_put_version_restore_render_download(self) -> None:
        suffix = uuid.uuid4().hex[:8]
        name = f"API Flow {suffix}"
        slug = f"api-flow-{suffix}"

        create = self.client.post("/api/projects", json={"name": name, "slug": slug})
        self.assertEqual(create.status_code, 200, create.text)
        body = create.json()
        project_id = self._track(body["id"])
        self.assertEqual(body["slug"], slug)
        self.assertEqual(body["name"], name)
        self.assertIn("data", body)
        self.assertIn("template_tz", body)
        self.assertIn("template_pz", body)
        self.assertIn("style_profile", body)
        self.assertIn("created_at", body)
        self.assertIn("updated_at", body)
        self.assertIsNotNone(body.get("active_version_id"))
        initial_version_id = body["active_version_id"]

        got = self.client.get(f"/api/projects/{project_id}")
        self.assertEqual(got.status_code, 200)
        self.assertEqual(got.json()["id"], project_id)
        self.assertEqual(got.json()["slug"], slug)
        self.assertEqual(got.json()["active_version_id"], initial_version_id)

        listed = self.client.get("/api/projects")
        self.assertEqual(listed.status_code, 200)
        items = listed.json()
        self.assertTrue(any(i["id"] == project_id for i in items))
        item = next(i for i in items if i["id"] == project_id)
        self.assertEqual(set(item.keys()), {"id", "slug", "name", "updated_at"})

        data_v1 = {**got.json()["data"], "meta": {**(got.json()["data"].get("meta") or {}), "title": "v1"}}
        put1 = self.client.put(
            f"/api/projects/{project_id}",
            json={
                "data": data_v1,
                "template_tz": got.json()["template_tz"],
                "template_pz": got.json()["template_pz"],
                "style_profile": got.json()["style_profile"],
                "name": name,
            },
        )
        self.assertEqual(put1.status_code, 200, put1.text)
        self.assertEqual(put1.json()["data"]["meta"]["title"], "v1")

        versions0 = self.client.get(f"/api/projects/{project_id}/versions")
        self.assertEqual(versions0.status_code, 200)
        self.assertEqual(len(versions0.json()), 1)
        self.assertEqual(versions0.json()[0]["label"], "Начальная")
        self.assertIn("updated_at", versions0.json()[0])

        # Second PUT must not create another version.
        put1b = self.client.put(f"/api/projects/{project_id}", json={"data": data_v1})
        self.assertEqual(put1b.status_code, 200, put1b.text)
        versions0b = self.client.get(f"/api/projects/{project_id}/versions")
        self.assertEqual(len(versions0b.json()), 1)

        # Snapshot without activating so later PUT mutates only the active version.
        ver = self.client.post(
            f"/api/projects/{project_id}/versions",
            json={"label": "checkpoint-1", "note": "after v1", "activate": False},
        )
        self.assertEqual(ver.status_code, 200, ver.text)
        version_id = ver.json()["id"]
        self.assertEqual(ver.json()["label"], "checkpoint-1")
        self.assertIn("created_at", ver.json())
        self.assertEqual(ver.json()["data"]["meta"]["title"], "v1")

        data_v2 = {**data_v1, "meta": {**data_v1["meta"], "title": "v2"}}
        put2 = self.client.put(f"/api/projects/{project_id}", json={"data": data_v2})
        self.assertEqual(put2.status_code, 200, put2.text)
        self.assertEqual(put2.json()["data"]["meta"]["title"], "v2")
        versions_after_put2 = self.client.get(f"/api/projects/{project_id}/versions")
        self.assertEqual(len(versions_after_put2.json()), 2)

        got_snap = self.client.get(f"/api/projects/{project_id}/versions/{version_id}")
        self.assertEqual(got_snap.status_code, 200)
        self.assertEqual(got_snap.json()["data"]["meta"]["title"], "v1")

        activate = self.client.post(
            f"/api/projects/{project_id}/versions/{version_id}/activate"
        )
        self.assertEqual(activate.status_code, 200, activate.text)
        self.assertEqual(activate.json()["data"]["meta"]["title"], "v1")
        self.assertEqual(activate.json()["active_version_id"], version_id)

        # Mutate active version via PUT version; mirror updates too.
        put_ver = self.client.put(
            f"/api/projects/{project_id}/versions/{version_id}",
            json={
                "data": {**data_v1, "meta": {**data_v1["meta"], "title": "v1-edited"}},
                "template_tz": "## edited\n",
            },
        )
        self.assertEqual(put_ver.status_code, 200, put_ver.text)
        self.assertEqual(put_ver.json()["data"]["meta"]["title"], "v1-edited")
        got_after = self.client.get(f"/api/projects/{project_id}")
        self.assertEqual(got_after.json()["data"]["meta"]["title"], "v1-edited")
        self.assertEqual(got_after.json()["template_tz"], "## edited\n")

        restore = self.client.post(
            f"/api/projects/{project_id}/versions/{initial_version_id}/restore"
        )
        self.assertEqual(restore.status_code, 200, restore.text)
        self.assertEqual(restore.json()["active_version_id"], initial_version_id)
        self.assertEqual(restore.json()["data"]["meta"]["title"], "v2")

        # Ensure renderable templates for DOCX smoke (seed templates may need system.*)
        renderable = {
            "data": {
                "system": {"name": "API Render", "short_name": "AR"},
                "meta": {"title": "v1"},
            },
            "template_tz": "## 1. Общие сведения\n{{ system.name }}\n",
            "template_pz": "## 1. Общие положения\n{{ system.name }}\n",
            "style_profile": (
                "page:\n  size: A4\nstyles:\n  Normal:\n"
                "    font_name: Times New Roman\n    font_size_pt: 12\n"
            ),
        }
        put_r = self.client.put(f"/api/projects/{project_id}", json=renderable)
        self.assertEqual(put_r.status_code, 200, put_r.text)

        rendered = self.client.post(
            f"/api/projects/{project_id}/render",
            json={"template": "tz", "format": "docx"},
        )
        self.assertEqual(rendered.status_code, 200, rendered.text)
        written = rendered.json()["written"]
        self.assertTrue(any(w.endswith(f"{slug}/tz.docx") or w.endswith("tz.docx") for w in written))

        dl = self.client.get(f"/api/projects/{project_id}/download/tz.docx")
        self.assertEqual(dl.status_code, 200, dl.text)
        self.assertIn(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            dl.headers.get("content-type", ""),
        )
        self.assertGreater(len(dl.content), 100)

        # Reject non-docx; traversal segments ("..") are also blocked in the handler.
        bad_ext = self.client.get(f"/api/projects/{project_id}/download/tz.md")
        self.assertEqual(bad_ext.status_code, 400)
        bad_dots = self.client.get(f"/api/projects/{project_id}/download/..tz.docx")
        self.assertEqual(bad_dots.status_code, 400)

        deleted = self.client.delete(f"/api/projects/{project_id}")
        self.assertEqual(deleted.status_code, 200)
        self.created_ids.remove(project_id)
        missing = self.client.get(f"/api/projects/{project_id}")
        self.assertEqual(missing.status_code, 404)

    def test_missing_project_and_version_404(self) -> None:
        missing_id = str(uuid.uuid4())
        self.assertEqual(self.client.get(f"/api/projects/{missing_id}").status_code, 404)
        self.assertEqual(
            self.client.put(f"/api/projects/{missing_id}", json={"data": {}}).status_code,
            404,
        )
        self.assertEqual(self.client.delete(f"/api/projects/{missing_id}").status_code, 404)
        self.assertEqual(
            self.client.get(f"/api/projects/{missing_id}/versions").status_code,
            404,
        )
        self.assertEqual(
            self.client.post(f"/api/projects/{missing_id}/versions", json={}).status_code,
            404,
        )
        self.assertEqual(
            self.client.post(
                f"/api/projects/{missing_id}/versions/{uuid.uuid4()}/restore"
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.delete(
                f"/api/projects/{missing_id}/versions/{uuid.uuid4()}"
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.post(f"/api/projects/{missing_id}/render", json={}).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(f"/api/projects/{missing_id}/download/tz.docx").status_code,
            404,
        )

        suffix = uuid.uuid4().hex[:8]
        create = self.client.post(
            "/api/projects",
            json={"name": f"API 404 {suffix}", "slug": f"api-404-{suffix}"},
        )
        self.assertEqual(create.status_code, 200, create.text)
        project_id = self._track(create.json()["id"])
        self.assertEqual(
            self.client.post(
                f"/api/projects/{project_id}/versions/{uuid.uuid4()}/restore"
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.delete(
                f"/api/projects/{project_id}/versions/{uuid.uuid4()}"
            ).status_code,
            404,
        )

    def test_soft_delete_version_and_project(self) -> None:
        suffix = uuid.uuid4().hex[:8]
        slug = f"api-soft-{suffix}"
        create = self.client.post(
            "/api/projects",
            json={"name": f"API Soft {suffix}", "slug": slug},
        )
        self.assertEqual(create.status_code, 200, create.text)
        project_id = create.json()["id"]
        # Do not _track for final assert on slug reuse cleanup path — track then untrack after delete
        self._track(project_id)

        # Create an extra version (activate=False), then soft-delete it.
        ver = self.client.post(
            f"/api/projects/{project_id}/versions",
            json={"label": "extra", "activate": False},
        )
        self.assertEqual(ver.status_code, 200, ver.text)
        version_id = ver.json()["id"]

        deleted_v = self.client.delete(
            f"/api/projects/{project_id}/versions/{version_id}"
        )
        self.assertEqual(deleted_v.status_code, 200)
        self.assertTrue(deleted_v.json()["ok"])
        self.assertIsNotNone(deleted_v.json().get("active_version_id"))

        listed = self.client.get(f"/api/projects/{project_id}/versions")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.json()), 1)
        self.assertEqual(listed.json()[0]["label"], "Начальная")

        again_v = self.client.delete(
            f"/api/projects/{project_id}/versions/{version_id}"
        )
        self.assertEqual(again_v.status_code, 404)

        restore = self.client.post(
            f"/api/projects/{project_id}/versions/{version_id}/restore"
        )
        self.assertEqual(restore.status_code, 404)

        deleted_p = self.client.delete(f"/api/projects/{project_id}")
        self.assertEqual(deleted_p.status_code, 200)
        self.assertEqual(deleted_p.json(), {"ok": True})
        self.created_ids.remove(project_id)

        self.assertEqual(self.client.get(f"/api/projects/{project_id}").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/projects/{project_id}").status_code, 404)

        # Slug reusable
        recreate = self.client.post(
            "/api/projects",
            json={"name": f"API Soft Re {suffix}", "slug": slug},
        )
        self.assertEqual(recreate.status_code, 200, recreate.text)
        self._track(recreate.json()["id"])

    def test_duplicate_slug_409(self) -> None:
        suffix = uuid.uuid4().hex[:8]
        slug = f"api-dup-{suffix}"
        first = self.client.post("/api/projects", json={"name": "Dup A", "slug": slug})
        self.assertEqual(first.status_code, 200, first.text)
        self._track(first.json()["id"])
        second = self.client.post("/api/projects", json={"name": "Dup B", "slug": slug})
        self.assertEqual(second.status_code, 409, second.text)

    def test_create_integrity_error_409(self) -> None:
        from sqlalchemy.exc import IntegrityError

        with patch(
            "api.main.create_project",
            side_effect=IntegrityError("stmt", {}, Exception("unique slug")),
        ):
            create = self.client.post(
                "/api/projects",
                json={"name": "Race", "slug": f"api-race-{uuid.uuid4().hex[:8]}"},
            )
        self.assertEqual(create.status_code, 409, create.text)
        self.assertNotEqual(create.status_code, 503)
        self.assertNotIn("Database unavailable", create.text)

    def test_health_reports_db(self) -> None:
        health = self.client.get("/api/health")
        self.assertEqual(health.status_code, 200)
        body = health.json()
        self.assertTrue(body["ok"])
        self.assertTrue(body["db"])

    def test_db_unavailable_503(self) -> None:
        with patch("api.main._db_up", return_value=False):
            health = self.client.get("/api/health")
            self.assertEqual(health.status_code, 503)
            self.assertEqual(health.json().get("db"), False)
            self.assertEqual(health.json().get("ok"), True)

        with patch("api.main.get_session", side_effect=OSError("db down")):
            create = self.client.post("/api/projects", json={"name": "Nope"})
            self.assertEqual(create.status_code, 503)

    def test_create_missing_seed_not_503(self) -> None:
        with patch(
            "api.main.load_seed_assets",
            side_effect=FileNotFoundError("Seed template not found: templates/tz.md.j2"),
        ):
            create = self.client.post(
                "/api/projects",
                json={"name": "Missing seed", "slug": f"api-seed-{uuid.uuid4().hex[:8]}"},
            )
        self.assertIn(create.status_code, (400, 404), create.text)
        self.assertNotEqual(create.status_code, 503)
        self.assertNotIn("Database unavailable", create.text)

    def test_render_invalid_style_profile_yaml_400(self) -> None:
        suffix = uuid.uuid4().hex[:8]
        create = self.client.post(
            "/api/projects",
            json={"name": f"Bad YAML {suffix}", "slug": f"api-yaml-{suffix}"},
        )
        self.assertEqual(create.status_code, 200, create.text)
        project_id = self._track(create.json()["id"])

        put = self.client.put(
            f"/api/projects/{project_id}",
            json={
                "data": {
                    "system": {"name": "Bad YAML", "short_name": "BY"},
                    "meta": {"title": "t"},
                },
                "template_tz": "## 1. Общие сведения\n{{ system.name }}\n",
                "template_pz": "## 1. Общие положения\n{{ system.name }}\n",
                "style_profile": "page: [\n  broken: yaml: ::",
            },
        )
        self.assertEqual(put.status_code, 200, put.text)

        rendered = self.client.post(
            f"/api/projects/{project_id}/render",
            json={"template": "tz", "format": "docx"},
        )
        self.assertEqual(rendered.status_code, 400, rendered.text)


if __name__ == "__main__":
    unittest.main()
