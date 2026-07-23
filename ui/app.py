"""Streamlit UI: заполнение общего project YAML и генерация ТЗ/ПЗ."""

from __future__ import annotations

import copy
import importlib
import sys
from pathlib import Path

import pandas as pd
import streamlit as st
import yaml

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import src.md_to_docx  # noqa: E402
import src.render  # noqa: E402
import src.style_profile  # noqa: E402

importlib.reload(src.style_profile)
importlib.reload(src.md_to_docx)
importlib.reload(src.render)
from src.render import load_data, render_document  # noqa: E402

DATA_DIR = ROOT / "data"
PROJECT_YAML = DATA_DIR / "project.yaml"
EXAMPLE_YAML = DATA_DIR / "project.example.yaml"
TEMPLATES_DIR = ROOT / "templates"
OUT_DIR = ROOT / "out"
STYLE_PROFILE = ROOT / "style-profile.yaml"

ABSENT_CODES = [
    "funding",
    "requirements",
    "works",
    "development",
    "acceptance",
    "prep",
    "docs",
    "sources",
]


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


def ensure_dict(data: dict, key: str) -> dict:
    if key not in data or not isinstance(data[key], dict):
        data[key] = {}
    return data[key]


def records_to_df(rows: list | None, columns: list[str]) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame(columns=columns)
    normalized = []
    for row in rows:
        if isinstance(row, dict):
            normalized.append({c: row.get(c, "") for c in columns})
        else:
            normalized.append({columns[0]: str(row), **{c: "" for c in columns[1:]}})
    return pd.DataFrame(normalized, columns=columns)


def df_to_records(df: pd.DataFrame, columns: list[str]) -> list[dict]:
    if df is None or df.empty:
        return []
    out: list[dict] = []
    for _, row in df.iterrows():
        rec = {c: ("" if pd.isna(row.get(c)) else str(row.get(c))) for c in columns}
        if any(v.strip() for v in rec.values()):
            out.append(rec)
    return out


def df_to_string_list(df: pd.DataFrame, column: str = "value") -> list[str]:
    if df is None or df.empty:
        return []
    values = []
    for _, row in df.iterrows():
        v = row.get(column, "")
        if pd.isna(v):
            continue
        s = str(v).strip()
        if s:
            values.append(s)
    return values


def text_field(label: str, value: str, *, area: bool = False, key: str) -> str:
    value = "" if value is None else str(value)
    if area:
        return st.text_area(label, value=value, key=key, height=120)
    return st.text_input(label, value=value, key=key)


def edit_mapping(prefix: str, mapping: dict, fields: list[tuple[str, str, bool]]) -> dict:
    """fields: (key, label, use_area)."""
    result = dict(mapping or {})
    for field_key, label, area in fields:
        result[field_key] = text_field(
            label,
            result.get(field_key, ""),
            area=area,
            key=f"{prefix}.{field_key}",
        )
    return result


st.set_page_config(page_title="Vitalych — переменные проекта", layout="wide")
st.title("Vitalych — заполнение переменных")
st.caption("Общий YAML для шаблонов ТЗ (ГОСТ 34.602) и ПЗ (ГОСТ Р 59795).")

if "data" not in st.session_state:
    st.session_state.data = load_data(default_data_path())
    st.session_state.source_path = str(default_data_path())

with st.sidebar:
    st.header("Файл")
    st.write(f"Источник: `{st.session_state.source_path}`")
    if st.button("Перезагрузить из example", use_container_width=True):
        st.session_state.data = load_data(EXAMPLE_YAML)
        st.session_state.source_path = str(EXAMPLE_YAML)
        st.rerun()
    if PROJECT_YAML.is_file() and st.button("Перезагрузить project.yaml", use_container_width=True):
        st.session_state.data = load_data(PROJECT_YAML)
        st.session_state.source_path = str(PROJECT_YAML)
        st.rerun()

    st.divider()
    if st.button("Сохранить в data/project.yaml", type="primary", use_container_width=True):
        save_yaml(PROJECT_YAML, st.session_state.data)
        st.session_state.source_path = str(PROJECT_YAML)
        st.success(f"Сохранено: {PROJECT_YAML}")

    if st.button("Сгенерировать ТЗ и ПЗ", use_container_width=True):
        try:
            save_yaml(PROJECT_YAML, st.session_state.data)
            data = copy.deepcopy(st.session_state.data)
            formats = {"md", "docx"}
            paths: list[str] = []
            for key in ("tz", "pz"):
                paths.extend(
                    str(p)
                    for p in render_document(
                        key,
                        data,
                        TEMPLATES_DIR,
                        OUT_DIR,
                        formats=formats,
                        style_profile_path=STYLE_PROFILE,
                    )
                )
            st.session_state.last_render = paths
            st.success("Сгенерировано (MD + DOCX):\n" + "\n".join(paths))
        except Exception as e:
            st.error(f"Ошибка рендера: {e}")

    preview_choice = st.radio("Превью", ["tz.md", "pz.md"], horizontal=True)
    st.caption("Также пишутся `out/tz.docx` и `out/pz.docx` по `style-profile.yaml`.")

data = st.session_state.data

# --- meta ---
with st.expander("meta — пустые разделы ТЗ", expanded=False):
    meta = ensure_dict(data, "meta")
    current = meta.get("absent_sections") or []
    meta["absent_sections"] = st.multiselect(
        "absent_sections",
        options=ABSENT_CODES,
        default=[c for c in current if c in ABSENT_CODES],
        key="meta.absent_sections",
    )

# --- system ---
with st.expander("system — система", expanded=True):
    data["system"] = edit_mapping(
        "system",
        ensure_dict(data, "system"),
        [
            ("name", "Полное наименование", False),
            ("short_name", "Условное обозначение", False),
            ("topic_code", "Шифр темы", False),
        ],
    )

# --- parties ---
with st.expander("parties — стороны", expanded=False):
    parties = ensure_dict(data, "parties")
    parties["customer"] = text_field("Заказчик", parties.get("customer", ""), key="parties.customer")
    parties["developer"] = text_field("Разработчик", parties.get("developer", ""), key="parties.developer")
    st.caption("Участники")
    pdf = records_to_df(parties.get("participants"), ["name", "role"])
    edited = st.data_editor(pdf, num_rows="dynamic", key="parties.participants", use_container_width=True)
    parties["participants"] = df_to_records(edited, ["name", "role"])
    data["parties"] = parties

# --- basis ---
with st.expander("basis — основания", expanded=False):
    basis = ensure_dict(data, "basis")
    bdf = records_to_df(basis.get("documents"), ["name", "number", "date", "approved_by"])
    edited = st.data_editor(bdf, num_rows="dynamic", key="basis.documents", use_container_width=True)
    basis["documents"] = df_to_records(edited, ["name", "number", "date", "approved_by"])
    data["basis"] = basis

# --- schedule ---
with st.expander("schedule — сроки", expanded=False):
    schedule = ensure_dict(data, "schedule")
    schedule["start"] = text_field("Начало", schedule.get("start", ""), key="schedule.start")
    schedule["end"] = text_field("Окончание", schedule.get("end", ""), key="schedule.end")
    sdf = records_to_df(schedule.get("stages"), ["name", "start", "end"])
    edited = st.data_editor(sdf, num_rows="dynamic", key="schedule.stages", use_container_width=True)
    schedule["stages"] = df_to_records(edited, ["name", "start", "end"])
    data["schedule"] = schedule

# --- funding ---
with st.expander("funding — финансирование", expanded=False):
    data["funding"] = text_field(
        "Финансирование",
        data.get("funding", ""),
        area=True,
        key="funding",
    )

# --- goals ---
with st.expander("goals — цели и назначение", expanded=False):
    goals = ensure_dict(data, "goals")
    goals["purpose"] = text_field("Назначение", goals.get("purpose", ""), area=True, key="goals.purpose")
    gdf = records_to_df(goals.get("objectives"), ["name", "target_value", "criterion"])
    edited = st.data_editor(gdf, num_rows="dynamic", key="goals.objectives", use_container_width=True)
    goals["objectives"] = df_to_records(edited, ["name", "target_value", "criterion"])
    data["goals"] = goals

# --- object ---
with st.expander("object — объект автоматизации", expanded=False):
    data["object"] = edit_mapping(
        "object",
        ensure_dict(data, "object"),
        [
            ("description", "Описание объекта", True),
            ("environment", "Условия эксплуатации / среда", True),
            ("processes", "Процессы деятельности", True),
        ],
    )

# --- requirements ---
with st.expander("requirements — требования к АС", expanded=False):
    req = ensure_dict(data, "requirements")
    req["structure"] = text_field("Структура АС", req.get("structure", ""), area=True, key="req.structure")
    fdf = records_to_df(req.get("functions"), ["name", "result"])
    edited = st.data_editor(fdf, num_rows="dynamic", key="req.functions", use_container_width=True)
    req["functions"] = df_to_records(edited, ["name", "result"])

    st.subheader("Виды обеспечения")
    support = ensure_dict(req, "support")
    support_fields = [
        ("mathematical", "Математическое"),
        ("information", "Информационное"),
        ("linguistic", "Лингвистическое"),
        ("software", "Программное"),
        ("technical", "Техническое"),
        ("metrological", "Метрологическое"),
        ("organizational", "Организационное"),
        ("methodological", "Методическое"),
        ("other", "Прочие"),
    ]
    for key, label in support_fields:
        support[key] = text_field(label, support.get(key, ""), area=True, key=f"req.support.{key}")
    req["support"] = support

    st.subheader("Общие технические требования")
    general = ensure_dict(req, "general")
    general_fields = [
        ("personnel", "Персонал"),
        ("purpose_metrics", "Показатели назначения"),
        ("reliability", "Надёжность"),
        ("safety", "Безопасность"),
        ("ergonomics", "Эргономика"),
        ("transportability", "Транспортабельность"),
        ("operation", "Эксплуатация / ТО"),
        ("unauthorized_access", "Защита от НСД"),
        ("information_safety", "Сохранность информации"),
        ("external_effects", "Внешние воздействия"),
        ("patent", "Патентная чистота"),
        ("standardization", "Стандартизация"),
        ("additional", "Дополнительно"),
    ]
    for key, label in general_fields:
        general[key] = text_field(label, general.get(key, ""), area=True, key=f"req.general.{key}")
    req["general"] = general
    data["requirements"] = req

# --- works ---
with st.expander("works — состав работ", expanded=False):
    works = ensure_dict(data, "works")
    wdf = records_to_df(works.get("stages"), ["name", "content", "due"])
    edited = st.data_editor(wdf, num_rows="dynamic", key="works.stages", use_container_width=True)
    works["stages"] = df_to_records(edited, ["name", "content", "due"])
    data["works"] = works

# --- development ---
with st.expander("development — порядок разработки", expanded=False):
    data["development"] = edit_mapping(
        "development",
        ensure_dict(data, "development"),
        [
            ("organization", "Организация работ", True),
            ("inputs_by_stage", "Исходные данные по этапам", True),
            ("expertise", "Экспертиза", True),
            ("prototypes", "Макеты / прототипы", True),
            ("joint_plan", "План совместных работ", True),
            ("standardization_program", "Программа стандартизации", True),
            ("warranties", "Гарантии", True),
            ("feasibility", "Оценка по ТЭО", True),
            ("special_programs", "Специальные программы", True),
        ],
    )

# --- acceptance ---
with st.expander("acceptance — контроль и приёмка", expanded=False):
    data["acceptance"] = edit_mapping(
        "acceptance",
        ensure_dict(data, "acceptance"),
        [
            ("tests", "Испытания", True),
            ("acceptance", "Приёмка", True),
            ("commission", "Приёмочная комиссия", True),
        ],
    )

# --- prep ---
with st.expander("prep — подготовка объекта", expanded=False):
    data["prep"] = edit_mapping(
        "prep",
        ensure_dict(data, "prep"),
        [
            ("information", "Подготовка информации", True),
            ("training", "Обучение персонала", True),
            ("org_staff", "Оргштатные меры", True),
            ("object_changes", "Изменение объекта", True),
            ("other", "Прочее", True),
        ],
    )

# --- docs ---
with st.expander("docs — документирование", expanded=False):
    data["docs"] = edit_mapping(
        "docs",
        ensure_dict(data, "docs"),
        [
            ("list", "Перечень документов", True),
            ("standards", "Стандарты оформления", True),
            ("additional", "Дополнительно", True),
        ],
    )

# --- sources ---
with st.expander("sources — источники разработки", expanded=False):
    sources = ensure_dict(data, "sources")
    entries = sources.get("entries") or []
    edf = pd.DataFrame({"value": entries}) if entries else pd.DataFrame(columns=["value"])
    edited = st.data_editor(edf, num_rows="dynamic", key="sources.entries", use_container_width=True)
    sources["entries"] = df_to_string_list(edited, "value")
    data["sources"] = sources

# --- pz ---
with st.expander("pz — поля пояснительной записки", expanded=False):
    data["pz"] = edit_mapping(
        "pz",
        ensure_dict(data, "pz"),
        [
            ("safety_compliance", "Соответствие нормам безопасности", True),
            ("normative_docs", "Нормативно-технические документы", True),
            ("research_and_inventions", "НИР / изобретения", True),
            ("queues", "Очередность создания АС", True),
            ("work_organization", "Организация работ при функционировании", True),
            ("quality_vs_tz", "Обеспечение характеристик относительно ТЗ", True),
            ("illustrations_note", "Иллюстрации смежных документов", True),
        ],
    )

st.session_state.data = data

st.divider()
st.subheader("Превью сгенерированного документа")
preview_path = OUT_DIR / preview_choice
if preview_path.is_file():
    lines = preview_path.read_text(encoding="utf-8").splitlines()
    preview = "\n".join(lines[:80])
    if len(lines) > 80:
        preview += "\n\n… (обрезано)"
    st.code(preview, language="markdown")
else:
    st.info(f"Файл `{preview_path}` ещё не создан. Нажмите «Сгенерировать ТЗ и ПЗ».")

if "last_render" in st.session_state:
    st.caption("Последняя генерация: " + ", ".join(st.session_state.last_render))
