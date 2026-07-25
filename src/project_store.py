from __future__ import annotations

import copy
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models import Project, ProjectVersion

_UNSET = object()


class SlugConflictError(Exception):
    """Raised when an explicitly requested project slug is already taken."""

    def __init__(self, slug: str) -> None:
        self.slug = slug
        super().__init__(f"Project slug already exists: {slug}")


def slugify(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "project"


def list_projects(session: Session) -> list[Project]:
    return list(
        session.scalars(
            select(Project)
            .where(Project.deleted_at.is_(None))
            .order_by(Project.updated_at.desc())
        ).all()
    )


def _slug_taken(session: Session, slug: str) -> bool:
    return (
        session.scalar(
            select(Project.id).where(Project.slug == slug, Project.deleted_at.is_(None))
        )
        is not None
    )


def _unique_slug(session: Session, base: str) -> str:
    if not _slug_taken(session, base):
        return base
    for _ in range(20):
        candidate = f"{base}-{uuid.uuid4().hex[:6]}"
        if not _slug_taken(session, candidate):
            return candidate
    raise SlugConflictError(base)


def create_project(
    session: Session,
    *,
    name: str,
    slug: str | None,
    data: dict[str, Any],
    template_tz: str,
    template_pz: str,
    style_profile: str,
) -> Project:
    if slug is None:
        resolved = _unique_slug(session, slugify(name))
    else:
        resolved = slug
        if _slug_taken(session, resolved):
            raise SlugConflictError(resolved)

    project = Project(
        name=name,
        slug=resolved,
        data=copy.deepcopy(data),
        template_tz=template_tz,
        template_pz=template_pz,
        style_profile=style_profile,
    )
    session.add(project)
    session.flush()
    return project


def get_project(session: Session, project_id: uuid.UUID) -> Project | None:
    project = session.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        return None
    return project


def get_project_by_slug(session: Session, slug: str) -> Project | None:
    return session.scalar(
        select(Project).where(Project.slug == slug, Project.deleted_at.is_(None))
    )


def update_project(
    session: Session,
    project: Project,
    *,
    data: Any = _UNSET,
    template_tz: Any = _UNSET,
    template_pz: Any = _UNSET,
    style_profile: Any = _UNSET,
    name: Any = _UNSET,
) -> Project:
    if data is not _UNSET:
        project.data = copy.deepcopy(data)
    if template_tz is not _UNSET:
        project.template_tz = template_tz
    if template_pz is not _UNSET:
        project.template_pz = template_pz
    if style_profile is not _UNSET:
        project.style_profile = style_profile
    if name is not _UNSET:
        project.name = name
    project.updated_at = datetime.now(timezone.utc)
    session.add(project)
    session.flush()
    return project


def delete_project(session: Session, project: Project) -> None:
    project.deleted_at = datetime.now(timezone.utc)
    session.add(project)
    session.flush()


def create_version(
    session: Session,
    project: Project,
    *,
    label: str | None = None,
    note: str | None = None,
) -> ProjectVersion:
    version = ProjectVersion(
        project_id=project.id,
        label=label,
        note=note,
        data=copy.deepcopy(project.data),
        template_tz=project.template_tz,
        template_pz=project.template_pz,
        style_profile=project.style_profile,
    )
    session.add(version)
    session.flush()
    return version


def list_versions(session: Session, project_id: uuid.UUID) -> list[ProjectVersion]:
    return list(
        session.scalars(
            select(ProjectVersion)
            .where(
                ProjectVersion.project_id == project_id,
                ProjectVersion.deleted_at.is_(None),
            )
            .order_by(ProjectVersion.created_at.desc())
        ).all()
    )


def get_version(
    session: Session, project_id: uuid.UUID, version_id: uuid.UUID
) -> ProjectVersion | None:
    return session.scalar(
        select(ProjectVersion).where(
            ProjectVersion.id == version_id,
            ProjectVersion.project_id == project_id,
            ProjectVersion.deleted_at.is_(None),
        )
    )


def delete_version(session: Session, version: ProjectVersion) -> None:
    version.deleted_at = datetime.now(timezone.utc)
    session.add(version)
    session.flush()


def restore_version(session: Session, project: Project, version: ProjectVersion) -> Project:
    project.data = copy.deepcopy(version.data)
    project.template_tz = version.template_tz
    project.template_pz = version.template_pz
    project.style_profile = version.style_profile
    project.updated_at = datetime.now(timezone.utc)
    session.add(project)
    session.flush()
    return project


def load_seed_assets(root: Path) -> tuple[dict[str, Any], str, str, str]:
    data_path = root / "data" / "project.yaml"
    if not data_path.exists():
        data_path = root / "data" / "project.example.yaml"
    with data_path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"Seed data must be a mapping: {data_path}")
    template_tz = (root / "templates" / "tz.md.j2").read_text(encoding="utf-8")
    template_pz = (root / "templates" / "pz.md.j2").read_text(encoding="utf-8")
    style_profile = (root / "style-profile.yaml").read_text(encoding="utf-8")
    return data, template_tz, template_pz, style_profile
