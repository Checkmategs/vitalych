"""FastAPI backend: Postgres projects, versions, and document render."""

from __future__ import annotations

import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

import yaml
from jinja2 import TemplateNotFound, UndefinedError
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.db import get_engine, get_session
from src.project_store import (
    SlugConflictError,
    activate_version,
    create_project,
    create_version,
    delete_project,
    delete_version,
    get_project,
    get_version,
    list_projects,
    list_versions,
    load_seed_assets,
    update_project,
    update_version,
)
from src.render import parse_formats, render_document_content, selected_keys
from src.style_profile import load_style_profile_text

OUT_DIR = ROOT / "out"
DIST_DIR = ROOT / "web" / "dist"

RenderTemplate = Literal["tz", "pz", "all"]
RenderFormat = Literal["md", "docx", "both"]


class ProjectCreateBody(BaseModel):
    name: str = Field(min_length=1)
    slug: str | None = None


class ProjectPutBody(BaseModel):
    data: dict[str, Any]
    template_tz: str | None = None
    template_pz: str | None = None
    style_profile: str | None = None
    name: str | None = None


class VersionCreateBody(BaseModel):
    label: str | None = None
    note: str | None = None
    data: dict[str, Any] | None = None
    template_tz: str | None = None
    template_pz: str | None = None
    style_profile: str | None = None
    activate: bool = True


class VersionPutBody(BaseModel):
    data: dict[str, Any]
    template_tz: str | None = None
    template_pz: str | None = None
    style_profile: str | None = None
    label: str | None = None
    note: str | None = None


class RenderBody(BaseModel):
    template: RenderTemplate = "all"
    format: RenderFormat = "both"


_DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:8080,http://127.0.0.1:8080"
)


def _cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", _DEFAULT_CORS_ORIGINS)
    return [o.strip() for o in raw.split(",") if o.strip()]


app = FastAPI(title="Vitalych API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _project_summary(project: Any) -> dict[str, Any]:
    return {
        "id": str(project.id),
        "slug": project.slug,
        "name": project.name,
        "updated_at": _iso(project.updated_at),
    }


def _project_full(project: Any) -> dict[str, Any]:
    return {
        "id": str(project.id),
        "slug": project.slug,
        "name": project.name,
        "data": project.data,
        "template_tz": project.template_tz,
        "template_pz": project.template_pz,
        "style_profile": project.style_profile,
        "active_version_id": str(project.active_version_id) if project.active_version_id else None,
        "created_at": _iso(project.created_at),
        "updated_at": _iso(project.updated_at),
    }


def _version_item(version: Any) -> dict[str, Any]:
    return {
        "id": str(version.id),
        "label": version.label,
        "note": version.note,
        "created_at": _iso(version.created_at),
        "updated_at": _iso(version.updated_at),
    }


def _version_full(version: Any) -> dict[str, Any]:
    return {
        **_version_item(version),
        "data": version.data,
        "template_tz": version.template_tz,
        "template_pz": version.template_pz,
        "style_profile": version.style_profile,
    }


def _db_up() -> bool:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def _require_project(session: Any, project_id: uuid.UUID) -> Any:
    project = get_project(session, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.get("/api/health", response_model=None)
def health() -> dict[str, bool] | JSONResponse:
    db_ok = _db_up()
    body = {"ok": True, "db": db_ok}
    if not db_ok:
        return JSONResponse(status_code=503, content=body)
    return body


@app.get("/api/projects")
def api_list_projects() -> list[dict[str, Any]]:
    try:
        with get_session() as session:
            return [_project_summary(p) for p in list_projects(session)]
    except (SQLAlchemyError, OSError) as e:
        raise HTTPException(status_code=503, detail="Database unavailable") from e


@app.post("/api/projects")
def api_create_project(body: ProjectCreateBody) -> dict[str, Any]:
    try:
        data, template_tz, template_pz, style_profile = load_seed_assets(ROOT)
        with get_session() as session:
            project = create_project(
                session,
                name=body.name,
                slug=body.slug,
                data=data,
                template_tz=template_tz,
                template_pz=template_pz,
                style_profile=style_profile,
            )
            session.flush()
            return _project_full(project)
    except SlugConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    except IntegrityError as e:
        raise HTTPException(status_code=409, detail="Slug already exists") from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except (ValueError, yaml.YAMLError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except (SQLAlchemyError, OSError) as e:
        raise HTTPException(status_code=503, detail="Database unavailable") from e


@app.get("/api/projects/{project_id}")
def api_get_project(project_id: uuid.UUID) -> dict[str, Any]:
    try:
        with get_session() as session:
            project = _require_project(session, project_id)
            return _project_full(project)
    except HTTPException:
        raise
    except (SQLAlchemyError, OSError) as e:
        raise HTTPException(status_code=503, detail="Database unavailable") from e


@app.put("/api/projects/{project_id}")
def api_put_project(project_id: uuid.UUID, body: ProjectPutBody) -> dict[str, Any]:
    try:
        with get_session() as session:
            project = _require_project(session, project_id)
            kwargs: dict[str, Any] = {"data": body.data}
            if body.template_tz is not None:
                kwargs["template_tz"] = body.template_tz
            if body.template_pz is not None:
                kwargs["template_pz"] = body.template_pz
            if body.style_profile is not None:
                kwargs["style_profile"] = body.style_profile
            if body.name is not None:
                kwargs["name"] = body.name
            update_project(session, project, **kwargs)
            return _project_full(project)
    except HTTPException:
        raise
    except (SQLAlchemyError, OSError) as e:
        raise HTTPException(status_code=503, detail="Database unavailable") from e


@app.delete("/api/projects/{project_id}")
def api_delete_project(project_id: uuid.UUID) -> dict[str, bool]:
    try:
        with get_session() as session:
            project = _require_project(session, project_id)
            delete_project(session, project)
            return {"ok": True}
    except HTTPException:
        raise
    except (SQLAlchemyError, OSError) as e:
        raise HTTPException(status_code=503, detail="Database unavailable") from e


@app.get("/api/projects/{project_id}/versions")
def api_list_versions(project_id: uuid.UUID) -> list[dict[str, Any]]:
    try:
        with get_session() as session:
            _require_project(session, project_id)
            return [_version_item(v) for v in list_versions(session, project_id)]
    except HTTPException:
        raise
    except (SQLAlchemyError, OSError) as e:
        raise HTTPException(status_code=503, detail="Database unavailable") from e


@app.post("/api/projects/{project_id}/versions")
def api_create_version(
    project_id: uuid.UUID, body: VersionCreateBody = VersionCreateBody()
) -> dict[str, Any]:
    try:
        with get_session() as session:
            project = _require_project(session, project_id)
            version = create_version(
                session,
                project,
                label=body.label,
                note=body.note,
                data=body.data,
                template_tz=body.template_tz,
                template_pz=body.template_pz,
                style_profile=body.style_profile,
                activate=body.activate,
            )
            return _version_full(version)
    except HTTPException:
        raise
    except (SQLAlchemyError, OSError) as e:
        raise HTTPException(status_code=503, detail="Database unavailable") from e


@app.get("/api/projects/{project_id}/versions/{version_id}")
def api_get_version(project_id: uuid.UUID, version_id: uuid.UUID) -> dict[str, Any]:
    try:
        with get_session() as session:
            _require_project(session, project_id)
            version = get_version(session, project_id, version_id)
            if version is None:
                raise HTTPException(status_code=404, detail="Version not found")
            return _version_full(version)
    except HTTPException:
        raise
    except (SQLAlchemyError, OSError) as e:
        raise HTTPException(status_code=503, detail="Database unavailable") from e


@app.put("/api/projects/{project_id}/versions/{version_id}")
def api_put_version(
    project_id: uuid.UUID, version_id: uuid.UUID, body: VersionPutBody
) -> dict[str, Any]:
    try:
        with get_session() as session:
            project = _require_project(session, project_id)
            version = get_version(session, project_id, version_id)
            if version is None:
                raise HTTPException(status_code=404, detail="Version not found")
            kwargs: dict[str, Any] = {"data": body.data}
            if body.template_tz is not None:
                kwargs["template_tz"] = body.template_tz
            if body.template_pz is not None:
                kwargs["template_pz"] = body.template_pz
            if body.style_profile is not None:
                kwargs["style_profile"] = body.style_profile
            if body.label is not None:
                kwargs["label"] = body.label
            if body.note is not None:
                kwargs["note"] = body.note
            update_version(session, version, **kwargs)
            if project.active_version_id == version.id:
                update_project(
                    session,
                    project,
                    data=version.data,
                    template_tz=version.template_tz,
                    template_pz=version.template_pz,
                    style_profile=version.style_profile,
                    mirror_active_version=False,
                )
            return _version_full(version)
    except HTTPException:
        raise
    except (SQLAlchemyError, OSError) as e:
        raise HTTPException(status_code=503, detail="Database unavailable") from e


@app.post("/api/projects/{project_id}/versions/{version_id}/activate")
def api_activate_version(project_id: uuid.UUID, version_id: uuid.UUID) -> dict[str, Any]:
    try:
        with get_session() as session:
            project = _require_project(session, project_id)
            version = get_version(session, project_id, version_id)
            if version is None:
                raise HTTPException(status_code=404, detail="Version not found")
            activate_version(session, project, version)
            return _project_full(project)
    except HTTPException:
        raise
    except (SQLAlchemyError, OSError) as e:
        raise HTTPException(status_code=503, detail="Database unavailable") from e


@app.post("/api/projects/{project_id}/versions/{version_id}/restore")
def api_restore_version(project_id: uuid.UUID, version_id: uuid.UUID) -> dict[str, Any]:
    """Alias of activate for compatibility."""
    return api_activate_version(project_id, version_id)


@app.delete("/api/projects/{project_id}/versions/{version_id}")
def api_delete_version(project_id: uuid.UUID, version_id: uuid.UUID) -> dict[str, Any]:
    try:
        with get_session() as session:
            project = _require_project(session, project_id)
            version = get_version(session, project_id, version_id)
            if version is None:
                raise HTTPException(status_code=404, detail="Version not found")
            delete_version(session, version)
            session.refresh(project)
            return {
                "ok": True,
                "active_version_id": (
                    str(project.active_version_id) if project.active_version_id else None
                ),
            }
    except HTTPException:
        raise
    except (SQLAlchemyError, OSError) as e:
        raise HTTPException(status_code=503, detail="Database unavailable") from e


@app.post("/api/projects/{project_id}/render")
def api_render(project_id: uuid.UUID, body: RenderBody = RenderBody()) -> dict[str, list[str]]:
    try:
        with get_session() as session:
            project = _require_project(session, project_id)
            slug = project.slug
            data = project.data
            template_tz = project.template_tz
            template_pz = project.template_pz
            style_profile_text = project.style_profile

        formats = parse_formats(body.format)
        profile = None
        if "docx" in formats:
            profile = load_style_profile_text(style_profile_text)

        out_dir = OUT_DIR / slug
        written: list[Path] = []
        for key in selected_keys(body.template):
            written.extend(
                render_document_content(
                    key,
                    data,
                    template_tz,
                    template_pz,
                    out_dir,
                    formats,
                    style_profile=profile,
                    style_profile_text=style_profile_text,
                )
            )
        return {"written": [str(p.relative_to(ROOT)) for p in written]}
    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except (ValueError, yaml.YAMLError, UndefinedError, TemplateNotFound, OSError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except SQLAlchemyError as e:
        raise HTTPException(status_code=503, detail="Database unavailable") from e


@app.get("/api/projects/{project_id}/download/{filename}")
def api_download(project_id: uuid.UUID, filename: str) -> FileResponse:
    """Serve a generated .docx from out/{slug}/ (no path traversal, docx only)."""
    name = Path(filename).name
    if name != filename or not name.endswith(".docx") or ".." in filename:
        raise HTTPException(status_code=400, detail="Only .docx filenames are allowed")
    try:
        with get_session() as session:
            project = _require_project(session, project_id)
            slug = project.slug
    except HTTPException:
        raise
    except (SQLAlchemyError, OSError) as e:
        raise HTTPException(status_code=503, detail="Database unavailable") from e

    base = (OUT_DIR / slug).resolve()
    path = (base / name).resolve()
    try:
        path.relative_to(base)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid path") from e
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {name}")
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=name,
    )


def _mount_frontend() -> None:
    """Serve Vite build from web/dist when present (production / LAN deploy)."""
    if not DIST_DIR.is_dir():
        return

    assets_dir = DIST_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    async def spa_index() -> FileResponse:
        index = DIST_DIR / "index.html"
        if not index.is_file():
            raise HTTPException(status_code=404, detail="Frontend not built (web/dist missing)")
        return FileResponse(index)

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str) -> FileResponse:
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = DIST_DIR / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        index = DIST_DIR / "index.html"
        if index.is_file():
            return FileResponse(index)
        raise HTTPException(status_code=404, detail="Frontend not built (web/dist missing)")


_mount_frontend()
