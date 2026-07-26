"""CLI --project / --project-id render from Postgres."""

from __future__ import annotations

import tempfile
import unittest
import uuid
from pathlib import Path
import os

from src.db import get_session
from src.models import LOCAL_WORKSPACE_ID
from src.project_store import create_project, delete_project, get_project
from src.render import build_parser, main


class RenderCliFlagsTest(unittest.TestCase):
    def test_data_project_and_project_id_are_mutually_exclusive(self) -> None:
        parser = build_parser()
        with self.assertRaises(SystemExit):
            parser.parse_args(["--data", "data/x.yaml", "--project", "slug"])
        with self.assertRaises(SystemExit):
            parser.parse_args(["--project", "slug", "--project-id", str(uuid.uuid4())])
        with self.assertRaises(SystemExit):
            parser.parse_args([])

    def test_accepts_project_without_data(self) -> None:
        args = build_parser().parse_args(["--project", "my-slug", "--format", "md"])
        self.assertEqual(args.project, "my-slug")
        self.assertIsNone(args.data)
        self.assertIsNone(args.project_id)


class RenderFromDbIntegrationTest(unittest.TestCase):
    def test_main_renders_project_by_slug_to_out_slug(self) -> None:
        suffix = uuid.uuid4().hex[:8]
        slug = f"render-db-{suffix}"
        tz = "## 1. Общие сведения\n{{ system.name }}\n"
        pz = "## 1. Общие положения\n{{ system.name }}\n"
        style = "page:\n  size: A4\nstyles:\n  Normal:\n    font_name: Times New Roman\n    font_size_pt: 12\n"
        data = {"system": {"name": "DB Render", "short_name": "DBR"}}

        with get_session() as session:
            project = create_project(
                session,
                name="Render DB",
                slug=slug,
                data=data,
                template_tz=tz,
                template_pz=pz,
                style_profile=style,
            )
            project_id = project.id

        try:
            with tempfile.TemporaryDirectory() as tmp:
                cwd = Path(tmp)
                old = os.getcwd()
                os.chdir(cwd)
                try:
                    code = main(["--project", slug, "--template", "tz", "--format", "md"])
                finally:
                    os.chdir(old)

                self.assertEqual(code, 0)
                out_md = cwd / "out" / str(LOCAL_WORKSPACE_ID) / slug / "tz.md"
                self.assertTrue(out_md.is_file(), msg=f"missing {out_md}")
                text = out_md.read_text(encoding="utf-8")
                self.assertIn("## 1. Общие сведения", text)
                self.assertIn("DB Render", text)
        finally:
            with get_session() as session:
                project = get_project(session, project_id)
                if project is not None:
                    delete_project(session, project)

    def test_main_renders_project_by_id(self) -> None:
        suffix = uuid.uuid4().hex[:8]
        slug = f"render-id-{suffix}"
        tz = "# TZ {{ system.name }}\n"
        pz = "# PZ\n"
        style = "page:\n  size: A4\n"
        data = {"system": {"name": "By Id", "short_name": "BI"}}

        with get_session() as session:
            project = create_project(
                session,
                name="Render ID",
                slug=slug,
                data=data,
                template_tz=tz,
                template_pz=pz,
                style_profile=style,
            )
            project_id = project.id

        try:
            with tempfile.TemporaryDirectory() as tmp:
                out = Path(tmp) / "custom-out"
                code = main(
                    [
                        "--project-id",
                        str(project_id),
                        "--template",
                        "tz",
                        "--format",
                        "md",
                        "--out",
                        str(out),
                    ]
                )
                self.assertEqual(code, 0)
                self.assertTrue((out / "tz.md").is_file())
                self.assertIn("By Id", (out / "tz.md").read_text(encoding="utf-8"))
        finally:
            with get_session() as session:
                project = get_project(session, project_id)
                if project is not None:
                    delete_project(session, project)

    def test_main_errors_when_project_missing(self) -> None:
        code = main(["--project", f"missing-{uuid.uuid4().hex}", "--format", "md"])
        self.assertEqual(code, 1)


if __name__ == "__main__":
    unittest.main()
