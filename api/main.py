"""FastAPI backend: project YAML, templates, and document render."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Literal

import yaml
from jinja2 import TemplateNotFound, UndefinedError
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.render import TEMPLATE_MAP, load_data, parse_formats, render_document, selected_keys

DATA_DIR = ROOT / "data"
PROJECT_YAML = DATA_DIR / "project.yaml"
EXAMPLE_YAML = DATA_DIR / "project.example.yaml"
TEMPLATES_DIR = ROOT / "templates"
OUT_DIR = ROOT / "out"
STYLE_PROFILE = ROOT / "style-profile.yaml"
DIST_DIR = ROOT / "web" / "dist"

TemplateKey = Literal["tz", "pz"]
RenderTemplate = Literal["tz", "pz", "all"]
RenderFormat = Literal["md", "docx", "both"]


class ProjectPutBody(BaseModel):
    data: dict[str, Any]


class TemplatePutBody(BaseModel):
    content: str


class RenderBody(BaseModel):
    template: RenderTemplate = "all"
    format: RenderFormat = "both"


app = FastAPI(title="Vitalych API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://10.91.0.142:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def default_data_path() -> Path:
    return PROJECT_YAML if PROJECT_YAML.is_file() else EXAMPLE_YAML


def save_yaml(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        yaml.safe_dump(
            data,
            f,
            allow_unicode=True,
            sort_keys=False,
            default_flow_style=False,
        )


def template_path(key: str) -> Path:
    if key not in TEMPLATE_MAP:
        raise HTTPException(status_code=404, detail=f"Unknown template key: {key}")
    j2_name, _ = TEMPLATE_MAP[key]
    return TEMPLATES_DIR / j2_name


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/api/project")
def get_project() -> dict[str, Any]:
    path = default_data_path()
    try:
        return load_data(path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except (ValueError, yaml.YAMLError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.put("/api/project")
def put_project(body: ProjectPutBody) -> dict[str, Any]:
    try:
        save_yaml(PROJECT_YAML, body.data)
        return load_data(PROJECT_YAML)
    except (OSError, ValueError, yaml.YAMLError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.get("/api/template/{key}")
def get_template(key: TemplateKey) -> dict[str, str]:
    path = template_path(key)
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"Template not found: {path}")
    return {"key": key, "content": path.read_text(encoding="utf-8")}


@app.put("/api/template/{key}")
def put_template(key: TemplateKey, body: TemplatePutBody) -> dict[str, str]:
    path = template_path(key)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body.content, encoding="utf-8")
    except OSError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"key": key, "content": path.read_text(encoding="utf-8")}


@app.post("/api/render")
def render(body: RenderBody = RenderBody()) -> dict[str, list[str]]:
    try:
        data = load_data(default_data_path())
        formats = parse_formats(body.format)
        profile = None
        if "docx" in formats:
            from src.style_profile import load_style_profile

            profile = load_style_profile(STYLE_PROFILE)
        written: list[Path] = []
        for key in selected_keys(body.template):
            written.extend(
                render_document(
                    key,
                    data,
                    TEMPLATES_DIR,
                    OUT_DIR,
                    formats,
                    style_profile=profile,
                    style_profile_path=STYLE_PROFILE,
                )
            )
        return {"written": [str(p.relative_to(ROOT)) for p in written]}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except (ValueError, yaml.YAMLError, OSError, UndefinedError, TemplateNotFound) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.get("/api/download/{filename}")
def download_docx(filename: str) -> FileResponse:
    """Serve a generated .docx from out/ (no path traversal, docx only)."""
    name = Path(filename).name
    if name != filename or not name.endswith(".docx") or ".." in filename:
        raise HTTPException(status_code=400, detail="Only .docx filenames in out/ are allowed")
    path = (OUT_DIR / name).resolve()
    try:
        path.relative_to(OUT_DIR.resolve())
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
