# MainHeader + mutable project versions

Date: 2026-07-25  
Status: approved  
Workspace: `.worktrees/postgres-projects-versions`  
Figma: `main-header` node `1312:47367` (file `QY0tD34gi4OwsMlqqdgVxv`)

## Goal

1. Replace the editor topbar + `ProjectBar` with a Figma-aligned `MainHeader`.
2. Make project versions **editable working states** (not immutable checkpoints only), with dual-write to the `projects` mirror and `active_version_id`.
3. Surface save/error feedback via bottom-right toasts.

Supersedes the UX parts of the earlier postgres versions design for this worktree (immutable checkpoint + separate restore). Storage stack (Postgres, soft-delete) remains.

## Out of scope

- Starter markdown picker on project create (future)
- Redesign of the three editor panes
- Auth
- Tailwind

## Data model (approach A — dual-write)

### `projects`

Unchanged columns for payload mirror (`data`, `template_tz`, `template_pz`, `style_profile`, soft-delete, timestamps), plus:

| Column | Type | Notes |
|--------|------|--------|
| `active_version_id` | UUID NULL FK → `project_versions.id` ON DELETE SET NULL | Currently loaded version |

### `project_versions`

Mutable snapshots. Add:

| Column | Type | Notes |
|--------|------|--------|
| `updated_at` | TIMESTAMPTZ | Bumped on PUT |

### Rules

- Editor always works against the **active** version; `projects` row is a mirror for list/render/CLI.
- Creating a project seeds payload into `projects` **and** creates version v1, sets `active_version_id`.
- Version select: if dirty, PUT old version; then activate new (copy version → projects mirror, set active).
- Project save: update mirror **and** active version with the same payload.
- Version save: PUT only that version’s snapshot.
- Version `+`: new version from current editor payload (optional label), then activate.
- Soft-delete project/version unchanged; if active version deleted, pick newest remaining or null.

## API

| Method | Path | Behavior |
|--------|------|----------|
| POST | `/api/projects` | Create + seed v1 + `active_version_id` |
| GET | `/api/projects/{id}` | Include `active_version_id`; body = mirror |
| PUT | `/api/projects/{id}` | Update mirror + active version (if set) |
| DELETE | `/api/projects/{id}` | Soft-delete |
| GET | `/api/projects/{id}/versions` | List (include `updated_at`) |
| GET | `/api/projects/{id}/versions/{vid}` | Full snapshot |
| POST | `/api/projects/{id}/versions` | Create from optional body payload (else mirror); activate new |
| PUT | `/api/projects/{id}/versions/{vid}` | Mutate snapshot |
| POST | `/api/projects/{id}/versions/{vid}/activate` | Mirror version → projects, set active |
| DELETE | `/api/projects/{id}/versions/{vid}` | Soft-delete |
| POST | `…/render`, GET download | Unchanged; use projects mirror |

`POST …/restore` may remain as a thin alias of activate for compatibility.

## UI — MainHeader

Layout (1440 reference, flex):

- Left (~240px): brand **Vitalych** + ТЗ/ПЗ segmented toggle
- Center: **Проект:** select + icon buttons `+` / save / trash; **Версия:** select + same trio
- Right (~280px): primary **Скачать docx**

Styling: existing CSS (no Tailwind); Figma colors (`#3b82f6`, `#e5e7eb`, trash `#fef2f2`); IBM Plex fonts; icons from Figma assets committed under `web/src/assets/`.

Removed from header: separate «Сохранить проект/шаблон», «Откатить», «Сгенерировать».

### Button mapping

| Control | Action |
|---------|--------|
| Project `+` | Create project (prompt name) |
| Project save | PUT project (mirror + active version) |
| Project trash | Soft-delete project (confirm) |
| Version `+` | Create version from editor (optional label) → activate |
| Version save | PUT active version |
| Version trash | Soft-delete selected version (confirm) |
| Version select | Dirty → PUT old; activate new |
| Скачать docx | Dirty → project-save; then render + download |

### Toasts

- Bottom-right stack (`ToastHost`)
- Success ~3s («Версия сохранена», «Проект сохранён», …)
- Errors longer / dismissible
- No status strip under the header

## Migration / backfill

For each alive project missing versions: insert a version from the current row and set `active_version_id`. Existing versions keep data; set `active_version_id` to newest if unset.

## Future

Choice of starter markdown/template on project create.
