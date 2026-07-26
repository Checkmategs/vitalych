"""Grammatical cases for project field values (manual forms + Jinja filter)."""

from __future__ import annotations

from dataclasses import dataclass
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


class CasedValue(str):
    """Nominative string subclass so Jinja `is string` / fill() macros keep working."""

    __slots__ = ("cases", "path", "warnings")

    def __new__(
        cls,
        value: str,
        cases: dict[str, str] | None = None,
        path: str = "",
        warnings: list[CaseWarning] | None = None,
    ) -> CasedValue:
        obj = str.__new__(cls, value)
        obj.cases = cases or {}
        obj.path = path
        obj.warnings = warnings
        return obj

    @property
    def value(self) -> str:
        return str.__str__(self)

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
    if not set(value.keys()) <= _WRAP_KEYS:
        return False
    cases = value.get("cases")
    if cases is None:
        return True
    return isinstance(cases, dict)


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
        prev = value.warnings
        if warnings is not None:
            value.warnings = warnings
        try:
            return value.for_case(key)
        finally:
            value.warnings = prev

    if is_cased_dict(value):
        cases_raw = value.get("cases") or {}
        wrapped = CasedValue(
            value["value"],
            cases={
                str(k): str(v)
                for k, v in cases_raw.items()
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
        return CasedValue(value["value"], cases=cases, path=path, warnings=warnings)
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
