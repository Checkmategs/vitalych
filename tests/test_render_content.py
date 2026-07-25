"""Unit tests for render_document_content (in-memory Jinja templates)."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from src.render import render_document_content

TZ_TEMPLATE = """# Техническое задание

## 1. Общие сведения
{{ system.name }}

## 2. Цели и назначение
{{ system.short_name }}
"""

PZ_TEMPLATE = """# Пояснительная записка

## 1. Общие положения
{{ system.name }}
"""

STYLE_YAML = """
page:
  size: A4
  margins_cm:
    top: 2.0
    bottom: 2.0
    left: 2.0
    right: 1.5
styles:
  Normal:
    font_name: Times New Roman
    font_size_pt: 12
"""


class RenderContentTest(unittest.TestCase):
    def test_renders_tz_headers_from_string_templates(self) -> None:
        data = {"system": {"name": "Test System", "short_name": "TS"}}
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            written = render_document_content(
                "tz",
                data,
                TZ_TEMPLATE,
                PZ_TEMPLATE,
                out,
                formats={"md"},
            )
            self.assertEqual([p.name for p in written], ["tz.md"])
            text = (out / "tz.md").read_text(encoding="utf-8")
            self.assertIn("## 1. Общие сведения", text)
            self.assertIn("## 2. Цели и назначение", text)
            self.assertIn("Test System", text)

    def test_docx_uses_style_profile_text(self) -> None:
        data = {"system": {"name": "Docx System", "short_name": "DS"}}
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            written = render_document_content(
                "tz",
                data,
                TZ_TEMPLATE,
                PZ_TEMPLATE,
                out,
                formats={"docx"},
                style_profile_text=STYLE_YAML,
            )
            self.assertEqual([p.name for p in written], ["tz.docx"])
            self.assertTrue((out / "tz.docx").is_file())
            self.assertGreater((out / "tz.docx").stat().st_size, 0)


if __name__ == "__main__":
    unittest.main()
