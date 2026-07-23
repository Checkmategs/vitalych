"""CLI: YAML + Jinja2 templates → Markdown / DOCX (ТЗ / ПЗ)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader, StrictUndefined, TemplateNotFound, UndefinedError

from src.md_to_docx import markdown_to_docx
from src.style_profile import load_style_profile

TEMPLATE_MAP = {
    "tz": ("tz.md.j2", "tz"),
    "pz": ("pz.md.j2", "pz"),
}


def load_data(path: Path) -> dict:
    if not path.is_file():
        raise FileNotFoundError(f"Data file not found: {path}")
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"YAML root must be a mapping, got {type(data).__name__}")
    return data


def parse_formats(format_name: str) -> set[str]:
    if format_name == "both":
        return {"md", "docx"}
    if format_name in {"md", "docx"}:
        return {format_name}
    raise ValueError(f"Unknown format: {format_name}")


def render_document(
    template_key: str,
    data: dict,
    templates_dir: Path,
    out_dir: Path,
    formats: set[str] | None = None,
    style_profile: dict | None = None,
    style_profile_path: Path | None = None,
) -> list[Path]:
    if template_key not in TEMPLATE_MAP:
        raise ValueError(f"Unknown template: {template_key}")
    formats = formats or {"md", "docx"}
    j2_name, stem = TEMPLATE_MAP[template_key]
    j2_path = templates_dir / j2_name
    if not j2_path.is_file():
        raise FileNotFoundError(f"Template not found: {j2_path}")

    env = Environment(
        loader=FileSystemLoader(str(templates_dir)),
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    text = env.get_template(j2_name).render(**data)
    out_dir.mkdir(parents=True, exist_ok=True)

    written: list[Path] = []
    if "md" in formats:
        md_path = out_dir / f"{stem}.md"
        md_path.write_text(text, encoding="utf-8")
        written.append(md_path)
    if "docx" in formats:
        if style_profile is None:
            if style_profile_path is None:
                raise FileNotFoundError(
                    "DOCX requires a style profile; pass style_profile_path "
                    "(default: style-profile.yaml)"
                )
            style_profile = load_style_profile(style_profile_path)
        docx_path = out_dir / f"{stem}.docx"
        markdown_to_docx(text, docx_path, profile=style_profile)
        written.append(docx_path)
    return written


def selected_keys(template: str) -> list[str]:
    if template == "all":
        return ["tz", "pz"]
    return [template]


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="python -m src.render",
        description="Render GOST ТЗ / ПЗ from a shared project YAML (Markdown and/or DOCX).",
    )
    p.add_argument(
        "--template",
        choices=("tz", "pz", "all"),
        default="all",
        help="Which document(s) to render (default: all)",
    )
    p.add_argument(
        "--data",
        type=Path,
        required=True,
        help="Path to project YAML",
    )
    p.add_argument(
        "--out",
        type=Path,
        default=Path("out"),
        help="Output directory (default: out)",
    )
    p.add_argument(
        "--templates-dir",
        type=Path,
        default=Path("templates"),
        help="Templates directory (default: templates)",
    )
    p.add_argument(
        "--format",
        choices=("md", "docx", "both"),
        default="both",
        help="Output format (default: both)",
    )
    p.add_argument(
        "--style-profile",
        type=Path,
        default=Path("style-profile.yaml"),
        help="Path to DOCX style profile YAML (default: style-profile.yaml)",
    )
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        data = load_data(args.data)
        formats = parse_formats(args.format)
        profile = None
        if "docx" in formats:
            profile = load_style_profile(args.style_profile)
        written: list[Path] = []
        for key in selected_keys(args.template):
            written.extend(
                render_document(
                    key,
                    data,
                    args.templates_dir,
                    args.out,
                    formats,
                    style_profile=profile,
                    style_profile_path=args.style_profile,
                )
            )
        for path in written:
            print(path)
        return 0
    except (FileNotFoundError, ValueError, yaml.YAMLError, UndefinedError, TemplateNotFound, OSError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
