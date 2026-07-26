"""Unit tests for grammatical cases helpers."""

from __future__ import annotations

import unittest

from src.cases import apply_case, nominative, prepare_render_data


class CasesTest(unittest.TestCase):
    def test_bare_string_case_falls_back(self) -> None:
        self.assertEqual(apply_case("ООО Ромашка", "gen"), "ООО Ромашка")

    def test_wrapped_value_gen(self) -> None:
        wrapped = {"value": "ООО Ромашка", "cases": {"gen": "ООО Ромашки"}}
        self.assertEqual(apply_case(wrapped, "gen"), "ООО Ромашки")
        self.assertEqual(apply_case(wrapped, "nom"), "ООО Ромашка")
        self.assertEqual(nominative(wrapped), "ООО Ромашка")

    def test_prepare_render_data_wraps_leaves(self) -> None:
        data = {
            "parties": {
                "customer": {
                    "value": "ООО Ромашка",
                    "cases": {"gen": "ООО Ромашки", "dat": "ООО Ромашке"},
                }
            }
        }
        wrapped, _warnings = prepare_render_data(data)
        customer = wrapped["parties"]["customer"]
        self.assertEqual(str(customer), "ООО Ромашка")
        self.assertEqual(customer.for_case("gen"), "ООО Ромашки")
        self.assertEqual(customer.for_case("dat"), "ООО Ромашке")

    def test_missing_case_emits_warning(self) -> None:
        warnings: list = []
        apply_case({"value": "Система", "cases": {}}, "gen", warnings)
        self.assertEqual(len(warnings), 1)
        self.assertEqual(warnings[0].code, "missing_case")


if __name__ == "__main__":
    unittest.main()
