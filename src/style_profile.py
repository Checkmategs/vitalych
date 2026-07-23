"""Load and helpers for style-profile.yaml."""

from __future__ import annotations

from pathlib import Path

import yaml
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt, RGBColor, Twips


ALIGN_MAP = {
    "left": WD_ALIGN_PARAGRAPH.LEFT,
    "center": WD_ALIGN_PARAGRAPH.CENTER,
    "right": WD_ALIGN_PARAGRAPH.RIGHT,
    "justify": WD_ALIGN_PARAGRAPH.JUSTIFY,
}


def load_style_profile(path: Path) -> dict:
    if not path.is_file():
        raise FileNotFoundError(f"Style profile not found: {path}")
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"Style profile root must be a mapping, got {type(data).__name__}")
    return data


def cm(value: float | int | None) -> Cm | None:
    if value is None:
        return None
    return Cm(float(value))


def pt(value: float | int | None) -> Pt | None:
    if value is None:
        return None
    return Pt(float(value))


def hex_to_rgb(color: str) -> RGBColor:
    c = color.strip().lstrip("#")
    if len(c) != 6:
        raise ValueError(f"Invalid hex color: {color}")
    return RGBColor(int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16))


def alignment(name: str | None):
    if not name:
        return None
    key = str(name).lower()
    if key not in ALIGN_MAP:
        raise ValueError(f"Unknown alignment: {name}")
    return ALIGN_MAP[key]


def cm_to_twips(value_cm: float) -> Twips:
    # 1 inch = 1440 twips; 1 inch = 2.54 cm
    return Twips(int(round(float(value_cm) / 2.54 * 1440)))
