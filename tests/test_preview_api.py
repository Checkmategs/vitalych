"""API tests for HTML preview endpoint."""

from __future__ import annotations

import unittest
import uuid

from fastapi.testclient import TestClient

from api.main import app
from src.db import get_session
from src.project_store import delete_project, get_project


class PreviewApiTest(unittest.TestCase):
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

    def _create(self) -> str:
        suffix = uuid.uuid4().hex[:8]
        res = self.client.post(
            "/api/projects",
            json={"name": f"Preview {suffix}", "slug": f"preview-{suffix}"},
        )
        self.assertEqual(res.status_code, 200, res.text)
        pid = res.json()["id"]
        self.created_ids.append(pid)
        return pid

    def test_preview_returns_html_and_markdown(self) -> None:
        project_id = self._create()
        res = self.client.post(
            f"/api/projects/{project_id}/preview",
            json={"template": "tz"},
        )
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        self.assertIn("markdown", body)
        self.assertIn("html", body)
        self.assertIn("warnings", body)
        self.assertIn("frame_preset", body)
        self.assertTrue(body["markdown"].strip())
        self.assertIn("preview-doc", body["html"])

    def test_preview_undefined_variable_returns_400(self) -> None:
        project_id = self._create()
        got = self.client.get(f"/api/projects/{project_id}")
        self.assertEqual(got.status_code, 200)
        project = got.json()
        res = self.client.post(
            f"/api/projects/{project_id}/preview",
            json={
                "template": "tz",
                "data": project["data"],
                "template_tz": "Hello {{ definitely_missing_var }}",
                "template_pz": project["template_pz"],
                "style_profile": project["style_profile"],
            },
        )
        self.assertEqual(res.status_code, 400, res.text)
        detail = res.json()["detail"]
        self.assertIsInstance(detail, dict)
        self.assertEqual(detail.get("kind"), "undefined")
        self.assertIn("message", detail)

    def test_preview_case_filter(self) -> None:
        project_id = self._create()
        got = self.client.get(f"/api/projects/{project_id}")
        project = got.json()
        data = {
            **project["data"],
            "parties": {
                **(project["data"].get("parties") or {}),
                "customer": {
                    "value": "ООО Ромашка",
                    "cases": {"gen": "ООО Ромашки"},
                },
            },
        }
        res = self.client.post(
            f"/api/projects/{project_id}/preview",
            json={
                "template": "tz",
                "data": data,
                "template_tz": "Заказчик: {{ parties.customer | case('gen') }}",
                "template_pz": project["template_pz"],
            },
        )
        self.assertEqual(res.status_code, 200, res.text)
        self.assertIn("ООО Ромашки", res.json()["markdown"])


if __name__ == "__main__":
    unittest.main()
