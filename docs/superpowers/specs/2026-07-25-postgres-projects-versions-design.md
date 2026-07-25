# Postgres: multi-project storage + explicit version checkpoints

Date: 2026-07-25  
Status: approved for planning  
Scope: MVP stage (auth deferred)

## Goal

Replace file-based persistence (`data/project.yaml`, `templates/*.j2`, `style-profile.yaml`) with PostgreSQL so Vitalych supports:

1. **Multiple projects** (each with its own data, ТЗ/ПЗ templates, and DOCX style profile)
2. **Explicit version checkpoints** (manual “save version”, not auto-snapshot on every save)

Out of scope for this MVP: user accounts, roles, and access control. Anyone who can reach the API can read/write all projects (same trust model as today’s LAN deploy).

Future (not this spec): multi-user auth (original goal C).

## Current state

- Source of truth: YAML + Jinja files on disk
- FastAPI (`api/main.py`) GETs/PUTs a single project and templates; render writes `out/`
- React UI edits one global project; CLI (`python -m src.render --data …`) reads YAML
- No database, Docker Compose, ORM, or migrations

## Approach

**Document-store in Postgres (JSONB)** — keep the nested project payload as JSONB (same shape as today’s YAML), store templates and style profile as text, add a versions table for full atomic snapshots.

Rejected alternatives:

- Fully normalized relational tables for parties/stages/modules — high cost, fights `_ui.custom_fields`
- Hybrid (DB metadata + files for templates) — conflicts with “everything in Postgres” and complicates atomic checkpoints

## Architecture

```
[React UI] ──HTTP──► [FastAPI] ──SQLAlchemy──► [Postgres 16]
                           │
                           ├── Alembic migrations
                           └── render → out/{slug}/

[CLI src.render] ──DATABASE_URL──► [Postgres] (by slug or id)
[Docker Compose] ── only Postgres service (app stays uvicorn/systemd)
```

Stack:

- PostgreSQL 16 via Docker Compose
- FastAPI + SQLAlchemy 2.x + Alembic
- `DATABASE_URL` from environment (`.env` not committed)
- Sync SQLAlchemy is acceptable for MVP (async optional later)

## Data model

### `projects` (current state)

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID PK | |
| `slug` | TEXT UNIQUE | CLI/URL id, e.g. `demo` |
| `name` | TEXT | Display name |
| `data` | JSONB | Former `project.yaml` body |
| `template_tz` | TEXT | Former `templates/tz.md.j2` |
| `template_pz` | TEXT | Former `templates/pz.md.j2` |
| `style_profile` | TEXT | Former `style-profile.yaml` as text |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `project_versions` (explicit checkpoints)

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID PK | |
| `project_id` | UUID FK → `projects` ON DELETE CASCADE | |
| `label` | TEXT NULL | Optional short label |
| `note` | TEXT NULL | Optional note |
| `data` | JSONB | Snapshot |
| `template_tz` | TEXT | Snapshot |
| `template_pz` | TEXT | Snapshot |
| `style_profile` | TEXT | Snapshot |
| `created_at` | TIMESTAMPTZ | |

### Versioning rules

- Ordinary save (PUT) updates only `projects` — **no** version row
- “Save version” copies the current project row fields into `project_versions`
- Restore overwrites `projects` from the chosen version — **does not** auto-create a new checkpoint
- A checkpoint is **atomic**: data + both templates + style together

### Indexes

- Unique index on `projects.slug`
- Index on `project_versions(project_id, created_at DESC)` for listing

## API

Project-scoped routes replace the single-document endpoints.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/projects` | List `{id, slug, name, updated_at}` |
| POST | `/api/projects` | Create (`name`, optional `slug`); seed `data`/templates/style from repo example assets |
| GET | `/api/projects/{id}` | Current state (data + templates + style); `{id}` is UUID |
| PUT | `/api/projects/{id}` | Save current state (no version) |
| DELETE | `/api/projects/{id}` | Delete project and its versions |
| GET | `/api/projects/{id}/versions` | List checkpoints |
| POST | `/api/projects/{id}/versions` | Create checkpoint (`label`/`note` optional) |
| POST | `/api/projects/{id}/versions/{vid}/restore` | Restore checkpoint into current |
| POST | `/api/projects/{id}/render` | Render to `out/{slug}/` |
| GET | `/api/projects/{id}/download/{filename}` | Download generated file |

Breaking change: delete `/api/project`, `/api/template/{tz|pz}`, `/api/render`, `/api/download/{filename}`. No compatibility shim — UI and clients switch to project UUID routes in the same change.

`GET /api/health` remains; may report DB connectivity.

### Error handling

| Case | Response |
|------|----------|
| DB unavailable | 503 |
| Unknown project/version | 404 |
| Duplicate slug | 409 |
| Invalid body | 422 |
| Render template/data error | 400 (same spirit as today) |

## CLI

Primary path reads from Postgres:

```bash
python -m src.render --project demo --out out/demo/
python -m src.render --project-id <uuid> --out out/...
```

`--data path/to.yaml` remains for offline import/ad-hoc render (not the default workflow).

When rendering from DB, templates and style profile come from the project row (not filesystem defaults), unless explicitly overridden by flags.

## Seed / one-time migration

Explicit script `scripts/seed_from_files.py` (also invokable from deploy when DB has zero projects):

1. If `projects` is empty and filesystem artifacts exist (`data/project.yaml` preferred, else `project.example.yaml`, plus templates and style-profile)
2. Create project `slug=default` (name from `data.meta` if present, else `"default"`)
3. Load YAML/text into the row

Do not silently re-seed on every app boot if any project already exists.

Example YAML and templates remain in the repo as **seed assets** for new projects and for this migration, not as runtime source of truth.

## Docker and deploy

### Compose

`docker-compose.yml` runs **Postgres only**:

- Image: `postgres:16`
- Named volume for data
- Port bound to localhost `5432`
- Credentials via env / `.env`

App process stays uvicorn (local) / systemd (prod), connecting via `DATABASE_URL`.

### Local workflow

```bash
docker compose up -d
alembic upgrade head
# optional seed
uvicorn api.main:app --reload --port 8010
```

### Production (`scripts/deploy.sh`)

- Ensure Docker Compose Postgres is up on the host
- Run `alembic upgrade head` before restarting the app unit
- Provide `DATABASE_URL` to the systemd unit (EnvironmentFile)
- Stop treating live `data/project.yaml` / `templates/*.j2` as deploy-protected source of truth (repo examples can still sync)
- Never commit production DB passwords

## UI (MVP)

- Project list / selector: open existing, create new
- Editor bound to `projectId` (load/save via `/api/projects/{id}`)
- “Save version” control (optional label) + history list with restore
- Generate / download scoped to the selected project (`out/{slug}/`)

No auth UI in this stage.

## Testing

- Alembic upgrade on empty DB
- API: create → put → checkpoint → restore → render smoke
- CLI: `--project` render smoke against test DB
- Keep existing render unit tests working with fixtures (YAML path or DB fixture)

## Non-goals (this MVP)

- User accounts, passwords, RLS, per-project ACLs
- Auto-versioning on every save
- Normalizing YAML sections into many SQL tables
- Containerizing the FastAPI/UI process (Compose is DB-only)
- Real-time collaborative editing / CRDT

## Success criteria

1. Can create and switch between ≥2 projects in the UI
2. Ordinary saves do not create versions; explicit checkpoints do
3. Restore returns data + templates + style to the checkpoint state and render succeeds
4. CLI can render a project by slug using only Postgres
5. `docker compose up -d` + migrations is enough to get a working DB locally and on `10.91.0.142`
