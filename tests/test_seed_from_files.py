from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

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

        session = MagicMock()
        with (
            patch("scripts.seed_from_files.list_projects", return_value=[object()]) as list_mock,
            patch("scripts.seed_from_files.create_project") as create_mock,
            patch("scripts.seed_from_files.load_seed_assets") as load_mock,
        ):
            result = seed_from_files(session, ROOT)

        self.assertEqual(result, "already seeded")
        list_mock.assert_called_once_with(session)
        create_mock.assert_not_called()
        load_mock.assert_not_called()

    def test_seed_inserts_default_when_empty(self) -> None:
        from scripts.seed_from_files import seed_from_files

        session = MagicMock()
        data = {"meta": {"title": "default"}}
        assets = (data, "# tz", "# pz", "page:\n  size: A4\n")

        with (
            patch("scripts.seed_from_files.list_projects", return_value=[]) as list_mock,
            patch("scripts.seed_from_files.create_project") as create_mock,
            patch("scripts.seed_from_files.load_seed_assets", return_value=assets) as load_mock,
        ):
            result = seed_from_files(session, ROOT)

        self.assertEqual(result, "seeded")
        list_mock.assert_called_once_with(session)
        load_mock.assert_called_once_with(ROOT)
        create_mock.assert_called_once_with(
            session,
            name="default",
            slug="default",
            data=data,
            template_tz="# tz",
            template_pz="# pz",
            style_profile="page:\n  size: A4\n",
        )


if __name__ == "__main__":
    unittest.main()
