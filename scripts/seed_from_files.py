"""Seed the default project from on-disk YAML + templates if DB is empty."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.db import get_session
from src.project_store import create_project, list_projects, load_seed_assets


def seed_from_files(root: Path = ROOT) -> str:
    with get_session() as session:
        if list_projects(session):
            return "already seeded"
        data, template_tz, template_pz, style_profile = load_seed_assets(root)
        name = data.get("meta", {}).get("title") or "default"
        create_project(
            session,
            name=name,
            slug="default",
            data=data,
            template_tz=template_tz,
            template_pz=template_pz,
            style_profile=style_profile,
        )
    return "seeded"


def main() -> int:
    result = seed_from_files(ROOT)
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
