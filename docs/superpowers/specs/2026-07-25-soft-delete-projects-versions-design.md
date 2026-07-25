# Soft delete for projects and versions

Date: 2026-07-25  
Status: approved for planning  
Scope: worktree / branch `feature/postgres-projects-versions` only  
Builds on: `2026-07-25-postgres-projects-versions-design.md`

## Goal

Allow users to remove a project or a project version from the UI and API without permanently wiping Postgres rows, so data can be restored later with a direct SQL update.

## Decisions

| Topic | Choice |
|-------|--------|
| Where | Worktree / feature branch only |
| Delete semantics | Soft delete via `deleted_at` |
| Restore API/UI | Out of scope; restore = `UPDATE … SET deleted_at = NULL` |
| Delete project → versions | Do **not** soft-delete versions; they stay attached and become unreachable while the project is deleted |
| Last / current project | Always allow delete; empty list triggers existing `listOrCreateDefaultProject()` bootstrap |
| Slug uniqueness | Unique among live rows only (`WHERE deleted_at IS NULL`) |
| Rendered `out/{slug}/` | Leave on disk |
| UI controls | Icon-only trash buttons (`aria-label` / `title`), no button text |
| Confirm | `window.confirm` before delete (same pattern as restore) |

## Approach

**Minimal soft-delete** — nullable `deleted_at` on both tables; all list/get/mutate paths ignore soft-deleted rows; `DELETE` sets the timestamp.

Rejected alternatives:

- Soft-delete + restore API/UI — useful later, out of scope now
- Tombstone table — more moving parts without benefit for MVP
- Hard delete only — conflicts with “restore from Postgres programmatically”

## Data model

### Schema changes

**`projects`**

- Add `deleted_at TIMESTAMPTZ NULL`
- Drop global `UNIQUE(slug)` / `uq_projects_slug`
- Add partial unique index: `UNIQUE (slug) WHERE deleted_at IS NULL`

**`project_versions`**

- Add `deleted_at TIMESTAMPTZ NULL`

Hard-delete ORM cascade / FK `ON DELETE CASCADE` remain for a possible future purge path; soft delete does not use them.

### Semantics

- Soft delete project: set `projects.deleted_at = now()`. Version rows unchanged.
- Soft delete version: set `project_versions.deleted_at = now()`.
- Manual restore: clear `deleted_at` on the project (and on versions only if they were soft-deleted individually).

## API and store

Existing `DELETE /api/projects/{id}` switches from hard delete to soft delete.

New endpoint:

| Method | Path | Behavior |
|--------|------|----------|
| DELETE | `/api/projects/{id}/versions/{vid}` | Soft-delete version; `{"ok": true}` |

Filtering / errors:

- `list_projects`, `list_versions`: `deleted_at IS NULL` only
- `get_project` and all project-scoped ops: treat soft-deleted project as missing → **404**
- Version ops (list, create, restore, delete): soft-deleted version → **404**; restore cannot target a soft-deleted version
- Double delete (already soft-deleted) → **404**
- Create project: slug conflict only against live rows (partial unique + existing IntegrityError → 409 mapping)

No restore endpoints. `out/{slug}/` is not cleaned on delete.

## UI

Files: `web/src/api/client.ts`, `web/src/components/ProjectBar.tsx`, `web/src/App.tsx` (+ minimal CSS if needed).

- Trash icon button for current project; trash icon button for selected version
- Icons only; accessible name via `aria-label` / `title` (e.g. «Удалить проект», «Удалить версию»)
- Confirm copy:
  - Project: «Удалить проект «…»? Его можно будет восстановить только из базы.»
  - Version: «Удалить выбранную версию?»
- After project delete: refresh via `listOrCreateDefaultProject()`, select another or newly created project, update `localStorage`
- After version delete: refresh version list; reset version dropdown selection if needed
- Client helpers: `deleteProject(id)`, `deleteVersion(projectId, versionId)`

## Testing

Store / API tests (extend existing suites):

- Soft delete project removes it from list/get; versions remain in DB with `deleted_at NULL`
- Soft delete version removes it from version list; restore of that id → 404
- Double delete → 404
- After soft-deleted project, a new project may reuse the same slug
- `DELETE` responses remain `{"ok": true}` with 200

No new frontend e2e.

## Out of scope

- Restore API or UI
- Soft-deleting all versions when a project is deleted
- Cleaning or renaming `out/{slug}/`
- Auth / who-can-delete
- Hard purge / retention jobs
- Merging this branch into main (separate work)

## Manual restore (ops)

```sql
-- restore project
UPDATE projects SET deleted_at = NULL WHERE id = '<uuid>';

-- restore a soft-deleted version (if it was deleted individually)
UPDATE project_versions SET deleted_at = NULL WHERE id = '<uuid>';
```
