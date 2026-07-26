"""Jinja → Markdown → HTML preview for ТЗ / ПЗ."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import markdown
import yaml
from jinja2 import DictLoader, Environment, StrictUndefined, TemplateNotFound, UndefinedError

from src.cases import CaseWarning, make_case_filter, prepare_render_data
from src.render import TEMPLATE_MAP

_MD_EXTENSIONS = ["tables", "fenced_code", "sane_lists", "nl2br"]


@dataclass
class PreviewResult:
    markdown: str
    html: str
    warnings: list[dict[str, str]]
    frame_preset: str = "none"

    def as_dict(self) -> dict[str, Any]:
        return {
            "markdown": self.markdown,
            "html": self.html,
            "warnings": self.warnings,
            "frame_preset": self.frame_preset,
        }


def _frame_preset_from_style(style_profile_text: str | None) -> str:
    if not style_profile_text or not style_profile_text.strip():
        return "none"
    try:
        profile = yaml.safe_load(style_profile_text)
    except yaml.YAMLError:
        return "none"
    if not isinstance(profile, dict):
        return "none"
    frame = profile.get("frame") or {}
    if not isinstance(frame, dict):
        return "none"
    preset = frame.get("preset") or "none"
    return str(preset).strip() or "none"


def _render_with_warnings(
    template_key: str,
    data: dict[str, Any],
    template_tz: str,
    template_pz: str,
) -> tuple[str, list[CaseWarning]]:
    if template_key not in TEMPLATE_MAP:
        raise ValueError(f"Unknown template: {template_key}")
    j2_name, _stem = TEMPLATE_MAP[template_key]
    wrapped, warnings = prepare_render_data(data)
    env = Environment(
        loader=DictLoader({"tz.md.j2": template_tz, "pz.md.j2": template_pz}),
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.filters["case"] = make_case_filter(warnings)
    text = env.get_template(j2_name).render(**wrapped)
    return text, warnings


def markdown_to_html(md_text: str, frame_preset: str = "none") -> str:
    body = markdown.markdown(md_text, extensions=_MD_EXTENSIONS)
    preset = (
        frame_preset
        if frame_preset in {"none", "frame_only", "stamp_compact", "eskd_2_2a"}
        else "none"
    )
    css_class = f"preview-doc preview-frame--{preset}"
    return f'<div class="{css_class}">{body}</div>'


def preview_document(
    template_key: str,
    data: dict[str, Any],
    template_tz: str,
    template_pz: str,
    style_profile_text: str | None = None,
) -> PreviewResult:
    md_text, warnings = _render_with_warnings(
        template_key, data, template_tz, template_pz
    )
    frame_preset = _frame_preset_from_style(style_profile_text)
    if frame_preset == "eskd_2_2a":
        warnings.append(
            CaseWarning(
                code="frame_fallback",
                message="Пресет eskd_2_2a пока использует stamp_compact",
                path="frame.preset",
            )
        )
        frame_preset = "stamp_compact"
    html = markdown_to_html(md_text, frame_preset)
    seen: set[tuple[str, str, str]] = set()
    warning_dicts: list[dict[str, str]] = []
    for w in warnings:
        key = (w.code, w.path, w.message)
        if key in seen:
            continue
        seen.add(key)
        warning_dicts.append(w.as_dict())
    return PreviewResult(
        markdown=md_text,
        html=html,
        warnings=warning_dicts,
        frame_preset=frame_preset,
    )


__all__ = [
    "PreviewResult",
    "preview_document",
    "markdown_to_html",
    "TemplateNotFound",
    "UndefinedError",
]
