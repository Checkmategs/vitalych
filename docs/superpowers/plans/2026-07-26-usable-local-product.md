# Usable Local Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship HTML preview, grammatical cases, configurable GOST frame presets, and minimal workspace/ArtifactStore so Vitalych is usable locally and SaaS-ready without auth.

**Architecture:** Extend Jinja render with cases + preview endpoint (MD→HTML); apply frame from style-profile in DOCX/CSS; scope projects by workspace and write artifacts via LocalArtifactStore.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Jinja2, Python `markdown`, python-docx, React/Vite, Postgres.

## Global Constraints

- No auth, no PDF, no wizard, no MD file download (clipboard copy only)
- Keep dirty-flush + manual save for projects/versions
- Spec: `docs/superpowers/specs/2026-07-26-usable-local-product-design.md`
- Prefer small focused modules; match existing API/test style in `tests/test_api_projects.py`

## File map

| Path | Role |
|------|------|
| `src/cases.py` | Wrap data + Jinja `case` filter + warnings |
| `src/preview.py` | Jinja→MD→HTML + collect warnings |
| `src/artifacts.py` | ArtifactStore protocol + LocalArtifactStore |
| `src/docx_frame.py` | Apply frame/stamp to Document from profile |
| `src/render.py` | Use cases filter; optional return markdown without write |
| `src/md_to_docx.py` | Call frame applicator |
| `src/models.py` / `project_store.py` | Workspace + workspace_id |
| `alembic/versions/*_workspaces.py` | Migration |
| `api/main.py` | preview endpoint; wire ArtifactStore |
| `style-profile.yaml` | Default `frame:` block |
| `web/src/components/PreviewPane.tsx` | HTML preview + copy MD + errors |
| `web/src/components/FieldEditModal.tsx` | Cases UI |
| `web/src/components/FramePresetSelect.tsx` | Preset picker |
| `web/src/App.tsx` / `App.css` | Template/Preview toggle |
| `web/src/api/client.ts` | preview API |
| `requirements.txt` | add `markdown` |
| `tests/test_cases.py`, `test_preview.py`, `test_docx_frame.py`, `test_artifacts.py` | Unit/API tests |

---

### Task 1: Cases + preview backend

**Files:**
- Create: `src/cases.py`, `src/preview.py`, `tests/test_cases.py`, `tests/test_preview_api.py`
- Modify: `src/render.py`, `api/main.py`, `requirements.txt`

**Interfaces:**
- Produces: `prepare_render_data(data) -> tuple[dict, list[Warning]]`, Jinja env with `case` filter; `preview_document(...) -> PreviewResult`; `POST /api/projects/{id}/preview`

- [ ] **Step 1: Add `markdown` dependency**

Add `markdown>=3.5` to `requirements.txt` and install.

- [ ] **Step 2: Write failing tests for cases**

```python
# tests/test_cases.py
from src.cases import apply_case, prepare_render_data

def test_bare_string_case_falls_back():
    assert apply_case("ООО Ромашка", "gen") == "ООО Ромашка"

def test_wrapped_value_gen():
    data, warnings = prepare_render_data({
        "parties": {"customer": {"value": "ООО Ромашка", "cases": {"gen": "ООО Ромашки"}}}
    })
    # after prepare, parties.customer stringifies / case filter works via env — unit test apply_case on wrapped
    assert apply_case({"value": "ООО Ромашка", "cases": {"gen": "ООО Ромашки"}}, "gen") == "ООО Ромашки"
    assert apply_case({"value": "ООО Ромашка", "cases": {"gen": "ООО Ромашки"}}, "nom") == "ООО Ромашка"
```

- [ ] **Step 3: Implement `src/cases.py`**

- `CASE_KEYS = ("gen", "dat", "acc", "ins", "pre")`
- `nominative(value)` — unwrap dict with `value` key or return str
- `apply_case(value, case_key)` — nom/gen/…
- `case_filter` for Jinja; track missing cases on a thread-local or mutable list passed via env.globals
- `prepare_render_data` — shallow-walk optional; prefer filter-only approach so templates keep `{{ parties.customer }}` working: custom `CaseString` or Jinja Undefined-safe wrapper that `__str__` → nominative

Recommended: class `CasedValue` with `__str__` = nominative; register filter `case`.

Also make plain strings in templates still work when printed.

- [ ] **Step 4: Implement `src/preview.py`**

```python
@dataclass
class PreviewResult:
    markdown: str
    html: str
    warnings: list[dict]

def preview_document(template_key, data, template_tz, template_pz, style_profile_text=None) -> PreviewResult:
    # Environment DictLoader + StrictUndefined + case filter
    # render md, markdown.markdown(...), attach frame CSS class from profile
```

- [ ] **Step 5: Add `render_markdown_content` in `src/render.py`** that returns `str` (no disk write), using same env/case filter as preview. Point `render_document_content` to use it before `_write_rendered`.

- [ ] **Step 6: API `POST /api/projects/{project_id}/preview`**

Accept optional overrides; return PreviewResult JSON; map UndefinedError → 400 with `{detail: {message, kind}}`.

- [ ] **Step 7: Tests pass; commit**

```bash
pytest tests/test_cases.py tests/test_preview_api.py -v
git add -A && git commit -m "feat: add cases filter and HTML preview API"
```

---

### Task 2: Preview UI + copy MD

**Files:**
- Create: `web/src/components/PreviewPane.tsx`
- Modify: `web/src/App.tsx`, `web/src/App.css`, `web/src/api/client.ts`

**Interfaces:**
- Consumes: `POST /api/projects/{id}/preview`
- Produces: center pane mode `template | preview`

- [ ] **Step 1: Add `previewProject` in `web/src/api/client.ts`**

```ts
export type PreviewResult = {
  markdown: string
  html: string
  warnings: { code: string; message: string; path?: string }[]
}

export async function previewProject(
  projectId: string,
  body: {
    template: TemplateKey
    data?: ProjectData
    template_tz?: string
    template_pz?: string
    style_profile?: string
  },
): Promise<PreviewResult>
```

Parse 400 detail object for errors.

- [ ] **Step 2: Build `PreviewPane`**

Props: `html`, `markdown`, `warnings`, `error`, `loading`, `onRefresh`, `onCopyMarkdown`.

- [ ] **Step 3: Wire App**

State `centerMode: 'template' | 'preview'`. Segmented control above center. When switching to preview or on debounce (400ms) while in preview + dirty/content change, call preview with editor payload. Copy MD → clipboard + toast.

- [ ] **Step 4: CSS** for preview prose (Times-like), frame classes `.preview-frame--none|frame_only|stamp_compact`, error box.

- [ ] **Step 5: Manual smoke + commit**

```bash
git add web/src && git commit -m "feat: add HTML preview pane and copy markdown"
```

---

### Task 3: Cases UI in FieldEditModal

**Files:**
- Modify: `web/src/components/FieldEditModal.tsx`, `web/src/schema/fields.ts` (helpers for get/set cases)
- Test: optional vitest if present; else rely on manual + backend tests

**Interfaces:**
- Consumes: wrapped value shape `{ value, cases }`
- Produces: `getFieldNominative`, `setFieldCases` helpers

- [ ] **Step 1: Helpers in `fields.ts`**

```ts
export type CaseKey = 'gen' | 'dat' | 'acc' | 'ins' | 'pre'
export function readNominative(raw: unknown): string
export function readCases(raw: unknown): Partial<Record<CaseKey, string>>
export function writeCasedText(nominative: string, cases: Partial<Record<CaseKey, string>>): unknown
// if no cases filled, store bare string for compactness
```

Update `getAtPath` consumers / field value display to use `readNominative`.

- [ ] **Step 2: Replace StubLink «Настроить падежи»** with accordion inputs for gen/dat (toggle more cases).

- [ ] **Step 3: Ensure VariablesPanel shows nominative for wrapped values.**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: grammatical cases editor for text fields"
```

---

### Task 4: Frame presets (DOCX + profile + UI)

**Files:**
- Create: `src/docx_frame.py`, `tests/test_docx_frame.py`, `web/src/components/FramePresetSelect.tsx`
- Modify: `src/md_to_docx.py`, `style-profile.yaml`, `web/src/App.tsx` / header

**Interfaces:**
- Produces: `apply_frame(doc: Document, profile: dict, data: dict) -> list[warnings]`

- [ ] **Step 1: Extend default `style-profile.yaml` with `frame:` block** (`preset: none`, sample `stamp_fields`).

- [ ] **Step 2: Implement `docx_frame.py`**

- `none`: no-op  
- `frame_only`: page border via sectPr `pgBorders` or floating table — use OOXML page borders  
- `stamp_compact`: page border + footer table 2–3 rows with designation/title/developer from rendered stamp_fields (mini Jinja against data)  
- `eskd_2_2a`: delegate to `stamp_compact` + warning

- [ ] **Step 3: Call from `markdown_to_docx` after body built; pass `data` optional (add param).

Wire render path to pass project data into `markdown_to_docx`.

- [ ] **Step 4: UI `FramePresetSelect`** — updates YAML: parse style_profile, set `frame.preset`, stringify back (use simple regex/yaml via API or client-side; prefer small helper that round-trips with `js-yaml` if already available, else backend endpoint `PATCH` style — simplest: store preset in `_ui.frame_preset` AND sync into style_profile on save).  

**Chosen approach:** keep source of truth in `style_profile` text; frontend uses lightweight parse: if `js-yaml` not in package.json, add dependency or do string replace for `preset: xxx` line. Check `web/package.json` — if no yaml, add `js-yaml`.

- [ ] **Step 5: Preview CSS** reads preset from preview API (include `frame_preset` in PreviewResult).

- [ ] **Step 6: Tests + commit**

```bash
pytest tests/test_docx_frame.py -v
git commit -m "feat: configurable GOST frame presets for DOCX and preview"
```

---

### Task 5: Workspace + ArtifactStore

**Files:**
- Create: `src/artifacts.py`, `alembic/versions/xxxx_workspaces.py`, `tests/test_artifacts.py`
- Modify: `src/models.py`, `src/project_store.py`, `api/main.py`, `src/render.py` (CLI out path)

**Interfaces:**
- Produces: `LocalArtifactStore`, `get_default_workspace_id(session)`, projects.workspace_id

- [ ] **Step 1: Migration** — create `workspaces`, add `projects.workspace_id`, seed Local, backfill, set NOT NULL.

- [ ] **Step 2: Models + store create_project assigns default workspace.**

- [ ] **Step 3: `LocalArtifactStore`** root `OUT_DIR / str(workspace_id) / slug`. Update render + download to use it. Keep backward-compatible read: if old `out/{slug}/file` exists and new path missing, serve old (optional one-release shim).

- [ ] **Step 4: Tests + commit**

```bash
pytest tests/test_artifacts.py tests/test_api_projects.py -v
git commit -m "feat: workspace scoping and local artifact store"
```

---

### Task 6: Verification

- [ ] Run full pytest suite
- [ ] Run web build `npm run build` in `web/`
- [ ] Fix regressions
- [ ] Final commit if needed

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| Preview API + HTML | 1–2 |
| Copy MD | 2 |
| Cases data + filter + UI | 1, 3 |
| Frame presets | 4 |
| workspace + ArtifactStore | 5 |
| No PDF/auth/wizard/MD download | Global constraints |
