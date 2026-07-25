# Soft Delete Projects & Versions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Soft-delete projects and versions via `deleted_at`, expose DELETE endpoints (project already exists; add version), and add icon-only trash controls in the ProjectBar UI.

**Architecture:** Nullable `deleted_at` on `projects` and `project_versions`; all list/get/mutate paths filter live rows (`deleted_at IS NULL`); `DELETE` sets the timestamp instead of `session.delete`. Partial unique index on `projects.slug` among live rows. No restore API — ops clear `deleted_at` in SQL.

**Tech Stack:** PostgreSQL 16, Alembic, SQLAlchemy 2, FastAPI, React/Vite, unittest + TestClient.

## Global Constraints

- Work only on branch / worktree `feature/postgres-projects-versions`.
- Soft delete only — never hard-delete for these user actions.
- No restore API or UI.
- Soft-deleting a project does **not** set `deleted_at` on its versions.
- Slug uniqueness: live rows only (`WHERE deleted_at IS NULL`).
- Do not touch `out/{slug}/` on delete.
- Empty project list after delete → existing `listOrCreateDefaultProject()` bootstrap.
- UI: icon-only trash buttons with `aria-label` / `title` (no button text).
- Prefer unittest (`python -m unittest`) to match existing tests.
- Confirm with `window.confirm` before delete.

---

## File structure

| Path | Responsibility |
|------|----------------|
| `src/models.py` | Add `deleted_at`; replace slug UniqueConstraint with partial unique Index |
| `alembic/versions/20260725_0002_soft_delete.py` | Migration: columns + drop/create slug constraint |
| `src/project_store.py` | Filter live rows; soft `delete_project`; add `delete_version` / `get_version` |
| `api/main.py` | Wire version DELETE; keep project DELETE (now soft via store) |
| `tests/test_models_migration.py` | Assert `deleted_at` column / soft-delete row insert |
| `tests/test_project_store.py` | Soft-delete + slug reuse + version hide |
| `tests/test_api_projects.py` | DELETE version; soft semantics; double-delete 404 |
| `web/src/api/client.ts` | `deleteProject`, `deleteVersion` |
| `web/src/components/ProjectBar.tsx` | Trash icon buttons |
| `web/src/App.tsx` | Handlers + refresh after delete |
| `web/src/App.css` | Minor icon-button tweak if needed (reuse `.btn-icon`) |

---

### Task 1: Schema — `deleted_at` + partial unique slug

**Files:**
- Modify: `src/models.py`
- Create: `alembic/versions/20260725_0002_soft_delete.py`
- Modify: `tests/test_models_migration.py`

**Interfaces:**
- Consumes: existing revision `8857b0637bb6` as `down_revision`
- Produces: `Project.deleted_at: datetime | None`, `ProjectVersion.deleted_at: datetime | None`; index name `uq_projects_slug_alive`

- [ ] **Step 1: Extend migration test to require `deleted_at`**

Append to `tests/test_models_migration.py`:

```python
    def test_project_and_version_have_deleted_at(self) -> None:
        from datetime import datetime, timezone
        from src.models import ProjectVersion

        pid = uuid.uuid4()
        vid = uuid.uuid4()
        now = datetime.now(timezone.utc)
        with get_session() as s:
            s.add(Project(
                id=pid,
                slug=f"sd-{pid.hex[:8]}",
                name="Soft",
                data={"meta": {"title": "x"}},
                template_tz="# tz",
                template_pz="# pz",
                style_profile="page:\n  size: A4\n",
                deleted_at=now,
            ))
            s.add(ProjectVersion(
                id=vid,
                project_id=pid,
                label="v1",
                note=None,
                data={"meta": {"title": "x"}},
                template_tz="# tz",
                template_pz="# pz",
                style_profile="page:\n  size: A4\n",
                deleted_at=now,
            ))
        with get_session() as s:
            project = s.scalar(select(Project).where(Project.id == pid))
            self.assertIsNotNone(project)
            assert project is not None
            self.assertIsNotNone(project.deleted_at)
            version = s.scalar(select(ProjectVersion).where(ProjectVersion.id == vid))
            self.assertIsNotNone(version)
            assert version is not None
            self.assertIsNotNone(version.deleted_at)
```

Add `ProjectVersion` to the existing import from `src.models` if the test file imports only `Project`.

- [ ] **Step 2: Run test — expect failure**

Run: `python -m unittest tests.test_models_migration.ModelsMigrationTest.test_project_and_version_have_deleted_at -v`  
Expected: FAIL (`TypeError: 'deleted_at' is an invalid keyword` or column missing)

- [ ] **Step 3: Update models**

In `src/models.py`:

- Remove `UniqueConstraint("slug", name="uq_projects_slug")` from `Project.__table_args__`
- Add to `Project`:

```python
deleted_at: Mapped[Optional[datetime]] = mapped_column(
    DateTime(timezone=True),
    nullable=True,
)
```

- Set `Project.__table_args__` to:

```python
__table_args__ = (
    Index(
        "uq_projects_slug_alive",
        "slug",
        unique=True,
        postgresql_where=text("deleted_at IS NULL"),
    ),
)
```

(`Index` and `text` are already imported.)

- Add the same `deleted_at` column to `ProjectVersion`.

- [ ] **Step 4: Add Alembic migration**

Create `alembic/versions/20260725_0002_soft_delete.py`:

```python
"""soft delete deleted_at

Revision ID: a1b2c3d4e5f6
Revises: 8857b0637bb6
Create Date: 2026-07-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "8857b0637bb6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("project_versions", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.drop_constraint("uq_projects_slug", "projects", type_="unique")
    op.create_index(
        "uq_projects_slug_alive",
        "projects",
        ["slug"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_projects_slug_alive", table_name="projects")
    op.create_unique_constraint("uq_projects_slug", "projects", ["slug"])
    op.drop_column("project_versions", "deleted_at")
    op.drop_column("projects", "deleted_at")
```

Use a real unique revision id (e.g. `uuid.uuid4().hex[:12]`) if preferred; keep `down_revision = "8857b0637bb6"`.

- [ ] **Step 5: Apply migration**

Run: `alembic upgrade head`  
Expected: success, no errors

- [ ] **Step 6: Run migration test — expect pass**

Run: `python -m unittest tests.test_models_migration -v`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/models.py alembic/versions/20260725_0002_soft_delete.py tests/test_models_migration.py
git commit -m "Add deleted_at columns and live-only slug uniqueness."
```

---

### Task 2: Store soft-delete semantics

**Files:**
- Modify: `src/project_store.py`
- Modify: `tests/test_project_store.py`

**Interfaces:**
- Consumes: `Project.deleted_at`, `ProjectVersion.deleted_at` from Task 1
- Produces:
  - `delete_project(session, project) -> None` — sets `deleted_at`, does not `session.delete`
  - `get_version(session, project_id: uuid.UUID, version_id: uuid.UUID) -> ProjectVersion | None` — live only
  - `delete_version(session, version: ProjectVersion) -> None` — sets `deleted_at`
  - `list_projects` / `get_project` / `get_project_by_slug` / `_slug_taken` / `list_versions` — live rows only

- [ ] **Step 1: Write failing store tests for soft delete**

Add to `tests/test_project_store.py` (import `delete_version`, `get_version` when implementing; for the failing test, import what you need):

```python
    def test_soft_delete_project_and_version(self) -> None:
        suffix = uuid.uuid4().hex[:8]
        slug = f"soft-{suffix}"
        payload = {
            "data": {"meta": {"title": "a"}},
            "template_tz": "# tz",
            "template_pz": "# pz",
            "style_profile": "page:\n  size: A4\n",
        }
        with get_session() as session:
            project = create_project(session, name="Soft", slug=slug, **payload)
            project_id = project.id
            version = create_version(session, project, label="keep-me")
            version_id = version.id

        with get_session() as session:
            project = get_project(session, project_id)
            self.assertIsNotNone(project)
            assert project is not None
            version = get_version(session, project_id, version_id)
            self.assertIsNotNone(version)
            assert version is not None
            delete_version(session, version)

        with get_session() as session:
            self.assertIsNone(get_version(session, project_id, version_id))
            self.assertEqual(list_versions(session, project_id), [])
            # Row still present with deleted_at set
            from sqlalchemy import select
            from src.models import ProjectVersion
            raw = session.scalar(select(ProjectVersion).where(ProjectVersion.id == version_id))
            self.assertIsNotNone(raw)
            assert raw is not None
            self.assertIsNotNone(raw.deleted_at)

            project = get_project(session, project_id)
            self.assertIsNotNone(project)
            assert project is not None
            delete_project(session, project)

        with get_session() as session:
            self.assertIsNone(get_project(session, project_id))
            self.assertFalse(any(p.id == project_id for p in list_projects(session)))
            from sqlalchemy import select
            from src.models import Project
            raw_p = session.scalar(select(Project).where(Project.id == project_id))
            self.assertIsNotNone(raw_p)
            assert raw_p is not None
            self.assertIsNotNone(raw_p.deleted_at)
            # Versions of soft-deleted project are unchanged (still have deleted_at from version delete only)
            raw_v = session.scalar(select(ProjectVersion).where(ProjectVersion.id == version_id))
            self.assertIsNotNone(raw_v)

            # Slug reusable after soft delete
            again = create_project(session, name="Soft Again", slug=slug, **payload)
            self.assertEqual(again.slug, slug)
            delete_project(session, again)
```

Also update the end of `test_create_update_does_not_version_checkpoint_restore_and_slug_conflict`: after `delete_project`, change expectations from hard-delete emptiness to soft-delete:

```python
        with get_session() as session:
            self.assertIsNone(get_project(session, project_id))
            # Soft delete: versions rows may remain; list_versions filters by live project usage —
            # list_versions still returns live versions for that project_id even if project is soft-deleted.
            # Spec: versions are not soft-deleted with the project. Prefer asserting get_project is None
            # and list_projects excludes the id (already covered above). Remove assertEqual(list_versions, []).
```

Replace:

```python
            self.assertIsNone(get_project(session, project_id))
            self.assertEqual(list_versions(session, project_id), [])
```

with:

```python
            self.assertIsNone(get_project(session, project_id))
            # Soft delete keeps version rows; they still list by project_id until version soft-deleted.
            self.assertEqual(len(list_versions(session, project_id)), 1)
```

(After that test's flow there is exactly one version.)

- [ ] **Step 2: Run tests — expect failure**

Run: `python -m unittest tests.test_project_store.ProjectStoreTest.test_soft_delete_project_and_version -v`  
Expected: FAIL (`ImportError` for `get_version` / `delete_version`, or hard-delete semantics)

- [ ] **Step 3: Implement store changes**

In `src/project_store.py`:

```python
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


def get_project(session: Session, project_id: uuid.UUID) -> Project | None:
    project = session.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        return None
    return project


def get_project_by_slug(session: Session, slug: str) -> Project | None:
    return session.scalar(
        select(Project).where(Project.slug == slug, Project.deleted_at.is_(None))
    )


def delete_project(session: Session, project: Project) -> None:
    project.deleted_at = datetime.now(timezone.utc)
    session.add(project)
    session.flush()


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
```

Leave `create_version` / `restore_version` as-is (callers use live project + live version lookups).

- [ ] **Step 4: Run store tests — expect pass**

Run: `python -m unittest tests.test_project_store -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/project_store.py tests/test_project_store.py
git commit -m "Soft-delete projects and versions in the store layer."
```

---

### Task 3: API — soft delete project (already routed) + DELETE version

**Files:**
- Modify: `api/main.py`
- Modify: `tests/test_api_projects.py`

**Interfaces:**
- Consumes: `delete_project`, `get_version`, `delete_version` from Task 2
- Produces: `DELETE /api/projects/{project_id}/versions/{version_id}` → `{"ok": true}` or 404

- [ ] **Step 1: Write failing API tests**

Add to `tests/test_api_projects.py`:

```python
    def test_soft_delete_version_and_project(self) -> None:
        suffix = uuid.uuid4().hex[:8]
        slug = f"api-soft-{suffix}"
        create = self.client.post(
            "/api/projects",
            json={"name": f"API Soft {suffix}", "slug": slug},
        )
        self.assertEqual(create.status_code, 200, create.text)
        project_id = create.json()["id"]
        # Do not _track for final assert on slug reuse cleanup path — track then untrack after delete
        self._track(project_id)

        ver = self.client.post(
            f"/api/projects/{project_id}/versions",
            json={"label": "v1"},
        )
        self.assertEqual(ver.status_code, 200, ver.text)
        version_id = ver.json()["id"]

        deleted_v = self.client.delete(
            f"/api/projects/{project_id}/versions/{version_id}"
        )
        self.assertEqual(deleted_v.status_code, 200)
        self.assertEqual(deleted_v.json(), {"ok": True})

        listed = self.client.get(f"/api/projects/{project_id}/versions")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json(), [])

        again_v = self.client.delete(
            f"/api/projects/{project_id}/versions/{version_id}"
        )
        self.assertEqual(again_v.status_code, 404)

        restore = self.client.post(
            f"/api/projects/{project_id}/versions/{version_id}/restore"
        )
        self.assertEqual(restore.status_code, 404)

        deleted_p = self.client.delete(f"/api/projects/{project_id}")
        self.assertEqual(deleted_p.status_code, 200)
        self.assertEqual(deleted_p.json(), {"ok": True})
        self.created_ids.remove(project_id)

        self.assertEqual(self.client.get(f"/api/projects/{project_id}").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/projects/{project_id}").status_code, 404)

        # Slug reusable
        recreate = self.client.post(
            "/api/projects",
            json={"name": f"API Soft Re {suffix}", "slug": slug},
        )
        self.assertEqual(recreate.status_code, 200, recreate.text)
        self._track(recreate.json()["id"])
```

Also add to `test_missing_project_and_version_404` a DELETE missing version line:

```python
        self.assertEqual(
            self.client.delete(
                f"/api/projects/{missing_id}/versions/{uuid.uuid4()}"
            ).status_code,
            404,
        )
```

(and after a real project is created in that test, delete a random version id → 404).

- [ ] **Step 2: Run test — expect failure**

Run: `python -m unittest tests.test_api_projects.ApiProjectsTest.test_soft_delete_version_and_project -v`  
Expected: FAIL (405/404 — route missing)

- [ ] **Step 3: Wire API**

In `api/main.py` imports, add `delete_version`, `get_version`.

Add route (near restore):

```python
@app.delete("/api/projects/{project_id}/versions/{version_id}")
def api_delete_version(project_id: uuid.UUID, version_id: uuid.UUID) -> dict[str, bool]:
    try:
        with get_session() as session:
            _require_project(session, project_id)
            version = get_version(session, project_id, version_id)
            if version is None:
                raise HTTPException(status_code=404, detail="Version not found")
            delete_version(session, version)
            return {"ok": True}
    except HTTPException:
        raise
    except (SQLAlchemyError, OSError) as e:
        raise HTTPException(status_code=503, detail="Database unavailable") from e
```

Optionally refactor `api_restore_version` to use `get_version` instead of building a dict from `list_versions` (same 404 behavior).

Existing `api_delete_project` needs no logic change once store soft-deletes.

- [ ] **Step 4: Run API tests — expect pass**

Run: `python -m unittest tests.test_api_projects -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/main.py tests/test_api_projects.py
git commit -m "Add soft-delete version API and cover soft-delete semantics."
```

---

### Task 4: Frontend — client + trash icons + handlers

**Files:**
- Modify: `web/src/api/client.ts`
- Modify: `web/src/components/ProjectBar.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/App.css` (only if icon alignment needs a small rule)

**Interfaces:**
- Consumes: `DELETE /api/projects/{id}`, `DELETE /api/projects/{id}/versions/{vid}`
- Produces:
  - `deleteProject(id: string): Promise<{ ok: boolean }>`
  - `deleteVersion(projectId: string, versionId: string): Promise<{ ok: boolean }>`
  - `ProjectBar` props: `onDeleteProject: () => void`, `onDeleteVersion: (versionId: string) => void`

- [ ] **Step 1: Add client helpers**

In `web/src/api/client.ts` after `putProject`:

```typescript
export async function deleteProject(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  return parseJson<{ ok: boolean }>(res)
}

export async function deleteVersion(
  projectId: string,
  versionId: string,
): Promise<{ ok: boolean }> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`,
    { method: 'DELETE' },
  )
  return parseJson<{ ok: boolean }>(res)
}
```

- [ ] **Step 2: Add trash buttons to ProjectBar**

Update props and UI in `web/src/components/ProjectBar.tsx`:

- Add `onDeleteProject: () => void` and `onDeleteVersion: (versionId: string) => void`
- Import nothing heavy — inline SVG trash icon:

```tsx
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v10h-2V9zm4 0h2v10h-2V9zM7 9h2v10H7V9zm-1 12h12a1 1 0 0 0 1-1V7H5v13a1 1 0 0 0 1 1z"
      />
    </svg>
  )
}
```

(Use any compact trash path; keep 14×14.)

- After «Новый проект» button, add:

```tsx
      <button
        type="button"
        className="btn-icon btn-danger"
        disabled={disabled || !projectId}
        onClick={onDeleteProject}
        aria-label="Удалить проект"
        title="Удалить проект"
      >
        <TrashIcon />
      </button>
```

- After «Откатить» button, add:

```tsx
      <button
        type="button"
        className="btn-icon btn-danger"
        disabled={disabled || !versionId}
        onClick={() => onDeleteVersion(versionId)}
        aria-label="Удалить версию"
        title="Удалить версию"
      >
        <TrashIcon />
      </button>
```

No visible text on either button.

- [ ] **Step 3: Wire App handlers**

In `web/src/App.tsx`:

- Import `deleteProject`, `deleteVersion`
- Add handlers:

```tsx
  const onDeleteProject = async () => {
    if (!projectId) return
    const name = projects.find((p) => p.id === projectId)?.name ?? 'проект'
    if (
      !window.confirm(
        `Удалить проект «${name}»? Его можно будет восстановить только из базы.`,
      )
    ) {
      return
    }
    setStatus('Удаление проекта…')
    try {
      await deleteProject(projectId)
      const list = await listOrCreateDefaultProject()
      setProjects(list)
      const nextId = list[0]?.id
      if (!nextId) {
        setError('Нет проектов')
        return
      }
      await openProject(nextId, doc)
      setStatus('Проект удалён')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e))
    }
  }

  const onDeleteVersion = async (versionId: string) => {
    if (!projectId) return
    if (!window.confirm('Удалить выбранную версию?')) {
      return
    }
    setStatus('Удаление версии…')
    try {
      await deleteVersion(projectId, versionId)
      await refreshVersions(projectId)
      setStatus('Версия удалена')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e))
    }
  }
```

- Pass to `ProjectBar`:

```tsx
          onDeleteProject={() => void onDeleteProject()}
          onDeleteVersion={(vid) => void onDeleteVersion(vid)}
```

- [ ] **Step 4: CSS (only if needed)**

If the SVG does not center in `.btn-icon`, add:

```css
.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
```

(Merge into existing `.btn-icon` rule rather than duplicating.)

- [ ] **Step 5: Manual smoke**

1. Start API + Vite as usual for this worktree.
2. Create a project, save a version.
3. Click version trash → confirm → version disappears from History.
4. Click project trash → confirm → switches to another/new project; deleted project gone from select.
5. Create a project with the same name/slug as a soft-deleted one — should succeed.

- [ ] **Step 6: Commit**

```bash
git add web/src/api/client.ts web/src/components/ProjectBar.tsx web/src/App.tsx web/src/App.css
git commit -m "Add trash controls for soft-deleting projects and versions."
```

---

### Task 5: Full regression + plan checkbox pass

**Files:** none new

- [ ] **Step 1: Run full backend suite**

Run: `python -m unittest discover -s tests -v`  
Expected: all PASS

- [ ] **Step 2: Spec coverage check (manual)**

Confirm each spec row is done:

| Spec item | Task |
|-----------|------|
| `deleted_at` on both tables | 1 |
| Partial unique slug | 1 |
| Soft delete project (store+API) | 2–3 |
| Soft delete version endpoint | 3 |
| Lists/gets filter deleted | 2 |
| No restore API | (none added) ✓ |
| Versions not soft-deleted with project | 2 tests |
| Slug reuse | 2–3 tests |
| No `out/` cleanup | (none added) ✓ |
| Icon-only trash + confirm + bootstrap | 4 |

- [ ] **Step 3: Final commit only if uncommitted fixes remain**

```bash
git status
# if dirty:
git add -A
git commit -m "Finish soft-delete regression fixes."
```

Do not commit `out/` artifacts.

---

## Self-review (plan vs spec)

1. **Spec coverage:** Data model, API, UI, tests, ops restore SQL (documented in spec; no code task needed), out-of-scope items respected.
2. **Placeholders:** None — concrete code, paths, commands.
3. **Type consistency:** `delete_project` / `delete_version` / `get_version` names match across Tasks 2–4; client helpers match App imports.
