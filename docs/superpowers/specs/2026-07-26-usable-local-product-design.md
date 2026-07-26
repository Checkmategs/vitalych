# Design: Usable local product patch (preview, cases, frame, SaaS prep)

**Date:** 2026-07-26  
**Status:** Approved (brainstorming)  
**Branch:** `feature/usable-local-product`

## Goal

Move Vitalych from “MVP that can emit DOCX” to a local single-user product that is safe to use daily and structured for a future SaaS without auth in this patch.

## Constraints

- Local / LAN trust model; **no auth**
- **No PDF**, no project wizard, no MD file download
- Keep existing project/version CRUD and dirty-flush save model
- Prefer rollback via git branch if something fails
- Future SaaS: add auth/middleware later without rewriting domain model

## In scope

1. **HTML preview** of rendered ТЗ/ПЗ + Jinja error surfacing
2. **Copy MD** button (clipboard only)
3. **Grammatical cases (падежи)** for text fields — manual forms
4. **Configurable GOST frame** via style-profile presets
5. **Minimal SaaS prep:** `workspace_id` + `ArtifactStore` abstraction

## Out of scope

- PDF export, auth, multi-user, billing
- Full ЕСКД forms 2/2а (schema slot only)
- Auto morphology (pymorphy), field history, onboarding wizard
- MD download as a file

---

## 1. Preview

### API

`POST /api/projects/{id}/preview`

Body (optional overrides for dirty editor state):

```json
{
  "template": "tz" | "pz",
  "data": {},
  "template_tz": "...",
  "template_pz": "...",
  "style_profile": "..."
}
```

If body fields omitted, use persisted project mirror.

Response 200:

```json
{
  "markdown": "...",
  "html": "...",
  "warnings": [{ "code": "missing_case", "message": "...", "path": "..." }]
}
```

Response 400 on Jinja/`StrictUndefined`/template errors:

```json
{ "detail": { "message": "...", "kind": "undefined" | "template" | "other" } }
```

### Pipeline

Jinja (`StrictUndefined` + case filter) → Markdown string → HTML (Python `markdown` lib, extensions: tables, fenced_code, nl2br as needed).

Frame CSS for preview reads `frame.preset` from style profile (simplified visual, not pixel-perfect Word).

### UI

- Toggle or tabs on center pane: **Шаблон | Превью**
- Preview pane shows HTML; toolbar: refresh (debounced on dirty) + **Скопировать MD**
- Errors shown in preview pane (not only toast)

---

## 2. Grammatical cases

### Data shape

For string leaf values that need cases, prefer wrapping:

```yaml
parties:
  customer:
    value: "ООО Ромашка"
    cases:
      gen: "ООО Ромашки"
      dat: "ООО Ромашке"
```

Backward compatible: bare string `"ООО Ромашка"` remains valid (= nominative only).

Default enabled cases in UI: `gen`, `dat`. Optional: `acc`, `ins`, `pre`.

Storage of which cases are enabled for a field: `_ui.field_cases[slug] = ["gen","dat"]` (optional; if absent, show gen+dat).

### Jinja

- Accessing a wrapped field as string → nominative (`value`)
- Filter: `{{ parties.customer | case('gen') }}` → gen or fallback to nominative + warning collected when previewing
- Bare strings: `| case('gen')` returns the string and may emit warning

Implementation: wrap data before render with a small proxy/dict helper in `src/cases.py`.

### UI

Replace stub «Настроить падежи» in `FieldEditModal` with editable case inputs for text/textarea fields.

---

## 3. Frame presets

### style-profile.yaml

```yaml
frame:
  preset: none  # none | frame_only | stamp_compact | eskd_2_2a (later)
  stamp_fields:
    designation: "{{ system.topic_code }}"
    title: "{{ system.name }}"
    developer: "{{ parties.developer }}"
```

- `none` — current behavior (margins + page number)
- `frame_only` — border rectangle in header/footer or section
- `stamp_compact` — frame + compact bottom stamp table; cells filled by rendering `stamp_fields` templates against project data
- `eskd_2_2a` — accepted in schema; if selected before implementation, fall back to `stamp_compact` with warning

### DOCX

Extend `src/md_to_docx.py` (or `src/docx_frame.py`) to apply frame/stamp after body conversion based on profile.

### UI

Simple select in a small “Оформление” control (header menu or variables footer): preset picker that updates `style_profile` YAML text / structured merge.

---

## 4. SaaS prep (minimal)

### workspace

- Table `workspaces` (`id`, `name`, `created_at`)
- Column `projects.workspace_id` FK, NOT NULL after backfill
- Seed one workspace `"Local"`; all existing projects assigned to it
- `list_projects` / create already scoped by workspace; API default workspace from env `DEFAULT_WORKSPACE_ID` or the single local row
- No workspace UI required in this patch

### ArtifactStore

```python
class ArtifactStore(Protocol):
    def write(self, workspace_id: UUID, project_slug: str, filename: str, data: bytes) -> str: ...
    def path_for(self, workspace_id: UUID, project_slug: str, filename: str) -> Path: ...
```

- `LocalArtifactStore` under `out/{workspace_id}/{slug}/` (or keep `out/{slug}/` if single workspace — prefer workspace segment for future)
- Render/download go through the store
- Env `ARTIFACT_BACKEND=local` (only implementation now)

---

## Error handling

| Case | Behavior |
|------|----------|
| Undefined Jinja var | 400 preview/render with message |
| Missing case form | fallback nominative + warning in preview |
| Unknown frame preset | treat as `none` + warning |
| `eskd_2_2a` selected | use `stamp_compact` + warning until implemented |

## Testing

- API tests for preview success/error
- Unit tests for `case` filter and string/wrapped values
- Unit tests for frame preset `none` vs `frame_only` / `stamp_compact` smoke (docx opens)
- Migration test: projects get workspace_id

## Success criteria

User can edit ТЗ/ПЗ, see HTML preview, set cases on key fields, pick a frame preset, download DOCX — locally, no login — with workspace-scoped artifacts ready for future multi-tenant.
