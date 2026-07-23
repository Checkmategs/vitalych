"""Smoke: example YAML → ТЗ/ПЗ MD headers + DOCX with style profile."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from docx import Document
from docx.shared import Pt

from src.render import load_data, render_document

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "project.example.yaml"
TEMPLATES = ROOT / "templates"
STYLE_PROFILE = ROOT / "style-profile.yaml"

TZ_HEADERS = [
    "## 1. Общие сведения",
    "## 2. Цели и назначение",
    "## 3. Характеристика объектов",
    "## 4. Требования к автоматизированной системе",
    "## 5. Состав и содержание работ",
    "## 6. Порядок разработки",
    "## 7. Порядок контроля и приёмки",
    "## 8. Требования к составу и содержанию работ по подготовке",
    "## 9. Требования к документированию",
    "## 10. Источники разработки",
]

PZ_HEADERS = [
    "## 1. Общие положения",
    "## 2. Описание процессов деятельности",
    "## 3. Основные технические решения",
    "## 4. Мероприятия по подготовке объекта",
]


class RenderSmokeTest(unittest.TestCase):
    def test_all_required_headers_and_docx(self) -> None:
        data = load_data(DATA)
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            formats = {"md", "docx"}
            tz_paths = render_document(
                "tz",
                data,
                TEMPLATES,
                out,
                formats,
                style_profile_path=STYLE_PROFILE,
            )
            pz_paths = render_document(
                "pz",
                data,
                TEMPLATES,
                out,
                formats,
                style_profile_path=STYLE_PROFILE,
            )

            tz_md = out / "tz.md"
            pz_md = out / "pz.md"
            tz_docx = out / "tz.docx"
            pz_docx = out / "pz.docx"

            self.assertTrue(tz_md.is_file())
            self.assertTrue(pz_md.is_file())
            self.assertTrue(tz_docx.is_file())
            self.assertTrue(pz_docx.is_file())
            self.assertGreater(tz_docx.stat().st_size, 0)
            self.assertGreater(pz_docx.stat().st_size, 0)

            self.assertEqual({p.name for p in tz_paths}, {"tz.md", "tz.docx"})
            self.assertEqual({p.name for p in pz_paths}, {"pz.md", "pz.docx"})

            tz = tz_md.read_text(encoding="utf-8")
            pz = pz_md.read_text(encoding="utf-8")
            for h in TZ_HEADERS:
                self.assertIn(h, tz, msg=f"missing in tz.md: {h}")
            for h in PZ_HEADERS:
                self.assertIn(h, pz, msg=f"missing in pz.md: {h}")

            doc = Document(str(tz_docx))
            section = doc.sections[0]
            # style-profile: left margin 2.0 cm, Normal 12 pt
            self.assertAlmostEqual(section.left_margin.cm, 2.0, delta=0.05)
            normal = doc.styles["Normal"]
            self.assertEqual(normal.font.size, Pt(12))
            self.assertEqual(normal.font.name, "Times New Roman")


if __name__ == "__main__":
    unittest.main()
