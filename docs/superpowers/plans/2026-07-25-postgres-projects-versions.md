# Postgres Multi-Project + Versions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist projects (YAML data + ТЗ/ПЗ templates + style profile) in PostgreSQL with multi-project support and explicit version checkpoints; wire API, CLI, UI, Docker, and deploy.

**Architecture:** Document-store model — `projects` holds current JSONB/text state; `project_versions` stores atomic manual checkpoints. FastAPI uses SQLAlchemy 2 + Alembic; Docker Compose runs Postgres only; render uses in-memory Jinja `DictLoader` so templates need not live on disk at runtime.

**Tech Stack:** PostgreSQL 16, Docker Compose, SQLAlchemy 2, Alembic, psycopg (v3), FastAPI, React/Vite UI, unittest + FastAPI TestClient.

## Global Constraints

- Postgres 16 via Docker Compose (DB service only; app stays uvicorn/systemd).
- No auth / ACL in this MVP.
- Ordinary PUT does **not** create versions; only `POST .../versions` does.
- Checkpoint is atomic: `data` + `template_tz` + `template_pz` + `style_profile`.
- API paths use project UUID; CLI may use `--project` slug or `--project-id`.
- Breaking: remove `/api/project`, `/api/template/*`, `/api/render`, `/api/download/*` (no shim).
- Render output directory: `out/{slug}/`.
- `.env` / DB passwords never committed; ship `.env.example`.
- Prefer unittest (`python -m unittest`) to match existing tests.
- Keep `--data` YAML path working for offline/ad-hoc render and existing smoke tests.

---

## File structure

| Path | Responsibility |
|------|----------------|
| `docker-compose.yml` | Postgres 16 service + volume |
| `.env.example` | `DATABASE_URL`, Postgres creds sample |
| `.gitignore` | ensure `.env` ignored |
| `requirements.txt` | add sqlalchemy, alembic, psycopg |
| `alembic.ini` + `alembic/` | migrations |
| `src/db.py` | engine, `SessionLocal`, `get_session` |
| `src/models.py` | `Project`, `ProjectVersion` ORM |
| `src/project_store.py` | CRUD, checkpoint, restore, slug helpers, seed readers |
| `src/style_profile.py` | add `load_style_profile_text(text: str) -> dict` |
| `src/render.py` | `render_document_content`, CLI `--project` / `--project-id` |
| `scripts/seed_from_files.py` | one-time file → DB seed when empty |
| `api/main.py` | project-scoped routes; drop old file routes |
| `tests/test_project_store.py` | store + versions |
| `tests/test_api_projects.py` | HTTP API integration |
| `tests/test_render_from_db.py` | CLI/DB render smoke |
| `web/src/api/client.ts` | new client functions |
| `web/src/components/ProjectBar.tsx` | project select/create + versions |
| `web/src/App.tsx` + `App.css` | wire ProjectBar, projectId |
| `deploy/vitalych.service` (+ user) | `EnvironmentFile` for `DATABASE_URL` |
| `scripts/deploy.sh` | compose up, alembic, seed |
| `README.md` | local DB + new CLI/API |

---

### Task 1: Docker Compose, deps, DB session

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Modify: `requirements.txt`
- Modify: `.gitignore` (add `.env` if missing)
- Create: `src/db.py`
- Test: `tests/test_db_connect.py`

**Interfaces:**
- Produces: `get_engine()`, `SessionLocal`, `get_session()` context manager; env `DATABASE_URL` default `postgresql+psycopg://vitalych:vitalych@127.0.0.1:5432/vitalych`

- [ ] **Step 1: Write failing connectivity test**

```python
# tests/test_db_connect.py
from __future__ import annotations
import os
import unittest
from sqlalchemy import text
from src.db import get_engine

class DbConnectTest(unittest.TestCase):
    def test_select_one(self) -> None:
        engine = get_engine()
        with engine.connect() as conn:
            self.assertEqual(conn.execute(text("SELECT 1")).scalar_one(), 1)

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test — expect ImportError / missing module**

Run: `python -m unittest tests.test_db_connect -v`  
Expected: FAIL (`No module named 'src.db'` or similar)

- [ ] **Step 3: Add compose, deps, `src/db.py`**

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: vitalych
      POSTGRES_PASSWORD: vitalych
      POSTGRES_DB: vitalych
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vitalych -d vitalych"]
      interval: 3s
      timeout: 3s
      retries: 10

volumes:
  pgdata:
```

`.env.example`:
```
POSTGRES_USER=vitalych
POSTGRES_PASSWORD=vitalych
POSTGRES_DB=vitalych
DATABASE_URL=postgresql+psycopg://vitalych:vitalych@127.0.0.1:5432/vitalych
```

Append to `requirements.txt`:
```
SQLAlchemy>=2.0
alembic>=1.13
psycopg[binary]>=3.1
```

`src/db.py`:
```python
from __future__ import annotations
import os
from contextlib import contextmanager
from collections.abc import Iterator
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

DEFAULT_DATABASE_URL = "postgresql+psycopg://vitalych:vitalych@127.0.0.1:5432/vitalych"

_engine: Engine | None = None
SessionLocal: sessionmaker[Session] | None = None

def database_url() -> str:
    return os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)

def get_engine() -> Engine:
    global _engine, SessionLocal
    if _engine is None:
        _engine = create_engine(database_url(), pool_pre_ping=True)
        SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)
    return _engine

@contextmanager
def get_session() -> Iterator[Session]:
    get_engine()
    assert SessionLocal is not None
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
```

- [ ] **Step 4: Install deps, start DB, pass test**

```bash
source .venv/bin/activate
pip install -r requirements.txt
docker compose up -d
# wait until healthy
python -m unittest tests.test_db_connect -v
```

Expected: OK

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example requirements.txt .gitignore src/db.py tests/test_db_connect.py
git commit -m "Add Postgres Compose, SQLAlchemy session, and DB connect smoke test."
```

---

### Task 2: Models + Alembic migration

**Files:**
- Create: `src/models.py`
- Create: `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako`, `alembic/versions/20260725_0001_projects.py`
- Test: `tests/test_models_migration.py`

**Interfaces:**
- Produces: ORM classes `Project`, `ProjectVersion` with columns from the design spec; `Base` metadata
- Consumes: `src.db.get_engine`, `database_url`

- [ ] **Step 1: Write failing migration/roundtrip test**

```python
# tests/test_models_migration.py
from __future__ import annotations
import unittest
import uuid
from sqlalchemy import select
from src.db import get_engine, get_session
from src.models import Project

class ModelsMigrationTest(unittest.TestCase):
    def test_insert_project_row(self) -> None:
        pid = uuid.uuid4()
        with get_session() as s:
            s.add(Project(
                id=pid,
                slug=f"t-{pid.hex[:8]}",
                name="Test",
                data={"meta": {"title": "x"}},
                template_tz="# tz",
                template_pz="# pz",
                style_profile="page:\n  size: A4\n",
            ))
        with get_session() as s:
            row = s.scalar(select(Project).where(Project.id == pid))
            self.assertIsNotNone(row)
            self.assertEqual(row.data["meta"]["title"], "x")
```

- [ ] **Step 2: Run — expect fail (no models / no table)**

Run: `python -m unittest tests.test_models_migration -v`

- [ ] **Step 3: Implement models + Alembic**

`src/models.py` — `Project` / `ProjectVersion` as in spec (`UUID`, `JSONB`, `TEXT`, timestamps with `server_default=func.now()`, `onupdate` for `updated_at`). Relationship `versions` with cascade delete.

Init Alembic pointing at `src.models.Base.metadata` and `database_url()` from `src.db`. Generate revision that creates both tables + indexes (`uq_projects_slug`, `ix_project_versions_project_created`).

- [ ] **Step 4: Upgrade and pass test**

```bash
alembic upgrade head
python -m unittest tests.test_models_migration -v
```

Expected: OK

- [ ] **Step 5: Commit**

```bash
git add src/models.py alembic.ini alembic tests/test_models_migration.py
git commit -m "Add Project/ProjectVersion models and initial Alembic migration."
```

---

### Task 3: `project_store` (CRUD, checkpoint, restore, slug)

**Files:**
- Create: `src/project_store.py`
- Test: `tests/test_project_store.py`

**Interfaces:**
- Produces:
  - `slugify(name: str) -> str`
  - `list_projects(session) -> list[Project]`
  - `create_project(session, *, name: str, slug: str | None, data, template_tz, template_pz, style_profile) -> Project`
  - `get_project(session, project_id: uuid.UUID) -> Project | None`
  - `get_project_by_slug(session, slug: str) -> Project | None`
  - `update_project(session, project: Project, *, data=..., template_tz=..., template_pz=..., style_profile=..., name=...) -> Project`
  - `delete_project(session, project: Project) -> None`
  - `create_version(session, project: Project, *, label: str | None = None, note: str | None = None) -> ProjectVersion`
  - `list_versions(session, project_id) -> list[ProjectVersion]`
  - `restore_version(session, project: Project, version: ProjectVersion) -> Project`
  - `load_seed_assets(root: Path) -> tuple[dict, str, str, str]` — reads example/live files from repo
- Consumes: `Project`, `ProjectVersion`

- [ ] **Step 1: Write failing store tests**

Cover: create → update does not add version → `create_version` copies all four payloads → `restore_version` restores data/templates/style → duplicate slug raises a clear error (custom `SlugConflictError` or IntegrityError mapped later in API).

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement `src/project_store.py`**

`slugify`: lowercase, replace non-alnum with `-`, collapse dashes, fallback `project`. If slug taken on create, append short suffix or raise `SlugConflictError`.

`create_version`: copy current `data`, `template_tz`, `template_pz`, `style_profile` into new `ProjectVersion`.

`restore_version`: assign those four fields back onto `project`; bump `updated_at`.

- [ ] **Step 4: Pass tests**

Run: `python -m unittest tests.test_project_store -v`

- [ ] **Step 5: Commit**

```bash
git commit -m "Add project_store CRUD with explicit checkpoints and restore."
```

---

### Task 4: Seed script + style profile from text

**Files:**
- Modify: `src/style_profile.py` — add `load_style_profile_text`
- Create: `scripts/seed_from_files.py`
- Test: `tests/test_seed_from_files.py`

**Interfaces:**
- Produces: `load_style_profile_text(text: str) -> dict` (yaml.safe_load + mapping check)
- Produces: CLI `python scripts/seed_from_files.py` — no-op if any project exists; else insert `slug=default`

- [ ] **Step 1: Failing tests for text loader + seed idempotency**

- [ ] **Step 2: Implement**

Seed preference order for data: `data/project.yaml` if exists else `data/project.example.yaml`. Templates from `templates/tz.md.j2`, `templates/pz.md.j2`. Style from `style-profile.yaml`. Name from `data.get("meta", {}).get("title")` or `"default"`.

- [ ] **Step 3: Pass tests; dry-run against local DB**

```bash
python scripts/seed_from_files.py
python scripts/seed_from_files.py   # second run: prints "already seeded" / exits 0
```

- [ ] **Step 4: Commit**

```bash
git commit -m "Add file-to-DB seed script and style profile text loader."
```

---

### Task 5: Render from in-memory templates + CLI DB flags

**Files:**
- Modify: `src/render.py`
- Modify: `src/style_profile.py` (if not done)
- Test: `tests/test_render_content.py`, `tests/test_render_from_db.py`
- Keep: `tests/test_render_smoke.py` green with `--data`

**Interfaces:**
- Produces:
  - `render_document_content(template_key, data, template_tz, template_pz, out_dir, formats, style_profile: dict | None, style_profile_text: str | None) -> list[Path]`
  - Uses `jinja2.DictLoader({"tz.md.j2": template_tz, "pz.md.j2": template_pz})`
  - CLI: mutually exclusive group — either `--data PATH` **or** `--project SLUG` **or** `--project-id UUID`; `--data` no longer required if project flags set

- [ ] **Step 1: Failing test** — render TZ headers from string templates (no filesystem templates dir)

- [ ] **Step 2: Implement `render_document_content`**

Reuse existing DOCX path via `load_style_profile_text` when `style_profile` dict not passed.

- [ ] **Step 3: Wire CLI**

When `--project` / `--project-id`: open session, load row, call `render_document_content` for each selected key, default `--out` to `out/{slug}` if user left default `out`.

- [ ] **Step 4: Pass unittest; keep smoke YAML test green**

```bash
python -m unittest tests.test_render_smoke tests.test_render_content tests.test_render_from_db -v
```

- [ ] **Step 5: Commit**

```bash
git commit -m "Render from in-memory templates and load projects from Postgres in CLI."
```

---

### Task 6: FastAPI project-scoped routes

**Files:**
- Modify: `api/main.py` (replace file-based project/template/render/download)
- Test: `tests/test_api_projects.py`

**Interfaces:**
- Produces routes exactly as design spec table
- Response shapes:
  - List item: `{id, slug, name, updated_at}`
  - Project get/put: `{id, slug, name, data, template_tz, template_pz, style_profile, created_at, updated_at}`
  - Version list item: `{id, label, note, created_at}`
  - Create version body: `{label?: str, note?: str}`
  - Put body: `{data, template_tz?, template_pz?, style_profile?, name?}` — at minimum `data` required; if templates omitted, leave unchanged
  - Health: `{ok: true, db: true|false}`

- [ ] **Step 1: Write API tests with `TestClient`**

Flow: create project → get → put (versions still 0) → post version → put again → restore → assert data rolled back → render → download docx.

Map errors: missing → 404; duplicate slug → 409; DB down → 503 on health `db: false` and mutating routes.

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Rewrite `api/main.py` routes**

Remove old endpoints. Use `get_session()`. For render: write under `OUT_DIR / project.slug`. Download: resolve under that slug dir (still block path traversal; only `.docx`).

Pydantic models for bodies. Serialize UUID/timestamps as strings in JSON.

- [ ] **Step 4: Pass API tests**

```bash
python -m unittest tests.test_api_projects -v
```

- [ ] **Step 5: Commit**

```bash
git commit -m "Replace file API with Postgres project and version endpoints."
```

---

### Task 7: Web client + ProjectBar UI

**Files:**
- Modify: `web/src/api/client.ts`
- Create: `web/src/components/ProjectBar.tsx`
- Modify: `web/src/App.tsx`, `web/src/App.css`
- Manual check: `npm run build`

**Interfaces:**
- Produces client helpers: `listProjects`, `createProject`, `getProject(id)`, `putProject(id, body)`, `listVersions`, `createVersion`, `restoreVersion`, `renderProject`, `fetchDocxBlob(projectId, filename)`
- `ProjectBar` props: `projectId`, `projects`, `onSelect`, `onCreated`, `onSaveVersion`, `onRestore`, `versions`

- [ ] **Step 1: Rewrite `client.ts`** to new routes (delete old `getProject()` no-id helpers)

- [ ] **Step 2: Add `ProjectBar`**

Minimal topbar controls (match existing CSS language — buttons/`seg`, no new design system):

- `<select>` of projects + button «Новый проект» (prompt for name)
- «Сохранить версию» (optional `prompt` for label)
- «История» `<select>` of versions + «Откатить»

Persist last `projectId` in `localStorage` key `vitalych.projectId`.

- [ ] **Step 3: Wire `App.tsx`**

On load: `listProjects` → pick stored/first/create default via API if empty → `getProject(id)` sets `data`, both templates cached: keep `template` state for active doc; also keep `templateTz`/`templatePz`/`styleProfile` in state for full PUT.

`saveProject` / `saveTemplate` / `generate` use `putProject(projectId, { data, template_tz, template_pz, style_profile })` then render/download with project id.

- [ ] **Step 4: `cd web && npm run build`** — must succeed

- [ ] **Step 5: Commit**

```bash
git commit -m "Switch React editor to multi-project API with version checkpoints."
```

---

### Task 8: Deploy + README

**Files:**
- Modify: `scripts/deploy.sh`
- Modify: `deploy/vitalych.service`, `deploy/vitalych.user.service`
- Modify: `README.md`
- Optional: remove rsync excludes for `data/project.yaml` / `templates/*.j2` as live source-of-truth protection (examples may still sync)

**Interfaces:**
- Deploy remote steps after sync:
  1. `docker compose up -d`
  2. `.venv` pip install
  3. `alembic upgrade head`
  4. `python scripts/seed_from_files.py`
  5. restart systemd with `EnvironmentFile=-/path/.env`

- [ ] **Step 1: Update systemd units**

```ini
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=-/opt/vitalych/.env
```

(user unit: `EnvironmentFile=-%h/vitalych/.env` or absolute DIR — match deploy script’s `REMOTE_ABS`)

- [ ] **Step 2: Update `deploy.sh` remote script**

Ensure Docker available; `docker compose up -d`; run alembic + seed; restart service. Document that operator must create `.env` on server once (copy from `.env.example`, strong password).

- [ ] **Step 3: README**

Document: `docker compose up -d`, `alembic upgrade head`, seed, API/UI, CLI `--project`, note auth still open on LAN.

- [ ] **Step 4: Commit**

```bash
git commit -m "Wire deploy and README for Compose Postgres and migrations."
```

---

### Task 9: End-to-end verification

**Files:** none new (verification only)

- [ ] **Step 1: Fresh local path**

```bash
docker compose down -v   # only if OK to wipe local DB
docker compose up -d
alembic upgrade head
python scripts/seed_from_files.py
python -m unittest discover -s tests -v
cd web && npm run build
```

Expected: all tests OK; frontend builds.

- [ ] **Step 2: Manual API smoke**

```bash
uvicorn api.main:app --port 8010
curl -s localhost:8010/api/health
curl -s localhost:8010/api/projects
# create second project, checkpoint, restore, render
```

- [ ] **Step 3: Fix any failures found; commit if needed**

- [ ] **Step 4: Final commit only if fixes landed**

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Postgres 16 Compose DB-only | 1, 8 |
| `projects` + `project_versions` schema | 2 |
| Explicit checkpoints / no auto on PUT | 3, 6 |
| Atomic snapshot (data+templates+style) | 3, 6 |
| API table + breaking old routes | 6 |
| CLI `--project` / `--project-id`; `--data` kept | 5 |
| Seed from files when empty | 4, 8 |
| UI multi-project + versions | 7 |
| Deploy alembic + DATABASE_URL | 8 |
| Render `out/{slug}/` | 5, 6 |
| Tests (store, API, render) | 1–6, 9 |
| No auth | all (omitted) |

No TBD placeholders. Types/names aligned: `project_store` ↔ API ↔ client.
