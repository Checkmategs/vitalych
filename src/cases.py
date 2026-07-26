"""Grammatical cases for project field values (manual forms + Jinja filter)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

CASE_KEYS = ("gen", "dat", "acc", "ins", "pre")
_WRAP_KEYS = frozenset({"value", "cases"})


@dataclass
class CaseWarning:
    code: str
    message: str
    path: str = ""

    def as_dict(self) -> dict[str, str]:
        out = {"code": self.code, "message": self.message}
        if self.path:
            out["path"] = self.path
        return out


@dataclass
class CasedValue:
    """Jinja-printable nominative with optional case forms."""

    value: str
    cases: dict[str, str] = field(default_factory=dict)
    path: str = ""
    warnings: list[CaseWarning] | None = None

    def __str__(self) -> str:
        return self.value

    def __html__(self) -> str:
        return self.value

    def for_case(self, case_key: str) -> str:
        key = (case_key or "nom").strip().lower()
        if key in ("nom", "им", "im", ""):
            return self.value
        if key not in CASE_KEYS:
            return self.value
        form = (self.cases.get(key) or "").strip()
        if form:
            return form
        if self.warnings is not None:
            self.warnings.append(
                CaseWarning(
                    code="missing_case",
                    message=f"Нет формы «{key}», использован именительный",
                    path=self.path or self.value[:40],
                )
            )
        return self.value


def is_cased_dict(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    if "value" not in value or not isinstance(value.get("value"), str):
        return False
    return set(value.keys()) <= _WRAP_KEYS


def nominative(value: Any) -> str:
    if isinstance(value, CasedValue):
        return value.value
    if is_cased_dict(value):
        return value["value"]
    if value is None:
        return ""
    return str(value)


def apply_case(value: Any, case_key: str, warnings: list[CaseWarning] | None = None) -> str:
    key = (case_key or "nom").strip().lower()
    if isinstance(value, CasedValue):
        # temporarily attach warnings list if provided
        prev = value.warnings
        if warnings is not None:
            value.warnings = warnings
        try:
            return value.for_case(key)
        finally:
            value.warnings = prev

    if is_cased_dict(value):
        wrapped = CasedValue(
            value=value["value"],
            cases={
                str(k): str(v)
                for k, v in (value.get("cases") or {}).items()
                if isinstance(k, str) and isinstance(v, str)
            },
            warnings=warnings,
        )
        return wrapped.for_case(key)

    text = "" if value is None else str(value)
    if key in ("nom", "им", "im", ""):
        return text
    if key in CASE_KEYS and warnings is not None:
        warnings.append(
            CaseWarning(
                code="missing_case",
                message=f"Нет формы «{key}», использован именительный",
                path=text[:40],
            )
        )
    return text


def _wrap_node(value: Any, path: str, warnings: list[CaseWarning]) -> Any:
    if is_cased_dict(value):
        cases_raw = value.get("cases") or {}
        cases = {
            str(k): str(v)
            for k, v in cases_raw.items()
            if isinstance(k, str) and isinstance(v, str) and k in CASE_KEYS
        }
        return CasedValue(value=value["value"], cases=cases, path=path, warnings=warnings)
    if isinstance(value, dict):
        return {
            k: _wrap_node(v, f"{path}.{k}" if path else str(k), warnings)
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [_wrap_node(v, f"{path}[{i}]", warnings) for i, v in enumerate(value)]
    return value


def prepare_render_data(data: dict[str, Any]) -> tuple[dict[str, Any], list[CaseWarning]]:
    """Wrap cased dict leaves so {{ field }} prints nominative; collect warnings via filter."""
    warnings: list[CaseWarning] = []
    wrapped = _wrap_node(data, "", warnings)
    if not isinstance(wrapped, dict):
        return data, warnings
    return wrapped, warnings


def make_case_filter(warnings: list[CaseWarning]):
    def case_filter(value: Any, case_key: str = "gen") -> str:
        return apply_case(value, case_key, warnings)

    return case_filter
